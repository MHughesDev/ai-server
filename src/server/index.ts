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
  safeLogError,
} from "../observability/index.js";
import type { IObservability } from "../observability/types.js";
import {
  ConnectionTracker,
  getConnectionTracker,
  resetConnectionTrackerForTest,
} from "./connection-tracker.js";
import { registerGracefulShutdownHandlers, isServerDraining } from "./graceful-shutdown.js";
import { getJobQueueService, handleRequest } from "./routes.js";

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
    if (isServerDraining() || tracker.isDraining()) {
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

  registerGracefulShutdownHandlers({
    connectionTracker: tracker,
    httpServer,
    httpsServer,
    stopWorkers: async () => {
      await getJobQueueService()?.stop();
    },
    onShutdownComplete: () => {
      process.exit(0);
    },
  });
}

const scriptPath = (process.argv[1] ?? "").replace(/\\/g, "/");
if (scriptPath.endsWith("server/index.js") || scriptPath.endsWith("server/index.ts")) {
  main();
}
