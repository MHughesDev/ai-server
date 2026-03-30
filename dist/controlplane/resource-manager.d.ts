/**
 * Resource manager – effective budgets and budget-exceeded enforcement (L2-03 Phase 1).
 * @see docs/SPEC/09_ResourceManager_Spec.md, L2-03 GOV-003, GOV-004
 */
import type { PolicyDecision } from "../contracts/policy-decision.js";
import type { CanonicalRequest } from "../contracts/canonical-request.js";
export interface EffectiveBudgets {
    token_budget: number;
    tool_budget: number;
    deadline_ms: number;
    cost_budget_usd: number;
}
export interface BudgetCheckResult {
    allowed: boolean;
    /** Set when allowed is false: BUDGET_EXCEEDED */
    deny_reason?: "BUDGET_EXCEEDED";
    effectiveBudgets?: EffectiveBudgets;
}
/**
 * Compute effective per-request budgets from policy max_budgets and request context.
 * Deterministic: same policy + request → same effective budgets.
 * Enforcement split: this module applies ingress **token_estimate** vs **token_budget** only. **deadline_ms**, **cost_budget_usd**, **tool_budget**, and **cumulative token_budget** for multi-step workflows are enforced in **`query-handler`** / pipelines / **`workflows/runner`** (see WANT-014).
 */
export declare function assignBudgets(policy: PolicyDecision, _canonical: CanonicalRequest): EffectiveBudgets;
/**
 * Check if request is within budget. At exact threshold, allowed.
 * Hard-stop when token_estimate exceeds token_budget (L2-03 P1-02).
 */
export declare function checkBudget(policy: PolicyDecision, canonical: CanonicalRequest): BudgetCheckResult;
//# sourceMappingURL=resource-manager.d.ts.map