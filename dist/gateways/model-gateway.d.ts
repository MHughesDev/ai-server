/**
 * Model Gateway – provider abstraction with timeout, retry, error mapping.
 * @see Docs/SPEC/15_ModelGateway_Spec.md, L2-02 Phase 2
 */
import type { IModelGateway, ModelCompletionRequest, ModelCompletionResult } from "./types.js";
import type { ErrorCode } from "../contracts/errors.js";
export interface ModelGatewayConfig {
    timeoutMs: number;
    maxRetries: number;
    defaultModel: string;
}
/** Thrown when gateway fails (maps to MODEL_FAILURE or INTERNAL_ERROR) */
export declare class ModelGatewayError extends Error {
    readonly code: ErrorCode;
    readonly retryable: boolean;
    constructor(message: string, code: ErrorCode, retryable: boolean);
}
/**
 * Stub implementation – returns deterministic response for tests and MVP.
 * No external provider call.
 */
export declare class StubModelGateway implements IModelGateway {
    private config;
    constructor(config?: Partial<ModelGatewayConfig>);
    complete(request: ModelCompletionRequest): Promise<ModelCompletionResult>;
}
/**
 * Gateway wrapper that enforces timeout and retries, maps errors to taxonomy.
 */
export declare function withTimeoutAndRetry(gateway: IModelGateway, config?: Partial<ModelGatewayConfig>): IModelGateway;
//# sourceMappingURL=model-gateway.d.ts.map