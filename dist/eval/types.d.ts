/**
 * Evaluation harness types – gold dataset and scoring.
 * @see Docs/SPEC/12_EvaluationEngine_Spec.md, Docs/SPEC/21_Test_and_Eval_Plan.md, L2-04 Phase 2
 */
/** A single gold case: input + expected outcomes */
export interface EvalCase {
    id: string;
    /** Request envelope (valid for POST /v1/query) */
    input: Record<string, unknown>;
    /** Expected response status */
    expected_status: "ok" | "blocked" | "error" | "accepted";
    /** Optional: max acceptable latency_ms */
    max_latency_ms?: number;
    /** Optional: expected pipeline_type in response */
    expected_pipeline?: string;
}
/** Result of running one case */
export interface EvalCaseResult {
    case_id: string;
    passed: boolean;
    status_match: boolean;
    latency_ok: boolean;
    pipeline_match: boolean;
    actual_status?: string;
    actual_latency_ms?: number;
    actual_pipeline?: string;
    error?: string;
}
/** Full run result */
export interface EvalRunResult {
    total: number;
    passed: number;
    failed: number;
    results: EvalCaseResult[];
    duration_ms: number;
}
//# sourceMappingURL=types.d.ts.map