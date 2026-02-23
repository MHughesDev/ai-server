/**
 * Control Plane – policy, strategy, supervision; no direct tool execution.
 * @see Docs/SPEC/06_ControlPlane_Spec.md, L2-03
 */

import type { CanonicalRequest, IntentBundle, PolicyDecision, PipelinePlan } from "../contracts/index.js";
import type { CallerContext } from "../ingress/types.js";
import type { RouteResult } from "../router/types.js";

export interface ControlPlaneInput {
  canonical: CanonicalRequest;
  intent: IntentBundle;
  caller: CallerContext;
  /** L2-07: Pipeline types that support multimodal; router uses for capability check */
  multimodalCapablePipelines?: string[];
}

/** When allowed, pipelinePlan is set and dispatch may proceed. When denied, errorCode set. */
export interface ControlPlaneResult {
  policyDecision: PolicyDecision;
  routeResult: RouteResult;
  /** Convenience: pipeline plan when routeResult.allowed; undefined when denied */
  pipelinePlan?: PipelinePlan;
}

/** (CanonicalRequest, IntentBundle, CallerContext) → ControlPlaneResult (allow or deny) */
export interface IControlPlane {
  decide(input: ControlPlaneInput): Promise<ControlPlaneResult>;
}
