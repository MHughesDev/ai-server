/**
 * Tamper-evident audit logger – append-only with integrity markers (hash chain).
 * @see docs/SPEC/19_Security_and_Isolation_Spec.md, L2-05 Phase 1
 * L2-04: Backpressure handling and atomic hash-chain for concurrent callers.
 */
import type { AuditEvent } from "./types.js";
export interface AuditLogEntry extends AuditEvent {
    sequence_id: number;
    previous_event_hash: string;
    event_hash: string;
}
export interface AuditSinkStatus {
    queueDepth: number;
    maxQueueSize: number;
    droppedEntries: number;
    isDraining: boolean;
    lastError: string | null;
    /** L2-04: Backpressure indicator - true when queue is at 80% capacity */
    backpressureActive: boolean;
}
export interface FileAuditSinkOptions {
    maxQueueSize?: number;
    maxFileSizeBytes?: number;
    maxRotatedFiles?: number;
    /** L2-04: Backpressure threshold percentage (0-1), default 0.8 */
    backpressureThreshold?: number;
}
export declare function setAuditSink(sink: ((entry: AuditLogEntry) => void | Promise<void>) | null): void;
/** L2-04: Set callback for backpressure events */
export declare function setBackpressureCallback(callback: (() => void) | null): void;
/** Create a non-blocking file sink with bounded queue and rotation for audit entries. */
export declare function createFileAuditSink(filePath: string, options?: FileAuditSinkOptions): (entry: AuditLogEntry) => void;
export declare function getAuditSinkStatus(): AuditSinkStatus | null;
/**
 * Append a single audit event with atomic hash-chain integrity.
 * L2-04: Uses async lock to ensure sequence_id and hash chain consistency for concurrent callers.
 */
export declare function writeAuditEventAsync(event: AuditEvent): Promise<AuditLogEntry>;
/**
 * Synchronous version for backward compatibility.
 * For concurrent scenarios, use writeAuditEventAsync.
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