/**
 * Tool Gateway – deny/stub-only enforcement; no real tool execution (L2-05).
 * @see Docs/SPEC/16_ToolGateway_Spec.md, L2-05 Phase 2
 */
import type { IToolGateway, ToolInvokeRequest, ToolInvokeResult } from "./types.js";
/**
 * Deny-only tool gateway. All invocations return a structured deny.
 * Used for runtime checks that block unsanctioned tool invocation.
 */
export declare class DenyOnlyToolGateway implements IToolGateway {
    invoke(request: ToolInvokeRequest): Promise<ToolInvokeResult>;
}
export declare function getDefaultToolGateway(): IToolGateway;
export declare function setDefaultToolGateway(gateway: IToolGateway | null): void;
//# sourceMappingURL=tool-gateway.d.ts.map