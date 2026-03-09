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
export function extractIntent(canonical: CanonicalRequest): IntentBundle {
  const text = (canonical.text ?? "").toLowerCase();
  const toolHint =
    /use (a )?tool|run (a )?tool|call (a )?tool|invoke (a )?tool|tool (to|for)/i.test(text);
  const researchHint =
    /\bresearch\b|deep research|find out about|investigate|what (is|are) .+ (and|or) how/i.test(text);
  const decisionHint =
    /\bdecide\b|choose between|which (option|one)|recommend|should i (pick|choose)|compare (the )?options/i.test(text);

  const routingHints: string[] = ["reactive_chat"];
  if (toolHint) routingHints.push("coding_agent");
  if (researchHint) routingHints.push("deep_research");
  if (decisionHint) routingHints.push("decision");
  if (/\bcomposite\b|nested workflow|workflow_call/i.test(text)) routingHints.push("composite_example");

  return {
    intents: ["chat"],
    confidence: 1,
    modalities_detected: ["text"],
    primary_intent: "chat",
    risk_flags: [],
    routing_hints: routingHints,
    ...(toolHint && { complexity: { tool_likelihood: 0.8 } }),
  };
}
