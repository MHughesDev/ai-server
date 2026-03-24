/**
 * Optional persistent event sink for observability (long-term retention).
 * @see docs/SPEC/18_Observability_Spec.md, L2-04 – in-memory/capture only → optional sink
 * When set, emitted events (after sampling/redaction) are also written to the sink.
 * L2-04: Backpressure handling for high-volume scenarios.
 */

import { appendFile, access, rename, stat } from "node:fs/promises";
import { constants } from "node:fs";
import { syncFileToDisk } from "../fs/sync-file-to-disk.js";
import type { TelemetryEvent } from "./events.js";

/** Sink for telemetry events; e.g. file append or OTEL exporter. */
export interface IEventSink {
  write(event: TelemetryEvent): void;
  getStatus?(): EventSinkStatus;
  close?(): Promise<void>;
  /** L2-04: Returns true when backpressure is active (queue above threshold) */
  isBackpressureActive?(): boolean;
}

export interface EventSinkStatus {
  queueDepth: number;
  maxQueueSize: number;
  droppedEvents: number;
  isDraining: boolean;
  lastError: string | null;
  /** L2-04: Backpressure indicator */
  backpressureActive: boolean;
}

export interface FileEventSinkOptions {
  maxQueueSize?: number;
  maxFileSizeBytes?: number;
  maxRotatedFiles?: number;
  /** L2-04: Backpressure threshold (0-1), default 0.8 */
  backpressureThreshold?: number;
  /** When true, `fsync` after each append (env `OBSERVABILITY_EVENT_SINK_FSYNC=true` in `server/index.ts`). */
  fsyncAfterEachWrite?: boolean;
}

/** L2-04: Global backpressure state */
let backpressureActive = false;
let backpressureCallback: (() => void) | null = null;

/** L2-04: Set callback for backpressure events */
export function setEventBackpressureCallback(callback: (() => void) | null): void {
  backpressureCallback = callback;
}

/** L2-04: Check if event sink backpressure is active */
export function isEventBackpressureActive(): boolean {
  return backpressureActive;
}

let eventSink: IEventSink | null = null;

export function setEventSink(sink: IEventSink | null): void {
  eventSink = sink;
}

export function getEventSink(): IEventSink | null {
  return eventSink;
}

/** File sink: one JSON line per event (NDJSON). Enable via OBSERVABILITY_EVENT_SINK_PATH.
 * Non-blocking queued writer with bounded queue and size-based rotation.
 * L2-04: Backpressure handling for queue management.
 */
export function createFileEventSink(
  filePath: string,
  options: FileEventSinkOptions = {}
): IEventSink {
  const maxQueueSize = options.maxQueueSize ?? 1_000;
  const maxFileSizeBytes = options.maxFileSizeBytes ?? 10 * 1024 * 1024;
  const maxRotatedFiles = options.maxRotatedFiles ?? 3;
  const backpressureThreshold = options.backpressureThreshold ?? 0.8;
  const fsyncAfterEachWrite = options.fsyncAfterEachWrite === true;
  const queue: string[] = [];
  let droppedEvents = 0;
  let draining = false;
  let closed = false;
  let lastError: string | null = null;
  let localBackpressureActive = false;

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
    if (draining || closed) return;
    draining = true;
    try {
      while (queue.length > 0 && !closed) {
        const line = queue.shift();
        if (!line) break;
        await maybeRotate(Buffer.byteLength(line));
        await appendFile(filePath, line, "utf8");
        if (fsyncAfterEachWrite) {
          await syncFileToDisk(filePath);
        }
      }
      lastError = null;
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
      console.error("[observability] event sink async write failed", err);
    } finally {
      draining = false;
      // L2-04: Update backpressure status after draining
      localBackpressureActive = queue.length >= maxQueueSize * backpressureThreshold;
      backpressureActive = localBackpressureActive;
      if (queue.length > 0 && !closed) {
        setImmediate(() => {
          void drainQueue();
        });
      }
    }
  }

  return {
    write(event: TelemetryEvent): void {
      if (closed) return;
      const line = `${JSON.stringify(event)}\n`;

      if (queue.length >= maxQueueSize) {
        droppedEvents += 1;
        queue.shift();
      }
      queue.push(line);

      // L2-04: Check backpressure after adding to queue
      const currentFillRatio = queue.length / maxQueueSize;
      localBackpressureActive = currentFillRatio >= backpressureThreshold;
      backpressureActive = localBackpressureActive;

      // L2-04: Trigger backpressure if threshold crossed
      if (localBackpressureActive && backpressureCallback) {
        try {
          backpressureCallback();
        } catch (err) {
          console.error("[observability] backpressure callback failed", err);
        }
      }

      if (!draining) {
        void drainQueue();
      }
    },
    getStatus(): EventSinkStatus {
      return {
        queueDepth: queue.length,
        maxQueueSize,
        droppedEvents,
        isDraining: draining,
        lastError,
        backpressureActive: localBackpressureActive,
      };
    },
    isBackpressureActive(): boolean {
      return localBackpressureActive;
    },
    async close(): Promise<void> {
      closed = true;
      while (draining) {
        await new Promise((resolve) => setTimeout(resolve, 5));
      }
      if (queue.length === 0) return;
      await appendFile(filePath, queue.join(""), "utf8");
      if (fsyncAfterEachWrite) {
        await syncFileToDisk(filePath);
      }
      queue.length = 0;
    },
  };
}
