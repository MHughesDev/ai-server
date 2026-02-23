/**
 * Tool Gateway – deny/stub-only enforcement; no real tool execution (L2-05).
 * @see Docs/SPEC/16_ToolGateway_Spec.md, L2-05 Phase 2
 */

import type { IToolGateway, ToolInvokeRequest, ToolInvokeResult } from "./types.js";

const DENY_REASON = "TOOL_GATEWAY_DENY_STUB";
const DENY_MESSAGE = "Tool execution is disabled; gateway is in deny/stub-only mode.";

/**
 * Deny-only tool gateway. All invocations return a structured deny.
 * Used for runtime checks that block unsanctioned tool invocation.
 */
export class DenyOnlyToolGateway implements IToolGateway {
  async invoke(request: ToolInvokeRequest): Promise<ToolInvokeResult> {
    await Promise.resolve();
    return {
      allowed: false,
      reason: DENY_REASON,
      message: DENY_MESSAGE,
      tool_id: request.tool_id,
    };
  }
}

/** Singleton deny-only gateway for use across the app */
let defaultToolGateway: IToolGateway | null = null;

export function getDefaultToolGateway(): IToolGateway {
  if (!defaultToolGateway) {
    defaultToolGateway = new DenyOnlyToolGateway();
  }
  return defaultToolGateway;
}

export function setDefaultToolGateway(gateway: IToolGateway | null): void {
  defaultToolGateway = gateway;
}
