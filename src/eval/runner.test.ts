/**
 * Evaluation harness tests – L2-04 Phase 2
 */

import { runEvalHarness } from "./runner.js";
import type { EvalCase } from "./types.js";

describe("eval harness", () => {
  it("runs baseline-style cases and reports pass/fail", async () => {
    const cases: EvalCase[] = [
      {
        id: "t1",
        input: {
          request_id: "550e8400-e29b-41d4-a716-446655440000",
          caller: { app_id: "a", user_id: "u", org_id: "o" },
          input: { text: "Hi" },
          contract_version: "v1",
        },
        expected_status: "ok",
        max_latency_ms: 10_000,
      },
    ];
    const result = await runEvalHarness(cases);
    expect(result.total).toBe(1);
    expect(result.results).toHaveLength(1);
    expect(result.results[0].case_id).toBe("t1");
    expect(result.results[0].status_match).toBe(true);
    expect(result.results[0].passed).toBe(true);
    expect(result.passed).toBe(1);
    expect(result.failed).toBe(0);
  });

  it("fails when expected_status does not match", async () => {
    const cases: EvalCase[] = [
      {
        id: "t2",
        input: {
          request_id: "550e8400-e29b-41d4-a716-446655440001",
          caller: { app_id: "a", user_id: "u", org_id: "o" },
          input: { text: "Hi" },
          contract_version: "v1",
        },
        expected_status: "blocked",
      },
    ];
    const result = await runEvalHarness(cases);
    expect(result.results[0].status_match).toBe(false);
    expect(result.results[0].passed).toBe(false);
    expect(result.failed).toBe(1);
  });
});
