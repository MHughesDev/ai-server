/**
 * Ingress – deterministic entrypoint; no AI cognition.
 * @see Docs/SPEC/04_Ingress_Spec.md
 */
import type { RequestEnvelope } from "../contracts/index.js";
/** Output of successful ingress: validated envelope + caller context */
export interface IngressResult {
    envelope: RequestEnvelope;
    callerContext: CallerContext;
}
export interface CallerContext {
    appId: string;
    userId: string;
    orgId: string;
    sessionId?: string;
    scopes: string[];
}
/** Stub: validate and normalize HTTP to RequestEnvelope (or reject) */
export interface IIngress {
    validate(body: unknown): Promise<IngressResult>;
}
//# sourceMappingURL=types.d.ts.map