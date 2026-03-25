/**
 * Policy evaluator – deterministic allow/deny and reason codes (L2-03 Phase 0).
 * @see docs/SPEC/07_PolicyEngine_Spec.md, L2-03 GOV-001, GOV-002, L2-06 memory scope
 */
import { getConfig } from "../bootstrap/index.js";
import { resolveFeatureFlagEnabled } from "../config/feature-flags.js";
import { listRegisteredWorkflowIds } from "../workflows/registry.js";
/** Parse comma-separated env list; empty string or unset => [] */
function parseDenyList(envValue) {
    if (envValue == null || envValue.trim() === "")
        return [];
    return envValue.split(",").map((s) => s.trim()).filter(Boolean);
}
/** Dynamic deny lists from env (L2-03 gap: dynamic policy refresh); (re)read on each evaluation. */
function getDenyOrgIds() {
    return parseDenyList(process.env.POLICY_DENY_ORG_IDS);
}
function getDenyAppIds() {
    return parseDenyList(process.env.POLICY_DENY_APP_IDS);
}
/** Default max budgets when policy allows (L2-03, SPEC 09) */
const DEFAULT_MAX_BUDGETS = {
    token_budget: 8192,
    tool_budget: 10,
    deadline_ms: 60_000,
    cost_budget_usd: 1.0,
};
/**
 * Evaluate policy for the given input. Deterministic: same input → same output.
 * Precedence: 1) explicit deny (org/app), 2) allow with constraints, 3) default deny.
 */
export function evaluatePolicy(input) {
    const { caller, intent } = input;
    if (getDenyOrgIds().includes(caller.orgId)) {
        return denyDecision("POLICY_BLOCKED", "org_not_allowed");
    }
    if (getDenyAppIds().includes(caller.appId)) {
        return denyDecision("POLICY_BLOCKED", "app_not_allowed");
    }
    const primaryIntent = intent.primary_intent ?? "chat";
    const allowedPipelines = listRegisteredWorkflowIds();
    const allowedIntents = new Set([...allowedPipelines, "chat", "query"]);
    const hasAllowedIntent = allowedIntents.has(primaryIntent) || intent.intents.some((i) => allowedIntents.has(i));
    if (!hasAllowedIntent) {
        return denyDecision("POLICY_BLOCKED", "pipeline_not_allowed");
    }
    const riskFlags = intent.risk_flags ?? [];
    if (riskFlags.includes("high_risk") || riskFlags.includes("blocked")) {
        return denyDecision("POLICY_BLOCKED", "risk_flags");
    }
    /** L2-05: When coding_agent is allowed, default allow_tools so router can enable tools. */
    const allowTools = allowedPipelines.includes("coding_agent") ? ["stub_tool"] : [];
    let memoryScope = "none";
    try {
        const cfg = getConfig();
        memoryScope = resolveFeatureFlagEnabled("enable_org_memory", cfg, {
            org_id: caller.orgId,
            app_id: caller.appId,
            user_id: caller.userId,
        })
            ? "org"
            : "none";
    }
    catch {
        // Unit tests may not call bootstrap(); keep none
    }
    return {
        allowed: true,
        allow_tools: allowTools,
        deny_tools: [],
        memory_scope: memoryScope,
        max_budgets: { ...DEFAULT_MAX_BUDGETS },
        safety_profile: "standard",
        redaction_level: "minimal",
        audit_level: "summary",
        allowed_pipelines: allowedPipelines,
        strategy: "reactive",
    };
}
function denyDecision(reason, _detail) {
    return {
        allowed: false,
        deny_reason: reason,
        allow_tools: [],
        deny_tools: [],
        memory_scope: "none",
        safety_profile: "standard",
        redaction_level: "minimal",
        audit_level: "summary",
        allowed_pipelines: [],
        strategy: undefined,
    };
}
//# sourceMappingURL=policy-evaluator.js.map