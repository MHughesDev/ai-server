/**
 * Production persistent sink assertion tests (PR-012).
 */

import { assertProductionPersistentSinks } from "./assert-production-persistent-sinks.js";
import { loadConfigFromEnv } from "./schema.js";

const originalEnv = process.env;

beforeEach(() => {
  process.env = { ...originalEnv };
});

afterAll(() => {
  process.env = originalEnv;
});

describe("assertProductionPersistentSinks", () => {
  it("allows when both sink paths are set", () => {
    process.env.NODE_ENV = "production";
    process.env.AUDIT_LOG_PATH = "/var/log/ai-server/audit.jsonl";
    process.env.OBSERVABILITY_EVENT_SINK_PATH = "/var/log/ai-server/events.ndjson";
    expect(() => assertProductionPersistentSinks(loadConfigFromEnv())).not.toThrow();
  });

  it("throws when AUDIT_LOG_PATH is missing", () => {
    process.env.NODE_ENV = "production";
    delete process.env.AUDIT_LOG_PATH;
    process.env.OBSERVABILITY_EVENT_SINK_PATH = "/var/log/ai-server/events.ndjson";
    expect(() => assertProductionPersistentSinks(loadConfigFromEnv())).toThrow(/AUDIT_LOG_PATH/);
  });

  it("throws when OBSERVABILITY_EVENT_SINK_PATH is missing", () => {
    process.env.NODE_ENV = "production";
    process.env.AUDIT_LOG_PATH = "/var/log/ai-server/audit.jsonl";
    delete process.env.OBSERVABILITY_EVENT_SINK_PATH;
    expect(() => assertProductionPersistentSinks(loadConfigFromEnv())).toThrow(
      /OBSERVABILITY_EVENT_SINK_PATH/
    );
  });

  it("skips in non-production", () => {
    process.env.NODE_ENV = "development";
    delete process.env.AUDIT_LOG_PATH;
    delete process.env.OBSERVABILITY_EVENT_SINK_PATH;
    expect(() => assertProductionPersistentSinks(loadConfigFromEnv())).not.toThrow();
  });
});
