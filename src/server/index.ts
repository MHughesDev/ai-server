/**
 * HTTP/HTTPS server – POST /v1/query, health, ready, metrics, version.
 * @see docs/SPEC/02_API_Contracts.md, L2-02
 */

import { readFileSync } from "node:fs";
import {
  createServer as createHttpServer,
  type IncomingMessage,
  type Server,
  type ServerResponse,
} from "node:http";
import { createServer as createHttpsServer } from "node:https";
import type { Socket } from "node:net";
import { bootstrap, getConfig } from "../bootstrap/index.js";
import { loadConnectionLimitConfig } from "../config/connection-limits.js";
import { wirePersistentSinksFromConfig } from "../config/persistent-sinks.js";
import { createConfiguredTelemetryEmitter } from "../config/telemetry-redaction.js";
import {
  setObservability,
  getTraceContext,
  getEventSink,
  safeLogError,
} from "../observability/index.js";
import type { IObservability } from "../observability/types.js";
import { shutdownPersistentAuditFileSink } from "../security/audit-logger.js";
import {
  ConnectionTracker,
  getConnectionTracker,
  resetConnectionTrackerForTest,
} from "./connection-tracker.js";
import { handleRequest } from "./routes.js";

const PORT = parseInt(process.env.PORT ?? "3000", 10);

function applyServerResourceLimits(server: Server, limits = loadConnectionLimitConfig()): void {
  server.maxConnections = limits.maxConnections;
  server.headersTimeout = limits.serverHeadersTimeoutMs;
  server.requestTimeout = limits.serverRequestTimeoutMs;
  server.keepAliveTimeout = parseInt(process.env.SERVER_KEEP_ALIVE_TIMEOUT_MS ?? "5000", 10);
}

function attachConnectionGuard(server: Server, tracker: ConnectionTracker): void {
  server.on("connection", (socket: Socket) => {
    const clientIp = socket.remoteAddress ?? "unknown";
    if (!tracker.tryAccept(socket, clientIp)) {
      socket.destroy();
      console.warn(`[server] Connection limit exceeded for IP: ${clientIp}`);
    }
  });
}

function requestListener(tracker: ConnectionTracker) {
  return (req: IncomingMessage, res: ServerResponse): void => {
    if (tracker.isDraining()) {
      res.writeHead(503, { "Content-Type": "application/json", "Retry-After": "30" });
      res.end(JSON.stringify({ error: "Server is shutting down" }));
      return;
    }

    handleRequest(req, res).catch((err) => {
      console.error("[server] unhandled", safeLogError(err));
      if (!res.headersSent) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Internal server error" }));
      }
    });
  };
}

export function createAppServer(tracker: ConnectionTracker = getConnectionTracker()): Server {
  const limits = loadConnectionLimitConfig();
  const server = createHttpServer(requestListener(tracker));
  applyServerResourceLimits(server, limits);
  attachConnectionGuard(server, tracker);
  return server;
}

export function createHttpsAppServer(
  options: { key: Buffer; cert: Buffer },
  tracker: ConnectionTracker = getConnectionTracker()
): Server {
  const limits = loadConnectionLimitConfig();
  const server = createHttpsServer(options, requestListener(tracker));
  applyServerResourceLimits(server, limits);
  attachConnectionGuard(server, tracker);
  return server;
}

export { resetConnectionTrackerForTest };

function main(): void {
  bootstrap();
  const config = getConfig();
  if (!Number.isInteger(PORT) || PORT < 1 || PORT > 65535) {
    throw new Error(`Invalid PORT: ${process.env.PORT ?? "(unset)"}`);
  }

  wirePersistentSinksFromConfig(config);
  const emitter = createConfiguredTelemetryEmitter(config);
  if (emitter) {
    const obs: IObservability = {
      events: emitter,
      getContext: getTraceContext,
    };
    setObservability(obs);
  }

  const tracker = getConnectionTracker();
  const httpServer = createAppServer(tracker);
  httpServer.listen(PORT, () => {
    console.info(`Server listening on port ${PORT} (HTTP)`);
  });

  const keyPath = config.tlsKeyPath;
  const certPath = config.tlsCertPath;
  let httpsServer: ReturnType<typeof createHttpsAppServer> | null = null;
  if (keyPath && certPath) {
    try {
      const key = readFileSync(keyPath);
      const cert = readFileSync(certPath);
      httpsServer = createHttpsAppServer({ key, cert }, tracker);
      const httpsPort = config.httpsPort;
      httpsServer.listen(httpsPort, () => {
        console.info(`HTTPS server listening on port ${httpsPort}`);
      });
    } catch (err) {
      throw new Error(`TLS is configured but key/cert could not be loaded: ${safeLogError(err)}`);
    }
  }

  let shuttingDown = false;
  const DRAIN_TIMEOUT_MS = parseInt(process.env.SHUTDOWN_DRAIN_TIMEOUT_MS ?? "30000", 10);

  const shutdown = async (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.info(`[server] received ${signal}, starting graceful shutdown...`);

    tracker.setDraining(true);

    const httpClosePromise = new Promise<void>((resolve, reject) => {
      httpServer.close((err) => {
        if (err) reject(err);
        else {
          console.info("[server] HTTP server closed, no longer accepting connections");
          resolve();
        }
      });
    });

    const drainStart = Date.now();
    const checkConnections = (): Promise<void> => {
      return new Promise((resolve) => {
        const check = () => {
          const elapsed = Date.now() - drainStart;
          const activeConnections = tracker.getStats().activeConnections;

          if (activeConnections === 0 || elapsed >= DRAIN_TIMEOUT_MS) {
            if (activeConnections > 0) {
              console.warn(
                `[server] drain timeout reached with ${activeConnections} active connections`
              );
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

      try {
        await shutdownPersistentAuditFileSink();
      } catch (err) {
        console.error("[server] audit file sink shutdown error", safeLogError(err));
      }
      try {
        await getEventSink()?.close?.();
      } catch (err) {
        console.error("[server] event sink shutdown error", safeLogError(err));
      }

      if (httpsServer) {
        const tlsServer = httpsServer;
        await new Promise<void>((resolve, reject) => {
          tlsServer.close((err) => (err ? reject(err) : resolve()));
        });
        console.info("[server] HTTPS server closed");
      }

      await httpClosePromise;

      console.info("[server] graceful shutdown complete");
      process.exit(0);
    } catch (err) {
      console.error("[server] graceful shutdown failed", safeLogError(err));
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
