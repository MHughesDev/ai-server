/**
 * Shared telemetry emitter factory (PR-013).
 */

import type { Config } from "./schema.js";
import { createEmitter, type EventEmitter } from "../observability/emitter.js";
import { resolveTelemetryRedactionLevel } from "../observability/redact.js";
import { resolveFeatureFlagEnabled } from "./feature-flags.js";

/** Create the process-wide telemetry emitter when observability events are enabled. */
export function createConfiguredTelemetryEmitter(config: Config): EventEmitter | null {
  if (!resolveFeatureFlagEnabled("observability_required_events_v1", config)) {
    return null;
  }
  return createEmitter({
    redactionLevel: resolveTelemetryRedactionLevel(),
    logToConsole: config.logLevel === "debug",
    sampleRate: config.observability_trace_sample_rate,
  });
}
