/**
 * Brain Stem – minimal chat intent extraction for MVP.
 * @see Docs/SPEC/05_BrainStem_Spec.md, L2-02 Phase 1
 */
import type { CanonicalRequest } from "../contracts/canonical-request.js";
import type { IntentBundle } from "../contracts/intent-bundle.js";
/**
 * Extract intent for MVP: chat-first. All text requests get primary_intent "chat"
 * with high confidence; default-safe for routing to reactive_chat pipeline.
 */
export declare function extractIntent(_canonical: CanonicalRequest): IntentBundle;
//# sourceMappingURL=intent.d.ts.map