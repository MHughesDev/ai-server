/**
 * Integration tests – POST /v1/query happy path and fail paths.
 * @see L2-02 Phase 3 Task P3-01, P3-02, P3-03; L2-05 audit and security
 */

import { createServer } from "node:http";
import { request } from "node:http";
import { bootstrap, resetConfigForTest } from "../bootstrap/index.js";
import { handleRequest } from "./routes.js";
import { validateResponseEnvelope } from "../contracts/index.js";
import { getAuditLogSnapshot, resetAuditLog, verifyAuditIntegrity } from "../security/audit-logger.js";
import { setEventSink } from "../observability/event-sink.js";

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

  it("returns 400 for async/auto mode values in sync-only request contract", async () => {
    const asyncMode = { ...validQueryBody, mode: "async" };
    const autoMode = { ...validQueryBody, mode: "auto" };
    const asyncRes = await httpPost(port, "/v1/query", asyncMode);
    const autoRes = await httpPost(port, "/v1/query", autoMode);
    expect(asyncRes.statusCode).toBe(400);
    expect(autoRes.statusCode).toBe(400);
    expect(JSON.parse(asyncRes.body).error?.code).toBe("INVALID_PAYLOAD");
    expect(JSON.parse(autoRes.body).error?.code).toBe("INVALID_PAYLOAD");
  });

  it("returns 400 for paper-only request fields (idempotency, timestamp, safety_profile)", async () => {
    const withIdempotency = { ...validQueryBody, idempotency_key: "idem-1" };
    const withTimestamp = { ...validQueryBody, timestamp: "2026-01-01T00:00:00.000Z" };
    const withSafetyProfile = {
      ...validQueryBody,
      preferences: { ...validQueryBody.preferences, safety_profile: "strict" },
    };
    const idemRes = await httpPost(port, "/v1/query", withIdempotency);
    const tsRes = await httpPost(port, "/v1/query", withTimestamp);
    const safetyRes = await httpPost(port, "/v1/query", withSafetyProfile);
    expect(idemRes.statusCode).toBe(400);
    expect(tsRes.statusCode).toBe(400);
    expect(safetyRes.statusCode).toBe(400);
    expect(JSON.parse(idemRes.body).error?.code).toBe("INVALID_PAYLOAD");
    expect(JSON.parse(tsRes.body).error?.code).toBe("INVALID_PAYLOAD");
    expect(JSON.parse(safetyRes.body).error?.code).toBe("INVALID_PAYLOAD");
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

  it("writes TOOL_ACCESS audit with caller identity attribution when tool is invoked", async () => {
    resetAuditLog();
    const bodyWithToolHint = {
      ...validQueryBody,
      input: { text: "Please use a tool to fetch the weather", attachments: [] },
    };
    const { statusCode } = await httpPost(port, "/v1/query", bodyWithToolHint);
    expect(statusCode).toBe(200);
    const log = getAuditLogSnapshot();
    const toolEvents = log.filter((e) => e.event_type === "TOOL_ACCESS");
    expect(toolEvents.length).toBeGreaterThanOrEqual(1);
    expect(toolEvents[0]?.payload).toMatchObject({
      caller_org: "o1",
      caller_app: "a1",
      caller_user: "u1",
    });
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

  /** M3: Coding agent path – when intent suggests tool use, pipeline is coding_agent and telemetry includes tool_calls */
  it("runs coding_agent pipeline and records tool_calls in telemetry when intent has tool_likelihood", async () => {
    const bodyWithToolHint = {
      ...validQueryBody,
      input: { text: "Please use a tool to fetch the weather", attachments: [] },
    };
    const { statusCode, body } = await httpPost(port, "/v1/query", bodyWithToolHint);
    expect(statusCode).toBe(200);
    const parsed = JSON.parse(body);
    expect(parsed.status).toBe("ok");
    expect(parsed.telemetry?.pipeline).toBe("coding_agent");
    expect(parsed.telemetry?.tool_calls).toBe(1);
    validateResponseEnvelope(parsed);
  });

  /** M5 Segment J: Deep Research – "research X" routes to deep_research and returns ResearchReport-shaped structured output */
  it("runs deep_research pipeline and returns structured report with claims when intent suggests research", async () => {
    const bodyWithResearchHint = {
      ...validQueryBody,
      input: { text: "Research the impact of renewable energy on grid stability", attachments: [] },
    };
    const { statusCode, body } = await httpPost(port, "/v1/query", bodyWithResearchHint);
    expect(statusCode).toBe(200);
    const parsed = JSON.parse(body);
    expect(parsed.status).toBe("ok");
    expect(parsed.telemetry?.pipeline).toBe("deep_research");
    expect(parsed.output?.text).toBeDefined();
    expect(parsed.output?.structured).toBeDefined();
    const structured = parsed.output.structured as { summary?: string; claims?: unknown[]; open_questions?: string[] };
    expect(structured.claims).toBeDefined();
    expect(Array.isArray(structured.claims)).toBe(true);
    expect(parsed.output?.attachments?.some((a: { artifact_kind?: string }) => a.artifact_kind === "research_report")).toBe(true);
    validateResponseEnvelope(parsed);
  });

  /** M5 Segment J: Decision – "choose between" routes to decision and returns DecisionMemo-shaped structured output */
  it("runs decision pipeline and returns options and recommendation when intent suggests decision", async () => {
    const bodyWithDecisionHint = {
      ...validQueryBody,
      input: { text: "Which option should I choose: cloud vs on-prem for our new API?", attachments: [] },
    };
    const { statusCode, body } = await httpPost(port, "/v1/query", bodyWithDecisionHint);
    expect(statusCode).toBe(200);
    const parsed = JSON.parse(body);
    expect(parsed.status).toBe("ok");
    expect(parsed.telemetry?.pipeline).toBe("decision");
    expect(parsed.output?.text).toBeDefined();
    expect(parsed.output?.structured).toBeDefined();
    const structured = parsed.output.structured as { options?: unknown[]; recommendation?: string; question?: string };
    expect(structured.options).toBeDefined();
    expect(Array.isArray(structured.options)).toBe(true);
    expect(structured.recommendation).toBeDefined();
    expect(parsed.output?.attachments?.some((a: { artifact_kind?: string }) => a.artifact_kind === "decision_memo")).toBe(true);
    validateResponseEnvelope(parsed);
  });

  /** L2-99: Autonomous harness – when HARNESS_AUTONOMOUS_EXECUTION_ENABLED=true, coding_agent runs (execution ↔ tool)* loop and can perform multiple tool rounds */
  it("runs coding_agent with autonomous harness loop when HARNESS_AUTONOMOUS_EXECUTION_ENABLED=true", async () => {
    const prev = process.env.HARNESS_AUTONOMOUS_EXECUTION_ENABLED;
    const prevTools = process.env.TOOL_EXECUTION_ENABLED;
    process.env.HARNESS_AUTONOMOUS_EXECUTION_ENABLED = "true";
    process.env.TOOL_EXECUTION_ENABLED = "true";
    resetConfigForTest();
    const { server: autonomousServer, port: autonomousPort } = await (() =>
      new Promise<{ server: ReturnType<typeof createServer>; port: number }>((resolve) => {
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
      }))();
    try {
      const bodyWithToolHint = {
        ...validQueryBody,
        input: { text: "Please use a tool to fetch the weather", attachments: [] },
      };
      const { statusCode, body } = await httpPost(autonomousPort, "/v1/query", bodyWithToolHint);
      expect(statusCode).toBe(200);
      const parsed = JSON.parse(body);
      expect(parsed.telemetry?.pipeline).toBe("coding_agent");
      expect(parsed.telemetry?.tool_calls).toBeGreaterThanOrEqual(1);
      // Stub execution always proposes another tool; the harness blocks with BUDGET_EXCEEDED once tool_budget is exhausted (parity with workflow runner).
      if (parsed.status === "blocked") {
        expect(parsed.error?.code).toBe("BUDGET_EXCEEDED");
        expect(parsed.error?.detail).toMatchObject({ dimension: "tool_budget" });
      } else {
        expect(parsed.status).toBe("ok");
      }
      validateResponseEnvelope(parsed);
    } finally {
      autonomousServer.close();
      if (prev !== undefined) process.env.HARNESS_AUTONOMOUS_EXECUTION_ENABLED = prev;
      else delete process.env.HARNESS_AUTONOMOUS_EXECUTION_ENABLED;
      if (prevTools !== undefined) process.env.TOOL_EXECUTION_ENABLED = prevTools;
      else delete process.env.TOOL_EXECUTION_ENABLED;
      resetConfigForTest();
      bootstrap();
    }
  });

  /** M6 Segment K: Nested workflow – "composite" or "nested workflow" routes to composite_example; telemetry shows pipeline and sub-workflow runs */
  it("runs composite_example pipeline (workflow_call to reactive_chat then synthesis) when intent suggests composite", async () => {
    const bodyWithCompositeHint = {
      ...validQueryBody,
      input: { text: "Run a composite workflow to answer this: what is 2+2?", attachments: [] },
    };
    const { statusCode, body } = await httpPost(port, "/v1/query", bodyWithCompositeHint);
    expect(statusCode).toBe(200);
    const parsed = JSON.parse(body);
    expect(parsed.status).toBe("ok");
    expect(parsed.telemetry?.pipeline).toBe("composite_example");
    expect(parsed.output?.text).toBeDefined();
    validateResponseEnvelope(parsed);
  });

  it("uses provider-backed model registry routing in query path", async () => {
    const prevProviders = process.env.MODEL_GATEWAY_PROVIDERS_JSON;
    const prevRegistry = process.env.MODEL_GATEWAY_REGISTRY_JSON;
    const prevDefaultCapability = process.env.MODEL_GATEWAY_DEFAULT_CAPABILITY;
    process.env.MODEL_GATEWAY_PROVIDERS_JSON = JSON.stringify([
      { id: "framed", kind: "framed_echo", default_model: "framed-default" },
      { id: "stub", kind: "stub", default_model: "stub-chat" },
    ]);
    process.env.MODEL_GATEWAY_REGISTRY_JSON = JSON.stringify({
      chat: {
        org: {
          o1: { provider: "framed", model: "org-chat-v2" },
        },
      },
      reasoning: {
        default: { provider: "stub", model: "reasoning-default" },
      },
      classification: {
        default: { provider: "stub", model: "classification-default" },
      },
    });
    process.env.MODEL_GATEWAY_DEFAULT_CAPABILITY = "chat";
    resetConfigForTest();
    const { server: configuredServer, port: configuredPort } = await createTestServer();
    try {
      const { statusCode, body } = await httpPost(configuredPort, "/v1/query", validQueryBody);
      expect(statusCode).toBe(200);
      const parsed = JSON.parse(body);
      expect(parsed.status).toBe("ok");
      expect(String(parsed.output?.text ?? "")).toContain("provider:framed");
      expect(String(parsed.output?.text ?? "")).toContain("model:org-chat-v2");
    } finally {
      configuredServer.close();
      if (prevProviders !== undefined) process.env.MODEL_GATEWAY_PROVIDERS_JSON = prevProviders;
      else delete process.env.MODEL_GATEWAY_PROVIDERS_JSON;
      if (prevRegistry !== undefined) process.env.MODEL_GATEWAY_REGISTRY_JSON = prevRegistry;
      else delete process.env.MODEL_GATEWAY_REGISTRY_JSON;
      if (prevDefaultCapability !== undefined) {
        process.env.MODEL_GATEWAY_DEFAULT_CAPABILITY = prevDefaultCapability;
      } else {
        delete process.env.MODEL_GATEWAY_DEFAULT_CAPABILITY;
      }
      resetConfigForTest();
      bootstrap();
    }
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

  it("returns dependency-aware 503 for /readyz and /healthz when sink reports failure", async () => {
    setEventSink({
      write() {
        // no-op
      },
      getStatus() {
        return {
          queueDepth: 0,
          maxQueueSize: 100,
          droppedEvents: 0,
          isDraining: false,
          lastError: "disk unavailable",
        };
      },
    });
    try {
      const ready = await httpGet(port, "/readyz");
      const health = await httpGet(port, "/healthz");
      expect(ready.statusCode).toBe(503);
      expect(health.statusCode).toBe(503);
      const readyPayload = JSON.parse(ready.body);
      const healthPayload = JSON.parse(health.body);
      expect(readyPayload.ready).toBe(false);
      expect(healthPayload.status).toBe("degraded");
      expect(Array.isArray(readyPayload.dependencies)).toBe(true);
      expect(
        readyPayload.dependencies.some(
          (d: { name?: string; ready?: boolean }) =>
            d.name === "observability_event_sink" && d.ready === false
        )
      ).toBe(true);
    } finally {
      setEventSink(null);
    }
  });
});
