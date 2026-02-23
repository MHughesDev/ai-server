/**
 * Tamper-evident audit logger – append-only with integrity markers (hash chain).
 * @see Docs/SPEC/19_Security_and_Isolation_Spec.md, L2-05 Phase 1
 * L2-05 gap: optional persistent sink (e.g. AUDIT_LOG_PATH) for production.
 */

import { createHash } from "node:crypto";
import { appendFileSync } from "node:fs";
import type { AuditEvent } from "./types.js";

export interface AuditLogEntry extends AuditEvent {
  sequence_id: number;
  previous_event_hash: string;
  event_hash: string;
}

/** Optional persistent sink; when set, each entry is written after in-memory append */
let persistentSink: ((entry: AuditLogEntry) => void) | null = null;

export function setAuditSink(sink: ((entry: AuditLogEntry) => void) | null): void {
  persistentSink = sink;
}

/** Create a file sink that appends one JSON line per entry (L2-05 production persistence) */
export function createFileAuditSink(filePath: string): (entry: AuditLogEntry) => void {
  return (entry: AuditLogEntry) => {
    appendFileSync(filePath, JSON.stringify(entry) + "\n", "utf8");
  };
}

/** In-memory append-only store; production would use persistent tamper-evident sink */
const log: AuditLogEntry[] = [];
let sequenceId = 0;
let lastHash = "genesis";

function hashPayload(entry: Omit<AuditLogEntry, "event_hash">): string {
  const payload = JSON.stringify({
    sequence_id: entry.sequence_id,
    previous_event_hash: entry.previous_event_hash,
    event_type: entry.event_type,
    request_id: entry.request_id,
    timestamp_iso: entry.timestamp_iso,
    payload: entry.payload,
  });
  return createHash("sha256").update(payload).digest("hex");
}

/**
 * Append a single audit event. Assigns sequence_id and previous_event_hash, computes event_hash.
 * Events are immutable once written.
 */
export function writeAuditEvent(event: AuditEvent): void {
  sequenceId += 1;
  const entry: Omit<AuditLogEntry, "event_hash"> = {
    ...event,
    sequence_id: sequenceId,
    previous_event_hash: lastHash,
  };
  const eventHash = hashPayload(entry);
  const full: AuditLogEntry = { ...entry, event_hash: eventHash };
  log.push(full);
  if (persistentSink) {
    try {
      persistentSink(full);
    } catch (err) {
      console.error("[audit] persistent sink write failed", err);
    }
  }
  lastHash = eventHash;
}

/**
 * Verify integrity of the audit log: chain of previous_event_hash and event_hash.
 * Returns true if all entries are consistent.
 */
export function verifyAuditIntegrity(): { valid: boolean; firstInvalidIndex?: number } {
  let prevHash = "genesis";
  for (let i = 0; i < log.length; i++) {
    const entry = log[i];
    if (entry.previous_event_hash !== prevHash) {
      return { valid: false, firstInvalidIndex: i };
    }
    const entryWithoutHash: Omit<AuditLogEntry, "event_hash"> = {
      sequence_id: entry.sequence_id,
      previous_event_hash: entry.previous_event_hash,
      event_type: entry.event_type,
      request_id: entry.request_id,
      trace_id: entry.trace_id,
      timestamp_iso: entry.timestamp_iso,
      payload: entry.payload,
    };
    const expectedHash = hashPayload(entryWithoutHash);
    if (entry.event_hash !== expectedHash) {
      return { valid: false, firstInvalidIndex: i };
    }
    prevHash = entry.event_hash;
  }
  return { valid: true };
}

/**
 * Return a read-only snapshot of the log (for tests and compliance export).
 * Do not mutate returned array.
 */
export function getAuditLogSnapshot(): readonly AuditLogEntry[] {
  return log;
}

/** Reset state (for tests only). */
export function resetAuditLog(): void {
  log.length = 0;
  sequenceId = 0;
  lastHash = "genesis";
}
