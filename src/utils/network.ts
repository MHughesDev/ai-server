/**
 * Network optimization utilities.
 * L2-06 Phase 9: TCP connection pooling and timeout tuning.
 */

import type { Agent as HttpAgent } from "node:http";
import type { Agent as HttpsAgent } from "node:https";

// ============================================================================
// Connection Timeout Configuration
// ============================================================================

export interface ConnectionTimeoutConfig {
  /** Connection timeout in milliseconds */
  connectTimeoutMs: number;
  /** Socket timeout after connection */
  socketTimeoutMs: number;
  /** Request timeout (total) */
  requestTimeoutMs: number;
}

export const DefaultTimeoutConfig: ConnectionTimeoutConfig = {
  connectTimeoutMs: 5000, // 5 seconds to establish connection
  socketTimeoutMs: 30000, // 30 seconds of inactivity
  requestTimeoutMs: 60000, // 60 seconds total per request
};

/**
 * Apply timeout configuration to http(s) agents.
 */
export function configureAgentTimeouts(
  agent: HttpAgent | HttpsAgent,
  config: Partial<ConnectionTimeoutConfig> = {}
): void {
  const opts = { ...DefaultTimeoutConfig, ...config };

  // Set timeout on the agent
  (agent as unknown as { timeout: number }).timeout = opts.socketTimeoutMs;

  // Node.js agents support these options via constructor, but we can also set them
  // on individual requests using the timeout event
}

/**
 * Get timeout configuration for specific service types.
 */
export function getTimeoutConfigForService(
  service: "model_provider" | "vector_store" | "tool_gateway" | "idp"
): ConnectionTimeoutConfig {
  switch (service) {
    case "model_provider":
      return {
        connectTimeoutMs: 10000, // Model APIs may be slower to connect
        socketTimeoutMs: 120000, // Model calls can take time
        requestTimeoutMs: 180000, // 3 minutes for model calls
      };
    case "vector_store":
      return {
        connectTimeoutMs: 3000,
        socketTimeoutMs: 10000,
        requestTimeoutMs: 15000,
      };
    case "tool_gateway":
      return {
        connectTimeoutMs: 5000,
        socketTimeoutMs: 30000,
        requestTimeoutMs: 60000,
      };
    case "idp":
      return {
        connectTimeoutMs: 5000,
        socketTimeoutMs: 10000,
        requestTimeoutMs: 15000,
      };
    default:
      return DefaultTimeoutConfig;
  }
}

// ============================================================================
// TCP Connection Pooling
// ============================================================================

export interface TcpPoolConfig {
  /** Maximum sockets per host */
  maxSocketsPerHost: number;
  /** Maximum total sockets */
  maxTotalSockets: number;
  /** Keep-alive timeout in milliseconds */
  keepAliveTimeoutMs: number;
  /** Enable keep-alive */
  keepAlive: boolean;
}

export const DefaultTcpPoolConfig: TcpPoolConfig = {
  maxSocketsPerHost: 10,
  maxTotalSockets: 100,
  keepAliveTimeoutMs: 30000,
  keepAlive: true,
};

/**
 * Create HTTP agent with optimized connection pooling.
 */
export function createHttpAgent(options: Partial<TcpPoolConfig> = {}): HttpAgent {
  const opts = { ...DefaultTcpPoolConfig, ...options };
  const { Agent } = require("node:http");

  return new Agent({
    keepAlive: opts.keepAlive,
    keepAliveMsecs: opts.keepAliveTimeoutMs,
    maxSockets: opts.maxSocketsPerHost,
    maxTotalSockets: opts.maxTotalSockets,
  });
}

/**
 * Create HTTPS agent with optimized connection pooling.
 */
export function createHttpsAgent(options: Partial<TcpPoolConfig> = {}): HttpsAgent {
  const opts = { ...DefaultTcpPoolConfig, ...options };
  const { Agent } = require("node:https");

  return new Agent({
    keepAlive: opts.keepAlive,
    keepAliveMsecs: opts.keepAliveTimeoutMs,
    maxSockets: opts.maxSocketsPerHost,
    maxTotalSockets: opts.maxTotalSockets,
  });
}

// ============================================================================
// HTTP Fetch with Timeouts and Pooling
// ============================================================================

export interface FetchWithTimeoutOptions extends RequestInit {
  /** Connection timeout in milliseconds */
  connectTimeoutMs?: number;
  /** Request timeout in milliseconds */
  timeoutMs?: number;
  /** Whether to use connection pooling */
  useConnectionPool?: boolean;
}

/**
 * Fetch with timeout and connection pooling.
 * L2-06 Phase 9: Production-ready HTTP client with timeout tuning.
 */
export async function fetchWithTimeout(
  url: string,
  options: FetchWithTimeoutOptions = {}
): Promise<Response> {
  const { connectTimeoutMs = 5000, timeoutMs = 30000, useConnectionPool = true, ...fetchOptions } = options;

  const urlObj = new URL(url);
  const isHttps = urlObj.protocol === "https:";

  // Get or create agent with pooling
  let agent: HttpAgent | HttpsAgent | undefined;
  if (useConnectionPool) {
    const { getGlobalConnectionPool } = await import("./connection-pool.js");
    const pool = getGlobalConnectionPool();
    agent = isHttps ? pool.getHttpsAgent() : pool.getHttpAgent();
  }

  // Create AbortController for timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...fetchOptions,
      signal: controller.signal,
      // @ts-ignore - Node.js fetch supports agent
      agent,
    });

    clearTimeout(timeoutId);
    return response;
  } catch (err) {
    clearTimeout(timeoutId);
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error(`Request timeout after ${timeoutMs}ms: ${url}`);
    }
    throw err;
  }
}

// ============================================================================
// Model Provider Connection Tuning
// ============================================================================

export interface ModelProviderConnectionConfig {
  /** Base URL of the provider */
  baseUrl: string;
  /** Connection pool size */
  poolSize: number;
  /** Connection timeout */
  connectTimeoutMs: number;
  /** Read timeout */
  readTimeoutMs: number;
  /** Retry attempts */
  retryAttempts: number;
}

/**
 * Create optimized connection config for model providers.
 */
export function createModelProviderConfig(
  baseUrl: string,
  options: Partial<Omit<ModelProviderConnectionConfig, "baseUrl">> = {}
): ModelProviderConnectionConfig {
  return {
    baseUrl,
    poolSize: options.poolSize ?? 10,
    connectTimeoutMs: options.connectTimeoutMs ?? 10000,
    readTimeoutMs: options.readTimeoutMs ?? 120000,
    retryAttempts: options.retryAttempts ?? 2,
  };
}
