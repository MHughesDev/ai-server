/**
 * Default router – MVP chat route only; explicit allow/deny (L2-03 Phase 2, L2-07 Phase 2).
 * @see Docs/SPEC/13_Router_and_Dispatch_Spec.md
 */
import type { IRouter } from "./types.js";
/** Router: deny when policy denied; else allow with reactive_chat plan. Deterministic tie-breaker: chat. L2-07: Deny with MULTIMODAL_UNSUPPORTED when request has image/file but no capable pipeline allowed. */
export declare const defaultRouter: IRouter;
//# sourceMappingURL=default-router.d.ts.map