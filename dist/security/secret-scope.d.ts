/**
 * Scoped secret resolution – enforce access by caller role/org/environment.
 * @see Docs/SPEC/19_Security_and_Isolation_Spec.md, L2-05 Phase 1
 */
import type { CallerContext, SecretRef } from "./types.js";
/** Scope violation for audit and deny */
export declare class SecretScopeViolationError extends Error {
    readonly ref: SecretRef;
    readonly caller: CallerContext;
    constructor(message: string, ref: SecretRef, caller: CallerContext);
}
/**
 * Check whether the caller is allowed to access the secret ref.
 * Scope format: "org_id" or "org_id:env" or "role:roleName". Caller must match.
 */
export declare function isSecretAllowedForCaller(ref: SecretRef, caller: CallerContext): boolean;
/**
 * Resolve a secret by ref for the given caller. Returns value only if scope allows.
 * Stub implementation: returns a redacted placeholder when allowed; throws on violation.
 * Production would integrate with a secrets manager.
 */
export declare function resolveSecret(ref: SecretRef, caller: CallerContext): Promise<string | null>;
//# sourceMappingURL=secret-scope.d.ts.map