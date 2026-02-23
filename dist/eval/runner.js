/**
 * Evaluation harness runner – execute gold cases and score.
 * @see L2-04 Phase 2
 */
import { validateIngress } from "../ingress/validate.js";
import { handleQuery } from "../server/query-handler.js";
import { bootstrap } from "../bootstrap/index.js";
import { setObservability, createEmitter, getTraceContext } from "../observability/index.js";
/** Run a single eval case through the query handler; returns result (no throw). */
export async function runEvalCase(evalCase) {
    const result = {
        case_id: evalCase.id,
        passed: false,
        status_match: false,
        latency_ok: true,
        pipeline_match: true,
    };
    try {
        const ingressResult = validateIngress(evalCase.input, {
            maxBodyBytes: 1_000_000,
            contractVersion: "v1",
        });
        const start = Date.now();
        const response = await handleQuery(ingressResult);
        const actual_latency_ms = Date.now() - start;
        result.actual_status = response.status;
        result.actual_latency_ms = actual_latency_ms;
        result.actual_pipeline = response.telemetry?.pipeline;
        result.status_match = response.status === evalCase.expected_status;
        result.latency_ok =
            evalCase.max_latency_ms == null || actual_latency_ms <= evalCase.max_latency_ms;
        result.pipeline_match =
            evalCase.expected_pipeline == null ||
                response.telemetry?.pipeline === evalCase.expected_pipeline;
        result.passed =
            result.status_match && result.latency_ok && result.pipeline_match;
    }
    catch (err) {
        result.error = err instanceof Error ? err.message : String(err);
        result.actual_status = "error";
        result.passed = false;
    }
    return result;
}
/** Run all cases and aggregate; ensures bootstrap and observability are set. */
export async function runEvalHarness(cases) {
    try {
        bootstrap();
    }
    catch {
        // already bootstrapped
    }
    const emitter = createEmitter({ redactionLevel: "minimal" });
    setObservability({
        events: emitter,
        getContext: getTraceContext,
    });
    const start = Date.now();
    const results = [];
    for (const c of cases) {
        results.push(await runEvalCase(c));
    }
    const duration_ms = Date.now() - start;
    const passed = results.filter((r) => r.passed).length;
    return {
        total: cases.length,
        passed,
        failed: cases.length - passed,
        results,
        duration_ms,
    };
}
//# sourceMappingURL=runner.js.map