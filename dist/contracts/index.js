/**
 * Contracts package – versioned schemas and validators for external and internal APIs.
 * @see docs/PLANS/Implementation-plans/L2-01_Contracts-and-Project-Scaffold.md
 */
export * from "./request-envelope.js";
export * from "./response-envelope.js";
export * from "./canonical-request.js";
export * from "./intent-bundle.js";
export * from "./policy-decision.js";
export * from "./pipeline-plan.js";
export * from "./typed-artifact.js";
export * from "./task.js";
export * from "./engine-invocation.js";
export * from "./engine-result.js";
export * from "./workflow-definition.js";
export * from "./agent-harness-contract.js";
export * from "./errors.js";
export * from "./m5-artifacts.js";
import { RequestEnvelopeSchema } from "./request-envelope.js";
import { ResponseEnvelopeSchema } from "./response-envelope.js";
import { CanonicalRequestSchema } from "./canonical-request.js";
import { IntentBundleSchema } from "./intent-bundle.js";
import { PolicyDecisionSchema } from "./policy-decision.js";
import { PipelinePlanSchema } from "./pipeline-plan.js";
import { TypedArtifactSchema } from "./typed-artifact.js";
import { TaskSchema } from "./task.js";
import { EngineInvocationSchema } from "./engine-invocation.js";
import { EngineResultSchema } from "./engine-result.js";
import { WorkflowDefinitionSchema } from "./workflow-definition.js";
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
/** Validate TypedArtifact */
export function validateTypedArtifact(data) {
    return TypedArtifactSchema.parse(data);
}
/** Validate Task */
export function validateTask(data) {
    return TaskSchema.parse(data);
}
/** Validate EngineInvocation */
export function validateEngineInvocation(data) {
    return EngineInvocationSchema.parse(data);
}
/** Validate EngineResult */
export function validateEngineResult(data) {
    return EngineResultSchema.parse(data);
}
/** Validate WorkflowDefinition */
export function validateWorkflowDefinition(data) {
    return WorkflowDefinitionSchema.parse(data);
}
export const CONTRACT_VERSION = "v1";
//# sourceMappingURL=index.js.map