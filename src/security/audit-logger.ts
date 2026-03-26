/**
 * Tamper-evident audit logger – append-only with integrity markers (hash chain).
 * @see docs/SPEC/19_Security_and_Isolation_Spec.md, L2-05 Phase 1
 * L2-04: Backpressure handling and atomic hash-chain for concurrent callers.
 */

import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { appendFile, access, rename, stat } from "node:fs/promises";
import { constants } from "node:fs";
import { createInterface } from "node:readline";
import { finished } from "node:stream/promises";
import { syncFileToDisk } from "../fs/sync-file-to-disk.js";
import { safeLogError } from "../observability/redact.js";
import type { AuditEvent } from "./types.js";

export interface AuditLogEntry extends AuditEvent {
  sequence_id: number;
  previous_event_hash: string;
  event_hash: string;
}

/** Optional persistent sink; when set, each entry is written after in-memory append */
let persistentSink: ((entry: AuditLogEntry) => void | Promise<void>) | null = null;

/** Registered by `createFileAuditSink` for graceful shutdown (drain queue, then stop accepts). */
let fileAuditSinkShutdownHook: (() => Promise<void>) | null = null;

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

let currentAuditSinkStatus: AuditSinkStatus | null = null;

/** L2-04: Backpressure callback - invoked when queue reaches threshold */
let backpressureCallback: (() => void) | null = null;

export function setAuditSink(
  sink: ((entry: AuditLogEntry) => void | Promise<void>) | null
): void {
  persistentSink = sink;
  if (sink === null) {
    fileAuditSinkShutdownHook = null;
  }
}

/**
 * Wait for the file audit sink queue (from `createFileAuditSink`) to drain, then stop accepting new file writes.
 * Safe to call when no file sink was configured (no-op).
 */
export async function shutdownPersistentAuditFileSink(): Promise<void> {
  const hook = fileAuditSinkShutdownHook;
  if (!hook) return;
  await hook();
}

/** L2-04: Set callback for backpressure events */
export function setBackpressureCallback(callback: (() => void) | null): void {
  backpressureCallback = callback;
}

interface QueuedAuditLine {
  readonly line: string;
  readonly settle: { resolve: () => void; reject: (err: unknown) => void };
}

/**
 * Create a non-blocking file sink with bounded queue and rotation for audit entries.
 * Returns a sink that resolves its **per-entry** `Promise` after that line is appended (and optionally fsynced),
 * so `writeAuditEventAsync` can advance the hash chain only after durable ordering for that entry (WANT-040).
 */
export function createFileAuditSink(
  filePath: string,
  options: FileAuditSinkOptions = {}
): (entry: AuditLogEntry) => Promise<void> {
  const maxQueueSize = options.maxQueueSize ?? 1_000;
  const maxFileSizeBytes = options.maxFileSizeBytes ?? 10 * 1024 * 1024;
  const maxRotatedFiles = options.maxRotatedFiles ?? 3;
  const backpressureThreshold = options.backpressureThreshold ?? 0.8;
  const fsyncAfterEachWrite = options.fsyncAfterEachWrite === true;
  const queue: QueuedAuditLine[] = [];
  let droppedEntries = 0;
  let draining = false;
  let closed = false;
  let lastError: string | null = null;
  let backpressureActive = false;

  currentAuditSinkStatus = {
    queueDepth: 0,
    maxQueueSize,
    droppedEntries: 0,
    isDraining: false,
    lastError: null,
    backpressureActive: false,
  };

  async function fileExists(path: string): Promise<boolean> {
    try {
      await access(path, constants.F_OK);
      return true;
    } catch {
      return false;
    }
  }

  async function maybeRotate(nextWriteBytes: number): Promise<void> {
    try {
      const info = await stat(filePath);
      if (info.size + nextWriteBytes <= maxFileSizeBytes) return;
    } catch {
      return;
    }
    for (let i = maxRotatedFiles; i >= 1; i -= 1) {
      const src = i === 1 ? filePath : `${filePath}.${i - 1}`;
      const dst = `${filePath}.${i}`;
      if (await fileExists(src)) {
        try {
          await rename(src, dst);
        } catch (err) {
          lastError = err instanceof Error ? err.message : String(err);
          break;
        }
      }
    }
  }

  async function drainQueue(): Promise<void> {
    if (draining) return;
    draining = true;
    try {
      while (queue.length > 0) {
        const item = queue.shift();
        if (!item) break;
        try {
          await maybeRotate(Buffer.byteLength(item.line));
          await appendFile(filePath, item.line, "utf8");
          if (fsyncAfterEachWrite) {
            await syncFileToDisk(filePath);
          }
          item.settle.resolve();
        } catch (err) {
          lastError = err instanceof Error ? err.message : String(err);
          console.error("[audit] persistent sink write failed", safeLogError(err));
          item.settle.reject(err);
        }
      }
      lastError = null;
    } finally {
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
      if (queue.length > 0) {
        setImmediate(() => {
          void drainQueue();
        });
      }
    }
  }

  fileAuditSinkShutdownHook = async () => {
    try {
      const deadline = Date.now() + 30_000;
      while ((queue.length > 0 || draining) && Date.now() < deadline) {
        if (queue.length > 0 && !draining) {
          void drainQueue();
        }
        await new Promise((r) => setTimeout(r, 50));
      }
      if (queue.length > 0 || draining) {
        console.warn("[audit] file sink did not fully drain before shutdown timeout");
      }
      closed = true;
    } finally {
      fileAuditSinkShutdownHook = null;
    }
  };

  return (entry: AuditLogEntry): Promise<void> => {
    if (closed) return Promise.resolve();
    const line = `${JSON.stringify(entry)}\n`;

    return new Promise<void>((resolve, reject) => {
      if (queue.length >= maxQueueSize) {
        droppedEntries += 1;
        const dropped = queue.shift();
        dropped?.settle.reject(new Error("audit_file_sink_queue_overflow"));
      }
      queue.push({
        line,
        settle: { resolve, reject },
      });

      // L2-04: Backpressure check after adding to queue
      const currentFillRatio = queue.length / maxQueueSize;
      backpressureActive = currentFillRatio >= backpressureThreshold;

      // L2-04: Trigger backpressure callback if threshold crossed
      if (backpressureActive && backpressureCallback) {
        try {
          backpressureCallback();
        } catch (err) {
          console.error("[audit] backpressure callback failed", safeLogError(err));
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
    });
  };
}

export function getAuditSinkStatus(): AuditSinkStatus | null {
  return currentAuditSinkStatus;
}

/** Default cap on in-memory audit ring (file sink retains full chain on disk). */
const DEFAULT_MAX_IN_MEMORY_AUDIT_ENTRIES = 10_000;
let maxInMemoryAuditEntries = DEFAULT_MAX_IN_MEMORY_AUDIT_ENTRIES;

/**
 * Test/support: shrink in-memory cap to exercise trimming without 10k writes.
 * @internal
 */
export function setAuditMemoryCapForTests(cap: number): void {
  maxInMemoryAuditEntries = Math.max(1, cap);
}

/** In-memory ring for tests and debugging; bounded for long-lived processes. */
const log: AuditLogEntry[] = [];
let sequenceId = 0;
let lastHash = "genesis";
const pendingEvents: AuditEvent[] = [];
let processingQueue = false;

/** L2-04: Atomic lock for hash-chain integrity with concurrent callers */
let auditLock = false;
const auditLockQueue: (() => void)[] = [];

async function acquireAuditLock(): Promise<void> {
  if (!auditLock) {
    auditLock = true;
    return;
  }
  return new Promise((resolve) => {
    auditLockQueue.push(resolve);
  });
}

function releaseAuditLock(): void {
  if (auditLockQueue.length > 0) {
    const next = auditLockQueue.shift();
    next?.();
  } else {
    auditLock = false;
  }
}

function appendInMemoryAuditEntry(full: AuditLogEntry): void {
  while (log.length >= maxInMemoryAuditEntries) {
    log.shift();
  }
  log.push(full);
}

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
 * Append a single audit event with atomic hash-chain integrity.
 * L2-04: Uses async lock to ensure sequence_id and hash chain consistency for concurrent callers.
 */
export async function writeAuditEventAsync(event: AuditEvent): Promise<AuditLogEntry> {
  await acquireAuditLock();
  try {
    sequenceId += 1;
    const entry: Omit<AuditLogEntry, "event_hash"> = {
      ...event,
      sequence_id: sequenceId,
      previous_event_hash: lastHash,
    };
    const eventHash = hashPayload(entry);
    const full: AuditLogEntry = { ...entry, event_hash: eventHash };
    appendInMemoryAuditEntry(full);

    if (persistentSink) {
      try {
        const result = persistentSink(full);
        if (result instanceof Promise) {
          await result.catch((err) => {
            console.error("[audit] persistent sink write failed", safeLogError(err));
          });
        }
      } catch (err) {
        console.error("[audit] persistent sink write failed", safeLogError(err));
      }
    }

    lastHash = eventHash;
    return full;
  } finally {
    releaseAuditLock();
  }
}

/**
 * Synchronous version for backward compatibility.
 * For concurrent scenarios, use writeAuditEventAsync.
 */
export function writeAuditEvent(event: AuditEvent): void {
  pendingEvents.push(event);
  if (processingQueue) return;
  processingQueue = true;
  try {
    while (pendingEvents.length > 0) {
      const nextEvent = pendingEvents.shift();
      if (!nextEvent) break;
      sequenceId += 1;
      const entry: Omit<AuditLogEntry, "event_hash"> = {
        ...nextEvent,
        sequence_id: sequenceId,
        previous_event_hash: lastHash,
      };
      const eventHash = hashPayload(entry);
      const full: AuditLogEntry = { ...entry, event_hash: eventHash };
      appendInMemoryAuditEntry(full);
      if (persistentSink) {
        try {
          const result = persistentSink(full);
          if (result instanceof Promise) {
            void result.catch((err) => {
              console.error("[audit] persistent sink write failed", safeLogError(err));
            });
          }
        } catch (err) {
          console.error("[audit] persistent sink write failed", safeLogError(err));
        }
      }
      lastHash = eventHash;
    }
  } finally {
    processingQueue = false;
  }
}

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
export async function verifyAuditLogFileIntegrity(filePath: string): Promise<AuditFileVerifyResult> {
  try {
    await access(filePath, constants.R_OK);
  } catch {
    return { valid: false, linesRead: 0, error: "file_not_found" };
  }

  const stream = createReadStream(filePath, { encoding: "utf8" });
  const rl = createInterface({ input: stream, crlfDelay: Infinity });

  let lineNo = 0;
  let jsonLineIndex = 0;
  let prevEventHash: string | null = null;

  try {
    for await (const line of rl) {
      lineNo++;
      const trimmed = line.trim();
      if (trimmed.length === 0) continue;
      jsonLineIndex++;

      let entry: AuditLogEntry;
      try {
        entry = JSON.parse(trimmed) as AuditLogEntry;
      } catch {
        return {
          valid: false,
          linesRead: jsonLineIndex,
          firstInvalidLine: lineNo,
          error: "invalid_json",
        };
      }

      if (
        typeof entry.sequence_id !== "number" ||
        typeof entry.previous_event_hash !== "string" ||
        typeof entry.event_hash !== "string" ||
        typeof entry.event_type !== "string" ||
        typeof entry.request_id !== "string" ||
        typeof entry.timestamp_iso !== "string" ||
        entry.payload === undefined ||
        typeof entry.payload !== "object" ||
        entry.payload === null ||
        Array.isArray(entry.payload)
      ) {
        return {
          valid: false,
          linesRead: jsonLineIndex,
          firstInvalidLine: lineNo,
          error: "missing_fields",
        };
      }

      if (jsonLineIndex > 1) {
        if (entry.previous_event_hash !== prevEventHash) {
          return {
            valid: false,
            linesRead: jsonLineIndex,
            firstInvalidLine: lineNo,
            error: "chain_break",
          };
        }
      }

      const withoutHash: Omit<AuditLogEntry, "event_hash"> = {
        sequence_id: entry.sequence_id,
        previous_event_hash: entry.previous_event_hash,
        event_type: entry.event_type,
        request_id: entry.request_id,
        timestamp_iso: entry.timestamp_iso,
        payload: entry.payload,
      };
      if (hashPayload(withoutHash) !== entry.event_hash) {
        return {
          valid: false,
          linesRead: jsonLineIndex,
          firstInvalidLine: lineNo,
          error: "hash_mismatch",
        };
      }

      prevEventHash = entry.event_hash;
    }
  } catch (err) {
    return {
      valid: false,
      linesRead: jsonLineIndex,
      error: "read_error",
      detail: err instanceof Error ? err.message : String(err),
    };
  } finally {
    rl.close();
    stream.destroy();
    await finished(stream).catch(() => undefined);
  }

  return { valid: true, linesRead: jsonLineIndex };
}

export function verifyAuditIntegrity(): { valid: boolean; firstInvalidIndex?: number } {
  if (log.length === 0) return { valid: true };
  const first = log[0];
  const firstWithoutHash: Omit<AuditLogEntry, "event_hash"> = {
    sequence_id: first.sequence_id,
    previous_event_hash: first.previous_event_hash,
    event_type: first.event_type,
    request_id: first.request_id,
    timestamp_iso: first.timestamp_iso,
    payload: first.payload,
  };
  if (hashPayload(firstWithoutHash) !== first.event_hash) {
    return { valid: false, firstInvalidIndex: 0 };
  }
  let prevHash = first.event_hash;
  for (let i = 1; i < log.length; i++) {
    const entry = log[i];
    if (entry.previous_event_hash !== prevHash) {
      return { valid: false, firstInvalidIndex: i };
    }
    const entryWithoutHash: Omit<AuditLogEntry, "event_hash"> = {
      sequence_id: entry.sequence_id,
      previous_event_hash: entry.previous_event_hash,
      event_type: entry.event_type,
      request_id: entry.request_id,
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
  pendingEvents.length = 0;
  processingQueue = false;
  auditLock = false;
  auditLockQueue.length = 0;
  currentAuditSinkStatus = null;
  backpressureCallback = null;
  maxInMemoryAuditEntries = DEFAULT_MAX_IN_MEMORY_AUDIT_ENTRIES;
  fileAuditSinkShutdownHook = null;
}
