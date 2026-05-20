/**
 * Bootstrap smoke test – deterministic startup and getConfig.
 */

import { bootstrap, getConfig, resetConfigForTest } from "./index.js";

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

/** Minimal production auth env (PR-003). */
function applyProductionAuthEnv(): void {
  process.env.REQUIRE_AUTH_HEADER = "true";
  process.env.AUTH_AI_JWT_SECRET = "0123456789abcdef0123456789abcdef";
  process.env.AUTH_QUERY_REQUIRED_SCOPES = "query:invoke";
  process.env.AUTH_IDP_REGISTRY_JSON = PROD_AUTH_IDP_JSON;
  process.env.AUTH_APP_REGISTRY_JSON = PROD_AUTH_APP_JSON;
}

/** Production rollout + release traceability (PR-004). */
function applyProductionRolloutEnv(): void {
  process.env.PLATFORM_PRODUCTION_ROLLOUT_ENABLED = "true";
  process.env.ROLLOUT_CANARY_SIGNOFF = "true";
  process.env.RELEASE_ID = "rel-bootstrap-test";
  process.env.CORS_ALLOWED_ORIGINS = "https://app.example.com";
  process.env.TLS_KEY_PATH = "/tmp/key.pem";
  process.env.TLS_CERT_PATH = "/tmp/cert.pem";
  process.env.OBSERVABILITY_TRACE_SAMPLE_RATE = "0.1";
}

/** Production scoped secrets backend (PR-005). */
function applyProductionSecretsEnv(): void {
  process.env.SECRETS_BACKEND = "env";
  process.env.SCOPED_SECRETS_JSON = JSON.stringify({ bootstrap_test: "ok" });
}

/** Production persistent audit + event sinks (PR-012). */
function applyProductionSinksEnv(): void {
  process.env.AUDIT_LOG_PATH = "/tmp/ai-server-bootstrap-audit.jsonl";
  process.env.OBSERVABILITY_EVENT_SINK_PATH = "/tmp/ai-server-bootstrap-events.ndjson";
}

/** Production persistent memory (PR-006). */
function applyProductionMemoryEnv(): void {
  process.env.MEMORY_BACKEND = "vector";
  process.env.REDIS_URL = "redis://127.0.0.1:6379";
}

function applyProductionModelEnv(): void {
  process.env.MODEL_PROVIDER_API_KEY = "sk-test-bootstrap-only";
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
}

beforeEach(() => {
  process.env = { ...originalEnv };
  resetConfigForTest();
});

afterAll(() => {
  process.env = originalEnv;
  resetConfigForTest();
});

describe("bootstrap", () => {
  it("returns config and allows getConfig", () => {
    const config = bootstrap();
    expect(config).toBeDefined();
    expect(config.env).toBeDefined();
    expect(config.flags).toBeDefined();
    expect(getConfig()).toBe(config);
  });

  it("is idempotent", () => {
    const a = bootstrap();
    const b = bootstrap();
    expect(a).toBe(b);
  });

  it("fails in production when operational endpoint token is not configured", () => {
    process.env.NODE_ENV = "production";
    delete process.env.OPERATIONAL_BEARER_TOKEN;
    expect(() => bootstrap()).toThrow("OPERATIONAL_BEARER_TOKEN is required in production");
  });

  it("fails in production when model providers are only stub/framed_echo (WANT-023)", () => {
    process.env.NODE_ENV = "production";
    process.env.OPERATIONAL_BEARER_TOKEN = "ops-token";
    applyProductionAuthEnv();
    delete process.env.MODEL_GATEWAY_PROVIDERS_JSON;
    expect(() => bootstrap()).toThrow("openai_compatible");
  });

  it("fails in production when AUTH_IDP_REGISTRY_JSON is not set (PR-003)", () => {
    process.env.NODE_ENV = "production";
    process.env.OPERATIONAL_BEARER_TOKEN = "ops-token";
    process.env.AUTH_AI_JWT_SECRET = "0123456789abcdef0123456789abcdef";
    process.env.REQUIRE_AUTH_HEADER = "true";
    delete process.env.AUTH_IDP_REGISTRY_JSON;
    delete process.env.AUTH_APP_REGISTRY_JSON;
    applyProductionModelEnv();
    expect(() => bootstrap()).toThrow(/AUTH_IDP_REGISTRY_JSON/);
  });

  it("fails in production when openai_compatible provider API key env is empty (PR-002)", () => {
    process.env.NODE_ENV = "production";
    process.env.OPERATIONAL_BEARER_TOKEN = "ops-token";
    applyProductionAuthEnv();
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
    delete process.env.MODEL_PROVIDER_API_KEY;
    expect(() => bootstrap()).toThrow(/missing API key/);
  });

  it("fails in production without shared tenant budget backend (PR-007)", () => {
    process.env.NODE_ENV = "production";
    process.env.OPERATIONAL_BEARER_TOKEN = "ops-token";
    applyProductionAuthEnv();
    applyProductionModelEnv();
    applyProductionSecretsEnv();
    applyProductionSinksEnv();
    process.env.MEMORY_BACKEND = "vector";
    process.env.CHROMA_URL = "http://chroma:8000";
    delete process.env.REDIS_URL;
    delete process.env.TENANT_BUDGET_POSTGRES_URL;
    delete process.env.TENANT_BUDGET_REDIS_REST_URL;
    delete process.env.TENANT_BUDGET_REDIS_REST_TOKEN;
    expect(() => bootstrap()).toThrow(/shared tenant budget backend/);
  });

  it("fails in production when MEMORY_BACKEND is in_memory (PR-006)", () => {
    process.env.NODE_ENV = "production";
    process.env.OPERATIONAL_BEARER_TOKEN = "ops-token";
    applyProductionAuthEnv();
    applyProductionModelEnv();
    applyProductionSecretsEnv();
    process.env.MEMORY_BACKEND = "in_memory";
    expect(() => bootstrap()).toThrow(/MEMORY_BACKEND=vector/);
  });

  it("fails in production when vector memory has no REDIS_URL or CHROMA_URL (PR-006)", () => {
    process.env.NODE_ENV = "production";
    process.env.OPERATIONAL_BEARER_TOKEN = "ops-token";
    applyProductionAuthEnv();
    applyProductionModelEnv();
    applyProductionSecretsEnv();
    process.env.MEMORY_BACKEND = "vector";
    delete process.env.REDIS_URL;
    delete process.env.CHROMA_URL;
    expect(() => bootstrap()).toThrow(/REDIS_URL or CHROMA_URL/);
  });

  it("fails in production when SECRETS_BACKEND is stub (PR-005)", () => {
    process.env.NODE_ENV = "production";
    process.env.OPERATIONAL_BEARER_TOKEN = "ops-token";
    applyProductionAuthEnv();
    applyProductionModelEnv();
    process.env.SECRETS_BACKEND = "stub";
    expect(() => bootstrap()).toThrow(/SECRETS_BACKEND=env/);
  });

  it("fails in production when env secrets backend has no material (PR-005)", () => {
    process.env.NODE_ENV = "production";
    process.env.OPERATIONAL_BEARER_TOKEN = "ops-token";
    applyProductionAuthEnv();
    applyProductionModelEnv();
    process.env.SECRETS_BACKEND = "env";
    delete process.env.SCOPED_SECRETS_JSON;
    expect(() => bootstrap()).toThrow(/scoped secrets material/);
  });

  it("fails in production when persistent sink paths are unset (PR-012)", () => {
    process.env.NODE_ENV = "production";
    process.env.OPERATIONAL_BEARER_TOKEN = "ops-token";
    applyProductionAuthEnv();
    applyProductionModelEnv();
    applyProductionSecretsEnv();
    applyProductionMemoryEnv();
    delete process.env.AUDIT_LOG_PATH;
    delete process.env.OBSERVABILITY_EVENT_SINK_PATH;
    expect(() => bootstrap()).toThrow(/AUDIT_LOG_PATH/);
  });

  it("bootstraps in production with auth and model provider config (PR-002, PR-003)", () => {
    process.env.NODE_ENV = "production";
    process.env.OPERATIONAL_BEARER_TOKEN = "ops-token";
    applyProductionAuthEnv();
    applyProductionModelEnv();
    applyProductionSecretsEnv();
    applyProductionMemoryEnv();
    applyProductionSinksEnv();
    const cfg = bootstrap();
    expect(cfg.requireAuthHeader).toBe(true);
    expect(cfg.auth.query_required_scopes).toContain("query:invoke");
    expect(cfg.model_gateway.providers.some((p) => p.kind === "openai_compatible")).toBe(
      true
    );
    expect(cfg.model_gateway.registry.chat?.default?.provider).toBe("openai");
  });

  it("fails production rollout when AUTH_AI_JWT_SECRET is weak", () => {
    process.env.NODE_ENV = "production";
    process.env.PLATFORM_PRODUCTION_ROLLOUT_ENABLED = "true";
    process.env.ROLLOUT_CANARY_SIGNOFF = "true";
    process.env.OPERATIONAL_BEARER_TOKEN = "ops-token";
    applyProductionAuthEnv();
    applyProductionModelEnv();
    applyProductionSecretsEnv();
    applyProductionMemoryEnv();
    applyProductionSinksEnv();
    process.env.AUTH_AI_JWT_SECRET = "short-secret";
    process.env.CORS_ALLOWED_ORIGINS = "https://app.example.com";
    process.env.TLS_KEY_PATH = "/tmp/key.pem";
    process.env.TLS_CERT_PATH = "/tmp/cert.pem";
    process.env.OBSERVABILITY_TRACE_SAMPLE_RATE = "0.1";
    expect(() => bootstrap()).toThrow(
      /Production requires AUTH_AI_JWT_SECRET/
    );
  });

  it("fails production rollout when CORS_ALLOWED_ORIGINS is not explicit", () => {
    process.env.NODE_ENV = "production";
    process.env.PLATFORM_PRODUCTION_ROLLOUT_ENABLED = "true";
    process.env.ROLLOUT_CANARY_SIGNOFF = "true";
    process.env.OPERATIONAL_BEARER_TOKEN = "ops-token";
    applyProductionAuthEnv();
    applyProductionModelEnv();
    applyProductionSecretsEnv();
    applyProductionMemoryEnv();
    applyProductionSinksEnv();
    process.env.CORS_ALLOWED_ORIGINS = "*";
    process.env.TLS_KEY_PATH = "/tmp/key.pem";
    process.env.TLS_CERT_PATH = "/tmp/cert.pem";
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
    expect(() => bootstrap()).toThrow(
      "Production rollout requires CORS_ALLOWED_ORIGINS to be explicitly set (not *)"
    );
  });

  it("fails production rollout when TLS paths are not configured", () => {
    process.env.NODE_ENV = "production";
    process.env.PLATFORM_PRODUCTION_ROLLOUT_ENABLED = "true";
    process.env.ROLLOUT_CANARY_SIGNOFF = "true";
    process.env.OPERATIONAL_BEARER_TOKEN = "ops-token";
    applyProductionAuthEnv();
    applyProductionModelEnv();
    applyProductionSecretsEnv();
    applyProductionMemoryEnv();
    applyProductionSinksEnv();
    process.env.CORS_ALLOWED_ORIGINS = "https://app.example.com";
    process.env.OBSERVABILITY_TRACE_SAMPLE_RATE = "0.1";
    delete process.env.TLS_KEY_PATH;
    delete process.env.TLS_CERT_PATH;
    expect(() => bootstrap()).toThrow(
      "Production rollout requires TLS_KEY_PATH and TLS_CERT_PATH"
    );
  });

  it("fails production rollout when ROLLOUT_CANARY_SIGNOFF is not set (PR-010)", () => {
    process.env.NODE_ENV = "production";
    process.env.OPERATIONAL_BEARER_TOKEN = "ops-token";
    applyProductionAuthEnv();
    applyProductionModelEnv();
    applyProductionSecretsEnv();
    applyProductionMemoryEnv();
    applyProductionSinksEnv();
    process.env.PLATFORM_PRODUCTION_ROLLOUT_ENABLED = "true";
    process.env.CORS_ALLOWED_ORIGINS = "https://app.example.com";
    process.env.TLS_KEY_PATH = "/tmp/key.pem";
    process.env.TLS_CERT_PATH = "/tmp/cert.pem";
    process.env.OBSERVABILITY_TRACE_SAMPLE_RATE = "0.1";
    process.env.RELEASE_ID = "rel-bootstrap-test";
    delete process.env.ROLLOUT_CANARY_SIGNOFF;
    expect(() => bootstrap()).toThrow(/ROLLOUT_CANARY_SIGNOFF=true/);
  });

  it("fails production rollout when RELEASE_ID and BUILD_ID are unset", () => {
    process.env.NODE_ENV = "production";
    process.env.OPERATIONAL_BEARER_TOKEN = "ops-token";
    applyProductionAuthEnv();
    applyProductionModelEnv();
    applyProductionSecretsEnv();
    applyProductionMemoryEnv();
    applyProductionSinksEnv();
    applyProductionRolloutEnv();
    delete process.env.RELEASE_ID;
    delete process.env.BUILD_ID;
    expect(() => bootstrap()).toThrow(
      "Production rollout requires RELEASE_ID or BUILD_ID for traceability"
    );
  });

  it("bootstraps in production with rollout and RELEASE_ID (PR-004)", () => {
    process.env.NODE_ENV = "production";
    process.env.OPERATIONAL_BEARER_TOKEN = "ops-token";
    applyProductionAuthEnv();
    applyProductionModelEnv();
    applyProductionSecretsEnv();
    applyProductionMemoryEnv();
    applyProductionSinksEnv();
    applyProductionRolloutEnv();
    const cfg = bootstrap();
    expect(cfg.release?.release_id).toBe("rel-bootstrap-test");
  });

  it("fails in production when AUDIT_LOG_PATH parent directory does not exist", () => {
    process.env.NODE_ENV = "production";
    process.env.OPERATIONAL_BEARER_TOKEN = "ops-token";
    applyProductionAuthEnv();
    applyProductionModelEnv();
    applyProductionSecretsEnv();
    applyProductionMemoryEnv();
    applyProductionSinksEnv();
    process.env.OBSERVABILITY_EVENT_SINK_PATH = "/tmp/ai-server-bootstrap-events.ndjson";
    process.env.AUDIT_LOG_PATH = "/nonexistent-sink-parent-xyz-99999/audit.jsonl";
    delete process.env.PLATFORM_PRODUCTION_ROLLOUT_ENABLED;
    expect(() => bootstrap()).toThrow("Production sink parent directory must exist");
  });
});

describe("getConfig", () => {
  it("returns same config as bootstrap()", () => {
    bootstrap();
    expect(getConfig()).toBe(bootstrap());
  });
});

describe("resetConfigForTest", () => {
  it("clears config cache so getConfig throws until next bootstrap", () => {
    bootstrap();
    resetConfigForTest();
    expect(() => getConfig()).toThrow("bootstrap() must be called");
    bootstrap();
    expect(getConfig()).toBeDefined();
  });
});
