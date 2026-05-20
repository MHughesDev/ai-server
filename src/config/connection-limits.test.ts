import { describe, it, expect, beforeEach, afterAll } from "@jest/globals";
import { loadConnectionLimitConfig } from "./connection-limits.js";

const originalEnv = process.env;

describe("loadConnectionLimitConfig", () => {
  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it("uses defaults when env vars are unset", () => {
    delete process.env.MAX_CONNECTIONS;
    delete process.env.MAX_CONCURRENT_REQUESTS;
    const config = loadConnectionLimitConfig();
    expect(config.maxConnections).toBe(1000);
    expect(config.maxConcurrentRequests).toBe(100);
  });

  it("throws on invalid positive integer env", () => {
    process.env.MAX_CONNECTIONS = "0";
    expect(() => loadConnectionLimitConfig()).toThrow(/MAX_CONNECTIONS/);
  });
});
