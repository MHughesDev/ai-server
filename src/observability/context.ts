/**
 * Trace and request context propagation.
 * @see Docs/SPEC/18_Observability_Spec.md, L2-04 Phase 1 – trace_id/request_id in every log/artifact
 */

import { AsyncLocalStorage } from "node:async_hooks";

export interface TraceContext {
  trace_id: string;
  request_id: string;
}

const storage = new AsyncLocalStorage<TraceContext>();

/** Generate a simple trace id (UUID-like for correlation) */
export function generateTraceId(): string {
  return `tr_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 11)}`;
}

/**
 * Run a function with the given trace context. Context is available via getTraceContext().
 */
export function runWithContext<T>(context: TraceContext, fn: () => T): T {
  return storage.run(context, fn);
}

/**
 * Run an async function with the given trace context.
 */
export async function runWithContextAsync<T>(
  context: TraceContext,
  fn: () => Promise<T>
): Promise<T> {
  return storage.run(context, fn);
}

/**
 * Get the current trace context, or undefined if not inside runWithContext.
 */
export function getTraceContext(): TraceContext | undefined {
  return storage.getStore();
}

/**
 * Create context from request_id (e.g. from envelope or header); generates trace_id if not provided.
 */
export function createContext(requestId: string, traceId?: string): TraceContext {
  return {
    request_id: requestId,
    trace_id: traceId ?? generateTraceId(),
  };
}
