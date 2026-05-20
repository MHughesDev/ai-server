/**
 * Shared telemetry redaction helper (WANT-012).
 */

import { describe, it, expect } from "@jest/globals";
import { redactTelemetryEvent } from "./redact-event.js";
import { payloadHasSensitiveKeys } from "./redact.js";
import type { TelemetryEvent } from "./events.js";

describe("redactTelemetryEvent (WANT-012)", () => {
  it("strips sensitive keys from payload before sink persistence", () => {
    const event: TelemetryEvent = {
      event_type: "TEST",
      request_id: "r1",
      redaction_level: "minimal",
      payload: {
        allowed: true,
        api_key: "sk-live",
        nested: { client_secret: "cs" },
      },
    };
    const out = redactTelemetryEvent(event);
    expect(out.payload?.api_key).toBeUndefined();
    expect((out.payload?.nested as Record<string, unknown>)?.client_secret).toBeUndefined();
    expect(payloadHasSensitiveKeys(out.payload)).toBe(false);
  });
});
