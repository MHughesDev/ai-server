/**
 * Resource manager – effective budgets and budget-exceeded enforcement (L2-03 Phase 1).
 * @see docs/SPEC/09_ResourceManager_Spec.md, L2-03 GOV-003, GOV-004
 */
const DEFAULTS = {
    token_budget: 4096,
    tool_budget: 10,
    deadline_ms: 30_000,
    cost_budget_usd: 0.5,
};
/**
 * Compute effective per-request budgets from policy max_budgets and request context.
 * Deterministic: same policy + request → same effective budgets.
 * Enforcement split: this module applies ingress **token_estimate** vs **token_budget** only. **deadline_ms**, **cost_budget_usd**, **tool_budget**, and **cumulative token_budget** for multi-step workflows are enforced in **`query-handler`** / pipelines / **`workflows/runner`** (see WANT-014).
 */
export function assignBudgets(policy, _canonical) {
    const max = policy.max_budgets;
    return {
        token_budget: max?.token_budget ?? DEFAULTS.token_budget,
        tool_budget: max?.tool_budget ?? DEFAULTS.tool_budget,
        deadline_ms: max?.deadline_ms ?? DEFAULTS.deadline_ms,
        cost_budget_usd: max?.cost_budget_usd ?? DEFAULTS.cost_budget_usd,
    };
}
/**
 * Check if request is within budget. At exact threshold, allowed.
 * Hard-stop when token_estimate exceeds token_budget (L2-03 P1-02).
 */
export function checkBudget(policy, canonical) {
    const effective = assignBudgets(policy, canonical);
    const tokenEstimate = canonical.token_estimate ?? 0;
    if (tokenEstimate > effective.token_budget) {
        return { allowed: false, deny_reason: "BUDGET_EXCEEDED" };
    }
    return { allowed: true, effectiveBudgets: effective };
}
//# sourceMappingURL=resource-manager.js.map