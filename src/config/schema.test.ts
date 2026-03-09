/**
 * Config and feature-flag tests – missing/invalid config behavior.
 */

import { writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadConfigFromEnv, ConfigSchema } from "./schema.js";

describe("ConfigSchema", () => {
  it("accepts valid defaults", () => {
    const config = ConfigSchema.parse({
      env: "dev",
      logLevel: "info",
      maxRequestBodyBytes: 1_000_000,
      flags: {},
    });
    expect(config.env).toBe("dev");
    expect(config.flags.enable_cost_caps).toBe(true);
    expect(config.auth.ai_jwt_issuer).toBe("ai-server");
    expect(config.ingress_rate_limit.max_requests).toBe(0);
    expect(config.model_gateway.default_capability).toBe("chat");
    expect(config.model_gateway.registry.chat?.default?.provider).toBe("framed");
  });

  it("defaults multimodal_input_path_enabled to false (L2-07)", () => {
    const config = ConfigSchema.parse({
      env: "dev",
      logLevel: "info",
      maxRequestBodyBytes: 1_000_000,
      flags: {},
    });
    expect(config.flags.multimodal_input_path_enabled).toBe(false);
  });

  it("accepts L2-07 attachment limits", () => {
    const config = ConfigSchema.parse({
      env: "dev",
      logLevel: "info",
      maxRequestBodyBytes: 1_000_000,
      flags: {},
      maxAttachmentCount: 5,
      maxAttachmentBytes: 2 * 1024 * 1024,
    });
    expect(config.maxAttachmentCount).toBe(5);
    expect(config.maxAttachmentBytes).toBe(2 * 1024 * 1024);
  });

  it("rejects invalid env", () => {
    expect(() => ConfigSchema.parse({ env: "prod" })).toThrow();
  });

  it("rejects invalid logLevel", () => {
    expect(() => ConfigSchema.parse({ logLevel: "trace" })).toThrow();
  });

  it("accepts optional release metadata", () => {
    const config = ConfigSchema.parse({
      env: "staging",
      logLevel: "info",
      maxRequestBodyBytes: 1_000_000,
      flags: {},
      release: { release_id: "r-1", build_id: "b-2" },
    });
    expect(config.release?.release_id).toBe("r-1");
    expect(config.release?.build_id).toBe("b-2");
  });
});

describe("loadConfigFromEnv", () => {
  const orig = process.env;

  afterEach(() => {
    process.env = { ...orig };
  });

  it("loads defaults when env is empty", () => {
    process.env = {};
    const config = loadConfigFromEnv();
    expect(config.env).toBe("dev");
    expect(config.flags.enable_cost_caps).toBe(true);
    expect(config.auth.query_required_scopes).toEqual(["query:invoke"]);
    expect(config.memory.backend).toBe("in_memory");
    expect(config.memory.retrieval_timeout_ms).toBe(1_500);
  });

  it("parses memory runtime controls from env", () => {
    process.env.MEMORY_BACKEND = "vector";
    process.env.MEMORY_RETRIEVAL_TIMEOUT_MS = "777";
    process.env.MEMORY_MAX_CONTEXT_CHARS = "1024";
    process.env.MEMORY_MAX_CHUNKS_PER_INGEST = "9";
    process.env.MEMORY_INGEST_CHUNK_CAP_POLICY = "reject";
    const config = loadConfigFromEnv();
    expect(config.memory.backend).toBe("vector");
    expect(config.memory.retrieval_timeout_ms).toBe(777);
    expect(config.memory.max_context_chars).toBe(1024);
    expect(config.memory.max_chunks_per_ingest).toBe(9);
    expect(config.memory.ingest_chunk_cap_policy).toBe("reject");
  });

  it("respects auth and rate limit env overrides", () => {
    process.env.AUTH_AI_JWT_ISSUER = "issuer.test";
    process.env.AUTH_AI_JWT_AUDIENCE = "aud.test";
    process.env.AUTH_AI_JWT_SECRET = "super-secret";
    process.env.AUTH_QUERY_REQUIRED_SCOPES = "query:invoke,query:admin";
    process.env.INGRESS_RATE_LIMIT_MAX_REQUESTS = "5";
    process.env.INGRESS_RATE_LIMIT_WINDOW_MS = "1000";
    const config = loadConfigFromEnv();
    expect(config.auth.ai_jwt_issuer).toBe("issuer.test");
    expect(config.auth.ai_jwt_audience).toBe("aud.test");
    expect(config.auth.ai_jwt_secret).toBe("super-secret");
    expect(config.auth.query_required_scopes).toEqual(["query:invoke", "query:admin"]);
    expect(config.ingress_rate_limit.max_requests).toBe(5);
    expect(config.ingress_rate_limit.window_ms).toBe(1000);
  });

  it("parses model provider and registry routing config from env", () => {
    process.env.MODEL_GATEWAY_PROVIDERS_JSON = JSON.stringify([
      { id: "p-framed", kind: "framed_echo", default_model: "framed-default" },
    ]);
    process.env.MODEL_GATEWAY_REGISTRY_JSON = JSON.stringify({
      chat: {
        default: { provider: "p-framed", model: "chat-default" },
        org: { o1: { provider: "p-framed", model: "chat-org" } },
      },
    });
    process.env.MODEL_GATEWAY_TIMEOUT_MS = "3210";
    process.env.MODEL_GATEWAY_MAX_RETRIES = "4";

    const config = loadConfigFromEnv();
    expect(config.model_gateway.timeout_ms).toBe(3210);
    expect(config.model_gateway.max_retries).toBe(4);
    expect(config.model_gateway.providers[0]?.id).toBe("p-framed");
    expect(config.model_gateway.registry.chat?.org?.o1?.model).toBe("chat-org");
  });

  it("throws when auth registry env is invalid JSON", () => {
    process.env.AUTH_IDP_REGISTRY_JSON = "{not-json";
    expect(() => loadConfigFromEnv()).toThrow("AUTH_IDP_REGISTRY_JSON is invalid JSON");
  });

  it("treats ENABLE_COST_CAPS=false", () => {
    process.env.ENABLE_COST_CAPS = "false";
    const config = loadConfigFromEnv();
    expect(config.flags.enable_cost_caps).toBe(false);
  });

  it("respects SECURITY_HARD_CONTROLS_ENABLED default true", () => {
    process.env.SECURITY_HARD_CONTROLS_ENABLED = undefined;
    const config = loadConfigFromEnv();
    expect(config.flags.security_hard_controls_enabled).toBe(true);
  });

  it("treats SECURITY_HARD_CONTROLS_ENABLED=false", () => {
    process.env.SECURITY_HARD_CONTROLS_ENABLED = "false";
    const config = loadConfigFromEnv();
    expect(config.flags.security_hard_controls_enabled).toBe(false);
  });

  it("loads release metadata from RELEASE_ID and BUILD_ID (L2-08)", () => {
    process.env.RELEASE_ID = "rel-123";
    process.env.BUILD_ID = "build-456";
    const config = loadConfigFromEnv();
    expect(config.release?.release_id).toBe("rel-123");
    expect(config.release?.build_id).toBe("build-456");
  });

  it("respects MULTIMODAL_INPUT_PATH_ENABLED=true (L2-07)", () => {
    process.env.MULTIMODAL_INPUT_PATH_ENABLED = "true";
    const config = loadConfigFromEnv();
    expect(config.flags.multimodal_input_path_enabled).toBe(true);
  });

  it("normalizes rollout flag naming to platform_production_rollout_enabled", () => {
    process.env.PLATFORM_PRODUCTION_ROLLOUT_ENABLED = "true";
    const config = loadConfigFromEnv();
    expect(config.flags.platform_production_rollout_enabled).toBe(true);
  });

  it("supports legacy PLATFORM_MASTER_ROLLOUT_ENABLED as fallback alias", () => {
    process.env.PLATFORM_PRODUCTION_ROLLOUT_ENABLED = undefined;
    process.env.PLATFORM_MASTER_ROLLOUT_ENABLED = "true";
    const config = loadConfigFromEnv();
    expect(config.flags.platform_production_rollout_enabled).toBe(true);
  });

  it("defaults httpsPort to 3443 and TLS paths to undefined", () => {
    process.env.HTTPS_PORT = undefined;
    process.env.TLS_KEY_PATH = undefined;
    process.env.TLS_CERT_PATH = undefined;
    const config = loadConfigFromEnv();
    expect(config.httpsPort).toBe(3443);
    expect(config.tlsKeyPath).toBeUndefined();
    expect(config.tlsCertPath).toBeUndefined();
  });

  it("respects HTTPS_PORT and TLS_KEY_PATH, TLS_CERT_PATH", () => {
    process.env.HTTPS_PORT = "4443";
    process.env.TLS_KEY_PATH = "/etc/tls/key.pem";
    process.env.TLS_CERT_PATH = "/etc/tls/cert.pem";
    const config = loadConfigFromEnv();
    expect(config.httpsPort).toBe(4443);
    expect(config.tlsKeyPath).toBe("/etc/tls/key.pem");
    expect(config.tlsCertPath).toBe("/etc/tls/cert.pem");
  });

  it("defaults observability_trace_sample_rate to 1 (L2-04)", () => {
    process.env.OBSERVABILITY_TRACE_SAMPLE_RATE = undefined;
    const config = loadConfigFromEnv();
    expect(config.observability_trace_sample_rate).toBe(1);
  });

  it("respects OBSERVABILITY_TRACE_SAMPLE_RATE (L2-04)", () => {
    process.env.OBSERVABILITY_TRACE_SAMPLE_RATE = "0.25";
    const config = loadConfigFromEnv();
    expect(config.observability_trace_sample_rate).toBe(0.25);
  });

  it("defaults memory embedding config to hash provider (L2-06 Gap A)", () => {
    delete process.env.MEMORY_EMBEDDING_PROVIDER;
    delete process.env.MEMORY_EMBEDDING_MODEL;
    const config = loadConfigFromEnv();
    expect(config.memory.embedding.provider).toBe("hash");
    expect(config.memory.embedding.model).toBe("text-embedding-3-small");
    expect(config.memory.embedding.dimensions).toBe(1536);
    expect(config.memory.embedding.api_key_env).toBe("OPENAI_API_KEY");
  });

  it("respects MEMORY_EMBEDDING_PROVIDER and MEMORY_EMBEDDING_MODEL (L2-06 Gap A)", () => {
    process.env.MEMORY_EMBEDDING_PROVIDER = "openai";
    process.env.MEMORY_EMBEDDING_MODEL = "text-embedding-3-large";
    process.env.MEMORY_EMBEDDING_DIMENSIONS = "3072";
    process.env.MEMORY_EMBEDDING_API_KEY_ENV = "OPENAI_API_KEY_PROD";
    const config = loadConfigFromEnv();
    expect(config.memory.embedding.provider).toBe("openai");
    expect(config.memory.embedding.model).toBe("text-embedding-3-large");
    expect(config.memory.embedding.dimensions).toBe(3072);
    expect(config.memory.embedding.api_key_env).toBe("OPENAI_API_KEY_PROD");
  });

  it("overlays CONFIG_FILE when set; file overrides env (L2-01)", () => {
    const dir = mkdtempSync(join(tmpdir(), "config-"));
    const filePath = join(dir, "config.json");
    try {
      writeFileSync(
        filePath,
        JSON.stringify({
          logLevel: "warn",
          flags: { enable_org_memory: true },
        }),
        "utf8"
      );
      process.env.CONFIG_FILE = filePath;
      const config = loadConfigFromEnv();
      expect(config.logLevel).toBe("warn");
      expect(config.flags.enable_org_memory).toBe(true);
    } finally {
      delete process.env.CONFIG_FILE;
      rmSync(dir, { recursive: true });
    }
  });
});
