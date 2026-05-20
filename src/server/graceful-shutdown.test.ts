import { describe, it, expect, beforeEach, afterEach } from "@jest/globals";
import { jest } from "@jest/globals";
import { Socket } from "node:net";
import type { ConnectionLimitConfig } from "../config/connection-limits.js";
import { ConnectionTracker } from "./connection-tracker.js";
import {
  beginInFlightRequest,
  DEFAULT_SHUTDOWN_DRAIN_TIMEOUT_MS,
  endInFlightRequest,
  isServerDraining,
  loadGracefulShutdownConfig,
  RECOMMENDED_K8S_TERMINATION_GRACE_SECONDS,
  resetGracefulShutdownStateForTest,
  setServerDrainingForTest,
  waitForDrain,
} from "./graceful-shutdown.js";

const limits: ConnectionLimitConfig = {
  maxConnections: 10,
  maxConnectionsPerIp: 10,
  maxConcurrentRequests: 10,
  maxRequestQueueDepth: 5,
  serverHeadersTimeoutMs: 60_000,
  serverRequestTimeoutMs: 120_000,
};

describe("graceful-shutdown (PR-022)", () => {
  beforeEach(() => {
    resetGracefulShutdownStateForTest();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
    resetGracefulShutdownStateForTest();
  });

  it("loads drain timeout from env", () => {
    process.env.SHUTDOWN_DRAIN_TIMEOUT_MS = "45000";
    expect(loadGracefulShutdownConfig().drainTimeoutMs).toBe(45_000);
  });

  it("rejects new in-flight tracking while draining", () => {
    setServerDrainingForTest(true);
    expect(beginInFlightRequest()).toBe(false);
    expect(isServerDraining()).toBe(true);
  });

  it("matches recommended K8s termination grace to default drain SLO", () => {
    expect(RECOMMENDED_K8S_TERMINATION_GRACE_SECONDS * 1000).toBeGreaterThanOrEqual(
      DEFAULT_SHUTDOWN_DRAIN_TIMEOUT_MS + 10_000
    );
  });

  it("waits until in-flight requests complete before resolving drained", async () => {
    const tracker = new ConnectionTracker(limits);
    beginInFlightRequest();
    const waitPromise = waitForDrain(tracker, { drainTimeoutMs: 5000, pollIntervalMs: 100 });
    jest.advanceTimersByTime(50);
    endInFlightRequest();
    jest.advanceTimersByTime(100);
    const result = await waitPromise;
    expect(result.drained).toBe(true);
    expect(result.inFlightRequests).toBe(0);
  });

  it("times out when in-flight work exceeds drain window", async () => {
    const tracker = new ConnectionTracker(limits);
    beginInFlightRequest();
    const waitPromise = waitForDrain(tracker, { drainTimeoutMs: 200, pollIntervalMs: 50 });
    jest.advanceTimersByTime(250);
    const result = await waitPromise;
    expect(result.drained).toBe(false);
    expect(result.inFlightRequests).toBe(1);
    endInFlightRequest();
  });

  it("waits for tracked connections to close", async () => {
    const tracker = new ConnectionTracker(limits);
    const socket = new Socket();
    tracker.tryAccept(socket, "127.0.0.1");
    const waitPromise = waitForDrain(tracker, { drainTimeoutMs: 1000, pollIntervalMs: 50 });
    socket.emit("close");
    jest.advanceTimersByTime(100);
    const result = await waitPromise;
    expect(result.drained).toBe(true);
    expect(result.activeConnections).toBe(0);
  });
});
