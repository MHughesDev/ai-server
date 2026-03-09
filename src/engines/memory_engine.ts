/**
 * Memory Engine – scoped retrieval (and optional write/delete) via Memory Gateway only.
 * @see Architecture §10.5; SOW M4 Segment H
 * Rule: No file under src/engines/ may import another under src/engines/.
 */

import type { IEngine } from "./base.js";
import type {
  EngineInvocation,
  EngineResult,
  TypedArtifact,
} from "../contracts/index.js";
import type { IMemoryStore } from "../memory/memory-abstraction.js";
import type { RetrievalScope } from "../memory/types.js";
import { runRetrieval } from "../memory/retrieval-service.js";
import { getObservability } from "../observability/index.js";
import { getTraceContext } from "../observability/context.js";
import { randomUUID } from "node:crypto";

const SCHEMA_REF_MEMORY_RESPONSE = "schema://memory_response@v1";

const VALID_SCOPES: RetrievalScope[] = ["user", "project", "org", "none"];

function toCallerContext(
  inv: EngineInvocation
): { user_id?: string; app_id?: string; org_id?: string; project_id?: string } {
  const ac = inv.actor_context;
  if (!ac) return {};
  return {
    org_id: ac.org_id,
    app_id: ac.app_id,
    user_id: ac.user_id,
  };
}

function parseScope(s: unknown): RetrievalScope {
  if (typeof s === "string" && (VALID_SCOPES as readonly string[]).includes(s)) {
    return s as RetrievalScope;
  }
  return "user";
}

/**
 * Create Memory Engine that calls the Memory Gateway (IMemoryStore) only.
 * Supports operation "retrieve". "write" and "delete" return blocked for now.
 */
export function createMemoryEngine(store: IMemoryStore): IEngine {
  return {
    async invoke(inv: EngineInvocation): Promise<EngineResult> {
      const start = Date.now();
      const obs = getObservability();
      const ctx = getTraceContext();

      const formalSpec = inv.task.objective?.formal_spec;
      const operation = (formalSpec?.operation as string) ?? "retrieve";
      const queryText = (formalSpec?.query_text as string) ?? (formalSpec?.query as string) ?? "";
      const scope = parseScope(formalSpec?.scope ?? "user");
      const topK = typeof formalSpec?.top_k === "number" ? formalSpec.top_k : 5;

      if (operation !== "retrieve") {
        const durationMs = Date.now() - start;
        return {
          invocation_id: inv.invocation_id,
          status: "blocked",
          result_artifacts: [],
          error: {
            code: "MEMORY_OPERATION_UNSUPPORTED",
            message: `Memory engine only supports operation "retrieve" in this release`,
            detail: { operation },
          },
          metrics: { duration_ms: durationMs },
        };
      }

      if (scope === "none") {
        const durationMs = Date.now() - start;
        return {
          invocation_id: inv.invocation_id,
          status: "success",
          result_artifacts: [
            buildMemoryResponseArtifact([], [], "", false, 0),
          ],
          metrics: { duration_ms: durationMs },
        };
      }

      if (obs?.events) {
        obs.events.emit({
          event_type: "ENGINE_START",
          request_id: ctx?.request_id ?? "unknown",
          trace_id: ctx?.trace_id,
          timestamp_iso: new Date().toISOString(),
          redaction_level: "minimal",
          payload: { engine_type: "memory", invocation_id: inv.invocation_id },
        });
      }

      const caller = toCallerContext(inv);
      let retrievalResult: Awaited<ReturnType<typeof runRetrieval>>;
      try {
        retrievalResult = await runRetrieval(store, {
          query_text: queryText,
          scope,
          caller,
          top_k: topK,
        });
      } catch (err) {
        const durationMs = Date.now() - start;
        if (obs?.events) {
          obs.events.emit({
            event_type: "ENGINE_END",
            request_id: ctx?.request_id ?? "unknown",
            trace_id: ctx?.trace_id,
            timestamp_iso: new Date().toISOString(),
            redaction_level: "minimal",
            payload: {
              engine_type: "memory",
              invocation_id: inv.invocation_id,
              duration_ms: durationMs,
            },
          });
          obs.events.emit({
            event_type: "MEMORY_QUERY",
            request_id: ctx?.request_id ?? "unknown",
            trace_id: ctx?.trace_id,
            timestamp_iso: new Date().toISOString(),
            redaction_level: "minimal",
            payload: { hit_count: 0, scope, error: err instanceof Error ? err.message : String(err) },
          });
        }
        return {
          invocation_id: inv.invocation_id,
          status: "fail",
          result_artifacts: [
            buildMemoryResponseArtifact([], [], "", true, durationMs),
          ],
          error: {
            code: "RETRIEVAL_FAILED",
            message: err instanceof Error ? err.message : String(err),
          },
          metrics: { duration_ms: durationMs },
        };
      }

      const durationMs = Date.now() - start;
      const latencyMs = retrievalResult.result.latency_ms ?? durationMs;

      if (obs?.events) {
        obs.events.emit({
          event_type: "ENGINE_END",
          request_id: ctx?.request_id ?? "unknown",
          trace_id: ctx?.trace_id,
          timestamp_iso: new Date().toISOString(),
          redaction_level: "minimal",
          payload: {
            engine_type: "memory",
            invocation_id: inv.invocation_id,
            duration_ms: durationMs,
          },
        });
        obs.events.emit({
          event_type: "MEMORY_QUERY",
          request_id: ctx?.request_id ?? "unknown",
          trace_id: ctx?.trace_id,
          timestamp_iso: new Date().toISOString(),
          redaction_level: "minimal",
          payload: {
            hit_count: retrievalResult.result.hits.length,
            latency_ms: latencyMs,
            scope,
            degraded: retrievalResult.result.degraded,
          },
        });
      }

      const artifact = buildMemoryResponseArtifact(
        retrievalResult.citations,
        retrievalResult.result.hits.map((h) => h.chunk.text),
        retrievalResult.contextText,
        retrievalResult.result.degraded ?? false,
        latencyMs
      );

      return {
        invocation_id: inv.invocation_id,
        status: "success",
        result_artifacts: [artifact],
        metrics: { duration_ms: durationMs },
      };
    },
  };
}

function buildMemoryResponseArtifact(
  citations: Array<{ source: string; ref: string; span?: string }>,
  chunkTexts: string[],
  contextText: string,
  degraded: boolean,
  latencyMs: number
): TypedArtifact {
  return {
    artifact_id: randomUUID(),
    artifact_kind: "memory_response",
    schema_ref: SCHEMA_REF_MEMORY_RESPONSE,
    encoding: "json",
    content: {
      inline: {
        retrieved_artifacts: chunkTexts.length,
        citations,
        contextText,
        degraded,
        latency_ms: latencyMs,
      },
    },
  };
}
