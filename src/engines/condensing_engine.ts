/**
 * Condensing Engine – compresses/summarizes content into a smaller artifact.
 * Uses Model Gateway only. No engine-to-engine calls.
 * @see Architecture §10.8; SOW Segment M.3
 */

import type { IEngine } from "./base.js";
import type { EngineInvocation, EngineResult, TypedArtifact } from "../contracts/index.js";
import type { IModelGateway } from "../gateways/types.js";
import { randomUUID } from "node:crypto";

/** Schema ref for condensed/summary output */
export const SCHEMA_REF_REPORT = "schema://report@v1";

function createCondensedArtifact(text: string): TypedArtifact {
  return {
    artifact_id: randomUUID(),
    artifact_kind: "report",
    schema_ref: SCHEMA_REF_REPORT,
    encoding: "text",
    content: { inline: text },
  };
}

export function createCondensingEngine(gateway: IModelGateway): IEngine {
  return {
    async invoke(inv: EngineInvocation): Promise<EngineResult> {
      const start = Date.now();
      const inputText =
        inv.context_artifacts?.length && inv.context_artifacts[0]?.content?.inline != null
          ? String(inv.context_artifacts[0].content.inline)
          : inv.task.objective?.description ?? "(no input)";
      const maxTokens = inv.budgets?.token_budget ?? 1024;
      const result = await gateway.complete({
        prompt: `Summarize or condense the following in a few sentences:\n\n${inputText.slice(0, 2000)}`,
        max_tokens: maxTokens,
        model: undefined,
      });
      const durationMs = Date.now() - start;
      const artifact = createCondensedArtifact(result.text);
      return {
        invocation_id: inv.invocation_id,
        status: "success",
        result_artifacts: [artifact],
        confidence: 0.85,
        metrics: {
          duration_ms: durationMs,
          tokens_used: (result.tokens_in ?? 0) + (result.tokens_out ?? 0),
          cost_estimate_usd: result.cost_usd_est,
        },
      };
    },
  };
}

/** Stub condensing engine for tests (no Model Gateway). */
export function createStubCondensingEngine(): IEngine {
  return {
    async invoke(inv: EngineInvocation): Promise<EngineResult> {
      await Promise.resolve();
      const artifact = createCondensedArtifact("(condensed summary)");
      return {
        invocation_id: inv.invocation_id,
        status: "success",
        result_artifacts: [artifact],
        confidence: 0.9,
        metrics: { duration_ms: 0 },
      };
    },
  };
}
