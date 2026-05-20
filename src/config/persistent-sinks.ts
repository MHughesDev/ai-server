/**
 * Wire audit and observability file sinks from config (PR-012).
 */

import type { Config } from "./schema.js";
import { createFileEventSink, setEventSink } from "../observability/event-sink.js";
import { createFileAuditSink, setAuditSink } from "../security/audit-logger.js";
import {
  resolveAuditFileSinkOptions,
  resolveEventFileSinkOptions,
} from "./file-sink-options.js";

/** Register persistent NDJSON sinks when paths are configured. */
export function wirePersistentSinksFromConfig(config: Config): void {
  if (config.auditLogPath) {
    setAuditSink(createFileAuditSink(config.auditLogPath, resolveAuditFileSinkOptions()));
  }
  if (config.observabilityEventSinkPath) {
    setEventSink(
      createFileEventSink(config.observabilityEventSinkPath, resolveEventFileSinkOptions())
    );
  }
}
