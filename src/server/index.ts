/**
 * HTTP/HTTPS server – POST /v1/query, health, ready, metrics, version.
 * @see docs/SPEC/02_API_Contracts.md, L2-02
 */

import { readFileSync } from "node:fs";
import { createServer as createHttpServer, type IncomingMessage, type ServerResponse } from "node:http";
import { createServer as createHttpsServer } from "node:https";
import { bootstrap, getConfig } from "../bootstrap/index.js";
import { setObservability, createEmitter, getTraceContext, setEventSink, createFileEventSink } from "../observability/index.js";
import type { IObservability } from "../observability/types.js";
import { setAuditSink, createFileAuditSink } from "../security/audit-logger.js";
import { handleRequest } from "./routes.js";

const PORT = parseInt(process.env.PORT ?? "3000", 10);

/** Connection limits configuration (L2-05 Phase 1: Core Infrastructure Fixes) */
const MAX_CONNECTIONS = parseInt(process.env.MAX_CONNECTIONS ?? "1000", 10);
const MAX_CONNECTIONS_PER_IP = parseInt(process.env.MAX_CONNECTIONS_PER_IP ?? "100", 10);
const REQUEST_QUEUE_MAX_DEPTH = parseInt(process.env.REQUEST_QUEUE_MAX_DEPTH ?? "100", 10);

import type { Socket } from "node:net";

/** Connection tracking for resource protection */
interface ConnectionState {
  connections: Set<Socket>;
  connectionsByIp: Map<string, Set<Socket>>;
  requestQueue: Array<{ req: IncomingMessage; res: ServerResponse }>;
  draining: boolean;
}

const connectionState: ConnectionState = {
  connections: new Set(),
  connectionsByIp: new Map(),
  requestQueue: [],
  draining: false,
};

function trackConnection(socket: Socket, clientIp: string): boolean {
  if (connectionState.connections.size >= MAX_CONNECTIONS) {
    return false;
  }

  const ipConnections = connectionState.connectionsByIp.get(clientIp);
  if (ipConnections && ipConnections.size >= MAX_CONNECTIONS_PER_IP) {
    return false;
  }

  connectionState.connections.add(socket);

  if (!ipConnections) {
    connectionState.connectionsByIp.set(clientIp, new Set([socket]));
  } else {
    ipConnections.add(socket);
  }

  socket.once("close", () => {
    connectionState.connections.delete(socket);
    const ipConns = connectionState.connectionsByIp.get(clientIp);
    if (ipConns) {
      ipConns.delete(socket);
      if (ipConns.size === 0) {
        connectionState.connectionsByIp.delete(clientIp);
      }
    }
  });

  return true;
}

function requestListener(req: IncomingMessage, res: ServerResponse): void {
  // Check if server is draining (graceful shutdown)
  if (connectionState.draining) {
    res.writeHead(503, { "Content-Type": "application/json", "Retry-After": "30" });
    res.end(JSON.stringify({ error: "Server is shutting down" }));
    return;
  }

  // Check request queue depth
  if (connectionState.requestQueue.length >= REQUEST_QUEUE_MAX_DEPTH) {
    res.writeHead(503, { "Content-Type": "application/json", "Retry-After": "10" });
    res.end(JSON.stringify({ error: "Server overloaded, try again later" }));
    return;
  }

  handleRequest(req, res).catch((err) => {
    console.error("[server] unhandled", err);
    if (!res.headersSent) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Internal server error" }));
    }
  });
}

export function createAppServer() {
  const server = createHttpServer(requestListener);

  // Track connections on server
  server.on("connection", (socket: Socket) => {
    const clientIp = socket.remoteAddress ?? "unknown";
    if (!trackConnection(socket, clientIp)) {
      // Connection limit exceeded - destroy the socket
      socket.destroy();
      console.warn(`[server] Connection limit exceeded for IP: ${clientIp}`);
    }
  });

  return server;
}

export function createHttpsAppServer(options: { key: Buffer; cert: Buffer }) {
  const server = createHttpsServer(options, requestListener);

  // Track connections on server
  server.on("connection", (socket: Socket) => {
    const clientIp = socket.remoteAddress ?? "unknown";
    if (!trackConnection(socket, clientIp)) {
      socket.destroy();
      console.warn(`[server] Connection limit exceeded for IP: ${clientIp}`);
    }
  });

  return server;
}

function main(): void {
  bootstrap();
  const config = getConfig();
  if (!Number.isInteger(PORT) || PORT < 1 || PORT > 65535) {
    throw new Error(`Invalid PORT: ${process.env.PORT ?? "(unset)"}`);
  }

  const auditLogPath = config.auditLogPath;
  if (auditLogPath) {
    setAuditSink(createFileAuditSink(auditLogPath));
  }
  const eventSinkPath = config.observabilityEventSinkPath;
  if (eventSinkPath) {
    setEventSink(createFileEventSink(eventSinkPath));
  }
  if (config.flags.observability_required_events_v1) {
    const emitter = createEmitter({
      redactionLevel: "minimal",
      logToConsole: config.logLevel === "debug",
      sampleRate: config.observability_trace_sample_rate,
    });
    const obs: IObservability = {
      events: emitter,
      getContext: getTraceContext,
    };
    setObservability(obs);
  }

  const httpServer = createAppServer();
  const closers: Array<() => Promise<void>> = [
    () =>
      new Promise((resolve, reject) => {
        httpServer.close((err) => {
          if (err) {
            reject(err);
            return;
          }
          resolve();
        });
      }),
  ];
  httpServer.listen(PORT, () => {
    console.info(`Server listening on port ${PORT} (HTTP)`);
  });

  const keyPath = config.tlsKeyPath;
  const certPath = config.tlsCertPath;
  if (keyPath && certPath) {
    try {
      // PRODUCTION: Consider async load or validate paths exist first; readFileSync blocks event loop.
      const key = readFileSync(keyPath);
      const cert = readFileSync(certPath);
      const httpsServer = createHttpsAppServer({ key, cert });
      const httpsPort = config.httpsPort;
      httpsServer.listen(httpsPort, () => {
        console.info(`HTTPS server listening on port ${httpsPort}`);
      });
      closers.push(
        () =>
          new Promise((resolve, reject) => {
            httpsServer.close((err) => {
              if (err) {
                reject(err);
                return;
              }
              resolve();
            });
          })
      );
    } catch (err) {
      throw new Error(`TLS is configured but key/cert could not be loaded: ${String(err)}`);
    }
  }

  // Graceful shutdown with connection draining (L2-05 Phase 1)
  let shuttingDown = false;
  const DRAIN_TIMEOUT_MS = parseInt(process.env.SHUTDOWN_DRAIN_TIMEOUT_MS ?? "30000", 10);

  const shutdown = async (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.info(`[server] received ${signal}, starting graceful shutdown...`);

    // Mark as draining to reject new requests
    connectionState.draining = true;

    // Stop accepting new connections
    httpServer.close(() => {
      console.info("[server] HTTP server closed, no longer accepting connections");
    });

    // Close HTTPS server if running
    if (keyPath && certPath && closers.length > 1) {
      try {
        await closers[1]();
        console.info("[server] HTTPS server closed");
      } catch (err) {
        console.error("[server] HTTPS close error", err);
      }
    }

    // Wait for in-flight requests to complete or timeout
    const drainStart = Date.now();
    const checkConnections = (): Promise<void> => {
      return new Promise((resolve) => {
        const check = () => {
          const elapsed = Date.now() - drainStart;
          const activeConnections = connectionState.connections.size;

          if (activeConnections === 0 || elapsed >= DRAIN_TIMEOUT_MS) {
            if (activeConnections > 0) {
              console.warn(`[server] drain timeout reached with ${activeConnections} active connections`);
            } else {
              console.info("[server] all connections drained gracefully");
            }
            resolve();
          } else {
            setTimeout(check, 100);
          }
        };
        check();
      });
    };

    try {
      await checkConnections();
      console.info("[server] graceful shutdown complete");
      process.exit(0);
    } catch (err) {
      console.error("[server] graceful shutdown failed", err);
      process.exit(1);
    }
  };
  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
}

const scriptPath = (process.argv[1] ?? "").replace(/\\/g, "/");
if (scriptPath.endsWith("server/index.js") || scriptPath.endsWith("server/index.ts")) {
  main();
}
