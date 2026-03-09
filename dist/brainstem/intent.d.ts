/**
 * Brain Stem – minimal chat intent extraction for MVP.
 * @see docs/SPEC/05_BrainStem_Spec.md, L2-02 Phase 1
 */
import type { CanonicalRequest } from "../contracts/canonical-request.js";
import type { IntentBundle } from "../contracts/intent-bundle.js";
/**
 * Extract intent for MVP: chat-first. All text requests get primary_intent "chat"
 * with high confidence; default-safe for routing to reactive_chat pipeline.
 * When user text suggests tool use, set complexity.tool_likelihood for coding_agent routing (M3).
 * M5: "research" / "deep research" → routing_hints include "deep_research"; "decide" / "choose" / "recommend" → "decision".
 */
export declare function extractIntent(canonical: CanonicalRequest): IntentBundle;
//# sourceMappingURL=intent.d.ts.map