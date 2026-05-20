/**
 * End-to-end kill-switch tests for platform_production_rollout_enabled (PR-011).
 */

import { createServer } from "node:http";
import { request } from "node:http";
import { bootstrap, resetConfigForTest } from "../bootstrap/index.js";
import {
  PRODUCTION_ROLLOUT_DISABLED_ERROR,
  isProductionRolloutTrafficBlocked,
} from "../rollout/policy.js";
import { handleRequest } from "./routes.js";

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

const PROD_AUTH_APP_JSON = JSON.stringify([
  {
    client_id: "client-prod",
    client_secret: "client-secret-prod",
    app_id: "app-prod",
    allowed_issuers: ["https://idp.example.com"],
    allowed_scopes: ["query:invoke"],
  },
]);

function applyProductionBootstrapEnv(): void {
  process.env.NODE_ENV = "production";
  process.env.OPERATIONAL_BEARER_TOKEN = "ops-token";
  process.env.REQUIRE_AUTH_HEADER = "true";
  process.env.AUTH_AI_JWT_SECRET = "0123456789abcdef0123456789abcdef";
  process.env.AUTH_QUERY_REQUIRED_SCOPES = "query:invoke";
  process.env.AUTH_IDP_REGISTRY_JSON = PROD_AUTH_IDP_JSON;
  process.env.AUTH_APP_REGISTRY_JSON = PROD_AUTH_APP_JSON;
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
  process.env.AUDIT_LOG_PATH = "/tmp/ai-server-rollout-audit.jsonl";
  process.env.OBSERVABILITY_EVENT_SINK_PATH = "/tmp/ai-server-rollout-events.ndjson";
  process.env.OBSERVABILITY_REDACTION_LEVEL = "minimal";
  process.env.OBSERVABILITY_REQUIRED_EVENTS_V1 = "true";
  process.env.SECURITY_HARD_CONTROLS_ENABLED = "true";
  process.env.MAX_CONNECTIONS = "1000";
  process.env.MAX_CONNECTIONS_PER_IP = "100";
  process.env.MAX_CONCURRENT_REQUESTS = "100";
  process.env.MAX_REQUEST_QUEUE_DEPTH = "50";
  process.env.MAX_BODY_BYTES = "1000000";
}

function httpRequest(
  port: number,
  method: string,
  path: string,
  options: { headers?: Record<string, string>; body?: string } = {}
): Promise<{ statusCode: number; body: string }> {
  return new Promise((resolve, reject) => {
    const req = request(
      {
        host: "localhost",
        port,
        path,
        method,
        headers: {
          "Content-Type": "application/json",
          ...(options.body ? { "Content-Length": Buffer.byteLength(options.body) } : {}),
          ...options.headers,
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
    if (options.body) req.write(options.body);
    req.end();
  });
}

function createTestServer(): Promise<{ server: ReturnType<typeof createServer>; port: number }> {
  return new Promise((resolve) => {
    bootstrap();
    const server = createServer((req, res) => {
      void handleRequest(req, res).catch((err) => {
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

function closeServer(server: ReturnType<typeof createServer>): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((err) => (err ? reject(err) : resolve()));
  });
}

function parseError(body: string): { error?: { code?: string; message?: string } } {
  return JSON.parse(body) as { error?: { code?: string; message?: string } };
}

describe("production rollout kill-switch (PR-011)", () => {
  beforeEach(() => {
    resetConfigForTest();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
    resetConfigForTest();
  });

  it("blocks token exchange, query, and async query in production when rollout is off", async () => {
    applyProductionBootstrapEnv();
    process.env.PLATFORM_PRODUCTION_ROLLOUT_ENABLED = "false";
    const cfg = bootstrap();
    expect(isProductionRolloutTrafficBlocked(cfg)).toBe(true);

    const { server, port } = await createTestServer();
    try {
      const queryBody = JSON.stringify({
        request_id: "550e8400-e29b-41d4-a716-446655440099",
        caller: { app_id: "app-prod", user_id: "u1", org_id: "o1" },
        input: { text: "hi", attachments: [] },
        preferences: { response_format: "text", verbosity: "medium", stream: false },
        contract_version: "v1",
      });

      for (const path of ["/token/exchange", "/v1/query", "/v1/query/async"]) {
        const res = await httpRequest(port, "POST", path, {
          body: path === "/token/exchange" ? "{}" : queryBody,
        });
        expect(res.statusCode).toBe(503);
        const err = parseError(res.body).error;
        expect(err?.code).toBe(PRODUCTION_ROLLOUT_DISABLED_ERROR.code);
        expect(err?.message).toBe(PRODUCTION_ROLLOUT_DISABLED_ERROR.message);
      }
    } finally {
      await closeServer(server);
    }
  });

  it("does not block token exchange in development when rollout is off", async () => {
    process.env.NODE_ENV = "development";
    process.env.PLATFORM_PRODUCTION_ROLLOUT_ENABLED = "false";
    const cfg = bootstrap();
    expect(isProductionRolloutTrafficBlocked(cfg)).toBe(false);

    const { server, port } = await createTestServer();
    try {
      const res = await httpRequest(port, "POST", "/token/exchange", {
        body: JSON.stringify({
          grant_type: "client_credentials",
          client_id: "x",
          client_secret: "y",
        }),
      });
      expect(res.statusCode).not.toBe(503);
      const err = parseError(res.body).error;
      expect(err?.message).not.toBe(PRODUCTION_ROLLOUT_DISABLED_ERROR.message);
    } finally {
      await closeServer(server);
    }
  });

  it("allows production ingress when rollout and canary sign-off are enabled", async () => {
    applyProductionBootstrapEnv();
    process.env.PLATFORM_PRODUCTION_ROLLOUT_ENABLED = "true";
    process.env.ROLLOUT_CANARY_SIGNOFF = "true";
    process.env.RELEASE_ID = "rel-killswitch-test";
    process.env.CORS_ALLOWED_ORIGINS = "https://app.example.com";
    process.env.TLS_KEY_PATH = "/tmp/key.pem";
    process.env.TLS_CERT_PATH = "/tmp/cert.pem";
    process.env.OBSERVABILITY_TRACE_SAMPLE_RATE = "0.1";
    const cfg = bootstrap();
    expect(isProductionRolloutTrafficBlocked(cfg)).toBe(false);

    const { server, port } = await createTestServer();
    try {
      const res = await httpRequest(port, "POST", "/token/exchange", {
        body: JSON.stringify({
          grant_type: "client_credentials",
          client_id: "client-prod",
          client_secret: "client-secret-prod",
        }),
      });
      expect(res.statusCode).not.toBe(503);
      const err = parseError(res.body).error;
      expect(err?.message).not.toBe(PRODUCTION_ROLLOUT_DISABLED_ERROR.message);
    } finally {
      await closeServer(server);
    }
  });

  it("recovers after kill-switch is re-enabled via env on restart", async () => {
    applyProductionBootstrapEnv();
    process.env.PLATFORM_PRODUCTION_ROLLOUT_ENABLED = "false";

    const blocked = await createTestServer();
    try {
      const off = await httpRequest(blocked.port, "POST", "/token/exchange", { body: "{}" });
      expect(off.statusCode).toBe(503);
    } finally {
      await closeServer(blocked.server);
      resetConfigForTest();
    }

    process.env.PLATFORM_PRODUCTION_ROLLOUT_ENABLED = "true";
    process.env.ROLLOUT_CANARY_SIGNOFF = "true";
    process.env.RELEASE_ID = "rel-killswitch-test";
    process.env.CORS_ALLOWED_ORIGINS = "https://app.example.com";
    process.env.TLS_KEY_PATH = "/tmp/key.pem";
    process.env.TLS_CERT_PATH = "/tmp/cert.pem";
    process.env.OBSERVABILITY_TRACE_SAMPLE_RATE = "0.1";

    const recovered = await createTestServer();
    try {
      const on = await httpRequest(recovered.port, "POST", "/token/exchange", {
        body: JSON.stringify({
          grant_type: "client_credentials",
          client_id: "client-prod",
          client_secret: "client-secret-prod",
        }),
      });
      expect(on.statusCode).not.toBe(503);
      expect(parseError(on.body).error?.message).not.toBe(
        PRODUCTION_ROLLOUT_DISABLED_ERROR.message
      );
    } finally {
      await closeServer(recovered.server);
    }
  });
});
