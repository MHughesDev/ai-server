/**
 * Production telemetry redaction guards (PR-013).
 */

import type { Config } from "./schema.js";
import { resolveFeatureFlagEnabled } from "./feature-flags.js";
import { assertProductionTelemetryRedactionLevel } from "../observability/redact.js";

/** Fail fast when production would emit telemetry without redaction or observability off. */
export function assertProductionTelemetryRedaction(config: Config): void {
  if (config.env !== "production") return;

  assertProductionTelemetryRedactionLevel();

  if (!resolveFeatureFlagEnabled("observability_required_events_v1", config)) {
    throw new Error(
      "Production requires OBSERVABILITY_REQUIRED_EVENTS_V1=true so telemetry redaction is active on the query path"
    );
  }

  if (!resolveFeatureFlagEnabled("security_hard_controls_enabled", config)) {
    throw new Error(
      "Production requires SECURITY_HARD_CONTROLS_ENABLED=true for audit/redaction hardening"
    );
  }
}
