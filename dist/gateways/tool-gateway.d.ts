/**
 * Tool Gateway – deny/stub-only enforcement; allowlist + sandbox (M3).
 * @see docs/SPEC/16_ToolGateway_Spec.md, L2-05 Phase 2, SOW M3 F.3–F.4
 * WANT-006: Tool execution from governed paths uses `IToolGateway` only (`tool_engine.ts`); allowlist from policy/plan is applied in `query-handler.ts`.
 */
import type { IToolGateway, ToolInvokeRequest, ToolInvokeResult } from "./types.js";
type ToolExecutor = (request: ToolInvokeRequest) => Promise<unknown>;
interface ExecutableToolDefinition {
    requires_network?: boolean;
    requires_filesystem?: boolean;
    execute: ToolExecutor;
}
type ExecutableToolRegistry = Record<string, ExecutableToolDefinition>;
/**
 * Sandbox options for tool execution (Architecture §12).
 */
export interface ToolSandboxOptions {
    timeout_ms?: number;
    network_access?: boolean;
    filesystem_access?: boolean;
}
/**
 * Deny-only tool gateway. All invocations return a structured deny.
 * Used for runtime checks that block unsanctioned tool invocation.
 */
export declare class DenyOnlyToolGateway implements IToolGateway {
    invoke(request: ToolInvokeRequest): Promise<ToolInvokeResult>;
}
/**
 * Gateway that enforces an allowlist and optional sandbox (timeout).
 * When tool_id is not in allowlist, returns denied.
 * When allowed, delegates to the provided gateway (optionally with timeout).
 */
export interface AllowlistToolGatewayOptions {
    allowlist: string[];
    sandbox?: ToolSandboxOptions;
    delegate: IToolGateway;
}
export declare class AllowlistToolGateway implements IToolGateway {
    private readonly options;
    constructor(options: AllowlistToolGatewayOptions);
    invoke(request: ToolInvokeRequest): Promise<ToolInvokeResult>;
}
/** Stub delegate that returns allowed with a structured result (for tests / stub runs). */
export declare class StubAllowedToolGateway implements IToolGateway {
    private readonly resultPayload;
    constructor(resultPayload?: unknown);
    invoke(request: ToolInvokeRequest): Promise<ToolInvokeResult>;
}
/** Whether a built-in executable tool performs outbound network I/O (for plan sandbox alignment). */
export declare function toolIdRequiresNetworkAccess(toolId: string): boolean;
/** Whether a built-in executable tool writes under `TOOL_FILESYSTEM_ROOT` (for plan sandbox alignment). */
export declare function toolIdRequiresFilesystemAccess(toolId: string): boolean;
export declare class ExecutableToolGateway implements IToolGateway {
    private readonly registry;
    constructor(registry?: ExecutableToolRegistry);
    getToolDefinition(toolId: string): ExecutableToolDefinition | undefined;
    invoke(request: ToolInvokeRequest): Promise<ToolInvokeResult>;
}
export declare function getDefaultToolGateway(): IToolGateway;
export declare function setDefaultToolGateway(gateway: IToolGateway | null): void;
export {};
//# sourceMappingURL=tool-gateway.d.ts.map