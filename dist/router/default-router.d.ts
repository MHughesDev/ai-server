/**
 * Default router – MVP chat + coding_agent when policy and intent allow (L2-03, M3).
 * @see docs/SPEC/13_Router_and_Dispatch_Spec.md, L2-07 Phase 2
 */
import type { IRouter } from "./types.js";
/** Router: deny when policy denied; else allow with reactive_chat or coding_agent plan. */
export declare const defaultRouter: IRouter;
//# sourceMappingURL=default-router.d.ts.map