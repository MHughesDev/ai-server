/**
 * Evaluation Engine tests – Architecture §10.3, SOW M3
 * Tests artifact verification and evaluation report generation.
 */

import { jest } from "@jest/globals";
import { createEvaluationEngine } from "./evaluation_engine.js";
import type { TypedArtifact } from "../contracts/index.js";
import type { IModelGateway } from "../gateways/types.js";

// Mock model gateway for testing model-based evaluation
function createMockModelGateway(responseText: string): jest.Mocked<IModelGateway> {
  return {
    complete: jest.fn().mockResolvedValue({
      text: responseText,
      tokens_in: 100,
      tokens_out: 50,
      model: "mock-model",
    }),
  } as unknown as jest.Mocked<IModelGateway>;
}

describe("createEvaluationEngine", () => {
  describe("basic engine creation", () => {
    it("creates engine with invoke function", () => {
      const engine = createEvaluationEngine();
      expect(engine).toBeDefined();
      expect(typeof engine.invoke).toBe("function");
    });
  });

  describe("heuristic evaluation (no model gateway)", () => {
    it("returns fail status when no artifacts and no model gateway", async () => {
      const engine = createEvaluationEngine();
      const result = await engine.invoke({
        invocation_id: "eval-1",
        task: { objective: { description: "Evaluate code" } },
        context_artifacts: [],
      });
      // With no artifacts and heuristic evaluation, score is 0 which fails the 0.7 threshold
      expect(result.status).toBe("fail");
      expect(result.invocation_id).toBe("eval-1");
    });

    it("returns zero confidence for empty artifacts (heuristic)", async () => {
      const engine = createEvaluationEngine();
      const result = await engine.invoke({
        invocation_id: "eval-2",
        task: { objective: { description: "Evaluate code" } },
        context_artifacts: [],
      });
      expect(result.confidence).toBe(0);
    });

    it("returns heuristic summary for empty artifacts", async () => {
      const engine = createEvaluationEngine();
      const result = await engine.invoke({
        invocation_id: "eval-3",
        task: { objective: { description: "Evaluate code" } },
        context_artifacts: [],
      });
      const artifact = result.result_artifacts?.[0];
      expect(artifact?.artifact_kind).toBe("evaluation_report");
      expect(artifact?.content?.inline?.summary).toContain("Heuristic evaluation");
    });

    it("includes evaluation report artifact in result", async () => {
      const engine = createEvaluationEngine();
      const result = await engine.invoke({
        invocation_id: "eval-4",
        task: { objective: { description: "Evaluate code" } },
        context_artifacts: [],
      });
      expect(result.result_artifacts).toHaveLength(1);
      expect(result.result_artifacts?.[0]?.artifact_kind).toBe("evaluation_report");
    });

    it("includes metrics with duration", async () => {
      const engine = createEvaluationEngine();
      const result = await engine.invoke({
        invocation_id: "eval-5",
        task: { objective: { description: "Evaluate code" } },
        context_artifacts: [],
      });
      expect(result.metrics).toBeDefined();
      expect(typeof result.metrics?.duration_ms).toBe("number");
    });
  });

  describe("with model gateway", () => {
    it("uses model gateway when provided", async () => {
      const mockResponse = JSON.stringify({
        passed: true,
        score: 0.85,
        criteria: { correctness: 0.9, completeness: 0.8, safety: 1.0, performance: 0.9 },
        summary: "Good quality code",
        issues: [],
      });
      const mockGateway = createMockModelGateway(mockResponse);
      const engine = createEvaluationEngine({ modelGateway: mockGateway });

      const artifact: TypedArtifact = {
        artifact_id: "art-1",
        artifact_kind: "code",
        schema_ref: "schema://code@v1",
        encoding: "utf-8",
        content: { inline: { code: "console.log('test');" } },
      };

      const result = await engine.invoke({
        invocation_id: "eval-6",
        task: { objective: { description: "Evaluate code" } },
        context_artifacts: [artifact],
      });

      expect(mockGateway.complete).toHaveBeenCalled();
      expect(result.status).toBe("success");
      expect(result.confidence).toBe(0.85);
    });

    it("falls back to heuristic when model fails", async () => {
      const failingGateway = {
        complete: jest.fn<() => Promise<never>>().mockRejectedValue(new Error("Model error")),
      } as unknown as jest.Mocked<IModelGateway>;
      const engine = createEvaluationEngine({ modelGateway: failingGateway });

      const artifact: TypedArtifact = {
        artifact_id: "art-1",
        artifact_kind: "code",
        schema_ref: "schema://code@v1",
        encoding: "utf-8",
        content: { inline: "console.log('test');" },
      };

      const result = await engine.invoke({
        invocation_id: "eval-7",
        task: { objective: { description: "Evaluate code" } },
        context_artifacts: [artifact],
      });

      // Should still return a result (from heuristic fallback)
      expect(result).toBeDefined();
      expect(result.result_artifacts).toHaveLength(1);
      // The summary should indicate heuristic was used
      expect(result.result_artifacts?.[0]?.content?.inline?.summary).toContain("Heuristic evaluation");
    });
  });

  describe("evaluation with artifacts", () => {
    it("evaluates single artifact with heuristic", async () => {
      const engine = createEvaluationEngine();
      const artifact: TypedArtifact = {
        artifact_id: "single-art",
        artifact_kind: "code",
        schema_ref: "schema://code@v1",
        encoding: "utf-8",
        content: { inline: "This is a sufficiently long piece of code that should pass the length check." },
      };
      const result = await engine.invoke({
        invocation_id: "eval-8",
        task: { objective: { description: "Evaluate code" } },
        context_artifacts: [artifact],
      });
      const report = result.result_artifacts?.[0];
      expect(report?.content?.inline?.summary).toContain("1 artifact(s)");
    });

    it("evaluates multiple artifacts with heuristic", async () => {
      const engine = createEvaluationEngine();
      const artifacts: TypedArtifact[] = [
        {
          artifact_id: "art-1",
          artifact_kind: "code",
          schema_ref: "schema://code@v1",
          encoding: "utf-8",
          content: { inline: "First code sample with enough content to be valid." },
        },
        {
          artifact_id: "art-2",
          artifact_kind: "code",
          schema_ref: "schema://code@v1",
          encoding: "utf-8",
          content: { inline: "Second code sample with enough content to be valid." },
        },
      ];
      const result = await engine.invoke({
        invocation_id: "eval-9",
        task: { objective: { description: "Evaluate code" } },
        context_artifacts: artifacts,
      });
      const report = result.result_artifacts?.[0];
      expect(report?.content?.inline?.summary).toContain("2 artifact(s)");
    });

    it("detects short content as issue", async () => {
      const engine = createEvaluationEngine();
      const artifact: TypedArtifact = {
        artifact_id: "short-art",
        artifact_kind: "code",
        schema_ref: "schema://code@v1",
        encoding: "utf-8",
        content: { inline: "x" },
      };
      const result = await engine.invoke({
        invocation_id: "eval-10",
        task: { objective: { description: "Evaluate code" } },
        context_artifacts: [artifact],
      });
      const report = result.result_artifacts?.[0];
      expect(report?.content?.inline?.issues).toContain("Artifact content is very short");
    });

    it("detects error keywords in content", async () => {
      const engine = createEvaluationEngine();
      const artifact: TypedArtifact = {
        artifact_id: "error-art",
        artifact_kind: "code",
        schema_ref: "schema://code@v1",
        encoding: "utf-8",
        content: { inline: "This code has an Error in it and might fail." },
      };
      const result = await engine.invoke({
        invocation_id: "eval-11",
        task: { objective: { description: "Evaluate code" } },
        context_artifacts: [artifact],
      });
      const report = result.result_artifacts?.[0];
      expect(report?.content?.inline?.issues).toContain("Content may contain errors");
    });
  });

  describe("evaluation report structure", () => {
    it("generates unique artifact IDs for each evaluation", async () => {
      const engine = createEvaluationEngine();
      const result1 = await engine.invoke({
        invocation_id: "eval-12a",
        task: { objective: { description: "First evaluation" } },
        context_artifacts: [],
      });
      const result2 = await engine.invoke({
        invocation_id: "eval-12b",
        task: { objective: { description: "Second evaluation" } },
        context_artifacts: [],
      });
      const id1 = result1.result_artifacts?.[0]?.artifact_id;
      const id2 = result2.result_artifacts?.[0]?.artifact_id;
      expect(id1).toBeDefined();
      expect(id2).toBeDefined();
      expect(id1).not.toBe(id2);
    });

    it("uses correct schema ref for evaluation report", async () => {
      const engine = createEvaluationEngine();
      const result = await engine.invoke({
        invocation_id: "eval-13",
        task: { objective: { description: "Evaluate code" } },
        context_artifacts: [],
      });
      const artifact = result.result_artifacts?.[0];
      expect(artifact?.schema_ref).toBe("schema://evaluation_report@v1");
    });

    it("uses json encoding for report content", async () => {
      const engine = createEvaluationEngine();
      const result = await engine.invoke({
        invocation_id: "eval-14",
        task: { objective: { description: "Evaluate code" } },
        context_artifacts: [],
      });
      const artifact = result.result_artifacts?.[0];
      expect(artifact?.encoding).toBe("json");
    });

    it("includes criteria in report", async () => {
      const engine = createEvaluationEngine();
      const result = await engine.invoke({
        invocation_id: "eval-15",
        task: { objective: { description: "Evaluate code" } },
        context_artifacts: [],
      });
      const report = result.result_artifacts?.[0]?.content?.inline;
      expect(report?.criteria).toBeDefined();
      expect(typeof report?.criteria?.correctness).toBe("number");
      expect(typeof report?.criteria?.completeness).toBe("number");
      expect(typeof report?.criteria?.safety).toBe("number");
      expect(typeof report?.criteria?.performance).toBe("number");
    });
  });

  describe("pass threshold configuration", () => {
    it("uses custom pass threshold when provided", async () => {
      const mockResponse = JSON.stringify({
        passed: true,
        score: 0.5,
        criteria: { correctness: 0.5, completeness: 0.5, safety: 0.5, performance: 0.5 },
        summary: "Acceptable code",
        issues: [],
      });
      const mockGateway = createMockModelGateway(mockResponse);
      // With threshold 0.4, score of 0.5 should pass
      const engine = createEvaluationEngine({ 
        modelGateway: mockGateway, 
        passThreshold: 0.4 
      });

      const artifact: TypedArtifact = {
        artifact_id: "art-1",
        artifact_kind: "code",
        schema_ref: "schema://code@v1",
        encoding: "utf-8",
        content: { inline: "Code content here." },
      };

      const result = await engine.invoke({
        invocation_id: "eval-16",
        task: { objective: { description: "Evaluate code" } },
        context_artifacts: [artifact],
      });

      expect(result.status).toBe("success");
    });
  });
});
