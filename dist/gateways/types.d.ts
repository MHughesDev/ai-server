/**
 * Gateways – Model, Tool, Memory abstractions.
 * @see docs/SPEC/15_ModelGateway_Spec, 16_ToolGateway_Spec, 17_MemoryAbstraction
 */
import type { IMemoryStore } from "../memory/memory-abstraction.js";
/** Completion request for model gateway */
export interface ModelCompletionRequest {
    prompt: string;
    max_tokens?: number;
    model?: string;
}
/** Completion result with usage for telemetry */
export interface ModelCompletionResult {
    text: string;
    tokens_in: number;
    tokens_out: number;
    model: string;
    cost_usd_est?: number;
    latency_ms?: number;
}
/** Model gateway interface – provider abstraction with timeout/retry/usage */
export interface IModelGateway {
    complete(request: ModelCompletionRequest): Promise<ModelCompletionResult>;
}
/** Tool invocation request (L2-05+ deny/stub only) */
export interface ToolCallerIdentity {
    org_id: string;
    app_id: string;
    user_id: string;
    session_id?: string;
    roles?: string[];
    trace_id?: string;
    invocation_id?: string;
}
export interface ToolInvokeRequest {
    tool_id: string;
    params?: Record<string, unknown>;
    caller_identity?: ToolCallerIdentity;
}
/** Tool result – deny case (L2-05) */
export interface ToolInvokeResultDenied {
    allowed: false;
    reason: string;
    message: string;
    tool_id: string;
}
/** Tool result – allowed case with structured result (M3, Architecture §12) */
export interface ToolInvokeResultAllowed {
    allowed: true;
    tool_id: string;
    result?: unknown;
    duration_ms?: number;
}
/** Tool invocation result – discriminated union */
export type ToolInvokeResult = ToolInvokeResultDenied | ToolInvokeResultAllowed;
/** Tool gateway interface – L2-05 deny/stub; M3 allowlist + sandbox */
export interface IToolGateway {
    invoke(request: ToolInvokeRequest): Promise<ToolInvokeResult>;
}
/**
 * Memory surface aligned with SPEC 17 — same contract as {@link IMemoryStore}.
 * Use this name in gateway-oriented imports alongside {@link IModelGateway} / {@link IToolGateway}.
 */
export type IMemoryAbstraction = IMemoryStore;
//# sourceMappingURL=types.d.ts.map