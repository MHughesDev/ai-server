/**
 * Default router – MVP chat + coding_agent when policy and intent allow (L2-03, M3).
 * WANT-007: Pipeline **selection** follows intent (`routing_hints`), complexity (`tool_likelihood`), and policy
 * allowlists — not raw modality strings. Multimodal is a **capability gate** via
 * `intent.constraints_hints.needs_attachment_processing` (set in brain stem from canonical).
 * @see docs/SPEC/13_Router_and_Dispatch_Spec.md, L2-07 Phase 2
 */
import type { IRouter } from "./types.js";
/** Router: deny when policy denied; else allow with reactive_chat or coding_agent plan. */
export declare const defaultRouter: IRouter;
//# sourceMappingURL=default-router.d.ts.map