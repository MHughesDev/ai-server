/**
 * Execution Engine – stub; performs single-pass execution (may call Model Gateway).
 * @see Architecture §10.2; SOW M1 – stub implements EngineInvocation → EngineResult
 */

import type { IEngine } from "./base.js";
import type { EngineInvocation, EngineResult, TypedArtifact } from "../contracts/index.js";
import type { IModelGateway } from "../gateways/types.js";
import { randomUUID } from "node:crypto";

/** Schema ref for execution/synthesis report output */
export const SCHEMA_REF_REPORT = "schema://report@v1";

function createTextArtifact(text: string, kind: TypedArtifact["artifact_kind"] = "report"): TypedArtifact {
  return {
    artifact_id: randomUUID(),
    artifact_kind: kind,
    schema_ref: SCHEMA_REF_REPORT,
    encoding: "text",
    content: { inline: text },
  };
}

export function createExecutionEngine(gateway: IModelGateway): IEngine {
  return {
    async invoke(inv: EngineInvocation): Promise<EngineResult> {
      const start = Date.now();
      const prompt =
        typeof inv.task.objective?.description === "string"
          ? inv.task.objective.description
          : (inv.context_artifacts.find((a) => a.content?.inline != null))?.content?.inline != null
            ? String((inv.context_artifacts[0]).content?.inline)
            : "(no input)";
      const maxTokens = inv.budgets?.token_budget ?? 1024;
      const result = await gateway.complete({
        prompt,
        max_tokens: maxTokens,
        model: undefined,
      });
      const durationMs = Date.now() - start;
      const artifact = createTextArtifact(result.text);
      const out: EngineResult = {
        invocation_id: inv.invocation_id,
        status: "success",
        result_artifacts: [artifact],
        metrics: {
          duration_ms: durationMs,
          tokens_used: (result.tokens_in ?? 0) + (result.tokens_out ?? 0),
          cost_estimate_usd: result.cost_usd_est,
        },
      };
      // L2-99: When task.objective.formal_spec has suggested_tool_ref, return proposed_next_action so the autonomous harness can run tool rounds.
      const suggestedRef = inv.task.objective?.formal_spec as { suggested_tool_ref?: string } | undefined;
      if (typeof suggestedRef?.suggested_tool_ref === "string") {
        out.proposed_next_action = {
          type: "call_tool",
          ref: suggestedRef.suggested_tool_ref,
          arguments: {},
        };
      }
      return out;
    },
  };
}

/** Stub execution engine that does not call the model gateway (for tests). */
export function createStubExecutionEngine(): IEngine {
  return {
    async invoke(inv: EngineInvocation): Promise<EngineResult> {
      await Promise.resolve();
      return {
        invocation_id: inv.invocation_id,
        status: "success",
        result_artifacts: [createTextArtifact("stub execution output")],
        metrics: { duration_ms: 0 },
      };
    },
  };
}
