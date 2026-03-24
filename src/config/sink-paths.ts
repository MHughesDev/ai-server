/**
 * Production validation for optional file sinks (audit + observability NDJSON).
 * WANT-039: fail fast when paths are configured but parent dir is missing or not writable.
 */

import { accessSync, constants, existsSync } from "node:fs";
import { dirname } from "node:path";
import type { Config } from "./schema.js";

export function assertProductionSinkPathsWritable(cfg: Config): void {
  if (cfg.env !== "production") return;

  const sinks: Array<{ envHint: string; path: string }> = [];
  if (cfg.auditLogPath) {
    sinks.push({ envHint: "AUDIT_LOG_PATH", path: cfg.auditLogPath });
  }
  if (cfg.observabilityEventSinkPath) {
    sinks.push({ envHint: "OBSERVABILITY_EVENT_SINK_PATH", path: cfg.observabilityEventSinkPath });
  }

  for (const { envHint, path } of sinks) {
    const dir = dirname(path);
    if (!existsSync(dir)) {
      throw new Error(`Production sink parent directory must exist (${envHint}): ${dir}`);
    }
    try {
      accessSync(dir, constants.W_OK);
    } catch {
      throw new Error(`Production sink parent directory must be writable (${envHint}): ${dir}`);
    }
    if (existsSync(path)) {
      try {
        accessSync(path, constants.W_OK);
      } catch {
        throw new Error(`Production sink file must be writable (${envHint}): ${path}`);
      }
    }
  }
}
