/**
 * Redis vector backend — retention pruning (WANT-035) with injected client (no ioredis).
 */

import { RedisVectorBackend, type RedisClient } from "./redis-vector-backend.js";

function createMockStore(): {
  store: Map<string, Record<string, string>>;
  client: RedisClient;
} {
  const store = new Map<string, Record<string, string>>();
  const client: RedisClient = {
    connect() {
      return Promise.resolve();
    },
    disconnect() {
      return Promise.resolve();
    },
    ping() {
      return Promise.resolve("PONG");
    },
    hset(key, field, value) {
      const row = store.get(key) ?? {};
      row[field] = value;
      store.set(key, row);
      return Promise.resolve(1);
    },
    hgetall(key) {
      return Promise.resolve({ ...(store.get(key) ?? {}) });
    },
    hdel() {
      return Promise.resolve(0);
    },
    keys(pattern) {
      const star = pattern.endsWith("*") ? pattern.slice(0, -1) : pattern;
      return Promise.resolve([...store.keys()].filter((k) => k.startsWith(star)));
    },
    del(key, ...rest) {
      const all = [key, ...rest];
      let n = 0;
      for (const k of all) {
        if (store.delete(k)) n += 1;
      }
      return Promise.resolve(n);
    },
    expire() {
      return Promise.resolve(1);
    },
    quit() {
      return Promise.resolve();
    },
  };
  return { store, client };
}

describe("RedisVectorBackend pruneRetention (WANT-035)", () => {
  const prefix = "ai:vec:t:";

  it("removes keys older than ttl_seconds", async () => {
    const { store, client } = createMockStore();
    const oldIso = new Date(Date.now() - 3_600_000 * 48).toISOString();
    const key = `${prefix}a`;
    store.set(key, {
      embedding: "[0,1]",
      text: "old",
      scope: "org",
      scope_keys: JSON.stringify({ org_id: "o1" }),
      document_id: "d1",
      position: "0",
      created_at: oldIso,
    });

    const backend = new RedisVectorBackend({
      url: "redis://noop",
      keyPrefix: prefix,
      testClient: client,
    });
    await backend.pruneRetention({ ttl_seconds: 3600 });
    expect(store.has(key)).toBe(false);
  });

  it("enforces max_chunks_per_scope (keeps newest by created_at)", async () => {
    const { store, client } = createMockStore();
    const t1 = new Date(Date.now() - 10_000).toISOString();
    const t2 = new Date(Date.now() - 5_000).toISOString();
    const k1 = `${prefix}u1`;
    const k2 = `${prefix}u2`;
    const row = {
      embedding: "[1,0]",
      text: "x",
      scope: "org",
      scope_keys: JSON.stringify({ org_id: "o1" }),
      document_id: "d",
      position: "0",
    };
    store.set(k1, { ...row, created_at: t1 });
    store.set(k2, { ...row, created_at: t2 });

    const backend = new RedisVectorBackend({
      url: "redis://noop",
      keyPrefix: prefix,
      testClient: client,
    });
    await backend.pruneRetention({ max_chunks_per_scope: 1 });
    expect(store.has(k1)).toBe(false);
    expect(store.has(k2)).toBe(true);
  });
});
