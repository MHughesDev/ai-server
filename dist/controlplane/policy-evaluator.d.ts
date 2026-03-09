/**
 * Policy evaluator – deterministic allow/deny and reason codes (L2-03 Phase 0).
 * @see docs/SPEC/07_PolicyEngine_Spec.md, L2-03 GOV-001, GOV-002, L2-06 memory scope
 */
import type { PolicyDecision } from "../contracts/policy-decision.js";
import type { PolicyInput } from "./policy-input.js";
/**
 * Evaluate policy for the given input. Deterministic: same input → same output.
 * Precedence: 1) explicit deny (org/app), 2) allow with constraints, 3) default deny.
 */
export declare function evaluatePolicy(input: PolicyInput): PolicyDecision;
//# sourceMappingURL=policy-evaluator.d.ts.map