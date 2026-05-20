/**
 * Connection limit integration (PR-021).
 */

import { connect, type Socket } from "node:net";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "@jest/globals";
import type { ConnectionLimitConfig } from "../config/connection-limits.js";
import { ConnectionTracker } from "./connection-tracker.js";

const tightLimits: ConnectionLimitConfig = {
  maxConnections: 2,
  maxConnectionsPerIp: 2,
  maxConcurrentRequests: 1,
  maxRequestQueueDepth: 0,
  serverHeadersTimeoutMs: 60_000,
  serverRequestTimeoutMs: 120_000,
};

function connectTo(port: number): Promise<Socket> {
  return new Promise((resolve, reject) => {
    const socket = connect(port, "127.0.0.1");
    socket.once("connect", () => resolve(socket));
    socket.once("error", reject);
  });
}

describe("connection limits integration (PR-021)", () => {
  let server: ReturnType<typeof createServer>;
  let port = 0;
  const tracker = new ConnectionTracker(tightLimits);

  beforeAll(async () => {
    server = createServer((_req, res) => {
      res.writeHead(200);
      res.end("ok");
    });
    server.maxConnections = tightLimits.maxConnections;
    server.on("connection", (socket) => {
      const clientIp = socket.remoteAddress ?? "unknown";
      if (!tracker.tryAccept(socket, clientIp)) {
        socket.destroy();
      }
    });
    await new Promise<void>((resolve) => {
      server.listen(0, () => {
        port = (server.address() as AddressInfo).port;
        resolve();
      });
    });
  });

  afterAll(() => {
    server.close();
  });

  it("rejects a third simultaneous connection when global cap is two", async () => {
    const open: Socket[] = [];
    open.push(await connectTo(port));
    open.push(await connectTo(port));
    const overflow = await connectTo(port);
    expect(tracker.getStats().activeConnections).toBe(2);
    overflow.destroy();
    for (const socket of open) {
      socket.destroy();
    }
  });
});
