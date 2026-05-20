/**
 * End-to-end telemetry redaction through emitter + file sink (PR-013).
 */

import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { bootstrap, resetConfigForTest } from "../bootstrap/index.js";
import { createConfiguredTelemetryEmitter } from "../config/telemetry-redaction.js";
import { wirePersistentSinksFromConfig } from "../config/persistent-sinks.js";
import { payloadHasSensitiveKeys, resolveTelemetryRedactionLevel } from "../observability/redact.js";
import { setEventSink } from "../observability/event-sink.js";

const originalEnv = process.env;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe("telemetry redaction integration (PR-013)", () => {
  beforeEach(() => {
    resetConfigForTest();
    process.env = { ...originalEnv, NODE_ENV: "development" };
    setEventSink(null);
  });

  afterEach(() => {
    setEventSink(null);
    process.env = originalEnv;
    resetConfigForTest();
  });

  it("persists redacted events to sink without sensitive keys", async () => {
    const dir = mkdtempSync(join(tmpdir(), "telemetry-redact-"));
    const eventPath = join(dir, "events.ndjson");
    process.env.OBSERVABILITY_EVENT_SINK_PATH = eventPath;
    process.env.OBSERVABILITY_REDACTION_LEVEL = "minimal";
    process.env.OBSERVABILITY_REQUIRED_EVENTS_V1 = "true";

    const config = bootstrap();
    expect(resolveTelemetryRedactionLevel()).toBe("minimal");
    wirePersistentSinksFromConfig(config);
    const emitter = createConfiguredTelemetryEmitter(config);
    expect(emitter).not.toBeNull();

    emitter!.emit({
      event_type: "POLICY_DECISION",
      request_id: "req-redact-int",
      payload: {
        allowed: true,
        password: "super-secret",
        client_secret: "cs-live",
        email: "user@example.com",
        pipeline_type: "reactive_chat",
      },
    });

    for (let i = 0; i < 100; i++) {
      if (existsSync(eventPath)) break;
      await sleep(10);
    }
    expect(existsSync(eventPath)).toBe(true);
    const raw = readFileSync(eventPath, "utf8");
    expect(raw).not.toContain("super-secret");
    expect(raw).not.toContain("cs-live");
    expect(raw).not.toContain("user@example.com");

    const line = JSON.parse(raw.trim().split("\n")[0] ?? "{}") as {
      payload?: Record<string, unknown>;
    };
    expect(line.payload?.allowed).toBe(true);
    expect(payloadHasSensitiveKeys(line.payload)).toBe(false);

    rmSync(dir, { recursive: true, force: true });
  });
});
