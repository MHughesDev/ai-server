/**
 * Dispatch precondition – no execution without governance artifacts (L2-03 Phase 3).
 * @see docs/SPEC/01_Principles_and_Invariants.md, docs/SPEC/03_Component_Map.md
 */
import type { ControlPlaneResult } from "./types.js";
import type { PipelinePlan } from "../contracts/pipeline-plan.js";
/**
 * Assert that dispatch is allowed and a valid pipeline plan exists.
 * Call this immediately before invoking any pipeline; throws if bypass attempted.
 */
export declare function assertCanDispatch(result: ControlPlaneResult): asserts result is ControlPlaneResult & {
    pipelinePlan: PipelinePlan;
};
/** Thrown when dispatch is attempted without allow + pipeline plan */
export declare class DispatchBlockedError extends Error {
    readonly denyReason: string;
    constructor(message: string, denyReason: string);
}
/**
 * Returns true if and only if the control plane result allows dispatch with a plan.
 * Use for conditional flow; use assertCanDispatch when dispatch must proceed or throw.
 */
export declare function canDispatch(result: ControlPlaneResult): result is ControlPlaneResult & {
    pipelinePlan: PipelinePlan;
};
//# sourceMappingURL=dispatch-gate.d.ts.map