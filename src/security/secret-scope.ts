/**
 * Scoped secret resolution – enforce access by caller role/org/environment.
 * @see docs/SPEC/19_Security_and_Isolation_Spec.md, L2-05 Phase 1
 */

import type { CallerContext, SecretRef } from "./types.js";
import { incrementCounter, METRIC_SECRET_SCOPE_VIOLATIONS_TOTAL } from "../observability/metrics.js";

/** Scope violation for audit and deny */
export class SecretScopeViolationError extends Error {
  constructor(
    message: string,
    public readonly ref: SecretRef,
    public readonly caller: CallerContext
  ) {
    super(message);
    this.name = "SecretScopeViolationError";
  }
}

/**
 * Check whether the caller is allowed to access the secret ref.
 * Scope format: "org_id" or "org_id:env" or "role:roleName". Caller must match.
 */
export function isSecretAllowedForCaller(ref: SecretRef, caller: CallerContext): boolean {
  const scope = ref.scope.trim();
  if (!scope) return false;

  const parts = scope.split(":");
  if (parts.length === 1) {
    return caller.orgId === parts[0];
  }
  if (parts.length === 2) {
    const [orgOrRole, value] = parts;
    if (orgOrRole === "org") return caller.orgId === value;
    if (orgOrRole === "env" && ref.env) return ref.env === value;
    if (orgOrRole === "role") return caller.scopes.includes(value);
    return caller.orgId === parts[0] && (ref.env === undefined || ref.env === parts[1]);
  }
  return false;
}

/**
 * Resolve a secret by ref for the given caller. Returns value only if scope allows.
 * Stub implementation: returns a redacted placeholder when allowed; throws on violation.
 * Production would integrate with a secrets manager.
 */
export async function resolveSecret(
  ref: SecretRef,
  caller: CallerContext
): Promise<string | null> {
  if (!isSecretAllowedForCaller(ref, caller)) {
    incrementCounter(METRIC_SECRET_SCOPE_VIOLATIONS_TOTAL, 1);
    throw new SecretScopeViolationError(
      `Secret scope ${ref.scope} does not allow access for org=${caller.orgId}`,
      ref,
      caller
    );
  }
  return await Promise.resolve("[REDACTED]");
}
