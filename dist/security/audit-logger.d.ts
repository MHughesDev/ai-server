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
    /**
     * When true, `fsync` the audit file after each append (durability; high latency).
     * Enable with env `AUDIT_LOG_FSYNC=true` in `server/index.ts`.
     */
    fsyncAfterEachWrite?: boolean;
}
export declare function setAuditSink(sink: ((entry: AuditLogEntry) => void | Promise<void>) | null): void;
/**
 * Wait for the file audit sink queue (from `createFileAuditSink`) to drain, then stop accepting new file writes.
 * Safe to call when no file sink was configured (no-op).
 */
export declare function shutdownPersistentAuditFileSink(): Promise<void>;
/** L2-04: Set callback for backpressure events */
export declare function setBackpressureCallback(callback: (() => void) | null): void;
/** Create a non-blocking file sink with bounded queue and rotation for audit entries. */
export declare function createFileAuditSink(filePath: string, options?: FileAuditSinkOptions): (entry: AuditLogEntry) => void;
export declare function getAuditSinkStatus(): AuditSinkStatus | null;
/**
 * Test/support: shrink in-memory cap to exercise trimming without 10k writes.
 * @internal
 */
export declare function setAuditMemoryCapForTests(cap: number): void;
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
 * Verify integrity of the in-memory audit window: recomputed `event_hash` for each entry
 * and `previous_event_hash` links between consecutive rows. If the window was trimmed,
 * the first row is anchored on its stored `previous_event_hash` (may not be `"genesis"`).
 */
export interface AuditFileVerifyResult {
    valid: boolean;
    /** Non-empty JSON lines processed (blank lines skipped) */
    linesRead: number;
    firstInvalidLine?: number;
    /** Machine-oriented reason when invalid */
    error?: "invalid_json" | "missing_fields" | "hash_mismatch" | "chain_break" | "file_not_found" | "read_error";
    detail?: string;
}
/**
 * Verify tamper-evident hash chain in an on-disk audit file (newline-delimited JSON).
 * Checks each line’s recomputed `event_hash` and that `previous_event_hash` matches the prior line’s `event_hash`.
 * Does **not** join rotated segments (`.1`, `.2`, …); verify each file separately or merge for a full history audit.
 */
export declare function verifyAuditLogFileIntegrity(filePath: string): Promise<AuditFileVerifyResult>;
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