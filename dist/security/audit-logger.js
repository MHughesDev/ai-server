/**
 * Tamper-evident audit logger – append-only with integrity markers (hash chain).
 * @see docs/SPEC/19_Security_and_Isolation_Spec.md, L2-05 Phase 1
 * L2-04: Backpressure handling and atomic hash-chain for concurrent callers.
 */
import { createHash } from "node:crypto";
import { appendFile, access, rename, stat } from "node:fs/promises";
import { constants } from "node:fs";
/** Optional persistent sink; when set, each entry is written after in-memory append */
let persistentSink = null;
let currentAuditSinkStatus = null;
/** L2-04: Backpressure callback - invoked when queue reaches threshold */
let backpressureCallback = null;
export function setAuditSink(sink) {
    persistentSink = sink;
}
/** L2-04: Set callback for backpressure events */
export function setBackpressureCallback(callback) {
    backpressureCallback = callback;
}
/** Create a non-blocking file sink with bounded queue and rotation for audit entries. */
export function createFileAuditSink(filePath, options = {}) {
    const maxQueueSize = options.maxQueueSize ?? 1_000;
    const maxFileSizeBytes = options.maxFileSizeBytes ?? 10 * 1024 * 1024;
    const maxRotatedFiles = options.maxRotatedFiles ?? 3;
    const backpressureThreshold = options.backpressureThreshold ?? 0.8;
    const queue = [];
    let droppedEntries = 0;
    let draining = false;
    let closed = false;
    let lastError = null;
    let backpressureActive = false;
    currentAuditSinkStatus = {
        queueDepth: 0,
        maxQueueSize,
        droppedEntries: 0,
        isDraining: false,
        lastError: null,
        backpressureActive: false,
    };
    async function fileExists(path) {
        try {
            await access(path, constants.F_OK);
            return true;
        }
        catch {
            return false;
        }
    }
    async function maybeRotate(nextWriteBytes) {
        try {
            const info = await stat(filePath);
            if (info.size + nextWriteBytes <= maxFileSizeBytes)
                return;
        }
        catch {
            return;
        }
        for (let i = maxRotatedFiles; i >= 1; i -= 1) {
            const src = i === 1 ? filePath : `${filePath}.${i - 1}`;
            const dst = `${filePath}.${i}`;
            if (await fileExists(src)) {
                try {
                    await rename(src, dst);
                }
                catch (err) {
                    lastError = err instanceof Error ? err.message : String(err);
                    break;
                }
            }
        }
    }
    async function drainQueue() {
        if (draining || closed)
            return;
        draining = true;
        try {
            while (queue.length > 0 && !closed) {
                const line = queue.shift();
                if (!line)
                    break;
                await maybeRotate(Buffer.byteLength(line));
                await appendFile(filePath, line, "utf8");
            }
            lastError = null;
        }
        catch (err) {
            lastError = err instanceof Error ? err.message : String(err);
            console.error("[audit] persistent sink write failed", err);
        }
        finally {
            draining = false;
            // L2-04: Update backpressure status after draining
            backpressureActive = queue.length >= maxQueueSize * backpressureThreshold;
            currentAuditSinkStatus = {
                queueDepth: queue.length,
                maxQueueSize,
                droppedEntries,
                isDraining: draining,
                lastError,
                backpressureActive,
            };
            if (queue.length > 0 && !closed) {
                setImmediate(() => {
                    void drainQueue();
                });
            }
        }
    }
    return (entry) => {
        if (closed)
            return;
        const line = `${JSON.stringify(entry)}\n`;
        if (queue.length >= maxQueueSize) {
            droppedEntries += 1;
            queue.shift();
        }
        queue.push(line);
        // L2-04: Backpressure check after adding to queue
        const currentFillRatio = queue.length / maxQueueSize;
        backpressureActive = currentFillRatio >= backpressureThreshold;
        // L2-04: Trigger backpressure callback if threshold crossed
        if (backpressureActive && backpressureCallback) {
            try {
                backpressureCallback();
            }
            catch (err) {
                console.error("[audit] backpressure callback failed", err);
            }
        }
        currentAuditSinkStatus = {
            queueDepth: queue.length,
            maxQueueSize,
            droppedEntries,
            isDraining: draining,
            lastError,
            backpressureActive,
        };
        if (!draining) {
            void drainQueue();
        }
    };
}
export function getAuditSinkStatus() {
    return currentAuditSinkStatus;
}
/** In-memory append-only store; production would use persistent tamper-evident sink */
const log = [];
let sequenceId = 0;
let lastHash = "genesis";
const pendingEvents = [];
let processingQueue = false;
/** L2-04: Atomic lock for hash-chain integrity with concurrent callers */
let auditLock = false;
const auditLockQueue = [];
async function acquireAuditLock() {
    if (!auditLock) {
        auditLock = true;
        return;
    }
    return new Promise((resolve) => {
        auditLockQueue.push(resolve);
    });
}
function releaseAuditLock() {
    if (auditLockQueue.length > 0) {
        const next = auditLockQueue.shift();
        next?.();
    }
    else {
        auditLock = false;
    }
}
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
 * Append a single audit event with atomic hash-chain integrity.
 * L2-04: Uses async lock to ensure sequence_id and hash chain consistency for concurrent callers.
 */
export async function writeAuditEventAsync(event) {
    await acquireAuditLock();
    try {
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
                const result = persistentSink(full);
                if (result instanceof Promise) {
                    await result.catch((err) => {
                        console.error("[audit] persistent sink write failed", err);
                    });
                }
            }
            catch (err) {
                console.error("[audit] persistent sink write failed", err);
            }
        }
        lastHash = eventHash;
        return full;
    }
    finally {
        releaseAuditLock();
    }
}
/**
 * Synchronous version for backward compatibility.
 * For concurrent scenarios, use writeAuditEventAsync.
 */
export function writeAuditEvent(event) {
    pendingEvents.push(event);
    if (processingQueue)
        return;
    processingQueue = true;
    try {
        while (pendingEvents.length > 0) {
            const nextEvent = pendingEvents.shift();
            if (!nextEvent)
                break;
            sequenceId += 1;
            const entry = {
                ...nextEvent,
                sequence_id: sequenceId,
                previous_event_hash: lastHash,
            };
            const eventHash = hashPayload(entry);
            const full = { ...entry, event_hash: eventHash };
            log.push(full);
            if (persistentSink) {
                try {
                    const result = persistentSink(full);
                    if (result instanceof Promise) {
                        void result.catch((err) => {
                            console.error("[audit] persistent sink write failed", err);
                        });
                    }
                }
                catch (err) {
                    console.error("[audit] persistent sink write failed", err);
                }
            }
            lastHash = eventHash;
        }
    }
    finally {
        processingQueue = false;
    }
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
    pendingEvents.length = 0;
    processingQueue = false;
    auditLock = false;
    auditLockQueue.length = 0;
    currentAuditSinkStatus = null;
    backpressureCallback = null;
}
//# sourceMappingURL=audit-logger.js.map