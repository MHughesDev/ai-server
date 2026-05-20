/**
 * Production persistent sink guards (PR-012).
 */

import type { Config } from "./schema.js";

/** Fail fast when production would run without durable audit + event sinks. */
export function assertProductionPersistentSinks(config: Config): void {
  if (config.env !== "production") return;

  if (!config.auditLogPath?.trim()) {
    throw new Error(
      "Production requires AUDIT_LOG_PATH for persistent tamper-evident audit storage"
    );
  }
  if (!config.observabilityEventSinkPath?.trim()) {
    throw new Error(
      "Production requires OBSERVABILITY_EVENT_SINK_PATH for persistent telemetry retention"
    );
  }
}
