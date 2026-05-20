/**
 * Production secrets backend assertion tests (PR-005).
 */

import { loadConfigFromEnv } from "./schema.js";
import { assertProductionSecretsBackend } from "./assert-production-secrets-backend.js";

const originalEnv = process.env;

beforeEach(() => {
  process.env = { ...originalEnv };
});

afterAll(() => {
  process.env = originalEnv;
});

function productionConfig() {
  process.env.NODE_ENV = "production";
  return loadConfigFromEnv();
}

describe("assertProductionSecretsBackend", () => {
  it("allows env backend with SCOPED_SECRETS_JSON", () => {
    process.env.SECRETS_BACKEND = "env";
    process.env.SCOPED_SECRETS_JSON = JSON.stringify({ api_key: "prod-secret" });
    expect(() => assertProductionSecretsBackend(productionConfig())).not.toThrow();
  });

  it("throws when backend is stub in production", () => {
    process.env.SECRETS_BACKEND = "stub";
    expect(() => assertProductionSecretsBackend(productionConfig())).toThrow(
      /SECRETS_BACKEND=env/
    );
  });

  it("throws when env backend has no secret material", () => {
    process.env.SECRETS_BACKEND = "env";
    delete process.env.SCOPED_SECRETS_JSON;
    for (const key of Object.keys(process.env)) {
      if (key.startsWith("SCOPED_SECRET_")) delete process.env[key];
    }
    expect(() => assertProductionSecretsBackend(productionConfig())).toThrow(
      /scoped secrets material/
    );
  });

  it("throws when vault backend lacks VAULT_ADDR", () => {
    process.env.SECRETS_BACKEND = "vault";
    process.env.SCOPED_SECRETS_JSON = JSON.stringify({ k: "v" });
    delete process.env.VAULT_ADDR;
    expect(() => assertProductionSecretsBackend(productionConfig())).toThrow(/VAULT_ADDR/);
  });

  it("throws when aws_secrets_manager lacks region", () => {
    process.env.SECRETS_BACKEND = "aws_secrets_manager";
    process.env.SCOPED_SECRETS_JSON = JSON.stringify({ k: "v" });
    delete process.env.SECRETS_AWS_REGION;
    delete process.env.AWS_REGION;
    expect(() => assertProductionSecretsBackend(productionConfig())).toThrow(/AWS_REGION/);
  });

  it("skips in non-production", () => {
    process.env.NODE_ENV = "development";
    process.env.SECRETS_BACKEND = "stub";
    expect(() => assertProductionSecretsBackend(loadConfigFromEnv())).not.toThrow();
  });
});
