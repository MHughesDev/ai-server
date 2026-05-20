/**
 * Tool Gateway – deny/stub-only enforcement; allowlist + sandbox (M3).
 * @see docs/SPEC/16_ToolGateway_Spec.md, L2-05 Phase 2, SOW M3 F.3–F.4
 * WANT-006: Tool execution from governed paths uses `IToolGateway` only (`tool_engine.ts`); allowlist from policy/plan is applied in `query-handler.ts`.
 * PR-014: Production enables `ExecutableToolGateway` only when `TOOL_EXECUTION_ENABLED=true` and
 * `TOOL_EXECUTION_SECURITY_REVIEW_SIGNOFF=true` (`assert-production-tool-execution.ts`, `query-handler.ts`).
 * WANT-029: Executable registry in `tool-registry.ts` (builtins + `TOOL_GATEWAY_CUSTOM_TOOLS_JSON`).
 */

import type { IToolGateway, ToolInvokeRequest, ToolInvokeResult } from "./types.js";
import { createGatewayTimeoutError, toolInvokeResultForGatewayTimeout } from "./gateway-timeout.js";
import { raceWithTimeout } from "../utils/race-with-timeout.js";
import { ExecutableToolGateway, getExecutableToolDefinition } from "./tool-registry.js";

export {
  BUILTIN_EXECUTABLE_TOOLS,
  buildExecutableToolRegistry,
  createExecutableToolGateway,
  ExecutableToolGateway,
  getExecutableToolDefinition,
  getExecutableToolRegistry,
  parseCustomToolDefinitionsFromEnv,
  resetExecutableToolRegistryForTest,
  toolIdRequiresFilesystemAccess,
  toolIdRequiresNetworkAccess,
} from "./tool-registry.js";
export type { CustomToolDefinition, ExecutableToolDefinition, ExecutableToolRegistry } from "./tool-registry.js";

const DENY_REASON = "TOOL_GATEWAY_DENY_STUB";
const DENY_MESSAGE = "Tool execution is disabled; gateway is in deny/stub-only mode.";
const DENY_NOT_IN_ALLOWLIST = "TOOL_NOT_IN_ALLOWLIST";
const DENY_SANDBOX_NETWORK = "TOOL_SANDBOX_NETWORK_DENIED";
const DENY_SANDBOX_FILESYSTEM = "TOOL_SANDBOX_FILESYSTEM_DENIED";

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

export class AllowlistToolGateway implements IToolGateway {
  constructor(private readonly options: AllowlistToolGatewayOptions) {}

  async invoke(request: ToolInvokeRequest): Promise<ToolInvokeResult> {
    const { allowlist, sandbox, delegate } = this.options;
    if (!allowlist.includes(request.tool_id)) {
      return {
        allowed: false,
        reason: DENY_NOT_IN_ALLOWLIST,
        message: `Tool '${request.tool_id}' is not in the allowlist`,
        tool_id: request.tool_id,
      };
    }
    const timeoutMs = sandbox?.timeout_ms;
    const networkAllowed = sandbox?.network_access === true;
    const filesystemAllowed = sandbox?.filesystem_access === true;
    const executableDelegate = delegate instanceof ExecutableToolGateway ? delegate : null;
    const toolMetadata =
      executableDelegate?.getToolDefinition(request.tool_id) ??
      getExecutableToolDefinition(request.tool_id);
    if (toolMetadata?.requires_network && !networkAllowed) {
      return {
        allowed: false,
        reason: DENY_SANDBOX_NETWORK,
        message: `Tool '${request.tool_id}' requires network access, but sandbox network_access=false`,
        tool_id: request.tool_id,
      };
    }
    if (toolMetadata?.requires_filesystem && !filesystemAllowed) {
      return {
        allowed: false,
        reason: DENY_SANDBOX_FILESYSTEM,
        message: `Tool '${request.tool_id}' requires filesystem access, but sandbox filesystem_access=false`,
        tool_id: request.tool_id,
      };
    }
    if (timeoutMs != null && timeoutMs > 0) {
      try {
        return await raceWithTimeout(
          delegate.invoke(request),
          timeoutMs,
          createGatewayTimeoutError("tool")
        );
      } catch (err) {
        const timeoutDeny = toolInvokeResultForGatewayTimeout(err, request.tool_id);
        if (timeoutDeny) return timeoutDeny;
        const message = err instanceof Error ? err.message : String(err);
        return {
          allowed: false,
          reason: "TOOL_TIMEOUT",
          message,
          tool_id: request.tool_id,
        };
      }
    }
    return delegate.invoke(request);
  }
}

/** Stub delegate that returns allowed with a structured result (for tests / stub runs). */
export class StubAllowedToolGateway implements IToolGateway {
  constructor(private readonly resultPayload: unknown = { stub: true }) {}

  async invoke(request: ToolInvokeRequest): Promise<ToolInvokeResult> {
    const start = Date.now();
    await Promise.resolve();
    return {
      allowed: true,
      tool_id: request.tool_id,
      result: { ...(request.params as object), _result: this.resultPayload },
      duration_ms: Date.now() - start,
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
