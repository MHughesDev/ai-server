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
    expect(config.flags.contracts_v1_enabled).toBe(true);
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

  it("defaults platform_production_rollout_enabled to false (L2-08)", () => {
    const config = ConfigSchema.parse({
      env: "dev",
      logLevel: "info",
      maxRequestBodyBytes: 1_000_000,
      flags: {},
    });
    expect(config.flags.platform_production_rollout_enabled).toBe(false);
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
    expect(config.flags.contracts_v1_enabled).toBe(true);
  });

  it("respects ENABLE_ASYNC_JOBS=true", () => {
    process.env.ENABLE_ASYNC_JOBS = "true";
    const config = loadConfigFromEnv();
    expect(config.flags.enable_async_jobs).toBe(true);
  });

  it("treats CONTRACTS_V1_ENABLED=false", () => {
    process.env.CONTRACTS_V1_ENABLED = "false";
    const config = loadConfigFromEnv();
    expect(config.flags.contracts_v1_enabled).toBe(false);
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

  it("defaults governance_harness_readiness_gate_active to true (L2-99)", () => {
    process.env.GOVERNANCE_HARNESS_READINESS_GATE_ACTIVE = undefined;
    const config = loadConfigFromEnv();
    expect(config.flags.governance_harness_readiness_gate_active).toBe(true);
  });

  it("treats GOVERNANCE_HARNESS_READINESS_GATE_ACTIVE=false", () => {
    process.env.GOVERNANCE_HARNESS_READINESS_GATE_ACTIVE = "false";
    const config = loadConfigFromEnv();
    expect(config.flags.governance_harness_readiness_gate_active).toBe(false);
  });

  it("defaults platform_production_rollout_enabled to false (L2-08)", () => {
    process.env.PLATFORM_PRODUCTION_ROLLOUT_ENABLED = undefined;
    const config = loadConfigFromEnv();
    expect(config.flags.platform_production_rollout_enabled).toBe(false);
  });

  it("respects PLATFORM_PRODUCTION_ROLLOUT_ENABLED=true", () => {
    process.env.PLATFORM_PRODUCTION_ROLLOUT_ENABLED = "true";
    const config = loadConfigFromEnv();
    expect(config.flags.platform_production_rollout_enabled).toBe(true);
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
