/**
 * Graceful shutdown: drain in-flight requests and connections on SIGTERM/SIGINT (PR-022).
 * @see docs/OPERATIONS/RUNBOOKS/Observability-and-Eval.md
 */

import type { Server } from "node:http";
import { safeLogError } from "../observability/redact.js";
import { shutdownPersistentAuditFileSink } from "../security/audit-logger.js";
import { getEventSink } from "../observability/index.js";
import type { ConnectionTracker } from "./connection-tracker.js";

/** Default drain window; align K8s `terminationGracePeriodSeconds` to this + ~15s buffer. */
export const DEFAULT_SHUTDOWN_DRAIN_TIMEOUT_MS = 30_000;

/** Recommended K8s pod termination grace (drain + preStop buffer). */
export const RECOMMENDED_K8S_TERMINATION_GRACE_SECONDS = 45;

export interface GracefulShutdownConfig {
  drainTimeoutMs: number;
  pollIntervalMs: number;
}

export interface DrainWaitResult {
  drained: boolean;
  activeConnections: number;
  inFlightRequests: number;
  elapsedMs: number;
}

export interface GracefulShutdownDeps {
  signal: string;
  connectionTracker: ConnectionTracker;
  httpServer: Server;
  httpsServer?: Server | null;
  stopWorkers?: () => Promise<void>;
  onComplete?: () => void | Promise<void>;
}

let serverDraining = false;
let inFlightRequests = 0;

export function loadGracefulShutdownConfig(): GracefulShutdownConfig {
  const raw = process.env.SHUTDOWN_DRAIN_TIMEOUT_MS?.trim();
  const drainTimeoutMs = raw ? parseInt(raw, 10) : DEFAULT_SHUTDOWN_DRAIN_TIMEOUT_MS;
  if (!Number.isInteger(drainTimeoutMs) || drainTimeoutMs <= 0) {
    throw new Error(
      `SHUTDOWN_DRAIN_TIMEOUT_MS must be a positive integer (got ${raw ?? "(unset)"})`
    );
  }
  const pollRaw = process.env.SHUTDOWN_DRAIN_POLL_MS?.trim();
  const pollIntervalMs = pollRaw ? parseInt(pollRaw, 10) : 100;
  if (!Number.isInteger(pollIntervalMs) || pollIntervalMs <= 0) {
    throw new Error(`SHUTDOWN_DRAIN_POLL_MS must be a positive integer (got ${pollRaw})`);
  }
  return { drainTimeoutMs, pollIntervalMs };
}

export function isServerDraining(): boolean {
  return serverDraining;
}

/** Track an in-flight HTTP request after the connection is accepted. */
export function beginInFlightRequest(): boolean {
  if (serverDraining) return false;
  inFlightRequests += 1;
  return true;
}

export function endInFlightRequest(): void {
  inFlightRequests = Math.max(0, inFlightRequests - 1);
}

export function getInFlightRequestCount(): number {
  return inFlightRequests;
}

export function resetGracefulShutdownStateForTest(): void {
  serverDraining = false;
  inFlightRequests = 0;
}

/** Test-only: simulate drain without running full shutdown. */
export function setServerDrainingForTest(draining: boolean): void {
  serverDraining = draining;
}

function closeServer(server: Server): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((err) => (err ? reject(err) : resolve()));
  });
}

/** Wait until in-flight work and tracked sockets are gone or timeout elapses. */
export async function waitForDrain(
  connectionTracker: ConnectionTracker,
  config: GracefulShutdownConfig
): Promise<DrainWaitResult> {
  const start = Date.now();
  return new Promise((resolve) => {
    const check = (): void => {
      const elapsedMs = Date.now() - start;
      const activeConnections = connectionTracker.getStats().activeConnections;
      const inFlight = inFlightRequests;
      const done =
        (activeConnections === 0 && inFlight === 0) || elapsedMs >= config.drainTimeoutMs;

      if (done) {
        resolve({
          drained: activeConnections === 0 && inFlight === 0,
          activeConnections,
          inFlightRequests: inFlight,
          elapsedMs,
        });
        return;
      }
      setTimeout(check, config.pollIntervalMs);
    };
    check();
  });
}

/** Run graceful shutdown sequence (testable without sending real signals). */
export async function runGracefulShutdown(deps: GracefulShutdownDeps): Promise<DrainWaitResult> {
  const config = loadGracefulShutdownConfig();
  serverDraining = true;
  deps.connectionTracker.setDraining(true);

  console.info(`[server] received ${deps.signal}, starting graceful shutdown...`);

  const closeListeners: Promise<void>[] = [
    closeServer(deps.httpServer).then(() => {
      console.info("[server] HTTP server closed, no longer accepting connections");
    }),
  ];
  if (deps.httpsServer) {
    closeListeners.push(
      closeServer(deps.httpsServer).then(() => {
        console.info("[server] HTTPS server closed, no longer accepting connections");
      })
    );
  }
  await Promise.all(closeListeners);

  if (deps.stopWorkers) {
    try {
      await deps.stopWorkers();
    } catch (err) {
      console.error("[server] worker stop error", safeLogError(err));
    }
  }

  const drainResult = await waitForDrain(deps.connectionTracker, config);
  if (drainResult.drained) {
    console.info("[server] all in-flight requests and connections drained gracefully");
  } else {
    console.warn(
      `[server] drain timeout (${config.drainTimeoutMs}ms) with ${drainResult.inFlightRequests} in-flight request(s) and ${drainResult.activeConnections} connection(s)`
    );
  }

  try {
    await shutdownPersistentAuditFileSink();
  } catch (err) {
    console.error("[server] audit file sink shutdown error", safeLogError(err));
  }
  try {
    await getEventSink()?.close?.();
  } catch (err) {
    console.error("[server] event sink shutdown error", safeLogError(err));
  }

  if (deps.onComplete) {
    await deps.onComplete();
  }

  console.info("[server] graceful shutdown complete");
  return drainResult;
}

export function registerGracefulShutdownHandlers(deps: Omit<GracefulShutdownDeps, "signal"> & {
  onShutdownComplete?: () => void | Promise<void>;
}): void {
  let shuttingDown = false;
  const trigger = (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    void runGracefulShutdown({
      signal,
      connectionTracker: deps.connectionTracker,
      httpServer: deps.httpServer,
      httpsServer: deps.httpsServer,
      stopWorkers: deps.stopWorkers,
      onComplete: deps.onShutdownComplete,
    }).catch((err) => {
      console.error("[server] graceful shutdown failed", safeLogError(err));
      process.exit(1);
    });
  };
  process.on("SIGINT", () => trigger("SIGINT"));
  process.on("SIGTERM", () => trigger("SIGTERM"));
}
