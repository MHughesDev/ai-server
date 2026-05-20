/**
 * Production auth configuration guards (PR-003 / GAP-AUTH-003).
 */

import type { Config } from "./schema.js";

const DEV_AI_JWT_SECRET = "dev-ai-jwt-secret";
const DEFAULT_IDP_ISSUER = "https://idp.local/default";
const DEFAULT_IDP_JWT_SECRET = "dev-external-idp-secret";
const DEFAULT_APP_CLIENT_ID = "app-client";
const DEFAULT_APP_CLIENT_SECRET = "app-secret";

function usesDefaultIdpEntry(
  entry: Config["auth"]["idp_registry"][number]
): boolean {
  return (
    entry.issuer === DEFAULT_IDP_ISSUER ||
    entry.jwt_secret === DEFAULT_IDP_JWT_SECRET
  );
}

function usesDefaultAppEntry(
  entry: Config["auth"]["app_registry"][number]
): boolean {
  return (
    entry.client_id === DEFAULT_APP_CLIENT_ID ||
    entry.client_secret === DEFAULT_APP_CLIENT_SECRET
  );
}

/** Fail fast when production would rely on dev auth defaults or weak secrets. */
export function assertProductionAuth(config: Config): void {
  if (config.env !== "production") return;

  const aiSecret = config.auth.ai_jwt_secret?.trim() ?? "";
  if (aiSecret.length < 32 || aiSecret === DEV_AI_JWT_SECRET) {
    throw new Error(
      "Production requires AUTH_AI_JWT_SECRET with a strong 32+ char non-default value"
    );
  }

  if (!config.requireAuthHeader) {
    throw new Error("Production requires REQUIRE_AUTH_HEADER=true");
  }

  if (config.auth.query_required_scopes.length === 0) {
    throw new Error(
      "Production requires AUTH_QUERY_REQUIRED_SCOPES with at least one scope"
    );
  }

  if (!process.env.AUTH_IDP_REGISTRY_JSON?.trim()) {
    throw new Error(
      "Production requires AUTH_IDP_REGISTRY_JSON (do not rely on built-in dev IdP defaults)"
    );
  }

  if (!process.env.AUTH_APP_REGISTRY_JSON?.trim()) {
    throw new Error(
      "Production requires AUTH_APP_REGISTRY_JSON (do not rely on built-in dev app defaults)"
    );
  }

  if (config.auth.idp_registry.some(usesDefaultIdpEntry)) {
    throw new Error("Production cannot use default test IdP registry entries");
  }

  if (config.auth.app_registry.some(usesDefaultAppEntry)) {
    throw new Error("Production cannot use default test app registry entries");
  }

  const issuers = new Set(config.auth.idp_registry.map((e) => e.issuer));
  for (const idp of config.auth.idp_registry) {
    if (idp.jwt_algorithm === "HS256" && !idp.jwt_secret?.trim()) {
      throw new Error(`IdP '${idp.issuer}' requires jwt_secret for HS256`);
    }
    if (idp.jwt_algorithm === "RS256" && !idp.jwks_uri?.trim()) {
      throw new Error(`IdP '${idp.issuer}' requires jwks_uri for RS256`);
    }
  }

  for (const app of config.auth.app_registry) {
    if (app.allowed_scopes.length === 0) {
      throw new Error(`App registry entry '${app.app_id}' requires allowed_scopes`);
    }
    for (const issuer of app.allowed_issuers) {
      if (!issuers.has(issuer)) {
        throw new Error(
          `App '${app.app_id}' allowed_issuers references unknown issuer '${issuer}'`
        );
      }
    }
  }
}
