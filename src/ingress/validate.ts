/**
 * Ingress validation – deterministic envelope validation and rejection.
 * @see docs/SPEC/04_Ingress_Spec.md, L2-02 Phase 0
 */

import { ZodError } from "zod";
import {
  validateRequestEnvelope,
  type RequestEnvelope,
  CONTRACT_VERSION,
} from "../contracts/index.js";
import { type ErrorCode, ERROR_CODES, getErrorMeta } from "../contracts/errors.js";
import type { IngressRejection } from "./errors.js";
import type { IngressResult, CallerContext } from "./types.js";
import {
  validateAttachments,
  getDefaultAttachmentLimits,
  type AttachmentValidationLimits,
} from "./attachments.js";

export interface IngressValidateOptions {
  /** Max body size in bytes */
  maxBodyBytes: number;
  /** Raw body length (for size check before parse) */
  contentLength?: number;
  /** Optional request id from header (normalized into envelope if envelope missing) */
  requestIdHeader?: string;
  /** If true and authHeader missing, reject with AUTH_INVALID */
  requireAuthHeader?: boolean;
  /** Auth header value expected (e.g. Bearer token) */
  authHeader?: string;
  /** Contract version required; default v1 */
  contractVersion?: string;
  /** L2-07: When true, validate attachments (type/size/count/mime); reject with ATTACHMENT_REJECTED on failure */
  multimodalInputPathEnabled?: boolean;
  /** L2-07: Attachment limits when multimodalInputPathEnabled; defaults from getDefaultAttachmentLimits() */
  attachmentLimits?: Partial<AttachmentValidationLimits>;
  /** Verified caller context from auth token claims. */
  verifiedCallerContext?: CallerContext;
  /** When verified caller context exists, enforce body caller strict-match (default true). */
  enforceCallerMatch?: boolean;
}

/**
 * Normalize request id: use header value if envelope has none, or keep envelope.
 * Mutates obj.request_id if missing and header present.
 */
function normalizeRequestId(
  obj: Record<string, unknown>,
  requestIdHeader?: string
): void {
  if (requestIdHeader && typeof requestIdHeader === "string" && requestIdHeader.trim()) {
    const rid = (obj.request_id as string) || requestIdHeader.trim();
    if (!obj.request_id) obj.request_id = rid;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeScopes(scopes: string[]): string[] {
  return Array.from(
    new Set(
      scopes
        .map((scope) => scope.trim())
        .filter(Boolean)
    )
  ).sort((a, b) => a.localeCompare(b));
}

function assertCallerStrictMatch(
  envelope: RequestEnvelope,
  rawBody: Record<string, unknown>,
  verifiedCallerContext: CallerContext
): void {
  const mismatches: string[] = [];
  if (envelope.caller.app_id !== verifiedCallerContext.appId) {
    mismatches.push("caller.app_id");
  }
  if (envelope.caller.user_id !== verifiedCallerContext.userId) {
    mismatches.push("caller.user_id");
  }
  if (envelope.caller.org_id !== verifiedCallerContext.orgId) {
    mismatches.push("caller.org_id");
  }
  const rawCaller = isRecord(rawBody.caller) ? rawBody.caller : undefined;
  if (rawCaller && Object.prototype.hasOwnProperty.call(rawCaller, "session_id")) {
    if ((envelope.caller.session_id ?? undefined) !== (verifiedCallerContext.sessionId ?? undefined)) {
      mismatches.push("caller.session_id");
    }
  }
  if (rawCaller && Object.prototype.hasOwnProperty.call(rawCaller, "scopes")) {
    const bodyScopes = normalizeScopes(envelope.caller.scopes ?? []);
    const tokenScopes = normalizeScopes(verifiedCallerContext.scopes ?? []);
    if (bodyScopes.length !== tokenScopes.length) {
      mismatches.push("caller.scopes");
    } else {
      for (let i = 0; i < bodyScopes.length; i += 1) {
        if (bodyScopes[i] !== tokenScopes[i]) {
          mismatches.push("caller.scopes");
          break;
        }
      }
    }
  }
  if (mismatches.length > 0) {
    throw createRejection(
      "AUTH_INVALID",
      "Request caller does not match authenticated token claims",
      { mismatches }
    );
  }
}

/**
 * Validate and normalize request envelope; returns IngressResult or throws IngressRejection.
 * Order: body size (caller checks), request id normalization, schema validation, contract version, auth stub.
 */
export function validateIngress(
  body: unknown,
  opts: IngressValidateOptions
): IngressResult {
  if (opts.contentLength !== undefined && opts.contentLength > opts.maxBodyBytes) {
    throw createRejection("INVALID_PAYLOAD", "Request body exceeds max size", {
      max_bytes: opts.maxBodyBytes,
      received: opts.contentLength,
    });
  }

  if (body === null || body === undefined) {
    throw createRejection("INVALID_PAYLOAD", "Request body is required", {});
  }

  const obj = typeof body === "object" && body !== null ? (body as Record<string, unknown>) : undefined;
  if (!obj || Array.isArray(body)) {
    throw createRejection("INVALID_PAYLOAD", "Request body must be a JSON object", {});
  }

  normalizeRequestId(obj, opts.requestIdHeader);

  let envelope: RequestEnvelope;
  try {
    envelope = validateRequestEnvelope(body);
  } catch (err) {
    if (err instanceof ZodError) {
      const issues = err.issues.map((i) => `${i.path.join(".")}: ${i.message}`);
      throw createRejection("INVALID_PAYLOAD", "Request envelope validation failed", {
        details: issues,
      });
    }
    throw createRejection("INVALID_PAYLOAD", "Invalid request envelope", {});
  }

  const requiredVersion = opts.contractVersion ?? CONTRACT_VERSION;
  if (envelope.contract_version !== requiredVersion) {
    throw createRejection("CONTRACT_VERSION_UNSUPPORTED", "Unsupported contract_version", {
      expected: requiredVersion,
      received: envelope.contract_version,
    });
  }

  if (opts.requireAuthHeader && !opts.authHeader) {
    throw createRejection("AUTH_INVALID", "Missing or invalid authorization", {});
  }

  if (opts.multimodalInputPathEnabled && envelope.input?.attachments?.length) {
    const outcome = validateAttachments(
      envelope.input.attachments,
      opts.attachmentLimits ?? getDefaultAttachmentLimits()
    );
    if (!outcome.valid) {
      throw createRejection(
        "ATTACHMENT_REJECTED",
        `Attachment validation failed: ${outcome.reason}`,
        {
          attachment_reason: outcome.reason,
          attachment_id: outcome.attachmentId,
          ...outcome.detail,
        }
      );
    }
  }

  if (opts.verifiedCallerContext && (opts.enforceCallerMatch ?? true)) {
    assertCallerStrictMatch(envelope, obj, opts.verifiedCallerContext);
  }

  const callerContext: CallerContext = opts.verifiedCallerContext
    ? {
        appId: opts.verifiedCallerContext.appId,
        userId: opts.verifiedCallerContext.userId,
        orgId: opts.verifiedCallerContext.orgId,
        sessionId: opts.verifiedCallerContext.sessionId,
        scopes: opts.verifiedCallerContext.scopes,
      }
    : {
        appId: envelope.caller.app_id,
        userId: envelope.caller.user_id,
        orgId: envelope.caller.org_id,
        sessionId: envelope.caller.session_id,
        scopes: envelope.caller.scopes ?? [],
      };

  return { envelope, callerContext };
}

function createRejection(
  code: ErrorCode,
  message: string,
  detail: Record<string, unknown>
): IngressRejection {
  return {
    code,
    message,
    detail: Object.keys(detail).length ? detail : undefined,
    httpStatus: getErrorMeta(code).httpStatus,
    retryable: getErrorMeta(code).retryable,
  };
}

export { ERROR_CODES, getErrorMeta };
export type { ErrorCode };
export type { IngressRejection } from "./errors.js";
