/**
 * Brain Stem – first cognition: canonicalize input, produce IntentBundle.
 * @see docs/SPEC/05_BrainStem_Spec.md
 */

import type { RequestEnvelope } from "../contracts/index.js";
import type { CanonicalRequest, IntentBundle } from "../contracts/index.js";

export interface BrainStemResult {
  canonical: CanonicalRequest;
  intent: IntentBundle;
}

/** Stub: RequestEnvelope → (CanonicalRequest, IntentBundle) */
export interface IBrainStem {
  process(envelope: RequestEnvelope): Promise<BrainStemResult>;
}
