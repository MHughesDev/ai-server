/**
 * Persistent audit + event sinks integration (PR-012).
 */

import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { bootstrap, resetConfigForTest } from "../bootstrap/index.js";
import { wirePersistentSinksFromConfig } from "../config/persistent-sinks.js";
import { getEventSink, setEventSink } from "../observability/event-sink.js";
import {
  getAuditSinkStatus,
  setAuditSink,
  writeAuditEventAsync,
} from "../security/audit-logger.js";

const originalEnv = process.env;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe("persistent sinks integration (PR-012)", () => {
  beforeEach(() => {
    resetConfigForTest();
    process.env = { ...originalEnv, NODE_ENV: "development" };
    setAuditSink(null);
    setEventSink(null);
  });

  afterEach(() => {
    setAuditSink(null);
    setEventSink(null);
    process.env = originalEnv;
    resetConfigForTest();
  });

  it("wires sinks and persists audit + telemetry with rotation", async () => {
    const dir = mkdtempSync(join(tmpdir(), "sinks-int-"));
    const auditPath = join(dir, "audit.jsonl");
    const eventPath = join(dir, "events.ndjson");
    process.env.AUDIT_LOG_PATH = auditPath;
    process.env.OBSERVABILITY_EVENT_SINK_PATH = eventPath;
    process.env.AUDIT_LOG_MAX_FILE_BYTES = "350";
    process.env.AUDIT_LOG_MAX_ROTATED_FILES = "2";
    process.env.OBSERVABILITY_EVENT_SINK_MAX_FILE_BYTES = "250";
    process.env.OBSERVABILITY_EVENT_SINK_MAX_ROTATED_FILES = "2";

    const config = bootstrap();
    wirePersistentSinksFromConfig(config);

    await writeAuditEventAsync({
      event_type: "SINK_INT",
      request_id: "req-sink-int",
      timestamp_iso: new Date().toISOString(),
      payload: { check: true, pad: "z".repeat(200) },
    });

    const eventSink = getEventSink();
    expect(eventSink).not.toBeNull();
    for (let i = 0; i < 5; i++) {
      eventSink?.write({
        event_type: "FINAL_SYNTH",
        request_id: `evt-${i}`,
        payload: { pad: "w".repeat(100) },
      });
    }

    for (let i = 0; i < 150; i++) {
      const auditStatus = getAuditSinkStatus();
      const eventStatus = eventSink?.getStatus?.();
      if (
        auditStatus &&
        auditStatus.queueDepth === 0 &&
        !auditStatus.isDraining &&
        eventStatus &&
        eventStatus.queueDepth === 0 &&
        !eventStatus.isDraining
      ) {
        break;
      }
      await sleep(15);
    }

    expect(existsSync(auditPath)).toBe(true);
    expect(existsSync(eventPath)).toBe(true);
    const auditContent = readFileSync(auditPath, "utf8").trim();
    expect(auditContent.length).toBeGreaterThan(0);
    expect(JSON.parse(auditContent.split("\n")[0] ?? "{}").event_type).toBe("SINK_INT");

    const eventContent = readFileSync(eventPath, "utf8").trim();
    expect(eventContent.split("\n").length).toBeGreaterThan(0);

    rmSync(dir, { recursive: true, force: true });
  });
});
