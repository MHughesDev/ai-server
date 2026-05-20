/**
 * Production auth assertion tests (PR-003).
 */

import { assertProductionAuth } from "./assert-production-auth.js";
import { loadConfigFromEnv } from "./schema.js";

const originalEnv = process.env;

const PROD_IDP_JSON = JSON.stringify([
  {
    issuer: "https://idp.example.com",
    audience: "ai-server-token-exchange",
    jwt_algorithm: "HS256",
    jwt_secret: "production-idp-secret-value",
    claim_mapping: { org_id: "org_id", app_id: "azp", user_id: "sub" },
  },
]);

const PROD_APP_JSON = JSON.stringify([
  {
    client_id: "client-prod",
    client_secret: "client-secret-prod",
    app_id: "app-prod",
    allowed_issuers: ["https://idp.example.com"],
    allowed_scopes: ["query:invoke"],
  },
]);

function loadProductionConfig(): ReturnType<typeof loadConfigFromEnv> {
  process.env.NODE_ENV = "production";
  process.env.REQUIRE_AUTH_HEADER = "true";
  process.env.AUTH_AI_JWT_SECRET = "0123456789abcdef0123456789abcdef";
  process.env.AUTH_QUERY_REQUIRED_SCOPES = "query:invoke";
  process.env.AUTH_IDP_REGISTRY_JSON = PROD_IDP_JSON;
  process.env.AUTH_APP_REGISTRY_JSON = PROD_APP_JSON;
  process.env.OPERATIONAL_BEARER_TOKEN = "ops-token";
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
  return loadConfigFromEnv();
}

beforeEach(() => {
  process.env = { ...originalEnv };
});

afterAll(() => {
  process.env = originalEnv;
});

describe("assertProductionAuth", () => {
  it("no-op outside production", () => {
    process.env.NODE_ENV = "development";
    const cfg = loadProductionConfig();
    cfg.env = "development";
    expect(() => assertProductionAuth(cfg)).not.toThrow();
  });

  it("throws when AUTH_AI_JWT_SECRET is default dev value", () => {
    const cfg = loadProductionConfig();
    cfg.auth.ai_jwt_secret = "dev-ai-jwt-secret";
    expect(() => assertProductionAuth(cfg)).toThrow(/AUTH_AI_JWT_SECRET/);
  });

  it("throws when AUTH_IDP_REGISTRY_JSON env is not set", () => {
    const cfg = loadProductionConfig();
    delete process.env.AUTH_IDP_REGISTRY_JSON;
    expect(() => assertProductionAuth(cfg)).toThrow(/AUTH_IDP_REGISTRY_JSON/);
  });

  it("throws when REQUIRE_AUTH_HEADER is false", () => {
    const cfg = loadProductionConfig();
    cfg.requireAuthHeader = false;
    expect(() => assertProductionAuth(cfg)).toThrow(/REQUIRE_AUTH_HEADER/);
  });

  it("passes with explicit production auth configuration", () => {
    const cfg = loadProductionConfig();
    expect(() => assertProductionAuth(cfg)).not.toThrow();
  });
});
