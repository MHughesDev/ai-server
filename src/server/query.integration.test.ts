/**
 * Integration tests – POST /v1/query happy path and fail paths.
 * @see L2-02 Phase 3 Task P3-01, P3-02, P3-03; L2-05 audit and security
 */

import { createServer } from "node:http";
import { request } from "node:http";
import { bootstrap } from "../bootstrap/index.js";
import { handleRequest } from "./routes.js";
import { validateResponseEnvelope } from "../contracts/index.js";
import { getAuditLogSnapshot, resetAuditLog, verifyAuditIntegrity } from "../security/audit-logger.js";

function createTestServer(): Promise<{ server: ReturnType<typeof createServer>; port: number }> {
  return new Promise((resolve) => {
    bootstrap();
    const server = createServer((req, res) => {
      handleRequest(req, res).catch((err) => {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: String(err) }));
      });
    });
    server.listen(0, () => {
      const addr = server.address();
      const port = typeof addr === "object" && addr?.port ? addr.port : 0;
      resolve({ server, port });
    });
  });
}

function httpGet(port: number, path: string): Promise<{ statusCode: number; body: string }> {
  return new Promise((resolve, reject) => {
    const req = request(
      { host: "localhost", port, path, method: "GET" },
      (res) => {
        const chunks: string[] = [];
        res.on("data", (chunk) => chunks.push(chunk.toString()));
        res.on("end", () =>
          resolve({ statusCode: res.statusCode ?? 0, body: chunks.join("") })
        );
      }
    );
    req.on("error", reject);
    req.end();
  });
}

function httpPost(
  port: number,
  path: string,
  body: unknown,
  headers: Record<string, string> = {}
): Promise<{ statusCode: number; body: string }> {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = request(
      {
        host: "localhost",
        port,
        path,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(data),
          ...headers,
        },
      },
      (res) => {
        const chunks: string[] = [];
        res.on("data", (chunk) => chunks.push(chunk.toString()));
        res.on("end", () =>
          resolve({ statusCode: res.statusCode ?? 0, body: chunks.join("") })
        );
      }
    );
    req.on("error", reject);
    req.write(data);
    req.end();
  });
}

const validQueryBody = {
  request_id: "550e8400-e29b-41d4-a716-446655440000",
  caller: { app_id: "a1", user_id: "u1", org_id: "o1", scopes: [] },
  input: { text: "hello", attachments: [] },
  preferences: { response_format: "text", verbosity: "medium", stream: false },
  contract_version: "v1",
};

describe("POST /v1/query integration", () => {
  let server: ReturnType<typeof createServer>;
  let port: number;

  beforeAll(async () => {
    const env = process.env.RUNTIME_MVP_QUERY_CHAT_ENABLED;
    process.env.RUNTIME_MVP_QUERY_CHAT_ENABLED = "true";
    const s = await createTestServer();
    server = s.server;
    port = s.port;
    if (env !== undefined) process.env.RUNTIME_MVP_QUERY_CHAT_ENABLED = env;
  });

  afterAll((done) => {
    server.close(done);
  });

  it("returns 200 and valid ResponseEnvelope for valid request (happy path)", async () => {
    const { statusCode, body } = await httpPost(port, "/v1/query", validQueryBody);
    expect(statusCode).toBe(200);
    const parsed = JSON.parse(body);
    expect(parsed.status).toBe("ok");
    expect(parsed.request_id).toBe(validQueryBody.request_id);
    expect(parsed.output?.text).toBeDefined();
    expect(parsed.telemetry?.tokens_in).toBeDefined();
    validateResponseEnvelope(parsed);
  });

  it("returns 400 for invalid payload (missing caller)", async () => {
    const invalid = { ...validQueryBody, caller: undefined };
    const { statusCode, body } = await httpPost(port, "/v1/query", invalid);
    expect(statusCode).toBe(400);
    const parsed = JSON.parse(body);
    expect(parsed.error?.code).toBe("INVALID_PAYLOAD");
  });

  it("returns 400 for invalid request_id (not UUID)", async () => {
    const invalid = { ...validQueryBody, request_id: "not-a-uuid" };
    const { statusCode, body } = await httpPost(port, "/v1/query", invalid);
    expect(statusCode).toBe(400);
    const parsed = JSON.parse(body);
    expect(parsed.error?.code).toBe("INVALID_PAYLOAD");
  });

  it("returns 400 for unsupported contract_version", async () => {
    const invalid = { ...validQueryBody, contract_version: "v0" };
    const { statusCode, body } = await httpPost(port, "/v1/query", invalid);
    expect(statusCode).toBe(400);
    const parsed = JSON.parse(body);
    expect(parsed.error?.code).toBe("CONTRACT_VERSION_UNSUPPORTED");
  });

  /** L2-03: Governance – budget exceeded returns blocked with BUDGET_EXCEEDED */
  it("returns 200 with status blocked and BUDGET_EXCEEDED when token estimate exceeds budget", async () => {
    const longText = "x".repeat(40_000);
    const reqBody = { ...validQueryBody, input: { text: longText, attachments: [] } };
    const { statusCode, body: resBody } = await httpPost(port, "/v1/query", reqBody);
    expect(statusCode).toBe(200);
    const parsed = JSON.parse(resBody);
    expect(parsed.status).toBe("blocked");
    expect(parsed.error?.code).toBe("BUDGET_EXCEEDED");
    validateResponseEnvelope(parsed);
  });

  /** L2-05: Security – audit events written on key decisions and integrity valid */
  it("writes security audit events and maintains integrity when security_hard_controls enabled", async () => {
    resetAuditLog();
    const { statusCode } = await httpPost(port, "/v1/query", validQueryBody);
    expect(statusCode).toBe(200);
    const log = getAuditLogSnapshot();
    const policyEvents = log.filter((e) => e.event_type === "SECURITY_POLICY_DECISION");
    expect(policyEvents.length).toBeGreaterThanOrEqual(1);
    expect(verifyAuditIntegrity().valid).toBe(true);
  });

  it("writes SECURITY_ROUTE_DENY audit when request is blocked", async () => {
    resetAuditLog();
    const longText = "x".repeat(40_000);
    const reqBody = { ...validQueryBody, input: { text: longText, attachments: [] } };
    await httpPost(port, "/v1/query", reqBody);
    const log = getAuditLogSnapshot();
    const denyEvents = log.filter((e) => e.event_type === "SECURITY_ROUTE_DENY");
    expect(denyEvents.length).toBeGreaterThanOrEqual(1);
    expect(denyEvents.some((e) => e.payload?.deny_reason === "BUDGET_EXCEEDED")).toBe(true);
  });

  /** L2-06: Response envelope includes citations array (empty when retrieval disabled) */
  it("returns output.citations array in response envelope", async () => {
    const { statusCode, body } = await httpPost(port, "/v1/query", validQueryBody);
    expect(statusCode).toBe(200);
    const parsed = JSON.parse(body);
    expect(parsed.output).toBeDefined();
    expect(Array.isArray(parsed.output.citations)).toBe(true);
    parsed.output.citations.forEach((c: { source: string; ref: string; span?: string }) => {
      expect(c).toMatchObject({ source: expect.any(String), ref: expect.any(String) });
    });
  });
});

/** L2-08: Operational readiness – GET /v1/version returns contract_version, api, version, env (and optional release_id/build_id) */
describe("GET /v1/version", () => {
  let server: ReturnType<typeof createServer>;
  let port: number;

  beforeAll(async () => {
    const s = await createTestServer();
    server = s.server;
    port = s.port;
  });

  afterAll((done) => {
    server.close(done);
  });

  it("returns 200 with contract_version, api, version, and env", async () => {
    const { statusCode, body } = await httpGet(port, "/v1/version");
    expect(statusCode).toBe(200);
    const parsed = JSON.parse(body);
    expect(parsed.contract_version).toBe("v1");
    expect(parsed.api).toBe("v1");
    expect(parsed.version).toBeDefined();
    expect(typeof parsed.version).toBe("string");
    expect(["dev", "staging", "production"]).toContain(parsed.env);
  });
});
