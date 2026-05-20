/**
 * Production telemetry redaction assertion tests (PR-013).
 */

import { assertProductionTelemetryRedaction } from "./assert-production-telemetry-redaction.js";
import { loadConfigFromEnv } from "./schema.js";

const originalEnv = process.env;

beforeEach(() => {
  process.env = { ...originalEnv };
});

afterAll(() => {
  process.env = originalEnv;
});

describe("assertProductionTelemetryRedaction", () => {
  it("allows minimal redaction with observability and security flags", () => {
    process.env.NODE_ENV = "production";
    process.env.OBSERVABILITY_REDACTION_LEVEL = "minimal";
    process.env.OBSERVABILITY_REQUIRED_EVENTS_V1 = "true";
    process.env.SECURITY_HARD_CONTROLS_ENABLED = "true";
    expect(() => assertProductionTelemetryRedaction(loadConfigFromEnv())).not.toThrow();
  });

  it("throws when redaction level is none", () => {
    process.env.NODE_ENV = "production";
    process.env.OBSERVABILITY_REDACTION_LEVEL = "none";
    expect(() => assertProductionTelemetryRedaction(loadConfigFromEnv())).toThrow(
      /OBSERVABILITY_REDACTION_LEVEL=minimal/
    );
  });

  it("throws when observability events flag is disabled", () => {
    process.env.NODE_ENV = "production";
    process.env.OBSERVABILITY_REDACTION_LEVEL = "minimal";
    process.env.OBSERVABILITY_REQUIRED_EVENTS_V1 = "false";
    expect(() => assertProductionTelemetryRedaction(loadConfigFromEnv())).toThrow(
      /OBSERVABILITY_REQUIRED_EVENTS_V1/
    );
  });

  it("skips in non-production", () => {
    process.env.NODE_ENV = "development";
    process.env.OBSERVABILITY_REDACTION_LEVEL = "none";
    expect(() => assertProductionTelemetryRedaction(loadConfigFromEnv())).not.toThrow();
  });
});
