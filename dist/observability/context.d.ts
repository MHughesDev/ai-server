/**
 * Trace and request context propagation.
 * @see docs/SPEC/18_Observability_Spec.md, L2-04 Phase 1 – trace_id/request_id in every log/artifact
 */
export interface TraceContext {
    trace_id: string;
    request_id: string;
}
/** Generate a simple trace id (UUID-like for correlation) */
export declare function generateTraceId(): string;
/**
 * Run a function with the given trace context. Context is available via getTraceContext().
 */
export declare function runWithContext<T>(context: TraceContext, fn: () => T): T;
/**
 * Run an async function with the given trace context.
 */
export declare function runWithContextAsync<T>(context: TraceContext, fn: () => Promise<T>): Promise<T>;
/**
 * Get the current trace context, or undefined if not inside runWithContext.
 */
export declare function getTraceContext(): TraceContext | undefined;
/**
 * Create context from request_id (e.g. from envelope or header); generates trace_id if not provided.
 */
export declare function createContext(requestId: string, traceId?: string): TraceContext;
//# sourceMappingURL=context.d.ts.map