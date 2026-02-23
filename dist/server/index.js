/**
 * HTTP server – POST /v1/query, health, ready, metrics, version.
 * @see Docs/SPEC/02_API_Contracts.md, L2-02
 */
import { createServer } from "node:http";
import { bootstrap, getConfig } from "../bootstrap/index.js";
import { setObservability, createEmitter, getTraceContext, setEventSink, createFileEventSink } from "../observability/index.js";
import { setAuditSink, createFileAuditSink } from "../security/audit-logger.js";
import { handleRequest } from "./routes.js";
const PORT = parseInt(process.env.PORT ?? "3000", 10);
export function createAppServer() {
    return createServer((req, res) => {
        handleRequest(req, res).catch((err) => {
            console.error("[server] unhandled", err);
            res.writeHead(500, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: "Internal server error" }));
        });
    });
}
function main() {
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
        const obs = {
            events: emitter,
            getContext: getTraceContext,
        };
        setObservability(obs);
    }
    const server = createAppServer();
    server.listen(PORT, () => {
        console.info(`Server listening on port ${PORT}`);
    });
}
const scriptPath = (process.argv[1] ?? "").replace(/\\/g, "/");
if (scriptPath.endsWith("server/index.js") || scriptPath.endsWith("server/index.ts")) {
    main();
}
//# sourceMappingURL=index.js.map