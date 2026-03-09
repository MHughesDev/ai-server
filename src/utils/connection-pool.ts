/**
 * Connection pool manager for external service connections.
 * L2-06: TCP connection pooling for model providers, vector stores, etc.
 */

import type { Agent } from "node:http";
import { Agent as HttpsAgent } from "node:https";

export interface ConnectionPoolOptions {
  /** Maximum number of sockets to keep open */
  maxSockets: number;
  /** Maximum number of sockets per host */
  maxSocketsPerHost: number;
  /** Socket timeout in milliseconds */
  timeoutMs: number;
  /** Keep-alive timeout in milliseconds */
  keepAliveMs: number;
  /** Enable keep-alive */
  keepAlive: boolean;
}

export const DefaultConnectionPoolOptions: ConnectionPoolOptions = {
  maxSockets: 50,
  maxSocketsPerHost: 10,
  timeoutMs: 30000,
  keepAliveMs: 30000,
  keepAlive: true,
};

/**
 * HTTP connection pool manager.
 * Creates and manages http.Agent and https.Agent instances.
 */
export class ConnectionPoolManager {
  private httpAgent: Agent | null = null;
  private httpsAgent: HttpsAgent | null = null;
  private options: ConnectionPoolOptions;

  constructor(options: Partial<ConnectionPoolOptions> = {}) {
    this.options = { ...DefaultConnectionPoolOptions, ...options };
  }

  /**
   * Get or create the HTTP agent.
   */
  getHttpAgent(): Agent {
    if (!this.httpAgent) {
      // Dynamic import to avoid issues with Node.js module system
      const { Agent: HttpAgent } = require("node:http");
      this.httpAgent = new HttpAgent({
        keepAlive: this.options.keepAlive,
        keepAliveMsecs: this.options.keepAliveMs,
        maxSockets: this.options.maxSockets,
        maxFreeSockets: this.options.maxSocketsPerHost,
        timeout: this.options.timeoutMs,
      });
    }
    return this.httpAgent as Agent;
  }

  /**
   * Get or create the HTTPS agent.
   */
  getHttpsAgent(): HttpsAgent {
    if (!this.httpsAgent) {
      this.httpsAgent = new HttpsAgent({
        keepAlive: this.options.keepAlive,
        keepAliveMsecs: this.options.keepAliveMs,
        maxSockets: this.options.maxSockets,
        maxFreeSockets: this.options.maxSocketsPerHost,
        timeout: this.options.timeoutMs,
      });
    }
    return this.httpsAgent;
  }

  /**
   * Get the appropriate agent for a URL.
   */
  getAgentForUrl(url: string): Agent | HttpsAgent {
    return url.startsWith("https:") ? this.getHttpsAgent() : this.getHttpAgent();
  }

  /**
   * Get active socket counts for monitoring.
   */
  getStats(): {
    http: { active: number; free: number };
    https: { active: number; free: number };
  } {
    const httpStats = this.httpAgent
      ? {
          active: (this.httpAgent as unknown as { requests: Record<string, unknown> }).requests
            ? Object.keys((this.httpAgent as unknown as { requests: Record<string, unknown> }).requests).length
            : 0,
          free: (this.httpAgent as unknown as { freeSockets: Record<string, unknown> }).freeSockets
            ? Object.keys((this.httpAgent as unknown as { freeSockets: Record<string, unknown> }).freeSockets).length
            : 0,
        }
      : { active: 0, free: 0 };

    const httpsStats = this.httpsAgent
      ? {
          active: (this.httpsAgent as unknown as { requests: Record<string, unknown> }).requests
            ? Object.keys((this.httpsAgent as unknown as { requests: Record<string, unknown> }).requests).length
            : 0,
          free: (this.httpsAgent as unknown as { freeSockets: Record<string, unknown> }).freeSockets
            ? Object.keys((this.httpsAgent as unknown as { freeSockets: Record<string, unknown> }).freeSockets).length
            : 0,
        }
      : { active: 0, free: 0 };

    return { http: httpStats, https: httpsStats };
  }

  /**
   * Destroy all connections in the pool.
   */
  async destroy(): Promise<void> {
    if (this.httpAgent) {
      this.httpAgent.destroy();
      this.httpAgent = null;
    }
    if (this.httpsAgent) {
      this.httpsAgent.destroy();
      this.httpsAgent = null;
    }
  }
}

// Global pool manager instance
let globalPoolManager: ConnectionPoolManager | null = null;

/**
 * Get the global connection pool manager.
 */
export function getGlobalConnectionPool(): ConnectionPoolManager {
  if (!globalPoolManager) {
    globalPoolManager = new ConnectionPoolManager();
  }
  return globalPoolManager;
}

/**
 * Configure the global connection pool with custom options.
 */
export function configureGlobalConnectionPool(options: Partial<ConnectionPoolOptions>): void {
  globalPoolManager = new ConnectionPoolManager(options);
}

/**
 * Destroy the global connection pool (for shutdown).
 */
export async function destroyGlobalConnectionPool(): Promise<void> {
  if (globalPoolManager) {
    await globalPoolManager.destroy();
    globalPoolManager = null;
  }
}
