/**
 * Production memory wiring integration test (PR-006).
 */

import { bootstrap, resetConfigForTest } from "../bootstrap/index.js";
import { getDefaultStore, setDefaultStore } from "../memory/default-store.js";
import { VectorRetrievalAdapter } from "../memory/vector-retrieval-adapter.js";

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

beforeEach(() => {
  process.env = { ...originalEnv };
  resetConfigForTest();
  setDefaultStore(null);
});

afterAll(() => {
  process.env = originalEnv;
  resetConfigForTest();
  setDefaultStore(null);
});

function applyProductionEnv(): void {
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
  process.env.AUDIT_LOG_PATH = "/tmp/ai-server-memory-audit.jsonl";
  process.env.OBSERVABILITY_EVENT_SINK_PATH = "/tmp/ai-server-memory-events.ndjson";
  process.env.OBSERVABILITY_REDACTION_LEVEL = "minimal";
  process.env.OBSERVABILITY_REQUIRED_EVENTS_V1 = "true";
  process.env.SECURITY_HARD_CONTROLS_ENABLED = "true";
  process.env.MAX_CONNECTIONS = "1000";
  process.env.MAX_CONNECTIONS_PER_IP = "100";
  process.env.MAX_CONCURRENT_REQUESTS = "100";
  process.env.MAX_REQUEST_QUEUE_DEPTH = "50";
  process.env.MAX_BODY_BYTES = "1000000";
}

describe("production memory integration", () => {
  it("bootstraps with vector backend and Redis URL (PR-006)", () => {
    applyProductionEnv();
    const cfg = bootstrap();
    expect(cfg.memory.backend).toBe("vector");
    expect(getDefaultStore()).toBeInstanceOf(VectorRetrievalAdapter);
  });
});
