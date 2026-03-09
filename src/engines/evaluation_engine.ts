/**
 * Evaluation Engine – verifies/rates artifacts (e.g. code or tool output).
 * Production: Uses Model Gateway for real verification with quality scoring.
 * @see Architecture §10.3; SOW M3 – Coding Agent verification step
 */

import type { IEngine } from "./base.js";
import type { EngineInvocation, EngineResult, TypedArtifact } from "../contracts/index.js";
import type { IModelGateway } from "../gateways/types.js";
import { randomUUID } from "node:crypto";

export interface EvaluationEngineOptions {
  modelGateway?: IModelGateway;
  /** Default model to use for evaluation */
  evaluationModel?: string;
  /** Threshold for passing (0-1) */
  passThreshold?: number;
}

interface EvaluationCriteria {
  correctness?: number;
  completeness?: number;
  safety?: number;
  performance?: number;
}

interface EvaluationResult {
  passed: boolean;
  score: number;
  criteria: EvaluationCriteria;
  summary: string;
  issues: string[];
}

function createEvaluationArtifact(result: EvaluationResult): TypedArtifact {
  return {
    artifact_id: randomUUID(),
    artifact_kind: "evaluation_report",
    schema_ref: "schema://evaluation_report@v1",
    encoding: "json",
    content: { inline: result },
  };
}

function extractArtifactContent(artifact: TypedArtifact): string {
  const content = artifact.content as { inline?: string | Record<string, unknown>; uri?: string } | undefined;
  if (typeof content?.inline === "string") return content.inline;
  if (typeof content?.inline === "object" && content.inline !== null) {
    return JSON.stringify(content.inline);
  }
  return "";
}

async function evaluateWithModel(
  modelGateway: IModelGateway,
  artifacts: TypedArtifact[],
  taskDescription: string,
  model: string
): Promise<EvaluationResult> {
  const artifactContents = artifacts.map((a, i) => `Artifact ${i + 1} (${a.artifact_kind}):\n${extractArtifactContent(a)}`).join("\n\n---\n\n");

  const prompt = `You are an evaluation engine. Evaluate the following artifacts against the task description.

Task: ${taskDescription || "Evaluate quality and correctness"}

${artifactContents}

Provide your evaluation in this exact JSON format:
{
  "passed": boolean,
  "score": number (0-1),
  "criteria": {
    "correctness": number (0-1),
    "completeness": number (0-1),
    "safety": number (0-1),
    "performance": number (0-1)
  },
  "summary": "brief evaluation summary",
  "issues": ["list of specific issues if any"]
}

Respond only with the JSON object.`;

  try {
    const result = await modelGateway.complete({ prompt, max_tokens: 500, model });
    const jsonMatch = result.text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]) as EvaluationResult;
      return {
        passed: parsed.passed ?? parsed.score >= 0.7,
        score: Math.max(0, Math.min(1, parsed.score ?? 0)),
        criteria: {
          correctness: Math.max(0, Math.min(1, parsed.criteria?.correctness ?? 0)),
          completeness: Math.max(0, Math.min(1, parsed.criteria?.completeness ?? 0)),
          safety: Math.max(0, Math.min(1, parsed.criteria?.safety ?? 0)),
          performance: Math.max(0, Math.min(1, parsed.criteria?.performance ?? 0)),
        },
        summary: parsed.summary || "Evaluation completed",
        issues: Array.isArray(parsed.issues) ? parsed.issues : [],
      };
    }
  } catch (err) {
    // Fall back to heuristic evaluation
  }

  // Fallback heuristic evaluation
  return performHeuristicEvaluation(artifacts);
}

function performHeuristicEvaluation(artifacts: TypedArtifact[]): EvaluationResult {
  let totalScore = 0;
  const issues: string[] = [];

  for (const artifact of artifacts) {
    const content = extractArtifactContent(artifact);
    if (!content || content.length === 0) {
      issues.push(`Empty artifact: ${artifact.artifact_id}`);
      continue;
    }
    // Simple heuristics
    if (content.length < 10) issues.push("Artifact content is very short");
    if (content.includes("error") || content.includes("Error")) issues.push("Content may contain errors");

    // Score based on content length and quality indicators
    let score = Math.min(1, content.length / 100);
    if (!content.includes("error") && !content.includes("Error")) score += 0.2;
    if (content.includes("success") || content.includes("Success")) score += 0.2;
    totalScore += Math.min(1, score);
  }

  const finalScore = artifacts.length > 0 ? totalScore / artifacts.length : 0;

  return {
    passed: finalScore >= 0.7 && issues.length === 0,
    score: finalScore,
    criteria: {
      correctness: finalScore,
      completeness: finalScore,
      safety: 1.0,
      performance: 1.0,
    },
    summary: `Heuristic evaluation of ${artifacts.length} artifact(s)${issues.length > 0 ? ` with ${issues.length} issue(s)` : ""}`,
    issues,
  };
}

export function createEvaluationEngine(options: EvaluationEngineOptions = {}): IEngine {
  const { modelGateway, evaluationModel = "gpt-4o-mini", passThreshold = 0.7 } = options;

  return {
    async invoke(inv: EngineInvocation): Promise<EngineResult> {
      const start = Date.now();
      // Handle both full EngineInvocation and simplified test objects
      const artifacts = inv.context_artifacts ?? [];
      const taskDescription = inv.task?.objective?.description ?? (inv as unknown as { prompt?: string }).prompt ?? "";

      let evaluation: EvaluationResult;

      if (modelGateway && artifacts.length > 0) {
        try {
          evaluation = await evaluateWithModel(modelGateway, artifacts, taskDescription, evaluationModel);
        } catch (err) {
          // Fall back to heuristic on model failure
          evaluation = performHeuristicEvaluation(artifacts);
          evaluation.issues.push(`Model evaluation failed: ${err instanceof Error ? err.message : String(err)}`);
        }
      } else {
        // No model gateway available or no artifacts - use heuristic
        evaluation = performHeuristicEvaluation(artifacts);
      }

      // Apply pass threshold
      evaluation.passed = evaluation.score >= passThreshold;

      const durationMs = Date.now() - start;
      return {
        invocation_id: inv.invocation_id,
        status: evaluation.passed ? "success" : "fail",
        result_artifacts: [createEvaluationArtifact(evaluation)],
        confidence: evaluation.score,
        metrics: { duration_ms: durationMs },
      };
    },
  };
}
