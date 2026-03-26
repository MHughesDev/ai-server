/**
 * Bootstrap smoke test – deterministic startup and getConfig.
 */

import { bootstrap, getConfig, resetConfigForTest } from "./index.js";

const originalEnv = process.env;

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
    delete process.env.MODEL_GATEWAY_PROVIDERS_JSON;
    expect(() => bootstrap()).toThrow("openai_compatible");
  });

  it("fails production rollout when AUTH_AI_JWT_SECRET is weak", () => {
    process.env.NODE_ENV = "production";
    process.env.PLATFORM_PRODUCTION_ROLLOUT_ENABLED = "true";
    process.env.OPERATIONAL_BEARER_TOKEN = "ops-token";
    process.env.REQUIRE_AUTH_HEADER = "true";
    process.env.CORS_ALLOWED_ORIGINS = "https://app.example.com";
    process.env.TLS_KEY_PATH = "/tmp/key.pem";
    process.env.TLS_CERT_PATH = "/tmp/cert.pem";
    process.env.OBSERVABILITY_TRACE_SAMPLE_RATE = "0.1";
    process.env.AUTH_IDP_REGISTRY_JSON = JSON.stringify([
      {
        issuer: "https://idp.example.com",
        audience: "ai-server-token-exchange",
        jwt_algorithm: "HS256",
        jwt_secret: "not-default-but-short",
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
    process.env.AUTH_AI_JWT_SECRET = "short-secret";
    expect(() => bootstrap()).toThrow(
      "Production rollout requires AUTH_AI_JWT_SECRET with a strong 32+ char value"
    );
  });

  it("fails production rollout when CORS_ALLOWED_ORIGINS is not explicit", () => {
    process.env.NODE_ENV = "production";
    process.env.PLATFORM_PRODUCTION_ROLLOUT_ENABLED = "true";
    process.env.OPERATIONAL_BEARER_TOKEN = "ops-token";
    process.env.REQUIRE_AUTH_HEADER = "true";
    process.env.AUTH_AI_JWT_SECRET = "0123456789abcdef0123456789abcdef";
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
    process.env.OPERATIONAL_BEARER_TOKEN = "ops-token";
    process.env.REQUIRE_AUTH_HEADER = "true";
    process.env.CORS_ALLOWED_ORIGINS = "https://app.example.com";
    process.env.AUTH_AI_JWT_SECRET = "0123456789abcdef0123456789abcdef";
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
    delete process.env.TLS_KEY_PATH;
    delete process.env.TLS_CERT_PATH;
    expect(() => bootstrap()).toThrow(
      "Production rollout requires TLS_KEY_PATH and TLS_CERT_PATH"
    );
  });

  it("fails production rollout when RELEASE_ID and BUILD_ID are unset", () => {
    process.env.NODE_ENV = "production";
    process.env.PLATFORM_PRODUCTION_ROLLOUT_ENABLED = "true";
    process.env.OPERATIONAL_BEARER_TOKEN = "ops-token";
    process.env.REQUIRE_AUTH_HEADER = "true";
    process.env.CORS_ALLOWED_ORIGINS = "https://app.example.com";
    process.env.AUTH_AI_JWT_SECRET = "0123456789abcdef0123456789abcdef";
    process.env.TLS_KEY_PATH = "/tmp/key.pem";
    process.env.TLS_CERT_PATH = "/tmp/cert.pem";
    process.env.OBSERVABILITY_TRACE_SAMPLE_RATE = "0.1";
    delete process.env.RELEASE_ID;
    delete process.env.BUILD_ID;
    process.env.MODEL_GATEWAY_PROVIDERS_JSON = JSON.stringify([
      {
        id: "openai1",
        kind: "openai_compatible",
        default_model: "gpt-4o-mini",
        api_key_env: "OPENAI_API_KEY",
      },
    ]);
    process.env.MODEL_GATEWAY_REGISTRY_JSON = JSON.stringify({
      chat: { default: { provider: "openai1", model: "gpt-4o-mini" } },
    });
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
      "Production rollout requires RELEASE_ID or BUILD_ID for traceability"
    );
  });

  it("fails in production when AUDIT_LOG_PATH parent directory does not exist", () => {
    process.env.NODE_ENV = "production";
    process.env.OPERATIONAL_BEARER_TOKEN = "ops-token";
    process.env.AUDIT_LOG_PATH = "/nonexistent-sink-parent-xyz-99999/audit.jsonl";
    delete process.env.PLATFORM_PRODUCTION_ROLLOUT_ENABLED;
    process.env.MODEL_GATEWAY_PROVIDERS_JSON = JSON.stringify([
      {
        id: "openai1",
        kind: "openai_compatible",
        default_model: "gpt-4o-mini",
        api_key_env: "OPENAI_API_KEY",
      },
    ]);
    process.env.MODEL_GATEWAY_REGISTRY_JSON = JSON.stringify({
      chat: { default: { provider: "openai1", model: "gpt-4o-mini" } },
    });
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
