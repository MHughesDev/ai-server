/**
 * Incident simulation drills — provider outage, policy deny, budget exceeded (PR-032).
 */

import { createServer } from "node:http";
import { request } from "node:http";
import { join } from "node:path";
import { bootstrap, resetConfigForTest } from "../bootstrap/index.js";
import {
  clearHealthCheckProviders,
  registerHealthCheckProvider,
} from "../server/dependencies.js";
import { handleRequest } from "../server/routes.js";
import {
  buildIncidentDrillEvidence,
  INCIDENT_TRIAGE_RUNBOOKS,
  writeIncidentDrillEvidence,
  type IncidentDrillScenarioResult,
} from "./incident-drills.js";

const originalEnv = process.env;

const validQueryBody = {
  request_id: "550e8400-e29b-41d4-a716-446655440077",
  caller: { app_id: "a1", user_id: "u1", org_id: "o1", scopes: [] },
  input: { text: "hello", attachments: [] },
  preferences: { response_format: "text", verbosity: "medium", stream: false },
  contract_version: "v1",
};

function httpGet(port: number, path: string): Promise<{ statusCode: number; body: string }> {
  return new Promise((resolve, reject) => {
    const req = request(
      { host: "localhost", port, path, method: "GET" },
      (res) => {
        const chunks: string[] = [];
        res.on("data", (c) => chunks.push(c.toString()));
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
  body: unknown
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
        },
      },
      (res) => {
        const chunks: string[] = [];
        res.on("data", (c) => chunks.push(c.toString()));
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

async function createTestServer(): Promise<{
  server: ReturnType<typeof createServer>;
  port: number;
}> {
  bootstrap();
  const server = createServer((req, res) => {
    void handleRequest(req, res).catch((err) => {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: String(err) }));
    });
  });
  await new Promise<void>((resolve) => server.listen(0, () => resolve()));
  const addr = server.address();
  const port = typeof addr === "object" && addr?.port ? addr.port : 0;
  return { server, port };
}

describe("incident simulation drills (PR-032)", () => {
  beforeEach(() => {
    resetConfigForTest();
    clearHealthCheckProviders();
    process.env = { ...originalEnv };
    process.env.NODE_ENV = "development";
    process.env.RUNTIME_MVP_QUERY_CHAT_ENABLED = "true";
    delete process.env.POLICY_DENY_ORG_IDS;
    delete process.env.POLICY_DENY_APP_IDS;
  });

  afterAll(() => {
    process.env = originalEnv;
    resetConfigForTest();
    clearHealthCheckProviders();
  });

  it("runs provider, policy, and budget drills and writes evidence", async () => {
    const scenarios: IncidentDrillScenarioResult[] = [];

    // --- Provider outage (readiness degradation) ---
    {
      const start = Date.now();
      registerHealthCheckProvider({
        name: "simulated_model_provider_outage",
        checkHealth: () =>
          Promise.resolve({
            healthy: false,
            ready: false,
            latencyMs: 1,
            detail: { simulated: true, reason: "provider_unreachable" },
          }),
      });
      resetConfigForTest();
      const { server, port } = await createTestServer();
      try {
        const ready = await httpGet(port, "/readyz");
        const health = await httpGet(port, "/healthz");
        const readyBody = JSON.parse(ready.body) as {
          ready?: boolean;
          dependencies?: Array<{ name?: string; ready?: boolean }>;
        };
        const passed =
          ready.statusCode === 503 &&
          health.statusCode === 503 &&
          readyBody.ready === false &&
          readyBody.dependencies?.some(
            (d) => d.name === "simulated_model_provider_outage" && d.ready === false
          ) === true;
        scenarios.push({
          scenario: "provider",
          passed,
          duration_ms: Date.now() - start,
          expected_error_code: "DEPENDENCY_NOT_READY",
          observed_status_code: ready.statusCode,
          observed_error_code: passed ? "DEPENDENCY_NOT_READY" : undefined,
          triage_runbook: INCIDENT_TRIAGE_RUNBOOKS.provider,
          steps: [{ name: "probe_readyz_healthz", duration_ms: Date.now() - start }],
          detail: { health_status: JSON.parse(health.body).status },
        });
      } finally {
        await new Promise<void>((resolve, reject) => {
          server.close((err) => (err ? reject(err) : resolve()));
        });
        clearHealthCheckProviders();
      }
    }

    // --- Policy deny ---
    {
      const start = Date.now();
      process.env.POLICY_DENY_ORG_IDS = "o1";
      resetConfigForTest();
      const { server, port } = await createTestServer();
      try {
        const res = await httpPost(port, "/v1/query", validQueryBody);
        const parsed = JSON.parse(res.body) as {
          status?: string;
          error?: { code?: string };
        };
        const passed =
          res.statusCode === 200 &&
          parsed.status === "blocked" &&
          parsed.error?.code === "POLICY_BLOCKED";
        scenarios.push({
          scenario: "policy",
          passed,
          duration_ms: Date.now() - start,
          expected_error_code: "POLICY_BLOCKED",
          observed_status_code: res.statusCode,
          observed_error_code: parsed.error?.code,
          observed_response_status: parsed.status,
          triage_runbook: INCIDENT_TRIAGE_RUNBOOKS.policy,
          steps: [{ name: "post_v1_query_denied_org", duration_ms: Date.now() - start }],
        });
      } finally {
        await new Promise<void>((resolve, reject) => {
          server.close((err) => (err ? reject(err) : resolve()));
        });
        delete process.env.POLICY_DENY_ORG_IDS;
      }
    }

    // --- Budget exceeded ---
    {
      const start = Date.now();
      resetConfigForTest();
      const { server, port } = await createTestServer();
      try {
        const longText = "x".repeat(40_000);
        const res = await httpPost(port, "/v1/query", {
          ...validQueryBody,
          input: { text: longText, attachments: [] },
        });
        const parsed = JSON.parse(res.body) as {
          status?: string;
          error?: { code?: string };
        };
        const passed =
          res.statusCode === 200 &&
          parsed.status === "blocked" &&
          parsed.error?.code === "BUDGET_EXCEEDED";
        scenarios.push({
          scenario: "budget",
          passed,
          duration_ms: Date.now() - start,
          expected_error_code: "BUDGET_EXCEEDED",
          observed_status_code: res.statusCode,
          observed_error_code: parsed.error?.code,
          observed_response_status: parsed.status,
          triage_runbook: INCIDENT_TRIAGE_RUNBOOKS.budget,
          steps: [{ name: "post_v1_query_oversized_input", duration_ms: Date.now() - start }],
        });
      } finally {
        await new Promise<void>((resolve, reject) => {
          server.close((err) => (err ? reject(err) : resolve()));
        });
      }
    }

    const evidence = buildIncidentDrillEvidence(scenarios);
    expect(evidence.passed).toBe(true);
    expect(evidence.scenarios).toHaveLength(3);

    const outPath =
      process.env.INCIDENT_DRILL_EVIDENCE_PATH ??
      join(process.cwd(), "artifacts", "incident-drill-evidence.json");
    const path = await writeIncidentDrillEvidence(evidence, outPath);
    expect(path).toContain("incident-drill-evidence.json");
  });
});
