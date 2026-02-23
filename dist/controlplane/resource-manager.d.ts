/**
 * Resource manager – effective budgets and budget-exceeded enforcement (L2-03 Phase 1).
 * @see Docs/SPEC/09_ResourceManager_Spec.md, L2-03 GOV-003, GOV-004
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
 */
export declare function assignBudgets(policy: PolicyDecision, _canonical: CanonicalRequest): EffectiveBudgets;
/**
 * Check if request is within budget. At exact threshold, allowed.
 * Hard-stop when token_estimate exceeds token_budget (L2-03 P1-02).
 */
export declare function checkBudget(policy: PolicyDecision, canonical: CanonicalRequest): BudgetCheckResult;
//# sourceMappingURL=resource-manager.d.ts.map