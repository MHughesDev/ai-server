/**
 * Tamper-evident audit logger – append-only with integrity markers (hash chain).
 * @see Docs/SPEC/19_Security_and_Isolation_Spec.md, L2-05 Phase 1
 * L2-05 gap: optional persistent sink (e.g. AUDIT_LOG_PATH) for production.
 */
import type { AuditEvent } from "./types.js";
export interface AuditLogEntry extends AuditEvent {
    sequence_id: number;
    previous_event_hash: string;
    event_hash: string;
}
export declare function setAuditSink(sink: ((entry: AuditLogEntry) => void) | null): void;
/** Create a file sink that appends one JSON line per entry (L2-05 production persistence) */
export declare function createFileAuditSink(filePath: string): (entry: AuditLogEntry) => void;
/**
 * Append a single audit event. Assigns sequence_id and previous_event_hash, computes event_hash.
 * Events are immutable once written.
 */
export declare function writeAuditEvent(event: AuditEvent): void;
/**
 * Verify integrity of the audit log: chain of previous_event_hash and event_hash.
 * Returns true if all entries are consistent.
 */
export declare function verifyAuditIntegrity(): {
    valid: boolean;
    firstInvalidIndex?: number;
};
/**
 * Return a read-only snapshot of the log (for tests and compliance export).
 * Do not mutate returned array.
 */
export declare function getAuditLogSnapshot(): readonly AuditLogEntry[];
/** Reset state (for tests only). */
export declare function resetAuditLog(): void;
//# sourceMappingURL=audit-logger.d.ts.map