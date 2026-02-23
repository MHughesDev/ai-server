/**
 * Stub policy – default allow chat for MVP.
 * @see L2-02 Phase 1; full policy in L2-03
 */
/** Default policy for MVP: allow chat pipeline only. */
export function defaultPolicyDecision() {
    return {
        allowed: true,
        allow_tools: [],
        deny_tools: [],
        memory_scope: "none",
        safety_profile: "standard",
        redaction_level: "minimal",
        audit_level: "summary",
        allowed_pipelines: ["reactive_chat", "chat"],
        strategy: "reactive",
    };
}
//# sourceMappingURL=stub-policy.js.map