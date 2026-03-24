/**
 * Async job idempotency – POST /v1/query/async only (header Idempotency-Key).
 * Fingerprint excludes request_id so clients may retry with a fresh UUID.
 */

import { createHash } from "node:crypto";
import type { RequestEnvelope } from "../contracts/request-envelope.js";

/** Max length for trimmed Idempotency-Key header value */
export const MAX_ASYNC_IDEMPOTENCY_KEY_LENGTH = 256;

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return `{${keys.map(k => `${JSON.stringify(k)}:${stableStringify(obj[k])}`).join(",")}}`;
}

/** Stable hash of logical query body (caller + input + prefs + mode/deadline/version; not request_id). */
export function fingerprintAsyncQueryEnvelope(envelope: RequestEnvelope): string {
  const basis = {
    caller: envelope.caller,
    input: envelope.input ?? {},
    preferences: envelope.preferences,
    mode: envelope.mode,
    deadline_ms: envelope.deadline_ms,
    contract_version: envelope.contract_version,
  };
  return createHash("sha256").update(stableStringify(basis)).digest("hex");
}

export function idempotencyCompositeKey(
  metadata: { org_id?: string; app_id?: string; user_id?: string } | undefined,
  key: string
): string {
  return `${metadata?.org_id ?? ""}\n${metadata?.app_id ?? ""}\n${metadata?.user_id ?? ""}\n${key}`;
}
