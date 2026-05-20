import { loadConfigFromEnv } from "./schema.js";
import { assertProductionConnectionLimits } from "./assert-production-connection-limits.js";

const originalEnv = process.env;

describe("assertProductionConnectionLimits (PR-021)", () => {
  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it("does not require limits in non-production", () => {
    process.env.NODE_ENV = "development";
    delete process.env.MAX_CONNECTIONS;
    expect(() => assertProductionConnectionLimits()).not.toThrow();
  });

  it("throws when production omits required limit env vars", () => {
    process.env.NODE_ENV = "production";
    delete process.env.MAX_CONNECTIONS;
    process.env.MAX_CONCURRENT_REQUESTS = "100";
    process.env.MAX_CONNECTIONS_PER_IP = "50";
    process.env.MAX_REQUEST_QUEUE_DEPTH = "50";
    process.env.MAX_BODY_BYTES = "1000000";
    expect(() => assertProductionConnectionLimits()).toThrow(/MAX_CONNECTIONS/);
  });

  it("passes when production limit env vars are set", () => {
    process.env.NODE_ENV = "production";
    process.env.MAX_CONNECTIONS = "1000";
    process.env.MAX_CONNECTIONS_PER_IP = "100";
    process.env.MAX_CONCURRENT_REQUESTS = "100";
    process.env.MAX_REQUEST_QUEUE_DEPTH = "50";
    process.env.MAX_BODY_BYTES = "1000000";
    expect(() => assertProductionConnectionLimits()).not.toThrow();
    expect(loadConfigFromEnv().maxRequestBodyBytes).toBe(1_000_000);
  });
});
