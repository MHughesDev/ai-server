/**
 * Audit logger unit tests – integrity chain and append-only behavior.
 * @see L2-05 Phase 1, SEC-002
 */

import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  writeAuditEvent,
  writeAuditEventAsync,
  verifyAuditIntegrity,
  getAuditLogSnapshot,
  resetAuditLog,
  setAuditSink,
  createFileAuditSink,
  getAuditSinkStatus,
  setBackpressureCallback,
  setAuditMemoryCapForTests,
  verifyAuditLogFileIntegrity,
  shutdownPersistentAuditFileSink,
  type AuditLogEntry,
} from "./audit-logger.js";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Wait until file audit sink queue is drained so temp dirs can be removed safely. */
async function waitForAuditDrain(): Promise<void> {
  for (let i = 0; i < 100; i++) {
    const s = getAuditSinkStatus();
    if (s && s.queueDepth === 0 && !s.isDraining) return;
    await sleep(10);
  }
}

describe("audit-logger", () => {
  beforeEach(() => {
    resetAuditLog();
    setAuditSink(null);
  });

  it("appends events with sequence_id and previous_event_hash", () => {
    writeAuditEvent({
      event_type: "TEST",
      request_id: "req-1",
      timestamp_iso: new Date().toISOString(),
      payload: { a: 1 },
    });
    const log = getAuditLogSnapshot();
    expect(log.length).toBe(1);
    expect(log[0].sequence_id).toBe(1);
    expect(log[0].previous_event_hash).toBe("genesis");
    expect(log[0].event_hash).toBeDefined();
    expect(typeof log[0].event_hash).toBe("string");
  });

  it("builds hash chain across multiple events", () => {
    writeAuditEvent({
      event_type: "A",
      request_id: "r1",
      timestamp_iso: new Date().toISOString(),
      payload: {},
    });
    writeAuditEvent({
      event_type: "B",
      request_id: "r2",
      timestamp_iso: new Date().toISOString(),
      payload: {},
    });
    const log = getAuditLogSnapshot();
    expect(log.length).toBe(2);
    expect(log[1].previous_event_hash).toBe(log[0].event_hash);
  });

  it("verifyAuditIntegrity returns valid for unmodified log", () => {
    writeAuditEvent({
      event_type: "X",
      request_id: "r",
      timestamp_iso: new Date().toISOString(),
      payload: {},
    });
    expect(verifyAuditIntegrity()).toEqual({ valid: true });
  });

  it("trims in-memory audit ring and verifyAuditIntegrity checks retained suffix chain", () => {
    setAuditMemoryCapForTests(5);
    for (let i = 0; i < 8; i++) {
      writeAuditEvent({
        event_type: `E${i}`,
        request_id: `r${i}`,
        timestamp_iso: new Date().toISOString(),
        payload: { i },
      });
    }
    const snap = getAuditLogSnapshot();
    expect(snap.length).toBe(5);
    expect(verifyAuditIntegrity().valid).toBe(true);
  });

  it("verifyAuditIntegrity detects tampering of payload", () => {
    writeAuditEvent({
      event_type: "X",
      request_id: "r",
      timestamp_iso: new Date().toISOString(),
      payload: { x: 1 },
    });
    const log = getAuditLogSnapshot() as AuditLogEntry[];
    expect(verifyAuditIntegrity().valid).toBe(true);
    (log[0] as Record<string, unknown>).payload = { x: 2 };
    expect(verifyAuditIntegrity()).toMatchObject({
      valid: false,
      firstInvalidIndex: 0,
    });
  });

  it("verifyAuditIntegrity detects broken chain", () => {
    writeAuditEvent({
      event_type: "A",
      request_id: "r1",
      timestamp_iso: new Date().toISOString(),
      payload: {},
    });
    writeAuditEvent({
      event_type: "B",
      request_id: "r2",
      timestamp_iso: new Date().toISOString(),
      payload: {},
    });
    const log = getAuditLogSnapshot() as AuditLogEntry[];
    log[1].previous_event_hash = "tampered";
    expect(verifyAuditIntegrity()).toMatchObject({
      valid: false,
      firstInvalidIndex: 1,
    });
  });

  it("writes to persistent sink when set (L2-05 file sink)", () => {
    const sinkEntries: AuditLogEntry[] = [];
    setAuditSink((entry) => sinkEntries.push(entry));
    writeAuditEvent({
      event_type: "TEST_SINK",
      request_id: "req-sink",
      timestamp_iso: new Date().toISOString(),
      payload: { key: "value" },
    });
    expect(sinkEntries).toHaveLength(1);
    expect(sinkEntries[0].event_type).toBe("TEST_SINK");
    expect(sinkEntries[0].event_hash).toBeDefined();
  });

  it("rotates audit file when max size exceeded (PR-012)", async () => {
    const dir = mkdtempSync(join(tmpdir(), "audit-rotate-"));
    const filePath = join(dir, "audit.jsonl");
    try {
      setAuditSink(
        createFileAuditSink(filePath, {
          maxFileSizeBytes: 400,
          maxRotatedFiles: 2,
          maxQueueSize: 100,
        })
      );
      const payload = { blob: "x".repeat(300) };
      for (let i = 0; i < 4; i++) {
        await writeAuditEventAsync({
          event_type: `ROTATE_${i}`,
          request_id: `req-${i}`,
          timestamp_iso: new Date().toISOString(),
          payload,
        });
      }
      for (let i = 0; i < 100; i++) {
        const status = getAuditSinkStatus();
        if (status && status.queueDepth === 0 && !status.isDraining) break;
        await sleep(10);
      }
      expect(existsSync(`${filePath}.1`)).toBe(true);
    } finally {
      setAuditSink(null);
      rmSync(dir, { recursive: true });
    }
  });

  it("createFileAuditSink appends JSON lines to file", async () => {
    const dir = mkdtempSync(join(tmpdir(), "audit-"));
    const filePath = join(dir, "audit.jsonl");
    try {
      setAuditSink(createFileAuditSink(filePath));
      writeAuditEvent({
        event_type: "FILE_SINK",
        request_id: "r1",
        timestamp_iso: new Date().toISOString(),
        payload: {},
      });
      writeAuditEvent({
        event_type: "FILE_SINK_2",
        request_id: "r2",
        timestamp_iso: new Date().toISOString(),
        payload: {},
      });
      for (let i = 0; i < 100; i++) {
        const status = getAuditSinkStatus();
        if (status && status.queueDepth === 0 && !status.isDraining) break;
        await sleep(10);
      }
      const content = readFileSync(filePath, "utf8");
      const lines = content.trim().split("\n");
      expect(lines).toHaveLength(2);
      expect(JSON.parse(lines[0]).event_type).toBe("FILE_SINK");
      expect(JSON.parse(lines[1]).event_type).toBe("FILE_SINK_2");
    } finally {
      rmSync(dir, { recursive: true });
    }
  });

  it("preserves hash-chain sequence when sink re-enters writeAuditEvent", () => {
    setAuditSink((entry) => {
      if (entry.event_type === "ROOT") {
        writeAuditEvent({
          event_type: "NESTED",
          request_id: "nested",
          timestamp_iso: new Date().toISOString(),
          payload: {},
        });
      }
    });
    writeAuditEvent({
      event_type: "ROOT",
      request_id: "root",
      timestamp_iso: new Date().toISOString(),
      payload: {},
    });
    const log = getAuditLogSnapshot();
    expect(log).toHaveLength(2);
    expect(log[0].sequence_id).toBe(1);
    expect(log[1].sequence_id).toBe(2);
    expect(log[1].previous_event_hash).toBe(log[0].event_hash);
    expect(verifyAuditIntegrity().valid).toBe(true);
  });

  describe("async concurrent audit logging (L2-04)", () => {
    it("async write maintains hash-chain integrity with concurrent calls", async () => {
      const events: Promise<AuditLogEntry>[] = [];

      // Fire 10 concurrent audit writes
      for (let i = 0; i < 10; i++) {
        events.push(
          writeAuditEventAsync({
            event_type: `CONCURRENT_${i}`,
            request_id: `req-${i}`,
            timestamp_iso: new Date().toISOString(),
            payload: { index: i },
          })
        );
      }

      const results = await Promise.all(events);

      // All events should have unique sequence IDs
      const sequenceIds = results.map((r) => r.sequence_id);
      const uniqueIds = new Set(sequenceIds);
      expect(uniqueIds.size).toBe(10);

      // Verify integrity
      expect(verifyAuditIntegrity().valid).toBe(true);

      // Verify all events are in log
      const log = getAuditLogSnapshot();
      expect(log.length).toBe(10);
    });

    it("async write preserves correct hash chain order", async () => {
      // Write events in sequence
      const entry1 = await writeAuditEventAsync({
        event_type: "FIRST",
        request_id: "req-1",
        timestamp_iso: new Date().toISOString(),
        payload: {},
      });

      const entry2 = await writeAuditEventAsync({
        event_type: "SECOND",
        request_id: "req-2",
        timestamp_iso: new Date().toISOString(),
        payload: {},
      });

      expect(entry2.previous_event_hash).toBe(entry1.event_hash);
      expect(verifyAuditIntegrity().valid).toBe(true);
    });
  });

  describe("backpressure handling (L2-04)", () => {
    it("triggers backpressure callback when queue fills", async () => {
      const dir = mkdtempSync(join(tmpdir(), "audit-bp-"));
      const filePath = join(dir, "audit.jsonl");

      let backpressureTriggered = false;
      setBackpressureCallback(() => {
        backpressureTriggered = true;
      });

      try {
        // Create sink with very small queue and high threshold to keep items in queue
        setAuditSink(createFileAuditSink(filePath, { maxQueueSize: 5, backpressureThreshold: 0.5 }));

        // Write events quickly (queue fills to 5, triggering backpressure at 2.5 -> 3)
        for (let i = 0; i < 5; i++) {
          writeAuditEvent({
            event_type: `BP_TEST_${i}`,
            request_id: `req-${i}`,
            timestamp_iso: new Date().toISOString(),
            payload: {},
          });
        }

        // Check immediately after writing before draining completes
        expect(backpressureTriggered).toBe(true);
        const status = getAuditSinkStatus();
        expect(status?.backpressureActive).toBe(true);
      } finally {
        await waitForAuditDrain();
        setAuditSink(null);
        setBackpressureCallback(null);
        rmSync(dir, { recursive: true });
      }
    });

    it("status includes backpressure indicator", async () => {
      const dir = mkdtempSync(join(tmpdir(), "audit-bp2-"));
      const filePath = join(dir, "audit.jsonl");

      try {
        setAuditSink(createFileAuditSink(filePath, { maxQueueSize: 10, backpressureThreshold: 0.4 }));

        // Initially no backpressure
        let status = getAuditSinkStatus();
        expect(status?.backpressureActive).toBe(false);

        // Fill queue to 40% threshold (4 items triggers backpressure at 40% of 10)
        for (let i = 0; i < 5; i++) {
          writeAuditEvent({
            event_type: `FILL_${i}`,
            request_id: `req-${i}`,
            timestamp_iso: new Date().toISOString(),
            payload: {},
          });
        }

        // Check immediately - should have backpressure
        status = getAuditSinkStatus();
        expect(status?.backpressureActive).toBe(true);
      } finally {
        await waitForAuditDrain();
        setAuditSink(null);
        rmSync(dir, { recursive: true });
      }
    });
  });

  describe("verifyAuditLogFileIntegrity (on-disk chain)", () => {
    it("returns file_not_found for missing path", async () => {
      const r = await verifyAuditLogFileIntegrity(join(tmpdir(), "no-such-audit-log-xyz"));
      expect(r.valid).toBe(false);
      expect(r.error).toBe("file_not_found");
    });

    it("validates drained file sink output", async () => {
      const dir = mkdtempSync(join(tmpdir(), "audit-disk-"));
      const filePath = join(dir, "audit.jsonl");
      try {
        setAuditSink(createFileAuditSink(filePath));
        writeAuditEvent({
          event_type: "A",
          request_id: "r1",
          timestamp_iso: new Date().toISOString(),
          payload: { x: 1 },
        });
        writeAuditEvent({
          event_type: "B",
          request_id: "r2",
          timestamp_iso: new Date().toISOString(),
          payload: { y: 2 },
        });
        await waitForAuditDrain();
        const r = await verifyAuditLogFileIntegrity(filePath);
        expect(r).toEqual({ valid: true, linesRead: 2 });
      } finally {
        await shutdownPersistentAuditFileSink();
        setAuditSink(null);
        rmSync(dir, { recursive: true });
      }
    });

    it("detects tampered line on disk", async () => {
      const dir = mkdtempSync(join(tmpdir(), "audit-tamper-"));
      const filePath = join(dir, "audit.jsonl");
      try {
        setAuditSink(createFileAuditSink(filePath));
        writeAuditEvent({
          event_type: "OK",
          request_id: "r1",
          timestamp_iso: new Date().toISOString(),
          payload: {},
        });
        await waitForAuditDrain();
        let raw = readFileSync(filePath, "utf8");
        raw = raw.replace('"OK"', '"NOPE"');
        writeFileSync(filePath, raw, "utf8");
        const r = await verifyAuditLogFileIntegrity(filePath);
        expect(r.valid).toBe(false);
        expect(r.error).toBe("hash_mismatch");
      } finally {
        await shutdownPersistentAuditFileSink();
        setAuditSink(null);
        rmSync(dir, { recursive: true });
      }
    });

    it("accepts empty file", async () => {
      const dir = mkdtempSync(join(tmpdir(), "audit-empty-"));
      const filePath = join(dir, "empty.jsonl");
      try {
        writeFileSync(filePath, "", "utf8");
        const r = await verifyAuditLogFileIntegrity(filePath);
        expect(r).toEqual({ valid: true, linesRead: 0 });
      } finally {
        rmSync(dir, { recursive: true });
      }
    });
  });

  describe("shutdownPersistentAuditFileSink", () => {
    it("drains file sink queue then stops file writes", async () => {
      const dir = mkdtempSync(join(tmpdir(), "audit-shut-"));
      const path = join(dir, "a.jsonl");
      try {
        const sink = createFileAuditSink(path);
        setAuditSink(sink);
        writeAuditEvent({
          event_type: "X",
          request_id: "r",
          timestamp_iso: new Date().toISOString(),
          payload: {},
        });
        await shutdownPersistentAuditFileSink();
        await waitForAuditDrain();
        const afterShut = readFileSync(path, "utf8");
        expect(afterShut.trim().length).toBeGreaterThan(0);
        writeAuditEvent({
          event_type: "Y",
          request_id: "r2",
          timestamp_iso: new Date().toISOString(),
          payload: {},
        });
        await sleep(150);
        expect(readFileSync(path, "utf8")).toBe(afterShut);
      } finally {
        setAuditSink(null);
        resetAuditLog();
        rmSync(dir, { recursive: true });
      }
    });
  });
});
