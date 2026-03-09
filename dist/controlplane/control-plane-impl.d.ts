/**
 * Control plane implementation – policy → budget → router (L2-03).
 * @see docs/SPEC/06_ControlPlane_Spec.md
 */
import type { IControlPlane } from "./types.js";
import type { IRouter } from "../router/types.js";
export interface ControlPlaneImplOptions {
    router: IRouter;
}
/**
 * Control plane: 1) evaluate policy, 2) check budget, 3) route.
 * No execution path without explicit allow and pipeline plan.
 */
export declare function createControlPlane(opts: ControlPlaneImplOptions): IControlPlane;
//# sourceMappingURL=control-plane-impl.d.ts.map