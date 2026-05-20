/**
 * File event sink defensive redaction (WANT-012).
 */

import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, it, expect, afterEach } from "@jest/globals";
import { createFileEventSink } from "./event-sink.js";
import { payloadHasSensitiveKeys } from "./redact.js";
import type { TelemetryEvent } from "./events.js";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe("createFileEventSink redaction (WANT-012)", () => {
  let dir: string;

  afterEach(() => {
    if (dir && existsSync(dir)) rmSync(dir, { recursive: true, force: true });
  });

  it("redacts sensitive fields when write bypasses the emitter", async () => {
    dir = mkdtempSync(join(tmpdir(), "sink-redact-"));
    const path = join(dir, "events.ndjson");
    const sink = createFileEventSink(path);
    const event: TelemetryEvent = {
      event_type: "ENGINE_END",
      request_id: "req-sink",
      redaction_level: "minimal",
      payload: {
        engine_type: "execution",
        password: "plaintext-secret",
      },
    };
    sink.write(event);
    for (let i = 0; i < 50; i++) {
      if (existsSync(path)) break;
      await sleep(10);
    }
    await sink.close?.();
    const raw = readFileSync(path, "utf8");
    expect(raw).not.toContain("plaintext-secret");
    const parsed = JSON.parse(raw.trim()) as TelemetryEvent;
    expect(payloadHasSensitiveKeys(parsed.payload)).toBe(false);
  });
});
