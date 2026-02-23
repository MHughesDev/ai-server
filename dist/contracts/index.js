/**
 * Contracts package – versioned schemas and validators for external and internal APIs.
 * @see Docs/PLANS/Implementation-plans/L2-01_Contracts-and-Project-Scaffold.md
 */
export * from "./request-envelope.js";
export * from "./response-envelope.js";
export * from "./canonical-request.js";
export * from "./intent-bundle.js";
export * from "./policy-decision.js";
export * from "./pipeline-plan.js";
export * from "./agent-harness-contract.js";
export * from "./errors.js";
import { RequestEnvelopeSchema } from "./request-envelope.js";
import { ResponseEnvelopeSchema } from "./response-envelope.js";
import { CanonicalRequestSchema } from "./canonical-request.js";
import { IntentBundleSchema } from "./intent-bundle.js";
import { PolicyDecisionSchema } from "./policy-decision.js";
import { PipelinePlanSchema } from "./pipeline-plan.js";
/** Validate RequestEnvelope; throws ZodError on failure */
export function validateRequestEnvelope(data) {
    return RequestEnvelopeSchema.parse(data);
}
/** Validate ResponseEnvelope; throws ZodError on failure */
export function validateResponseEnvelope(data) {
    return ResponseEnvelopeSchema.parse(data);
}
/** Validate CanonicalRequest */
export function validateCanonicalRequest(data) {
    return CanonicalRequestSchema.parse(data);
}
/** Validate IntentBundle */
export function validateIntentBundle(data) {
    return IntentBundleSchema.parse(data);
}
/** Validate PolicyDecision */
export function validatePolicyDecision(data) {
    return PolicyDecisionSchema.parse(data);
}
/** Validate PipelinePlan */
export function validatePipelinePlan(data) {
    return PipelinePlanSchema.parse(data);
}
export const CONTRACT_VERSION = "v1";
//# sourceMappingURL=index.js.map