/**
 * Application bootstrap – deterministic startup and config validation.
 * @see L2-01 Phase 1: bootstrap path with startup checks
 */
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadConfigFromEnv } from "../config/index.js";
import { CONTRACT_VERSION } from "../contracts/index.js";
import { validateReleaseConfig } from "../rollout/policy.js";
import { createJobQueueService } from "../queue/job-queue.js";
import { setJobQueueService } from "../server/routes.js";
import { initializeFeatureFlags, resetFeatureFlags } from "../config/feature-flags.js";
let config = null;
let jobQueue = null;
function assertProductionReadiness(cfg) {
    if (cfg.env !== "production" || !cfg.flags.platform_production_rollout_enabled) {
        return;
    }
    const secret = cfg.auth.ai_jwt_secret?.trim() ?? "";
    if (secret.length < 32 || secret === "dev-ai-jwt-secret") {
        throw new Error("Production rollout requires AUTH_AI_JWT_SECRET with a strong 32+ char value");
    }
    if (!cfg.requireAuthHeader) {
        throw new Error("Production rollout requires REQUIRE_AUTH_HEADER=true");
    }
    const hasDefaultIdp = cfg.auth.idp_registry.some((entry) => entry.issuer === "https://idp.local/default" ||
        entry.jwt_secret === "dev-external-idp-secret");
    if (hasDefaultIdp) {
        throw new Error("Production rollout cannot use default test IdP entries");
    }
    const hasDefaultApp = cfg.auth.app_registry.some((entry) => entry.client_id === "app-client" ||
        entry.client_secret === "app-secret");
    if (hasDefaultApp) {
        throw new Error("Production rollout cannot use default test app registry entries");
    }
    const corsOrigins = (process.env.CORS_ALLOWED_ORIGINS ?? "").trim();
    if (!corsOrigins || corsOrigins === "*") {
        throw new Error("Production rollout requires CORS_ALLOWED_ORIGINS to be explicitly set (not *)");
    }
    if (!cfg.tlsKeyPath || !cfg.tlsCertPath) {
        throw new Error("Production rollout requires TLS_KEY_PATH and TLS_CERT_PATH");
    }
    if (cfg.flags.observability_required_events_v1 &&
        cfg.observability_trace_sample_rate >= 1) {
        throw new Error("Production rollout requires OBSERVABILITY_TRACE_SAMPLE_RATE < 1 when observability events are enabled");
    }
}
/** Load and validate config; throws on invalid env. Call once at startup. */
export function bootstrap() {
    if (config)
        return config;
    config = loadConfigFromEnv();
    assertProductionReadiness(config);
    if (config.env === "production" && !config.operationalBearerToken) {
        throw new Error("OPERATIONAL_BEARER_TOKEN is required in production to protect operational endpoints");
    }
    if (config.env === "production" && config.flags.platform_production_rollout_enabled) {
        const syntheticProviders = config.model_gateway.providers
            .filter((p) => p.kind === "stub" || p.kind === "framed_echo")
            .map((p) => `${p.id}:${p.kind}`);
        if (syntheticProviders.length > 0) {
            throw new Error(`Production rollout requires non-synthetic model providers; found ${syntheticProviders.join(", ")}`);
        }
    }
    // L2-08: Release config validation – warn in production without traceability
    const releaseValidation = validateReleaseConfig({
        env: config.env,
        release_id: config.release?.release_id,
        build_id: config.release?.build_id,
    });
    if (!releaseValidation.valid) {
        console.warn("[bootstrap] release config:", releaseValidation.errors.join("; "));
    }
    // Gap 3A: Initialize async job queue if configured
    if (process.env.QUEUE_WORKERS_COUNT) {
        jobQueue = createJobQueueService(config, async (request) => {
            // Import dynamically to avoid circular dependency
            const { handleQuery } = await import("../server/query-handler.js");
            return handleQuery(request);
        });
        if (jobQueue) {
            setJobQueueService(jobQueue);
            void jobQueue.start().catch((err) => {
                console.error("[bootstrap] Failed to start async job queue", err);
            });
            console.info("[bootstrap] Async job queue initialized");
        }
    }
    // Gap 3D: Initialize feature flag service
    const flagService = initializeFeatureFlags(config);
    void flagService.initialize().catch((err) => {
        console.error("[bootstrap] Failed to initialize feature flags", err);
    });
    console.info("[bootstrap] Feature flag service initialized");
    // Startup validation: non-secret settings (for logs / runbooks)
    const safeDump = {
        env: config.env,
        logLevel: config.logLevel,
        maxRequestBodyBytes: config.maxRequestBodyBytes,
        flags: config.flags,
        contractVersion: CONTRACT_VERSION,
    };
    if (config.logLevel === "debug") {
        console.debug("[bootstrap] config validated", JSON.stringify(safeDump));
    }
    return config;
}
/** Return current config; must call bootstrap() first. */
export function getConfig() {
    if (!config)
        throw new Error("bootstrap() must be called before getConfig()");
    return config;
}
/** Test-only: clear config cache so next bootstrap() reloads from env. Use in isolation tests (e.g. L2-06 retrieval). */
export function resetConfigForTest() {
    config = null;
    if (jobQueue) {
        void jobQueue.stop();
        jobQueue = null;
        setJobQueueService(null);
    }
    resetFeatureFlags();
}
/** Entrypoint for CLI: validate config and exit 0. */
function main() {
    try {
        bootstrap();
        console.info("Bootstrap OK");
        process.exit(0);
    }
    catch (err) {
        console.error("Bootstrap failed:", err);
        process.exit(1);
    }
}
const scriptPath = resolve(fileURLToPath(import.meta.url));
const isEntry = process.argv[1] ? resolve(process.argv[1]) === scriptPath : false;
if (isEntry) {
    main();
}
//# sourceMappingURL=index.js.map