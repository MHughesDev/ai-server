import type { Config } from "../config/schema.js";
import { resolveFeatureFlagEnabled } from "../config/feature-flags.js";
import { hasDurableTenantBudgetBackend } from "../controlplane/tenant-budget.js";
import { isRolloutCanarySignoffAcknowledged } from "../rollout/policy.js";
import { checkOperationalDependenciesAsync } from "./dependencies.js";

export type PreflightStatus = "pass" | "fail" | "warn";

export interface PreflightCheck {
  id: string;
  status: PreflightStatus;
  message: string;
  detail?: Record<string, unknown>;
}

export interface PreflightReport {
  summary: {
    status: "pass" | "fail";
    passed: number;
    failed: number;
    warnings: number;
  };
  checks: PreflightCheck[];
  dependencies: Awaited<ReturnType<typeof checkOperationalDependenciesAsync>>;
}

function isStrongSecret(secret: string | undefined): boolean {
  if (!secret) return false;
  if (secret.length < 32) return false;
  if (secret === "dev-ai-jwt-secret") return false;
  return true;
}

function hasModelCostTracking(config: Config): boolean {
  return config.model_gateway.providers
    .filter((p) => p.kind === "openai_compatible")
    .every(
      (p) =>
        typeof p.input_cost_per_million_usd === "number" &&
        typeof p.output_cost_per_million_usd === "number"
    );
}

function hasProductionProviders(config: Config): boolean {
  return !config.model_gateway.providers.some(
    (p) => p.kind === "stub" || p.kind === "framed_echo"
  );
}

export async function runProductionPreflight(config: Config): Promise<PreflightReport> {
  const checks: PreflightCheck[] = [];
  const add = (check: PreflightCheck): void => {
    checks.push(check);
  };
  const cors = (process.env.CORS_ALLOWED_ORIGINS ?? "").trim();

  add({
    id: "auth.jwt_secret_strength",
    status: isStrongSecret(config.auth.ai_jwt_secret) ? "pass" : "fail",
    message: "AUTH_AI_JWT_SECRET is strong and non-default",
  });
  add({
    id: "auth.require_header",
    status: config.requireAuthHeader ? "pass" : "fail",
    message: "REQUIRE_AUTH_HEADER is enabled",
  });
  add({
    id: "auth.idp_registry_non_default",
    status: config.auth.idp_registry.some((i) => i.issuer === "https://idp.local/default")
      ? "fail"
      : "pass",
    message: "Default test IdP entries removed",
  });
  add({
    id: "auth.app_registry_non_default",
    status: config.auth.app_registry.some((a) => a.client_id === "app-client")
      ? "fail"
      : "pass",
    message: "Default test app entries removed",
  });
  add({
    id: "network.tls_configured",
    status: config.tlsKeyPath && config.tlsCertPath ? "pass" : "fail",
    message: "TLS key/cert paths are configured",
  });
  add({
    id: "network.cors_explicit",
    status: cors && cors !== "*" ? "pass" : "fail",
    message: "CORS allowed origins explicitly configured",
  });
  add({
    id: "ops.operational_bearer_token",
    status: config.operationalBearerToken ? "pass" : "fail",
    message: "Operational bearer token is configured",
  });
  add({
    id: "ops.audit_log_path",
    status: config.auditLogPath?.trim() ? "pass" : "fail",
    message: "AUDIT_LOG_PATH configured for persistent audit storage",
  });
  add({
    id: "ops.event_sink_path",
    status: config.observabilityEventSinkPath?.trim() ? "pass" : "fail",
    message: "OBSERVABILITY_EVENT_SINK_PATH configured for persistent telemetry",
  });
  add({
    id: "providers.production",
    status: hasProductionProviders(config) ? "pass" : "fail",
    message: "Model providers are production-capable (not stub/framed_echo)",
  });
  add({
    id: "providers.api_key_env",
    status: config.model_gateway.providers
      .filter((p) => p.kind === "openai_compatible")
      .every((p) => !!p.api_key_env)
      ? "pass"
      : "fail",
    message: "OpenAI-compatible providers use api_key_env",
  });
  add({
    id: "providers.cost_tracking",
    status: hasModelCostTracking(config) ? "pass" : "warn",
    message: "Model provider cost tracking fields are configured",
  });
  const rolloutEnabled = resolveFeatureFlagEnabled(
    "platform_production_rollout_enabled",
    config
  );
  add({
    id: "flags.production_rollout",
    status: rolloutEnabled ? "pass" : "fail",
    message: "PLATFORM_PRODUCTION_ROLLOUT_ENABLED is enabled",
  });
  add({
    id: "rollout.canary_signoff",
    status: !rolloutEnabled || isRolloutCanarySignoffAcknowledged() ? "pass" : "fail",
    message: "ROLLOUT_CANARY_SIGNOFF=true when production rollout is enabled",
  });
  add({
    id: "flags.security_controls",
    status: resolveFeatureFlagEnabled("security_hard_controls_enabled", config) ? "pass" : "fail",
    message: "SECURITY_HARD_CONTROLS_ENABLED is enabled",
  });
  add({
    id: "security.secrets_backend",
    status:
      config.secrets.backend !== "stub"
        ? "pass"
        : "fail",
    message: "Scoped secrets use a production backend (not stub)",
    detail: { backend: config.secrets.backend },
  });
  add({
    id: "flags.cost_caps",
    status: resolveFeatureFlagEnabled("enable_cost_caps", config) ? "pass" : "warn",
    message: "ENABLE_COST_CAPS is enabled",
  });
  add({
    id: "limits.ingress_rate_limit",
    status:
      config.ingress_rate_limit.max_requests > 0 &&
      config.ingress_rate_limit.window_ms > 0
        ? "pass"
        : "warn",
    message: "Ingress rate limiting is configured",
  });
  add({
    id: "limits.connection_controls",
    status:
      !!process.env.MAX_CONNECTIONS &&
      !!process.env.MAX_CONCURRENT_REQUESTS &&
      !!process.env.MAX_BODY_BYTES
        ? "pass"
        : "warn",
    message: "Connection and body resource limits are explicitly configured",
  });
  add({
    id: "timeouts.request_processing",
    status: parseInt(process.env.REQUEST_PROCESSING_TIMEOUT_MS ?? "120000", 10) > 0 ? "pass" : "fail",
    message: "Request processing timeout is configured",
  });
  add({
    id: "budget.tenant_shared_backend",
    status: hasDurableTenantBudgetBackend() ? "pass" : "fail",
    message: "Tenant budget uses shared Redis or Postgres backend",
  });
  add({
    id: "memory.persistent_backend",
    status:
      config.memory.backend === "vector" &&
      (!!process.env.REDIS_URL?.trim() || !!process.env.CHROMA_URL?.trim())
        ? "pass"
        : "fail",
    message: "MEMORY_BACKEND=vector with REDIS_URL or CHROMA_URL for persistent memory",
    detail: {
      backend: config.memory.backend,
      redis: !!process.env.REDIS_URL?.trim(),
      chroma: !!process.env.CHROMA_URL?.trim(),
    },
  });

  const dependencies = await checkOperationalDependenciesAsync(config);
  const failed = checks.filter((c) => c.status === "fail").length;
  const warnings = checks.filter((c) => c.status === "warn").length;
  const passed = checks.filter((c) => c.status === "pass").length;

  return {
    summary: {
      status: failed === 0 ? "pass" : "fail",
      passed,
      failed,
      warnings,
    },
    checks,
    dependencies,
  };
}

