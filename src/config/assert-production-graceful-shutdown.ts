/**
 * Production graceful shutdown guards (PR-022).
 */

import { loadGracefulShutdownConfig } from "../server/graceful-shutdown.js";

/** Fail fast when production omits explicit drain timeout configuration. */
export function assertProductionGracefulShutdown(): void {
  if ((process.env.NODE_ENV ?? "").trim() !== "production") return;
  if (!(process.env.SHUTDOWN_DRAIN_TIMEOUT_MS ?? "").trim()) {
    throw new Error(
      "Production requires SHUTDOWN_DRAIN_TIMEOUT_MS for SIGTERM/SIGINT request draining (recommended 30000; K8s terminationGracePeriodSeconds >= 45)"
    );
  }
  loadGracefulShutdownConfig();
}
