/**
 * Evaluation harness runner – execute gold cases and score.
 * @see L2-04 Phase 2
 */
import type { EvalCase, EvalCaseResult, EvalRunResult } from "./types.js";
/** Run a single eval case through the query handler; returns result (no throw). */
export declare function runEvalCase(evalCase: EvalCase): Promise<EvalCaseResult>;
/** Run all cases and aggregate; ensures bootstrap and observability are set. */
export declare function runEvalHarness(cases: EvalCase[]): Promise<EvalRunResult>;
//# sourceMappingURL=runner.d.ts.map