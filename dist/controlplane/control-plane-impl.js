/**
 * Control plane implementation – policy → budget → router (L2-03).
 * @see docs/SPEC/06_ControlPlane_Spec.md
 */
import { evaluatePolicy } from "./policy-evaluator.js";
import { checkBudget } from "./resource-manager.js";
import { checkTenantBudget } from "./tenant-budget.js";
import { policyDenyReasonToErrorCode } from "../contracts/policy-decision.js";
/**
 * Control plane: 1) evaluate policy, 2) check budget, 3) route.
 * No execution path without explicit allow and pipeline plan.
 */
export function createControlPlane(opts) {
    const { router } = opts;
    return {
        async decide(input) {
            const policyInput = {
                caller: input.caller,
                canonical: input.canonical,
                intent: input.intent,
                requestMetadata: {
                    token_estimate: input.canonical.token_estimate,
                },
            };
            const policyDecision = evaluatePolicy(policyInput);
            if (!policyDecision.allowed) {
                const denyReason = policyDenyReasonToErrorCode((policyDecision.deny_reason ?? "POLICY_BLOCKED"));
                const routeResult = { allowed: false, denyReason };
                return {
                    policyDecision,
                    routeResult,
                    pipelinePlan: undefined,
                };
            }
            const budgetResult = checkBudget(policyDecision, input.canonical);
            if (!budgetResult.allowed) {
                const routeResult = {
                    allowed: false,
                    denyReason: "BUDGET_EXCEEDED",
                };
                return {
                    policyDecision: { ...policyDecision, allowed: false, deny_reason: "BUDGET_EXCEEDED" },
                    routeResult,
                    pipelinePlan: undefined,
                };
            }
            const tenantCheck = await checkTenantBudget(input.caller.orgId);
            if (!tenantCheck.allowed) {
                const routeResult = {
                    allowed: false,
                    denyReason: "BUDGET_EXCEEDED",
                };
                return {
                    policyDecision: { ...policyDecision, allowed: false, deny_reason: "BUDGET_EXCEEDED" },
                    routeResult,
                    pipelinePlan: undefined,
                };
            }
            const routeResult = await router.plan({
                canonical: input.canonical,
                intent: input.intent,
                policy: { ...policyDecision, max_budgets: budgetResult.effectiveBudgets ? {
                        token_budget: budgetResult.effectiveBudgets.token_budget,
                        tool_budget: budgetResult.effectiveBudgets.tool_budget,
                        deadline_ms: budgetResult.effectiveBudgets.deadline_ms,
                        cost_budget_usd: budgetResult.effectiveBudgets.cost_budget_usd,
                    } : policyDecision.max_budgets },
                multimodalCapablePipelines: input.multimodalCapablePipelines,
            });
            return {
                policyDecision,
                routeResult,
                pipelinePlan: routeResult.allowed ? routeResult.pipelinePlan : undefined,
            };
        },
    };
}
//# sourceMappingURL=control-plane-impl.js.map