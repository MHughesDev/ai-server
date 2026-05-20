import { describe, it, expect, afterEach } from "@jest/globals";
import { Socket } from "node:net";
import type { ConnectionLimitConfig } from "../config/connection-limits.js";
import { ConnectionTracker, resetConnectionTrackerForTest } from "./connection-tracker.js";

function mockSocket(): Socket {
  return new Socket();
}

const tightLimits: ConnectionLimitConfig = {
  maxConnections: 2,
  maxConnectionsPerIp: 1,
  maxConcurrentRequests: 10,
  maxRequestQueueDepth: 5,
  serverHeadersTimeoutMs: 60_000,
  serverRequestTimeoutMs: 120_000,
};

describe("ConnectionTracker (PR-021)", () => {
  afterEach(() => {
    resetConnectionTrackerForTest();
  });

  it("accepts connections until global cap is reached", () => {
    const tracker = new ConnectionTracker(tightLimits);
    const s1 = mockSocket();
    const s2 = mockSocket();
    const s3 = mockSocket();
    expect(tracker.tryAccept(s1, "10.0.0.1")).toBe(true);
    expect(tracker.tryAccept(s2, "10.0.0.2")).toBe(true);
    expect(tracker.tryAccept(s3, "10.0.0.3")).toBe(false);
    expect(tracker.getStats().activeConnections).toBe(2);
  });

  it("enforces per-IP connection cap", () => {
    const tracker = new ConnectionTracker({
      ...tightLimits,
      maxConnections: 10,
      maxConnectionsPerIp: 1,
    });
    const s1 = mockSocket();
    const s2 = mockSocket();
    expect(tracker.tryAccept(s1, "192.168.1.5")).toBe(true);
    expect(tracker.tryAccept(s2, "192.168.1.5")).toBe(false);
  });

  it("decrements count when socket closes", () => {
    const tracker = new ConnectionTracker(tightLimits);
    const socket = mockSocket();
    expect(tracker.tryAccept(socket, "127.0.0.1")).toBe(true);
    socket.emit("close");
    expect(tracker.getStats().activeConnections).toBe(0);
  });
});
