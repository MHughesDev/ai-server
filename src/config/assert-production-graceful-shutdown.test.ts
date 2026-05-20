import { assertProductionGracefulShutdown } from "./assert-production-graceful-shutdown.js";

const originalEnv = process.env;

describe("assertProductionGracefulShutdown (PR-022)", () => {
  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it("does not require drain timeout in non-production", () => {
    process.env.NODE_ENV = "development";
    delete process.env.SHUTDOWN_DRAIN_TIMEOUT_MS;
    expect(() => assertProductionGracefulShutdown()).not.toThrow();
  });

  it("throws when production omits SHUTDOWN_DRAIN_TIMEOUT_MS", () => {
    process.env.NODE_ENV = "production";
    delete process.env.SHUTDOWN_DRAIN_TIMEOUT_MS;
    expect(() => assertProductionGracefulShutdown()).toThrow(/SHUTDOWN_DRAIN_TIMEOUT_MS/);
  });

  it("passes when production sets SHUTDOWN_DRAIN_TIMEOUT_MS", () => {
    process.env.NODE_ENV = "production";
    process.env.SHUTDOWN_DRAIN_TIMEOUT_MS = "30000";
    expect(() => assertProductionGracefulShutdown()).not.toThrow();
  });
});
