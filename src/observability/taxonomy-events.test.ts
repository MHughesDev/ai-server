/**
 * SPEC 18 taxonomy emissions from non-pipeline code paths.
 */

import { describe, it, expect, afterEach } from "@jest/globals";
import type { TelemetryEvent } from "./events.js";
import { createEmitter } from "./emitter.js";
import { setObservability } from "./types.js";
import { createContext, getTraceContext, runWithContextAsync } from "./context.js";
import {
  emitMemoryQueryEvent,
  emitMemoryWriteEvent,
  emitVerifyResultEvent,
} from "./taxonomy-events.js";

describe("taxonomy-events", () => {
  afterEach(() => setObservability(null));

  it("emits VERIFY_RESULT with trace context when observability is configured", async () => {
    const captured: TelemetryEvent[] = [];
    const emitter = createEmitter({ capture: captured });
    setObservability({ events: emitter, getContext: () => getTraceContext() });

    await runWithContextAsync(createContext("req-verify", "tr-verify"), async () => {
      emitVerifyResultEvent({ passed: true, score: 0.85 });
    });

    expect(captured).toHaveLength(1);
    expect(captured[0]?.event_type).toBe("VERIFY_RESULT");
    expect(captured[0]?.request_id).toBe("req-verify");
    expect(captured[0]?.trace_id).toBe("tr-verify");
    expect((captured[0]?.payload as { passed?: boolean })?.passed).toBe(true);
  });

  it("emits MEMORY_WRITE for ingest-shaped payloads", async () => {
    const captured: TelemetryEvent[] = [];
    setObservability({
      events: createEmitter({ capture: captured }),
      getContext: () => getTraceContext(),
    });

    await runWithContextAsync(createContext("req-mw", "tr-mw"), async () => {
      emitMemoryWriteEvent({
        document_id: "doc1",
        scope: "org",
        chunks_written: 2,
        store: "in_memory",
      });
    });

    expect(captured[0]?.event_type).toBe("MEMORY_WRITE");
    expect((captured[0]?.payload as { document_id?: string })?.document_id).toBe("doc1");
  });

  it("emits MEMORY_QUERY with payload fields", async () => {
    const captured: TelemetryEvent[] = [];
    setObservability({
      events: createEmitter({ capture: captured }),
      getContext: () => getTraceContext(),
    });

    await runWithContextAsync(createContext("req-memq", "tr-memq"), async () => {
      emitMemoryQueryEvent({ hit_count: 2, latency_ms: 12, scope: "user", degraded: false });
    });

    expect(captured[0]?.event_type).toBe("MEMORY_QUERY");
    const p = captured[0]?.payload as Record<string, unknown>;
    expect(p.hit_count).toBe(2);
    expect(p.latency_ms).toBe(12);
    expect(p.scope).toBe("user");
    expect(p.degraded).toBe(false);
  });
});
