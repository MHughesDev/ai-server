/**
 * WANT-004 — pipelines must not re-derive harness mode from feature flags or own loop caps.
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it, expect } from "@jest/globals";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

describe("orchestrator invariants (WANT-004)", () => {
  it("coding-agent-pipeline does not read harness feature flags", () => {
    const src = readFileSync(
      join(REPO_ROOT, "src/pipelines/coding-agent-pipeline.ts"),
      "utf8"
    );
    expect(src).not.toMatch(/harness_autonomous_execution_enabled/);
    expect(src).not.toMatch(/resolveFeatureFlagEnabled/);
    expect(src).not.toMatch(/HARNESS_TOOL_ITERATION_ABSOLUTE_CAP/);
    expect(src).toMatch(/resolveOrchestratorExecutionSpec/);
    expect(src).toMatch(/runExecutionToolHarnessLoop/);
  });

  it("query-handler applies orchestrator plan normalization before pipeline run", () => {
    const src = readFileSync(join(REPO_ROOT, "src/server/query-handler.ts"), "utf8");
    expect(src).toMatch(/applyOrchestratorToPipelinePlan/);
  });
});
