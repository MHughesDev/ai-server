/**
 * Graceful shutdown integration (PR-022).
 */

import type { Server } from "node:http";
import { describe, expect, it } from "@jest/globals";
import type { ConnectionLimitConfig } from "../config/connection-limits.js";
import { ConnectionTracker } from "./connection-tracker.js";
import {
  beginInFlightRequest,
  endInFlightRequest,
  isServerDraining,
  resetGracefulShutdownStateForTest,
  runGracefulShutdown,
} from "./graceful-shutdown.js";

const limits: ConnectionLimitConfig = {
  maxConnections: 10,
  maxConnectionsPerIp: 10,
  maxConcurrentRequests: 10,
  maxRequestQueueDepth: 5,
  serverHeadersTimeoutMs: 60_000,
  serverRequestTimeoutMs: 120_000,
};

describe("graceful shutdown integration (PR-022)", () => {
  it("completes SIGTERM shutdown after in-flight requests finish", async () => {
    resetGracefulShutdownStateForTest();
    process.env.SHUTDOWN_DRAIN_TIMEOUT_MS = "2000";
    const tracker = new ConnectionTracker(limits);
    beginInFlightRequest();

    const stubServer = {
      close(callback?: (err?: Error) => void) {
        callback?.();
      },
    } as Server;

    const shutdownPromise = runGracefulShutdown({
      signal: "SIGTERM",
      connectionTracker: tracker,
      httpServer: stubServer,
    });

    expect(isServerDraining()).toBe(true);
    tracker.setDraining(true);
    expect(tracker.isDraining()).toBe(true);

    await new Promise((r) => setTimeout(r, 50));
    endInFlightRequest();

    const drain = await shutdownPromise;
    expect(drain.drained).toBe(true);
    expect(drain.inFlightRequests).toBe(0);
  });
});
