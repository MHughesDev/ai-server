/**
 * Deterministic gateway timeout errors (WANT-027 / PR-020).
 * Shared timer-safe races use {@link ../utils/race-with-timeout.js}; timeouts map to taxonomy by scope.
 */

import type { ErrorCode } from "../contracts/errors.js";
import type { ToolInvokeResult } from "./types.js";

export type GatewayTimeoutScope = "model" | "tool" | "job";

export interface GatewayTimeoutSpec {
  code: ErrorCode;
  retryable: boolean;
  message: string;
}

/** Canonical timeout mapping per gateway surface. */
export const GATEWAY_TIMEOUT_SPEC: Record<GatewayTimeoutScope, GatewayTimeoutSpec> = {
  model: {
    code: "MODEL_FAILURE",
    retryable: true,
    message: "Model gateway timeout",
  },
  tool: {
    code: "TOOL_TIMEOUT",
    retryable: true,
    message: "Tool execution timed out",
  },
  job: {
    code: "TIMEOUT",
    retryable: true,
    message: "Job processing timed out",
  },
};

export class GatewayTimeoutError extends Error {
  readonly scope: GatewayTimeoutScope;
  readonly code: ErrorCode;
  readonly retryable: boolean;

  constructor(scope: GatewayTimeoutScope, message?: string) {
    const spec = GATEWAY_TIMEOUT_SPEC[scope];
    super(message ?? spec.message);
    this.name = "GatewayTimeoutError";
    this.scope = scope;
    this.code = spec.code;
    this.retryable = spec.retryable;
  }
}

export function createGatewayTimeoutError(scope: GatewayTimeoutScope): GatewayTimeoutError {
  return new GatewayTimeoutError(scope);
}

export function isGatewayTimeoutError(error: unknown): error is GatewayTimeoutError {
  return error instanceof GatewayTimeoutError;
}

export interface GatewayFailureClassification {
  code: ErrorCode;
  retryable: boolean;
  message: string;
}

export function classifyGatewayTimeoutFailure(
  error: unknown
): GatewayFailureClassification | undefined {
  if (!isGatewayTimeoutError(error)) return undefined;
  return {
    code: error.code,
    retryable: error.retryable,
    message: error.message,
  };
}

/** Map tool-gateway timeout to structured deny (reason = taxonomy code). */
export function toolInvokeResultForGatewayTimeout(
  error: unknown,
  toolId: string
): ToolInvokeResult | undefined {
  if (!isGatewayTimeoutError(error) || error.scope !== "tool") return undefined;
  return {
    allowed: false,
    reason: error.code,
    message: error.message,
    tool_id: toolId,
  };
}
