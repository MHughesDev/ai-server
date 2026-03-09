/**
 * Synthesis Engine – stub; produces final response (may call Model Gateway).
 * @see Architecture §10.7; SOW M1 – stub implements EngineInvocation → EngineResult
 */

import type { IEngine } from "./base.js";
import type { EngineInvocation, EngineResult, TypedArtifact } from "../contracts/index.js";
import type { IModelGateway } from "../gateways/types.js";
import { randomUUID } from "node:crypto";

/** Schema ref for synthesis final response */
export const SCHEMA_REF_REPORT = "schema://report@v1";

function createTextArtifact(text: string): TypedArtifact {
  return {
    artifact_id: randomUUID(),
    artifact_kind: "report",
    schema_ref: SCHEMA_REF_REPORT,
    encoding: "text",
    content: { inline: text },
  };
}

export function createSynthesisEngine(gateway: IModelGateway): IEngine {
  return {
    async invoke(inv: EngineInvocation): Promise<EngineResult> {
      const start = Date.now();
      const inputText =
        inv.context_artifacts?.length && inv.context_artifacts[0]?.content?.inline != null
          ? String(inv.context_artifacts[0].content.inline)
          : "(no input)";
      const prompt = inputText.slice(0, 500);
      const maxTokens = inv.budgets?.token_budget ?? 1024;
      const result = await gateway.complete({
        prompt,
        max_tokens: maxTokens,
        model: undefined,
      });
      const durationMs = Date.now() - start;
      const artifact = createTextArtifact(result.text);
      return {
        invocation_id: inv.invocation_id,
        status: "success",
        result_artifacts: [artifact],
        metrics: {
          duration_ms: durationMs,
          tokens_used: (result.tokens_in ?? 0) + (result.tokens_out ?? 0),
          cost_estimate_usd: result.cost_usd_est,
        },
      };
    },
  };
}

/** Stub synthesis engine that does not call the model gateway (for tests). */
export function createStubSynthesisEngine(): IEngine {
  return {
    async invoke(inv: EngineInvocation): Promise<EngineResult> {
      await Promise.resolve();
      return {
        invocation_id: inv.invocation_id,
        status: "success",
        result_artifacts: [createTextArtifact("stub synthesis output")],
        metrics: { duration_ms: 0 },
      };
    },
  };
}
