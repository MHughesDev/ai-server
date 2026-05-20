/**
 * File sink rotation/queue options from environment (PR-012).
 */

import type { FileAuditSinkOptions } from "../security/audit-logger.js";
import type { FileEventSinkOptions } from "../observability/event-sink.js";

function parsePositiveInt(value: string | undefined, fallback: number): number {
  if (!value?.trim()) return fallback;
  const n = parseInt(value, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function parseThreshold(value: string | undefined, fallback: number): number {
  if (!value?.trim()) return fallback;
  const n = parseFloat(value);
  if (!Number.isFinite(n) || n <= 0 || n > 1) return fallback;
  return n;
}

/** Resolve audit file sink options from `AUDIT_LOG_*` env vars. */
export function resolveAuditFileSinkOptions(): FileAuditSinkOptions {
  return {
    maxQueueSize: parsePositiveInt(process.env.AUDIT_LOG_MAX_QUEUE_SIZE, 1_000),
    maxFileSizeBytes: parsePositiveInt(
      process.env.AUDIT_LOG_MAX_FILE_BYTES,
      10 * 1024 * 1024
    ),
    maxRotatedFiles: parsePositiveInt(process.env.AUDIT_LOG_MAX_ROTATED_FILES, 3),
    backpressureThreshold: parseThreshold(process.env.AUDIT_LOG_BACKPRESSURE_THRESHOLD, 0.8),
    fsyncAfterEachWrite: process.env.AUDIT_LOG_FSYNC === "true",
  };
}

/** Resolve observability event file sink options from `OBSERVABILITY_EVENT_SINK_*` env vars. */
export function resolveEventFileSinkOptions(): FileEventSinkOptions {
  return {
    maxQueueSize: parsePositiveInt(process.env.OBSERVABILITY_EVENT_SINK_MAX_QUEUE_SIZE, 1_000),
    maxFileSizeBytes: parsePositiveInt(
      process.env.OBSERVABILITY_EVENT_SINK_MAX_FILE_BYTES,
      10 * 1024 * 1024
    ),
    maxRotatedFiles: parsePositiveInt(
      process.env.OBSERVABILITY_EVENT_SINK_MAX_ROTATED_FILES,
      3
    ),
    backpressureThreshold: parseThreshold(
      process.env.OBSERVABILITY_EVENT_SINK_BACKPRESSURE_THRESHOLD,
      0.8
    ),
    fsyncAfterEachWrite: process.env.OBSERVABILITY_EVENT_SINK_FSYNC === "true",
  };
}
