/**
 * Secrets backend unit tests (PR-005).
 */

import {
  EnvSecretsBackend,
  initializeSecretsBackend,
  resetSecretsBackendForTest,
  StubSecretsBackend,
} from "./secrets-backend.js";

const originalEnv = process.env;

beforeEach(() => {
  process.env = { ...originalEnv };
  resetSecretsBackendForTest();
});

afterAll(() => {
  process.env = originalEnv;
  resetSecretsBackendForTest();
});

describe("StubSecretsBackend", () => {
  it("returns redacted placeholder", async () => {
    const backend = new StubSecretsBackend();
    expect(await backend.resolve("api_key")).toBe("[REDACTED]");
  });
});

describe("EnvSecretsBackend", () => {
  it("resolves from SCOPED_SECRETS_JSON", async () => {
    process.env.SCOPED_SECRETS_JSON = JSON.stringify({ api_key: "from-json" });
    const backend = new EnvSecretsBackend("env");
    expect(await backend.resolve("api_key")).toBe("from-json");
  });

  it("resolves from prefixed env var", async () => {
    delete process.env.SCOPED_SECRETS_JSON;
    process.env.SCOPED_SECRET_API_KEY = "from-env";
    const backend = new EnvSecretsBackend("env");
    expect(await backend.resolve("api_key")).toBe("from-env");
  });

  it("returns null when key is missing", async () => {
    delete process.env.SCOPED_SECRETS_JSON;
    const backend = new EnvSecretsBackend("env");
    expect(await backend.resolve("missing")).toBeNull();
  });
});

describe("initializeSecretsBackend", () => {
  it("sets active backend for getSecretsBackend", () => {
    process.env.SCOPED_SECRETS_JSON = JSON.stringify({ k: "v" });
    const backend = initializeSecretsBackend("env");
    expect(backend.kind).toBe("env");
  });
});
