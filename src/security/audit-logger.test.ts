/**
 * Audit logger unit tests – integrity chain and append-only behavior.
 * @see L2-05 Phase 1, SEC-002
 */

import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  writeAuditEvent,
  verifyAuditIntegrity,
  getAuditLogSnapshot,
  resetAuditLog,
  setAuditSink,
  createFileAuditSink,
  type AuditLogEntry,
} from "./audit-logger.js";

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

  it("createFileAuditSink appends JSON lines to file", () => {
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
      const content = readFileSync(filePath, "utf8");
      const lines = content.trim().split("\n");
      expect(lines).toHaveLength(2);
      expect(JSON.parse(lines[0]!).event_type).toBe("FILE_SINK");
      expect(JSON.parse(lines[1]!).event_type).toBe("FILE_SINK_2");
    } finally {
      rmSync(dir, { recursive: true });
    }
  });
});
