/**
 * Default router – MVP chat route only; explicit allow/deny (L2-03 Phase 2, L2-07 Phase 2).
 * @see Docs/SPEC/13_Router_and_Dispatch_Spec.md
 */
import { policyDenyReasonToErrorCode } from "../contracts/policy-decision.js";
function hasMultimodalModality(modalities) {
    return modalities.some((m) => m === "image" || m === "file");
}
/** Router: deny when policy denied; else allow with reactive_chat plan. Deterministic tie-breaker: chat. L2-07: Deny with MULTIMODAL_UNSUPPORTED when request has image/file but no capable pipeline allowed. */
export const defaultRouter = {
    plan(input) {
        if (!input.policy.allowed) {
            const reason = (input.policy.deny_reason ?? "POLICY_BLOCKED");
            return Promise.resolve({
                allowed: false,
                denyReason: policyDenyReasonToErrorCode(reason),
            });
        }
        const modalities = input.canonical.modalities ?? ["text"];
        const capablePipelines = input.multimodalCapablePipelines ?? [];
        if (hasMultimodalModality(modalities) && capablePipelines.length > 0) {
            const allowed = input.policy.allowed_pipelines ?? [];
            const hasCapable = capablePipelines.some((p) => allowed.includes(p));
            if (!hasCapable) {
                return Promise.resolve({ allowed: false, denyReason: "MULTIMODAL_UNSUPPORTED" });
            }
        }
        const allowed = input.policy.allowed_pipelines ?? [];
        const useChat = allowed.includes("reactive_chat") || allowed.includes("chat");
        const plan = {
            pipeline_type: useChat ? "reactive_chat" : "reactive_chat",
            strategy_id: "reactive",
            execution_mode: "sync_stream",
            budgets: input.policy.max_budgets
                ? {
                    token_budget: input.policy.max_budgets.token_budget ?? 4096,
                    deadline_ms: input.policy.max_budgets.deadline_ms ?? 30_000,
                }
                : { token_budget: 4096, deadline_ms: 30_000 },
            verification_level: "basic",
            tools_enabled: [],
        };
        return Promise.resolve({ allowed: true, pipelinePlan: plan });
    },
};
//# sourceMappingURL=default-router.js.map