/**
 * Router/Dispatcher – map IntentBundle + PolicyDecision to allow/deny + PipelinePlan.
 * @see docs/SPEC/13_Router_and_Dispatch_Spec.md, L2-03 Phase 2
 */

import type { CanonicalRequest, IntentBundle, PolicyDecision, PipelinePlan } from "../contracts/index.js";
import type { ErrorCode } from "../contracts/errors.js";
import type { CallerContext } from "../ingress/types.js";

export interface RouterInput {
  canonical: CanonicalRequest;
  intent: IntentBundle;
  policy: PolicyDecision;
  /** Caller identity for scoped routing and plan fields (e.g. harness execution mode). */
  caller: CallerContext;
  /** L2-07 / WANT-007: Capable pipeline types; when non-empty, requests with `intent.constraints_hints.needs_attachment_processing` require one of these in policy.allowed_pipelines. */
  multimodalCapablePipelines?: string[];
}

/** Router output: explicit allow with plan or deny with reason (L2-03 P2-02) */
export type RouteResult =
  | { allowed: true; pipelinePlan: PipelinePlan }
  | { allowed: false; denyReason: ErrorCode };

/** (CanonicalRequest, IntentBundle, PolicyDecision) → RouteResult */
export interface IRouter {
  plan(input: RouterInput): Promise<RouteResult>;
}
