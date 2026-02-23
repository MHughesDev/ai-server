/**
 * HTTP/HTTPS server – POST /v1/query, health, ready, metrics, version.
 * @see Docs/SPEC/02_API_Contracts.md, L2-02
 */

import { readFileSync } from "node:fs";
import { createServer as createHttpServer } from "node:http";
import { createServer as createHttpsServer } from "node:https";
import { bootstrap, getConfig } from "../bootstrap/index.js";
import { setObservability, createEmitter, getTraceContext, setEventSink, createFileEventSink } from "../observability/index.js";
import type { IObservability } from "../observability/types.js";
import { setAuditSink, createFileAuditSink } from "../security/audit-logger.js";
import { handleRequest } from "./routes.js";

const PORT = parseInt(process.env.PORT ?? "3000", 10);

function requestListener(
  req: import("node:http").IncomingMessage,
  res: import("node:http").ServerResponse
): void {
  handleRequest(req, res).catch((err) => {
    console.error("[server] unhandled", err);
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Internal server error" }));
  });
}

export function createAppServer() {
  return createHttpServer(requestListener);
}

export function createHttpsAppServer(options: { key: Buffer; cert: Buffer }) {
  return createHttpsServer(options, requestListener);
}

function main(): void {
  bootstrap();
  const config = getConfig();
  const auditLogPath = process.env.AUDIT_LOG_PATH;
  if (auditLogPath) {
    setAuditSink(createFileAuditSink(auditLogPath));
  }
  const eventSinkPath = process.env.OBSERVABILITY_EVENT_SINK_PATH;
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
  httpServer.listen(PORT, () => {
    console.info(`Server listening on port ${PORT} (HTTP)`);
  });

  const keyPath = config.tlsKeyPath;
  const certPath = config.tlsCertPath;
  if (keyPath && certPath) {
    try {
      const key = readFileSync(keyPath);
      const cert = readFileSync(certPath);
      const httpsServer = createHttpsAppServer({ key, cert });
      const httpsPort = config.httpsPort;
      httpsServer.listen(httpsPort, () => {
        console.info(`HTTPS server listening on port ${httpsPort}`);
      });
    } catch (err) {
      console.error("[server] HTTPS disabled: failed to load TLS key/cert", err);
    }
  }
}

const scriptPath = (process.argv[1] ?? "").replace(/\\/g, "/");
if (scriptPath.endsWith("server/index.js") || scriptPath.endsWith("server/index.ts")) {
  main();
}
