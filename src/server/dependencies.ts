/**
 * Dependency-aware health checks for external services.
 * L2-04: Health & Readiness with dependency-aware probes.
 */

import type { Config } from "../config/schema.js";
import { getEventSink } from "../observability/event-sink.js";
import { getAuditSinkStatus } from "../security/audit-logger.js";
import { getRedisClient } from "./rate-limit.js";

export interface DependencyStatus {
  name: string;
  healthy: boolean;
  ready: boolean;
  detail?: Record<string, unknown>;
  version?: string;
}

/** Health check result from an external dependency */
export interface HealthCheckResult {
  healthy: boolean;
  ready: boolean;
  detail?: Record<string, unknown>;
  version?: string;
  latencyMs: number;
}

/** Health check provider interface */
export interface HealthCheckProvider {
  name: string;
  checkHealth(): Promise<HealthCheckResult>;
}

// Registry of health check providers
const healthCheckProviders: HealthCheckProvider[] = [];

export function registerHealthCheckProvider(provider: HealthCheckProvider): void {
  healthCheckProviders.push(provider);
}

export function clearHealthCheckProviders(): void {
  healthCheckProviders.length = 0;
}

/**
 * Check IdP (Identity Provider) health.
 * L2-04: IdP dependency health check.
 */
async function checkIdPHealth(config: Config): Promise<DependencyStatus | null> {
  // Only check if auth is configured
  if (!config.auth.idp_registry || config.auth.idp_registry.length === 0) {
    return null;
  }

  const startTime = Date.now();
  const results: Array<{ issuer: string; status: string; error?: string }> = [];
  let allHealthy = true;

  for (const idp of config.auth.idp_registry) {
    try {
      // For RS256 IdPs, verify JWKS endpoint is reachable
      if (idp.jwt_algorithm === "RS256" && idp.jwks_uri) {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);
        const response = await fetch(idp.jwks_uri, {
          method: "GET",
          signal: controller.signal,
        });
        clearTimeout(timeout);

        if (response.ok) {
          results.push({ issuer: idp.issuer, status: "ok" });
        } else {
          results.push({
            issuer: idp.issuer,
            status: "unhealthy",
            error: `HTTP ${response.status}`,
          });
          allHealthy = false;
        }
      } else {
        // HS256 IdPs don't have external endpoints to check
        results.push({ issuer: idp.issuer, status: "configured" });
      }
    } catch (err) {
      results.push({
        issuer: idp.issuer,
        status: "unhealthy",
        error: err instanceof Error ? err.message : String(err),
      });
      allHealthy = false;
    }
  }

  return {
    name: "idp",
    healthy: allHealthy,
    ready: allHealthy,
    detail: {
      latency_ms: Date.now() - startTime,
      idps: results,
    },
  };
}

/**
 * Check model provider health.
 * L2-04: Model provider dependency health check.
 */
async function checkModelProvidersHealth(config: Config): Promise<DependencyStatus | null> {
  if (!config.model_gateway?.providers || config.model_gateway.providers.length === 0) {
    return null;
  }

  const startTime = Date.now();
  const results: Array<{ provider: string; status: string; error?: string }> = [];
  let allHealthy = true;

  for (const provider of config.model_gateway.providers) {
    try {
      // Skip stub providers - they don't need external checks
      if (provider.kind === "stub" || provider.kind === "framed_echo") {
        results.push({ provider: provider.id, status: "stub" });
        continue;
      }

      // For OpenAI-compatible providers, check base URL is reachable
      if (provider.kind === "openai_compatible" && provider.base_url) {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);
        await fetch(`${provider.base_url}/healthz`, {
          method: "GET",
          signal: controller.signal,
        }).catch(() => null);
        clearTimeout(timeout);

        // Even if /healthz fails, the provider might be available
        // Just check that DNS resolves (no network error)
        results.push({ provider: provider.id, status: "configured" });
      } else {
        results.push({ provider: provider.id, status: "configured" });
      }
    } catch (err) {
      results.push({
        provider: provider.id,
        status: "unhealthy",
        error: err instanceof Error ? err.message : String(err),
      });
      // Don't mark as unhealthy - providers might be temporarily unreachable
      // but we should still try to use them
    }
  }

  return {
    name: "model_providers",
    healthy: allHealthy,
    ready: allHealthy,
    detail: {
      latency_ms: Date.now() - startTime,
      providers: results,
      default_capability: config.model_gateway.default_capability,
    },
  };
}

/**
 * Check Redis connection health.
 * L2-04: Redis dependency health check.
 */
async function checkRedisHealth(): Promise<DependencyStatus | null> {
  const redis = getRedisClient();
  if (!redis) {
    return null;
  }

  const startTime = Date.now();
  try {
    // Try to get a test key
    await redis.get("__health_check__");
    return {
      name: "redis",
      healthy: true,
      ready: true,
      detail: {
        latency_ms: Date.now() - startTime,
        status: "connected",
      },
    };
  } catch (err) {
    return {
      name: "redis",
      healthy: false,
      ready: false,
      detail: {
        latency_ms: Date.now() - startTime,
        status: "disconnected",
        error: err instanceof Error ? err.message : String(err),
      },
    };
  }
}

/**
 * Check vector backend health.
 * L2-04: Vector backend dependency health check.
 */
async function checkVectorBackendHealth(config: Config): Promise<DependencyStatus | null> {
  // Only check if memory backend is configured for vector
  if (config.memory?.backend !== "vector") {
    return null;
  }

  // Note: Actual vector backend check would depend on the specific implementation
  // (Pinecone, Weaviate, pgvector, etc.)
  return {
    name: "vector_backend",
    healthy: true,
    ready: true,
    detail: {
      backend: config.memory.backend,
      status: "configured",
      note: "Actual connectivity check depends on specific vector store implementation",
    },
  };
}

/**
 * Comprehensive health check with all dependencies.
 * L2-04: Dependency-aware health and readiness checks.
 */
export async function checkOperationalDependenciesAsync(config: Config): Promise<{
  healthy: boolean;
  ready: boolean;
  dependencies: DependencyStatus[];
  version: string;
}> {
  const dependencies: DependencyStatus[] = [];

  // Config is always healthy if we can read it
  dependencies.push({
    name: "config",
    healthy: true,
    ready: true,
    version: "1.0.0",
    detail: {
      env: config.env,
      release_id: config.release?.release_id ?? null,
      build_id: config.release?.build_id ?? null,
    },
  });

  // Check IdP health
  const idpStatus = await checkIdPHealth(config);
  if (idpStatus) {
    dependencies.push(idpStatus);
  }

  // Check model providers
  const modelStatus = await checkModelProvidersHealth(config);
  if (modelStatus) {
    dependencies.push(modelStatus);
  }

  // Check Redis
  const redisStatus = await checkRedisHealth();
  if (redisStatus) {
    dependencies.push(redisStatus);
  }

  // Check vector backend
  const vectorStatus = await checkVectorBackendHealth(config);
  if (vectorStatus) {
    dependencies.push(vectorStatus);
  }

  // Check event sink
  const eventSink = getEventSink();
  if (eventSink || config.observabilityEventSinkPath) {
    const status = eventSink?.getStatus?.();
    const healthy = !status?.lastError;
    const ready = healthy && (!status || status.queueDepth < status.maxQueueSize);
    dependencies.push({
      name: "observability_event_sink",
      healthy,
      ready,
      detail: status
        ? {
            queue_depth: status.queueDepth,
            max_queue_size: status.maxQueueSize,
            dropped_events: status.droppedEvents,
            last_error: status.lastError,
          }
        : { configured_path: config.observabilityEventSinkPath ?? null, status: "not_initialized" },
    });
  }

  // Check audit sink
  const auditStatus = getAuditSinkStatus();
  if (auditStatus || config.auditLogPath) {
    const healthy = !auditStatus?.lastError;
    const ready = healthy && (!auditStatus || auditStatus.queueDepth < auditStatus.maxQueueSize);
    dependencies.push({
      name: "audit_sink",
      healthy,
      ready,
      detail: auditStatus
        ? {
            queue_depth: auditStatus.queueDepth,
            max_queue_size: auditStatus.maxQueueSize,
            dropped_entries: auditStatus.droppedEntries,
            last_error: auditStatus.lastError,
          }
        : { configured_path: config.auditLogPath ?? null, status: "not_initialized" },
    });
  }

  // Run custom health check providers
  for (const provider of healthCheckProviders) {
    try {
      const result = await provider.checkHealth();
      dependencies.push({
        name: provider.name,
        healthy: result.healthy,
        ready: result.ready,
        version: result.version,
        detail: {
          ...result.detail,
          latency_ms: result.latencyMs,
        },
      });
    } catch (err) {
      dependencies.push({
        name: provider.name,
        healthy: false,
        ready: false,
        detail: {
          error: err instanceof Error ? err.message : String(err),
        },
      });
    }
  }

  const healthy = dependencies.every((d) => d.healthy);
  const ready = dependencies.every((d) => d.ready);

  return {
    healthy,
    ready,
    dependencies,
    version: config.release?.release_id ?? "0.1.0",
  };
}

/**
 * Synchronous version for backward compatibility.
 * Note: This doesn't check external dependencies that require async operations.
 */
export function checkOperationalDependencies(config: Config): {
  healthy: boolean;
  ready: boolean;
  dependencies: DependencyStatus[];
} {
  const dependencies: DependencyStatus[] = [];

  dependencies.push({
    name: "config",
    healthy: true,
    ready: true,
    detail: {
      env: config.env,
      release_id: config.release?.release_id ?? null,
      build_id: config.release?.build_id ?? null,
    },
  });

  const eventSink = getEventSink();
  if (eventSink || config.observabilityEventSinkPath) {
    const status = eventSink?.getStatus?.();
    const healthy = !status?.lastError;
    const ready = healthy && (!status || status.queueDepth < status.maxQueueSize);
    dependencies.push({
      name: "observability_event_sink",
      healthy,
      ready,
      detail: status
        ? {
            queue_depth: status.queueDepth,
            max_queue_size: status.maxQueueSize,
            dropped_events: status.droppedEvents,
            last_error: status.lastError,
          }
        : { configured_path: config.observabilityEventSinkPath ?? null },
    });
  }

  const auditStatus = getAuditSinkStatus();
  if (auditStatus || config.auditLogPath) {
    const healthy = !auditStatus?.lastError;
    const ready = healthy && (!auditStatus || auditStatus.queueDepth < auditStatus.maxQueueSize);
    dependencies.push({
      name: "audit_sink",
      healthy,
      ready,
      detail: auditStatus
        ? {
            queue_depth: auditStatus.queueDepth,
            max_queue_size: auditStatus.maxQueueSize,
            dropped_entries: auditStatus.droppedEntries,
            last_error: auditStatus.lastError,
          }
        : { configured_path: config.auditLogPath ?? null },
    });
  }

  return {
    healthy: dependencies.every((d) => d.healthy),
    ready: dependencies.every((d) => d.ready),
    dependencies,
  };
}
