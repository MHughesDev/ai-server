/**
 * POST /v1/query handler – ingress → brain stem → policy → router → response.
 * @see L2-02 MVP runtime, L2-04 observability wiring
 */
import type { IngressResult } from "../ingress/types.js";
import type { CanonicalRequest, IntentBundle } from "../contracts/index.js";
import type { ControlPlaneResult } from "../controlplane/types.js";
import type { PipelinePlan } from "../contracts/pipeline-plan.js";
import type { ResponseEnvelope } from "../contracts/response-envelope.js";
import { type RedactionLevel } from "../observability/redact.js";
type ControlPlaneDispatchOk = ControlPlaneResult & {
    pipelinePlan: PipelinePlan;
};
export interface QueryGovernanceGateOk {
    canonical: CanonicalRequest;
    intent: IntentBundle;
    result: ControlPlaneDispatchOk;
    redactionLevel: RedactionLevel;
}
export type QueryGovernanceGateOutcome = {
    status: "blocked";
    response: ResponseEnvelope;
} | {
    status: "ok";
    data: QueryGovernanceGateOk;
};
/** Flags needed for policy telemetry and the dispatch gate (caller matches handleQuery). */
export interface QueryGovernanceGateFlags {
    multimodalInputPathEnabled: boolean;
    observabilityEnabled: boolean;
    securityHardControlsEnabled: boolean;
}
/**
 * Brain stem + control plane through the dispatch gate (policy → budget → route → plan).
 * Async submit uses `skipPolicyTelemetryIfDispatchAllowed` so allowed jobs do not duplicate POLICY/BUDGET events before `handleQuery` runs on the worker.
 */
export declare function runQueryGovernanceGate(ingressResult: IngressResult, start: number, gateFlags: QueryGovernanceGateFlags, options: {
    skipPolicyTelemetryIfDispatchAllowed: boolean;
}): Promise<QueryGovernanceGateOutcome>;
/**
 * Run the same dispatch gate as `handleQuery` before enqueueing async work. Returns a blocked `ResponseEnvelope` when policy/budget/route would deny; otherwise `null`. Allowed path skips allow-side policy telemetry to avoid duplicate events when the worker runs `handleQuery`.
 */
export declare function preflightAsyncQueryGovernance(ingressResult: IngressResult): Promise<ResponseEnvelope | null>;
/**
 * Handle validated query: canonicalize → intent → control plane (policy → budget → route) → dispatch gate → pipeline.
 * No pipeline runs without explicit allow and pipeline plan (L2-03 non-bypass).
 */
export declare function handleQuery(ingressResult: IngressResult): Promise<ResponseEnvelope>;
export {};
//# sourceMappingURL=query-handler.d.ts.map