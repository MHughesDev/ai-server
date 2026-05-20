/**
 * WANT-015 — global per-request deadline beyond HTTP wrapper.
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it, expect } from "@jest/globals";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

const PIPELINE_FILES = [
  "src/pipelines/chat-pipeline.ts",
  "src/pipelines/decision-pipeline.ts",
  "src/pipelines/deep-research-pipeline.ts",
  "src/pipelines/coding-agent-pipeline.ts",
];

describe("WANT-015 invariants", () => {
  it("query-handler sets request_started_at_ms and enforces deadline before retrieval/pipeline", () => {
    const src = readFileSync(join(REPO_ROOT, "src/server/query-handler.ts"), "utf8");
    expect(src).toMatch(/request_started_at_ms:\s*start/);
    expect(src).toMatch(/checkDeadlineBlocked\(requestDeadline/);
    expect(src).toMatch(/requestDeadline\.run\(\(\)\s*=>\s*runRetrieval/);
    expect(src).not.toMatch(/withDeadline\(pipeline\.run/);
  });

  it.each(PIPELINE_FILES)("%s uses resolvePipelineDeadline and checkDeadlineBlocked", (relPath) => {
    const src = readFileSync(join(REPO_ROOT, relPath), "utf8");
    expect(src).toMatch(/resolvePipelineDeadline/);
    expect(src).toMatch(/input\.request_started_at_ms/);
    expect(src).toMatch(/checkDeadlineBlocked/);
  });

  it("harness loop checks deadline.isExceeded each iteration", () => {
    const src = readFileSync(join(REPO_ROOT, "src/orchestrator/harness-loop.ts"), "utf8");
    expect(src).toMatch(/deadline\.isExceeded\(\)/);
  });
});
