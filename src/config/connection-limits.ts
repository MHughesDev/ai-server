/**
 * HTTP connection and request concurrency limits (PR-021).
 */

export interface ConnectionLimitConfig {
  maxConnections: number;
  maxConnectionsPerIp: number;
  maxConcurrentRequests: number;
  maxRequestQueueDepth: number;
  serverHeadersTimeoutMs: number;
  serverRequestTimeoutMs: number;
}

function parsePositiveInt(raw: string | undefined, fallback: number, name: string): number {
  if (raw === undefined || raw.trim() === "") return fallback;
  const value = parseInt(raw.trim(), 10);
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${name} must be a positive integer (got ${raw})`);
  }
  return value;
}

/** Load connection/concurrency limits from environment with validation. */
export function loadConnectionLimitConfig(): ConnectionLimitConfig {
  return {
    maxConnections: parsePositiveInt(process.env.MAX_CONNECTIONS, 1000, "MAX_CONNECTIONS"),
    maxConnectionsPerIp: parsePositiveInt(
      process.env.MAX_CONNECTIONS_PER_IP,
      100,
      "MAX_CONNECTIONS_PER_IP"
    ),
    maxConcurrentRequests: parsePositiveInt(
      process.env.MAX_CONCURRENT_REQUESTS,
      100,
      "MAX_CONCURRENT_REQUESTS"
    ),
    maxRequestQueueDepth: parsePositiveInt(
      process.env.MAX_REQUEST_QUEUE_DEPTH,
      50,
      "MAX_REQUEST_QUEUE_DEPTH"
    ),
    serverHeadersTimeoutMs: parsePositiveInt(
      process.env.SERVER_HEADERS_TIMEOUT_MS,
      60_000,
      "SERVER_HEADERS_TIMEOUT_MS"
    ),
    serverRequestTimeoutMs: parsePositiveInt(
      process.env.SERVER_REQUEST_TIMEOUT_MS,
      120_000,
      "SERVER_REQUEST_TIMEOUT_MS"
    ),
  };
}

/** Fail fast when production omits explicit resource limit env (PR-021). */
export function assertProductionConnectionLimits(): void {
  if ((process.env.NODE_ENV ?? "").trim() !== "production") return;

  const required = [
    "MAX_CONNECTIONS",
    "MAX_CONNECTIONS_PER_IP",
    "MAX_CONCURRENT_REQUESTS",
    "MAX_REQUEST_QUEUE_DEPTH",
    "MAX_BODY_BYTES",
  ] as const;

  const missing = required.filter((key) => !(process.env[key] ?? "").trim());
  if (missing.length > 0) {
    throw new Error(
      `Production requires explicit connection and body limits: ${missing.join(", ")}`
    );
  }

  loadConnectionLimitConfig();
}
