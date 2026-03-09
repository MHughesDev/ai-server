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
export function assertCanDispatch(result: ControlPlaneResult): asserts result is ControlPlaneResult & { pipelinePlan: PipelinePlan } {
  if (!result.routeResult.allowed || !result.pipelinePlan) {
    const reason = !result.routeResult.allowed && "denyReason" in result.routeResult
      ? result.routeResult.denyReason
      : "POLICY_BLOCKED";
    throw new DispatchBlockedError(
      "Dispatch precondition failed: governance did not allow execution",
      reason
    );
  }
}

/** Thrown when dispatch is attempted without allow + pipeline plan */
export class DispatchBlockedError extends Error {
  constructor(
    message: string,
    public readonly denyReason: string
  ) {
    super(message);
    this.name = "DispatchBlockedError";
  }
}

/**
 * Returns true if and only if the control plane result allows dispatch with a plan.
 * Use for conditional flow; use assertCanDispatch when dispatch must proceed or throw.
 */
export function canDispatch(result: ControlPlaneResult): result is ControlPlaneResult & { pipelinePlan: PipelinePlan } {
  return result.routeResult.allowed === true && result.pipelinePlan != null;
}
