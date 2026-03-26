/**
 * Memory engine – unit tests (EngineInvocation → EngineResult; Memory Gateway only).
 * @see SOW M4 Segment H.2
 */

import { createMemoryEngine } from "./memory_engine.js";
import type { EngineInvocation } from "../contracts/index.js";
import { validateEngineResult } from "../contracts/index.js";
import { InMemoryStore } from "../memory/in-memory-store.js";

function minimalInvocation(overrides: Partial<EngineInvocation> = {}): EngineInvocation {
  return {
    invocation_id: "inv-mem-1",
    engine_type: "memory",
    task: {
      task_id: "t1",
      task_type: "retrieve",
      category: "retrieval",
      objective: {
        formal_spec: {
          operation: "retrieve",
          query_text: "test query",
          scope: "user",
          top_k: 5,
        },
      },
    },
    context_artifacts: [],
    actor_context: {
      org_id: "org1",
      app_id: "app1",
      user_id: "user1",
    },
    ...overrides,
  };
}

describe("Memory Engine", () => {
  it("implements IEngine and returns success with memory_response artifact when store returns hits", async () => {
    const store = new InMemoryStore();
    await store.ingest({
      document_id: "doc1",
      text: "This is test content about the test query.",
      scope: "user",
      scope_keys: { user_id: "user1", org_id: "org1" },
      source_label: "doc1.txt",
    });

    const engine = createMemoryEngine(store);
    const inv = minimalInvocation();
    const result = await engine.invoke(inv);

    expect(result.invocation_id).toBe("inv-mem-1");
    expect(result.status).toBe("success");
    expect(result.result_artifacts).toHaveLength(1);
    expect(result.result_artifacts[0].artifact_kind).toBe("memory_response");
    expect(result.result_artifacts[0].schema_ref).toBe("schema://memory_response@v1");

    const inline = result.result_artifacts[0].content as { inline?: Record<string, unknown> };
    expect(inline?.inline).toBeDefined();
    expect((inline?.inline?.citations as unknown[])?.length).toBeGreaterThanOrEqual(0);
    expect(typeof (inline?.inline?.contextText as string)).toBe("string");
    expect(typeof (inline?.inline?.retrieved_artifacts as number)).toBe("number");
    expect(result.metrics?.duration_ms).toBeGreaterThanOrEqual(0);

    validateEngineResult(result);
  });

  it("returns success with empty context when scope is none", async () => {
    const store = new InMemoryStore();
    const engine = createMemoryEngine(store);
    const inv = minimalInvocation({
      task: {
        task_id: "t1",
        task_type: "retrieve",
        category: "retrieval",
        objective: { formal_spec: { operation: "retrieve", scope: "none" } },
      },
    });

    const result = await engine.invoke(inv);
    expect(result.status).toBe("success");
    expect(result.result_artifacts).toHaveLength(1);
    expect(result.result_artifacts[0].artifact_kind).toBe("memory_response");
    const inline = result.result_artifacts[0].content as { inline?: { contextText?: string } };
    expect(inline?.inline?.contextText).toBe("");
    validateEngineResult(result);
  });

  it("returns blocked for unsupported operation write", async () => {
    const store = new InMemoryStore();
    const engine = createMemoryEngine(store);
    const inv = minimalInvocation({
      task: {
        task_id: "t1",
        task_type: "write",
        category: "retrieval",
        objective: { formal_spec: { operation: "write", query_text: "x" } },
      },
    });

    const result = await engine.invoke(inv);
    expect(result.status).toBe("blocked");
    expect(result.error?.code).toBe("MEMORY_OPERATION_UNSUPPORTED");
    expect(result.error?.detail).toMatchObject({ operation: "write" });
    validateEngineResult(result);
  });

  it("returns degraded success when store throws", async () => {
    const brokenStore: import("../memory/memory-abstraction.js").IMemoryStore = {
      retrieve: async () => {
        await Promise.resolve();
        throw new Error("store broken");
      },
    };

    const engine = createMemoryEngine(brokenStore);
    const inv = minimalInvocation();
    const result = await engine.invoke(inv);

    expect(result.status).toBe("success");
    expect(result.error).toBeUndefined();
    expect(result.result_artifacts).toHaveLength(1);
    expect(result.result_artifacts[0].artifact_kind).toBe("memory_response");
    const inline = result.result_artifacts[0].content as { inline?: { degraded?: boolean } };
    expect(inline?.inline?.degraded).toBe(true);
    validateEngineResult(result);
  });

  it("honors max_context_tokens in formal_spec (bounded context via runRetrieval)", async () => {
    const store = new InMemoryStore();
    const longText = "word ".repeat(2000);
    await store.ingest({
      document_id: "long-doc",
      text: longText,
      scope: "user",
      scope_keys: { user_id: "user1", org_id: "org1" },
      source_label: "long.txt",
    });

    const engine = createMemoryEngine(store);
    const inv = minimalInvocation({
      task: {
        task_id: "t1",
        task_type: "retrieve",
        category: "retrieval",
        objective: {
          formal_spec: {
            operation: "retrieve",
            query_text: "word",
            scope: "user",
            top_k: 5,
            max_context_tokens: 12,
          },
        },
      },
    });

    const result = await engine.invoke(inv);
    expect(result.status).toBe("success");
    const inline = result.result_artifacts[0].content as { inline?: { contextText?: string } };
    const text = inline?.inline?.contextText ?? "";
    expect(text.length).toBeLessThan(longText.length);
    expect(text.length).toBeGreaterThan(0);
    validateEngineResult(result);
  });

  it("maps actor_context to caller for scoped retrieval", async () => {
    const store = new InMemoryStore();
    await store.ingest({
      document_id: "doc2",
      text: "User-specific content for user2.",
      scope: "user",
      scope_keys: { user_id: "user2", org_id: "org1" },
    });

    const engine = createMemoryEngine(store);
    const inv = minimalInvocation({
      actor_context: { org_id: "org1", app_id: "app1", user_id: "user2" },
      task: {
        task_id: "t1",
        task_type: "retrieve",
        category: "retrieval",
        objective: {
          formal_spec: {
            operation: "retrieve",
            query_text: "User-specific",
            scope: "user",
            top_k: 5,
          },
        },
      },
    });

    const result = await engine.invoke(inv);
    expect(result.status).toBe("success");
    const inline = result.result_artifacts[0].content as { inline?: { contextText?: string; citations?: unknown[] } };
    expect((inline?.inline?.contextText as string) ?? "").toContain("User-specific");
    expect((inline?.inline?.citations as unknown[])?.length ?? 0).toBeGreaterThanOrEqual(0);
    validateEngineResult(result);
  });
});
