/**
 * Policy input model – inputs to policy evaluation (L2-03 Phase 0).
 * @see docs/SPEC/07_PolicyEngine_Spec.md
 */
import type { CanonicalRequest, IntentBundle } from "../contracts/index.js";
import type { CallerContext } from "../ingress/types.js";
export interface PolicyInput {
    /** Caller identity and tenant */
    caller: CallerContext;
    /** Canonical request (redacted as needed) */
    canonical: CanonicalRequest;
    /** Intent and risk hints from Brain Stem */
    intent: IntentBundle;
    /** Optional request metadata for rules */
    requestMetadata?: {
        deadline_ms?: number;
        token_estimate?: number;
    };
}
//# sourceMappingURL=policy-input.d.ts.map