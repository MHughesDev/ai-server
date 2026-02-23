/**
 * Tamper-evident audit logger – append-only with integrity markers (hash chain).
 * @see Docs/SPEC/19_Security_and_Isolation_Spec.md, L2-05 Phase 1
 * L2-05 gap: optional persistent sink (e.g. AUDIT_LOG_PATH) for production.
 */
import { createHash } from "node:crypto";
import { appendFileSync } from "node:fs";
/** Optional persistent sink; when set, each entry is written after in-memory append */
let persistentSink = null;
export function setAuditSink(sink) {
    persistentSink = sink;
}
/** Create a file sink that appends one JSON line per entry (L2-05 production persistence) */
export function createFileAuditSink(filePath) {
    return (entry) => {
        appendFileSync(filePath, JSON.stringify(entry) + "\n", "utf8");
    };
}
/** In-memory append-only store; production would use persistent tamper-evident sink */
const log = [];
let sequenceId = 0;
let lastHash = "genesis";
function hashPayload(entry) {
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
export function writeAuditEvent(event) {
    sequenceId += 1;
    const entry = {
        ...event,
        sequence_id: sequenceId,
        previous_event_hash: lastHash,
    };
    const eventHash = hashPayload(entry);
    const full = { ...entry, event_hash: eventHash };
    log.push(full);
    if (persistentSink) {
        try {
            persistentSink(full);
        }
        catch (err) {
            console.error("[audit] persistent sink write failed", err);
        }
    }
    lastHash = eventHash;
}
/**
 * Verify integrity of the audit log: chain of previous_event_hash and event_hash.
 * Returns true if all entries are consistent.
 */
export function verifyAuditIntegrity() {
    let prevHash = "genesis";
    for (let i = 0; i < log.length; i++) {
        const entry = log[i];
        if (entry.previous_event_hash !== prevHash) {
            return { valid: false, firstInvalidIndex: i };
        }
        const entryWithoutHash = {
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
export function getAuditLogSnapshot() {
    return log;
}
/** Reset state (for tests only). */
export function resetAuditLog() {
    log.length = 0;
    sequenceId = 0;
    lastHash = "genesis";
}
//# sourceMappingURL=audit-logger.js.map