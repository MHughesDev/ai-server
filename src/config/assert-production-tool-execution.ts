/**
 * Production executable tool guards (PR-014).
 * @see docs/SPEC/16_ToolGateway_Spec.md, Production-Readiness-Gaps-Report §tool gateway
 */

import type { Config } from "./schema.js";
import { resolveFeatureFlagEnabled } from "./feature-flags.js";

/** Whether `TOOL_EXECUTION_ENABLED=true` is set in the environment. */
export function isToolExecutionEnvFlagEnabled(): boolean {
  return (process.env.TOOL_EXECUTION_ENABLED ?? "").trim().toLowerCase() === "true";
}

/** Whether security review sign-off env is set (for preflight / ops checks). */
export function isToolExecutionSecurityReviewSignoffAcknowledged(): boolean {
  return (
    (process.env.TOOL_EXECUTION_SECURITY_REVIEW_SIGNOFF ?? "").trim().toLowerCase() ===
    "true"
  );
}

/**
 * Fail-fast when production enables executable tools without explicit security review sign-off.
 * Set `TOOL_EXECUTION_SECURITY_REVIEW_SIGNOFF=true` only after tool sandbox review per runbook.
 */
export function assertProductionToolExecution(config: Config): void {
  if (config.env !== "production") return;
  if (!isToolExecutionEnvFlagEnabled()) return;

  if (!isToolExecutionSecurityReviewSignoffAcknowledged()) {
    throw new Error(
      "Production requires TOOL_EXECUTION_SECURITY_REVIEW_SIGNOFF=true after security review before TOOL_EXECUTION_ENABLED=true"
    );
  }

  if (!resolveFeatureFlagEnabled("security_hard_controls_enabled", config)) {
    throw new Error(
      "Production tool execution requires SECURITY_HARD_CONTROLS_ENABLED=true for TOOL_ACCESS audit events"
    );
  }

  if (!process.env.TOOL_FILESYSTEM_ROOT?.trim()) {
    throw new Error(
      "Production tool execution requires TOOL_FILESYSTEM_ROOT for sandboxed filesystem tools (e.g. file_write_preview)"
    );
  }
}

/**
 * Whether the query path may delegate to ExecutableToolGateway (defense in depth at runtime).
 */
export function resolveToolExecutionEnabled(config: Config): boolean {
  if (!isToolExecutionEnvFlagEnabled()) return false;
  if (
    config.env === "production" &&
    !isToolExecutionSecurityReviewSignoffAcknowledged()
  ) {
    return false;
  }
  return true;
}
