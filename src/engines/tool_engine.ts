/**
 * Tool Engine – executes tool calls via Tool Gateway only; no model or other engine.
 * @see Architecture §10.4; SOW M3 F.1
 * Rule: No file under src/engines/ may import another under src/engines/.
 */

import type { IEngine } from "./base.js";
import type {
  EngineInvocation,
  EngineResult,
  TypedArtifact,
} from "../contracts/index.js";
import type { IToolGateway } from "../gateways/types.js";
import { randomUUID } from "node:crypto";

const SCHEMA_REF_TOOL_RESULT = "schema://tool_result@v1";

function isAllowed(
  r: { allowed: boolean }
): r is { allowed: true; tool_id: string; result?: unknown; duration_ms?: number } {
  return r.allowed === true;
}

export interface CreateToolEngineOptions {
  /** When set, only these tool_ids may be invoked; otherwise all are passed to gateway. */
  allowlist?: string[];
}

/**
 * Create Tool Engine that calls the Tool Gateway only.
 * Uses task.objective.formal_spec for { tool_id, parameters } when present.
 */
export function createToolEngine(
  gateway: IToolGateway,
  options: CreateToolEngineOptions = {}
): IEngine {
  const { allowlist } = options;

  return {
    async invoke(inv: EngineInvocation): Promise<EngineResult> {
      const start = Date.now();
      const formalSpec = inv.task.objective?.formal_spec;
      const toolId = (formalSpec?.tool_id as string) ?? undefined;
      const params =
        (formalSpec?.parameters as Record<string, unknown>) ??
        (formalSpec?.params as Record<string, unknown>);

      if (!toolId || typeof toolId !== "string") {
        const durationMs = Date.now() - start;
        return {
          invocation_id: inv.invocation_id,
          status: "fail",
          result_artifacts: [],
          error: {
            code: "TOOL_INVOCATION_INVALID",
            message: "Missing tool_id in task objective",
          },
          metrics: { duration_ms: durationMs },
        };
      }

      if (allowlist != null && allowlist.length > 0 && !allowlist.includes(toolId)) {
        const durationMs = Date.now() - start;
        return {
          invocation_id: inv.invocation_id,
          status: "blocked",
          result_artifacts: [],
          error: {
            code: "TOOL_NOT_ALLOWED",
            message: `Tool ${toolId} is not in the allowlist`,
            detail: { tool_id: toolId, allowlist },
          },
          metrics: { duration_ms: durationMs },
        };
      }

      const gwResult = await gateway.invoke({
        tool_id: toolId,
        params: params ?? undefined,
        caller_identity: inv.actor_context
          ? {
              org_id: inv.actor_context.org_id,
              app_id: inv.actor_context.app_id,
              user_id: inv.actor_context.user_id,
              session_id: inv.metadata?.trace_id, // Use trace_id as session identifier
              roles: inv.actor_context.roles,
              trace_id: inv.metadata?.trace_id,
              invocation_id: inv.invocation_id,
            }
          : undefined,
      });
      const durationMs = Date.now() - start;

      if (!isAllowed(gwResult)) {
        return {
          invocation_id: inv.invocation_id,
          status: "blocked",
          result_artifacts: [],
          error: {
            code: gwResult.reason,
            message: gwResult.message,
            detail: { tool_id: gwResult.tool_id },
          },
          metrics: { duration_ms: durationMs },
        };
      }

      const artifact: TypedArtifact = {
        artifact_id: randomUUID(),
        artifact_kind: "tool_result",
        schema_ref: SCHEMA_REF_TOOL_RESULT,
        encoding: "json",
        content: {
          inline: {
            tool_id: gwResult.tool_id,
            result: gwResult.result,
            duration_ms: gwResult.duration_ms ?? durationMs,
          },
        },
      };

      return {
        invocation_id: inv.invocation_id,
        status: "success",
        result_artifacts: [artifact],
        metrics: { duration_ms: durationMs },
      };
    },
  };
}
