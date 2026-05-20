/**
 * Production secrets backend guards (PR-005 / STUB-001).
 */

import type { Config } from "./schema.js";

const PRODUCTION_BACKENDS = new Set<Config["secrets"]["backend"]>([
  "env",
  "aws_secrets_manager",
  "vault",
]);

function hasScopedSecretsMaterial(): boolean {
  const json = process.env.SCOPED_SECRETS_JSON?.trim();
  if (json) {
    try {
      const parsed = JSON.parse(json) as unknown;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return Object.keys(parsed as Record<string, unknown>).length > 0;
      }
    } catch {
      return false;
    }
  }
  const prefix = (process.env.SCOPED_SECRETS_ENV_PREFIX ?? "SCOPED_SECRET_").trim();
  return Object.keys(process.env).some(
    (name) => name.startsWith(prefix) && (process.env[name]?.trim() ?? "").length > 0
  );
}

/** Fail fast when production would use the stub secrets resolver. */
export function assertProductionSecretsBackend(config: Config): void {
  if (config.env !== "production") return;

  if (!PRODUCTION_BACKENDS.has(config.secrets.backend)) {
    throw new Error(
      "Production requires SECRETS_BACKEND=env|aws_secrets_manager|vault (stub is dev-only)"
    );
  }

  if (config.secrets.backend === "aws_secrets_manager") {
    const region =
      process.env.SECRETS_AWS_REGION?.trim() || process.env.AWS_REGION?.trim();
    if (!region) {
      throw new Error(
        "Production aws_secrets_manager backend requires SECRETS_AWS_REGION or AWS_REGION"
      );
    }
  }

  if (config.secrets.backend === "vault") {
    if (!process.env.VAULT_ADDR?.trim()) {
      throw new Error("Production vault backend requires VAULT_ADDR");
    }
  }

  if (!hasScopedSecretsMaterial()) {
    throw new Error(
      "Production requires scoped secrets material via SCOPED_SECRETS_JSON or SCOPED_SECRETS_ENV_PREFIX variables"
    );
  }
}
