/**
 * Retrieval service tests – L2-06 (runRetrieval, scope keys, context + citations)
 */

import { afterEach, describe, expect, it } from "@jest/globals";
import { runRetrieval, scopeKeysFromCaller } from "./retrieval-service.js";
import { InMemoryStore } from "./in-memory-store.js";
import type { IMemoryStore } from "./memory-abstraction.js";
import { createContext, getTraceContext, runWithContextAsync } from "../observability/context.js";
import { createEmitter } from "../observability/emitter.js";
import type { TelemetryEvent } from "../observability/events.js";
import { setObservability } from "../observability/types.js";

describe("scopeKeysFromCaller", () => {
  it("maps caller to scope_keys", () => {
    const keys = scopeKeysFromCaller("org", {
      user_id: "u1",
      app_id: "a1",
      org_id: "o1",
    });
    expect(keys.org_id).toBe("o1");
    expect(keys.user_id).toBe("u1");
    expect(keys.app_id).toBe("a1");
  });
});

describe("runRetrieval", () => {
  afterEach(() => {
    setObservability(null);
  });

  it("returns contextText and citations from store hits", async () => {
    const store = new InMemoryStore();
    await store.ingest({
      document_id: "doc1",
      text: "Alpha beta gamma. Delta epsilon.",
      scope: "org",
      scope_keys: { org_id: "o1" },
      source_label: "notes.txt",
    });
    const out = await runRetrieval(store, {
      query_text: "alpha beta",
      scope: "org",
      caller: { org_id: "o1", user_id: "u1" },
      top_k: 5,
    });
    expect(out.result.degraded).toBeFalsy();
    expect(out.result.hits.length).toBeGreaterThanOrEqual(1);
    expect(out.contextText).toContain("Alpha");
    expect(out.citations.length).toBeGreaterThanOrEqual(1);
    expect(out.citations[0].source).toBe("notes.txt");
  });

  it("returns empty context and citations when store returns degraded", async () => {
    const store = new InMemoryStore();
    store.setAvailable(false);
    const out = await runRetrieval(store, {
      query_text: "anything",
      scope: "org",
      caller: { org_id: "o1" },
    });
    expect(out.result.degraded).toBe(true);
    expect(out.contextText).toBe("");
    expect(out.citations).toEqual([]);
  });

  it("emits MEMORY_QUERY with degraded=true when store is unavailable", async () => {
    const captured: TelemetryEvent[] = [];
    setObservability({
      events: createEmitter({ capture: captured }),
      getContext: () => getTraceContext(),
    });
    const store = new InMemoryStore();
    store.setAvailable(false);
    await runWithContextAsync(createContext("req-mq", "tr-mq"), async () => {
      await runRetrieval(store, {
        query_text: "anything",
        scope: "org",
        caller: { org_id: "o1" },
      });
    });
    const mq = captured.filter((e) => e.event_type === "MEMORY_QUERY");
    expect(mq).toHaveLength(1);
    const p = mq[0]?.payload as { degraded?: boolean; hit_count?: number; scope?: string };
    expect(p.degraded).toBe(true);
    expect(p.hit_count).toBe(0);
    expect(p.scope).toBe("org");
  });

  it("times out retrieval and returns deterministic degraded fallback", async () => {
    const slowStore: IMemoryStore = {
      async retrieve() {
        await new Promise((resolve) => setTimeout(resolve, 50));
        return { hits: [] };
      },
    };
    const out = await runRetrieval(slowStore, {
      query_text: "anything",
      scope: "org",
      caller: { org_id: "o1" },
      retrieval_timeout_ms: 5,
    });
    expect(out.result.degraded).toBe(true);
    expect(out.result.hits).toEqual([]);
    expect(out.contextText).toBe("");
    expect(out.citations).toEqual([]);
  });

  it("truncates contextText to configured max_context_chars", async () => {
    const store = new InMemoryStore();
    await store.ingest({
      document_id: "doc1",
      text: "alpha ".repeat(300),
      scope: "org",
      scope_keys: { org_id: "o1" },
      source_label: "long.txt",
    });
    const out = await runRetrieval(store, {
      query_text: "alpha",
      scope: "org",
      caller: { org_id: "o1" },
      top_k: 5,
      max_context_chars: 120,
    });
    expect(out.contextText.length).toBeLessThanOrEqual(120);
    expect(out.contextText.length).toBeGreaterThan(0);
  });
});
