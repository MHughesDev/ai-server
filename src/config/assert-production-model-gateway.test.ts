/**
 * Production model gateway assertion tests (PR-002).
 */

import { assertProductionModelGateway } from "./assert-production-model-gateway.js";
import type { Config } from "./schema.js";

const originalEnv = process.env;

function baseProductionConfig(): Config {
  return {
    env: "production",
    logLevel: "info",
    requireAuthHeader: false,
    auth: {
      ai_jwt_issuer: "ai",
      ai_jwt_audience: "aud",
      ai_jwt_secret: "x".repeat(32),
      ai_jwt_ttl_seconds: 900,
      query_required_scopes: ["query:invoke"],
      idp_registry: [],
      app_registry: [],
    },
    ingress_rate_limit: { max_requests: 0, window_ms: 60_000 },
    model_gateway: {
      timeout_ms: 25_000,
      max_retries: 2,
      default_model: "gpt-4o-mini",
      default_capability: "chat",
      providers: [
        {
          id: "openai",
          kind: "openai_compatible",
          default_model: "gpt-4o-mini",
          api_key_env: "OPENAI_API_KEY",
        },
      ],
      registry: {
        chat: { default: { provider: "openai", model: "gpt-4o-mini" } },
      },
    },
    maxRequestBodyBytes: 1_000_000,
    requestReadTimeoutMs: 30_000,
    flags: {},
    release: {},
    memoryRetention: {},
    memory: {
      retrieval_timeout_ms: 5000,
      max_context_chars: 8000,
      max_context_tokens: 2000,
      max_chunks_per_ingest: 128,
      ingest_chunk_cap_policy: "reject",
      backend: "in_memory",
      embedding: {
        provider: "hash",
        model: "hash",
        api_key_env: "UNUSED",
        dimensions: 1536,
      },
    },
    maxAttachmentCount: 10,
    maxAttachmentBytes: 5_000_000,
  } as Config;
}

beforeEach(() => {
  process.env = { ...originalEnv, OPENAI_API_KEY: "sk-test-key" };
});

afterAll(() => {
  process.env = originalEnv;
});

describe("assertProductionModelGateway", () => {
  it("no-op outside production", () => {
    const cfg = baseProductionConfig();
    cfg.env = "development";
    expect(() => assertProductionModelGateway(cfg)).not.toThrow();
  });

  it("throws when only framed_echo providers", () => {
    const cfg = baseProductionConfig();
    cfg.model_gateway.providers = [
      { id: "framed", kind: "framed_echo", default_model: "framed-chat" },
    ];
    expect(() => assertProductionModelGateway(cfg)).toThrow(/openai_compatible/);
  });

  it("throws when openai_compatible provider has no API key", () => {
    delete process.env.OPENAI_API_KEY;
    expect(() => assertProductionModelGateway(baseProductionConfig())).toThrow(
      /missing API key/
    );
  });

  it("throws when registry routes to framed provider", () => {
    const cfg = baseProductionConfig();
    cfg.model_gateway.providers = [
      { id: "openai", kind: "openai_compatible", default_model: "gpt-4o-mini", api_key_env: "OPENAI_API_KEY" },
      { id: "framed", kind: "framed_echo", default_model: "framed-chat" },
    ];
    cfg.model_gateway.registry = {
      chat: { default: { provider: "framed", model: "framed-chat" } },
    };
    expect(() => assertProductionModelGateway(cfg)).toThrow(/openai_compatible/);
  });

  it("passes with openai provider, key, and registry", () => {
    expect(() => assertProductionModelGateway(baseProductionConfig())).not.toThrow();
  });
});
