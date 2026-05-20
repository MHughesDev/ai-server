/**
 * Tracks live sockets and enforces connection caps (PR-021).
 */

import type { Socket } from "node:net";
import type { ConnectionLimitConfig } from "../config/connection-limits.js";
import { loadConnectionLimitConfig } from "../config/connection-limits.js";

export interface ConnectionStats {
  activeConnections: number;
  activeConnectionsByIp: number;
  draining: boolean;
}

export class ConnectionTracker {
  private readonly connections = new Set<Socket>();
  private readonly connectionsByIp = new Map<string, Set<Socket>>();
  private draining = false;

  constructor(private readonly limits: ConnectionLimitConfig) {}

  setDraining(draining: boolean): void {
    this.draining = draining;
  }

  isDraining(): boolean {
    return this.draining;
  }

  getStats(): ConnectionStats {
    return {
      activeConnections: this.connections.size,
      activeConnectionsByIp: this.connectionsByIp.size,
      draining: this.draining,
    };
  }

  /** Returns false when the socket must be destroyed (global or per-IP cap). */
  tryAccept(socket: Socket, clientIp: string): boolean {
    if (this.connections.size >= this.limits.maxConnections) {
      return false;
    }

    const ipConnections = this.connectionsByIp.get(clientIp);
    if (ipConnections && ipConnections.size >= this.limits.maxConnectionsPerIp) {
      return false;
    }

    this.connections.add(socket);

    if (!ipConnections) {
      this.connectionsByIp.set(clientIp, new Set([socket]));
    } else {
      ipConnections.add(socket);
    }

    socket.once("close", () => {
      this.connections.delete(socket);
      const ipConns = this.connectionsByIp.get(clientIp);
      if (ipConns) {
        ipConns.delete(socket);
        if (ipConns.size === 0) {
          this.connectionsByIp.delete(clientIp);
        }
      }
    });

    return true;
  }
}

let defaultTracker: ConnectionTracker | null = null;

export function getConnectionTracker(
  limits: ConnectionLimitConfig = loadConnectionLimitConfig()
): ConnectionTracker {
  if (!defaultTracker) {
    defaultTracker = new ConnectionTracker(limits);
  }
  return defaultTracker;
}

export function resetConnectionTrackerForTest(): void {
  defaultTracker = null;
}
