/**
 * Gateways – Model, Tool, Memory abstractions.
 * @see Docs/SPEC/15_ModelGateway_Spec, 16_ToolGateway_Spec, 17_MemoryAbstraction
 */

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
export interface ToolInvokeRequest {
  tool_id: string;
  params?: Record<string, unknown>;
}

/** Tool result – deny-only in L2-05 */
export interface ToolInvokeResult {
  allowed: false;
  reason: string;
  message: string;
  tool_id: string;
}

/** Tool gateway interface – L2-05 deny/stub-only; no real execution */
export interface IToolGateway {
  invoke(request: ToolInvokeRequest): Promise<ToolInvokeResult>;
}

/** Stub: memory abstraction interface (L2-06+) */
export interface IMemoryAbstraction {
  // TBD
}
