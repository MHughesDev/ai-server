/**
 * Rollback drill — kill-switch MTTR measurement and evidence (PR-031).
 */

import { createServer } from "node:http";
import { request } from "node:http";
import { join } from "node:path";
import { bootstrap, resetConfigForTest } from "../bootstrap/index.js";
import {
  PRODUCTION_ROLLOUT_DISABLED_ERROR,
  resetRolloutPolicyCacheForTest,
} from "./policy.js";
import {
  measureRollbackKillSwitchMttr,
  writeRollbackDrillEvidence,
} from "./rollback-drill.js";
import { handleRequest } from "../server/routes.js";

const originalEnv = process.env;

const PROD_AUTH_IDP_JSON = JSON.stringify([
  {
    issuer: "https://idp.example.com",
    audience: "ai-server-token-exchange",
    jwt_algorithm: "HS256",
    jwt_secret: "production-idp-secret-not-default",
    claim_mapping: {},
  },
]);

function applyProductionEnv(): void {
  process.env.NODE_ENV = "production";
  process.env.OPERATIONAL_BEARER_TOKEN = "ops-rollback-drill";
  process.env.REQUIRE_AUTH_HEADER = "true";
  process.env.AUTH_AI_JWT_SECRET = "0123456789abcdef0123456789abcdef";
  process.env.AUTH_QUERY_REQUIRED_SCOPES = "query:invoke";
  process.env.AUTH_IDP_REGISTRY_JSON = PROD_AUTH_IDP_JSON;
  process.env.AUTH_APP_REGISTRY_JSON = JSON.stringify([
    {
      client_id: "client-prod",
      client_secret: "client-secret-prod",
      app_id: "app-prod",
      allowed_issuers: ["https://idp.example.com"],
      allowed_scopes: ["query:invoke"],
    },
  ]);
  process.env.MODEL_PROVIDER_API_KEY = "sk-test";
  process.env.MODEL_GATEWAY_PROVIDERS_JSON = JSON.stringify([
    {
      id: "openai",
      kind: "openai_compatible",
      default_model: "gpt-4o-mini",
      api_key_env: "MODEL_PROVIDER_API_KEY",
    },
  ]);
  process.env.MODEL_GATEWAY_REGISTRY_JSON = JSON.stringify({
    chat: { default: { provider: "openai", model: "gpt-4o-mini" } },
  });
  process.env.SECRETS_BACKEND = "env";
  process.env.SCOPED_SECRETS_JSON = JSON.stringify({ k: "v" });
  process.env.MEMORY_BACKEND = "vector";
  process.env.REDIS_URL = "redis://127.0.0.1:6379";
  process.env.AUDIT_LOG_PATH = "/tmp/ai-server-rollback-drill-audit.jsonl";
  process.env.OBSERVABILITY_EVENT_SINK_PATH = "/tmp/ai-server-rollback-drill-events.ndjson";
  process.env.OBSERVABILITY_REDACTION_LEVEL = "minimal";
  process.env.OBSERVABILITY_REQUIRED_EVENTS_V1 = "true";
  process.env.SECURITY_HARD_CONTROLS_ENABLED = "true";
  process.env.MAX_CONNECTIONS = "1000";
  process.env.MAX_CONNECTIONS_PER_IP = "100";
  process.env.MAX_CONCURRENT_REQUESTS = "100";
  process.env.MAX_REQUEST_QUEUE_DEPTH = "50";
  process.env.MAX_BODY_BYTES = "1000000";
  process.env.SHUTDOWN_DRAIN_TIMEOUT_MS = "30000";
  process.env.PLATFORM_PRODUCTION_ROLLOUT_ENABLED = "true";
  process.env.ROLLOUT_CANARY_SIGNOFF = "true";
  process.env.RELEASE_ID = "rollback-drill-release";
  process.env.CORS_ALLOWED_ORIGINS = "https://app.example.com";
  process.env.TLS_KEY_PATH = "/tmp/key.pem";
  process.env.TLS_CERT_PATH = "/tmp/cert.pem";
  process.env.OBSERVABILITY_TRACE_SAMPLE_RATE = "0.1";
}

function httpPost(
  port: number,
  path: string,
  body: string
): Promise<{ statusCode: number; body: string }> {
  return new Promise((resolve, reject) => {
    const req = request(
      {
        host: "localhost",
        port,
        path,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(body),
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
    req.write(body);
    req.end();
  });
}

describe("rollback drill (PR-031)", () => {
  beforeEach(() => {
    resetConfigForTest();
    resetRolloutPolicyCacheForTest();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
    resetConfigForTest();
    resetRolloutPolicyCacheForTest();
  });

  it("measures kill-switch MTTR and writes evidence within SLO", async () => {
    applyProductionEnv();
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

    const queryBody = JSON.stringify({
      request_id: "550e8400-e29b-41d4-a716-446655440088",
      caller: { app_id: "app-prod", user_id: "u1", org_id: "o1" },
      input: { text: "hi", attachments: [] },
      preferences: { response_format: "text", verbosity: "medium", stream: false },
      contract_version: "v1",
    });

    try {
      const evidence = await measureRollbackKillSwitchMttr({
        maxMttrMs: 30_000,
        activateKillSwitch: () => {
          process.env.PLATFORM_PRODUCTION_ROLLOUT_ENABLED = "false";
          resetConfigForTest();
          bootstrap();
        },
        pollKillSwitchActive: async () => {
          const res = await httpPost(port, "/v1/query", queryBody);
          const parsed = JSON.parse(res.body) as {
            error?: { code?: string };
          };
          return {
            statusCode: res.statusCode,
            errorCode: parsed.error?.code,
          };
        },
      });

      expect(evidence.passed).toBe(true);
      expect(evidence.mttr_ms).toBeLessThan(evidence.max_rollback_mttr_ms);
      expect(evidence.kill_switch_error_code).toBe(
        PRODUCTION_ROLLOUT_DISABLED_ERROR.code
      );

      const outPath =
        process.env.ROLLBACK_DRILL_EVIDENCE_PATH ??
        join(process.cwd(), "artifacts", "rollback-drill-evidence.json");
      const path = await writeRollbackDrillEvidence(evidence, outPath);
      expect(path).toContain("rollback-drill-evidence.json");
    } finally {
      await new Promise<void>((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
      });
    }
  });
});
