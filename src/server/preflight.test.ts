import { loadConfigFromEnv } from "../config/schema.js";
import { runProductionPreflight } from "./preflight.js";

const originalEnv = process.env;

describe("production preflight", () => {
  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it("fails with default insecure config", async () => {
    process.env = {};
    const config = loadConfigFromEnv();
    const report = await runProductionPreflight(config);
    expect(report.summary.status).toBe("fail");
    expect(report.checks.some((c) => c.status === "fail")).toBe(true);
  });

  it("passes when required production checks are configured", async () => {
    process.env.NODE_ENV = "production";
    process.env.PLATFORM_PRODUCTION_ROLLOUT_ENABLED = "true";
    process.env.REQUIRE_AUTH_HEADER = "true";
    process.env.SECURITY_HARD_CONTROLS_ENABLED = "true";
    process.env.ENABLE_COST_CAPS = "true";
    process.env.AUTH_AI_JWT_SECRET = "0123456789abcdef0123456789abcdef";
    process.env.TLS_KEY_PATH = "/etc/tls/key.pem";
    process.env.TLS_CERT_PATH = "/etc/tls/cert.pem";
    process.env.CORS_ALLOWED_ORIGINS = "https://app.example.com";
    process.env.OPERATIONAL_BEARER_TOKEN = "ops-token";
    process.env.INGRESS_RATE_LIMIT_MAX_REQUESTS = "100";
    process.env.INGRESS_RATE_LIMIT_WINDOW_MS = "60000";
    process.env.MAX_CONNECTIONS = "1000";
    process.env.MAX_CONCURRENT_REQUESTS = "100";
    process.env.MAX_BODY_BYTES = "1000000";
    process.env.REQUEST_PROCESSING_TIMEOUT_MS = "60000";
    process.env.MEMORY_BACKEND = "vector";
    process.env.REDIS_URL = "redis://redis:6379";
    process.env.OBSERVABILITY_TRACE_SAMPLE_RATE = "0.1";
    process.env.AUTH_IDP_REGISTRY_JSON = JSON.stringify([
      {
        issuer: "https://idp.example.com",
        audience: "ai-server-token-exchange",
        jwt_algorithm: "HS256",
        jwt_secret: "not-default-external-idp-secret",
        claim_mapping: {},
      },
    ]);
    process.env.AUTH_APP_REGISTRY_JSON = JSON.stringify([
      {
        client_id: "client-prod",
        client_secret: "client-secret-prod",
        app_id: "app-prod",
        allowed_issuers: ["https://idp.example.com"],
        allowed_scopes: ["query:invoke"],
      },
    ]);
    process.env.MODEL_GATEWAY_PROVIDERS_JSON = JSON.stringify([
      {
        id: "openai-prod",
        kind: "openai_compatible",
        default_model: "gpt-4o-mini",
        base_url: "https://api.openai.com/v1",
        api_key_env: "OPENAI_API_KEY",
        input_cost_per_million_usd: 0.15,
        output_cost_per_million_usd: 0.6,
      },
    ]);
    process.env.MODEL_GATEWAY_REGISTRY_JSON = JSON.stringify({
      chat: {
        default: {
          provider: "openai-prod",
          model: "gpt-4o-mini",
        },
      },
    });
    process.env.SECRETS_BACKEND = "env";
    process.env.SCOPED_SECRETS_JSON = JSON.stringify({ api_key: "preflight-secret" });
    process.env.ROLLOUT_CANARY_SIGNOFF = "true";
    process.env.AUDIT_LOG_PATH = "/var/log/ai-server/audit.jsonl";
    process.env.OBSERVABILITY_EVENT_SINK_PATH = "/var/log/ai-server/events.ndjson";

    const config = loadConfigFromEnv();
    const report = await runProductionPreflight(config);
    expect(report.summary.status).toBe("pass");
    expect(report.summary.failed).toBe(0);
  });
});

