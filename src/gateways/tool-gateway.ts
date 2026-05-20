/**
 * Tool Gateway – deny/stub-only enforcement; allowlist + sandbox (M3).
 * @see docs/SPEC/16_ToolGateway_Spec.md, L2-05 Phase 2, SOW M3 F.3–F.4
 * WANT-006: Tool execution from governed paths uses `IToolGateway` only (`tool_engine.ts`); allowlist from policy/plan is applied in `query-handler.ts`.
 * PR-014: Production enables `ExecutableToolGateway` only when `TOOL_EXECUTION_ENABLED=true` and
 * `TOOL_EXECUTION_SECURITY_REVIEW_SIGNOFF=true` (`assert-production-tool-execution.ts`, `query-handler.ts`).
 */

import type { IToolGateway, ToolInvokeRequest, ToolInvokeResult } from "./types.js";
import { raceWithTimeout } from "../utils/race-with-timeout.js";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const DENY_REASON = "TOOL_GATEWAY_DENY_STUB";
const DENY_MESSAGE = "Tool execution is disabled; gateway is in deny/stub-only mode.";
const DENY_NOT_IN_ALLOWLIST = "TOOL_NOT_IN_ALLOWLIST";
const DENY_SANDBOX_NETWORK = "TOOL_SANDBOX_NETWORK_DENIED";
const DENY_SANDBOX_FILESYSTEM = "TOOL_SANDBOX_FILESYSTEM_DENIED";
const DENY_TOOL_UNAVAILABLE = "TOOL_NOT_IMPLEMENTED";

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
    const toolMetadata = executableDelegate?.getToolDefinition(request.tool_id);
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
          "TOOL_TIMEOUT"
        );
      } catch (err) {
        const message =
          err instanceof Error && err.message === "TOOL_TIMEOUT"
            ? "Tool execution timed out"
            : err instanceof Error ? err.message : String(err);
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

function readString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function readBoolean(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
}

function readObject(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function getFilesystemRoot(): string {
  return resolve(process.env.TOOL_FILESYSTEM_ROOT?.trim() || process.cwd());
}

function resolveSandboxedPath(relativePath: string): string {
  const clean = relativePath.trim();
  if (!clean) {
    throw new Error("path is required");
  }
  const root = getFilesystemRoot();
  const target = resolve(root, clean);
  const rootWithSep = root.endsWith("\\") || root.endsWith("/") ? root : `${root}/`;
  if (target !== root && !target.startsWith(rootWithSep)) {
    throw new Error("path escapes TOOL_FILESYSTEM_ROOT");
  }
  return target;
}

const BUILTIN_EXECUTABLE_TOOLS: ExecutableToolRegistry = {
  stub_tool: {
    execute: async (request) => {
      const prompt = readString(request.params?.prompt, "");
      await Promise.resolve();
      return {
        tool: "stub_tool",
        output: `stub_tool executed: ${prompt || "ok"}`,
        caller: request.caller_identity
          ? {
              org_id: request.caller_identity.org_id,
              app_id: request.caller_identity.app_id,
              user_id: request.caller_identity.user_id,
            }
          : undefined,
      };
    },
  },
  web_search: {
    requires_network: true,
    execute: async (request) => {
      const query = readString(request.params?.query, "");
      if (!query.trim()) {
        throw new Error("query is required");
      }
      const endpoint = new URL("https://api.duckduckgo.com/");
      endpoint.searchParams.set("q", query);
      endpoint.searchParams.set("format", "json");
      endpoint.searchParams.set("no_html", "1");
      endpoint.searchParams.set("no_redirect", "1");
      endpoint.searchParams.set("skip_disambig", "1");
      const response = await fetch(endpoint, { method: "GET" });
      if (!response.ok) {
        throw new Error(`web_search upstream error (${response.status})`);
      }
      const payload = (await response.json()) as {
        Heading?: string;
        AbstractText?: string;
        AbstractURL?: string;
        RelatedTopics?: Array<
          | { Text?: string; FirstURL?: string }
          | { Name?: string; Topics?: Array<{ Text?: string; FirstURL?: string }> }
        >;
      };
      const results: Array<{ title: string; snippet: string; url?: string }> = [];
      if (payload.AbstractText) {
        results.push({
          title: payload.Heading || "Summary",
          snippet: payload.AbstractText,
          url: payload.AbstractURL,
        });
      }
      for (const topic of payload.RelatedTopics ?? []) {
        if ("Topics" in topic && Array.isArray(topic.Topics)) {
          for (const nested of topic.Topics) {
            if (nested.Text) {
              results.push({
                title: nested.Text.split(" - ")[0] ?? "Result",
                snippet: nested.Text,
                url: nested.FirstURL,
              });
            }
          }
          continue;
        }
        if ("Text" in topic && topic.Text) {
          results.push({
            title: topic.Text.split(" - ")[0] ?? "Result",
            snippet: topic.Text,
            url: topic.FirstURL,
          });
        }
      }
      return {
        tool: "web_search",
        query,
        results: results.slice(0, 10),
      };
    },
  },
  file_write_preview: {
    requires_filesystem: true,
    execute: async (request) => {
      const path = readString(request.params?.path, "");
      const content = readString(request.params?.content, "");
      const encoding = readString(request.params?.encoding, "utf8");
      const metadata = readObject(request.params?.metadata);
      const overwrite = readBoolean(request.params?.overwrite) ?? false;
      const resolvedPath = resolveSandboxedPath(path);
      await mkdir(dirname(resolvedPath), { recursive: true });
      if (!overwrite) {
        await writeFile(resolvedPath, content, { encoding: encoding as BufferEncoding, flag: "wx" });
      } else {
        await writeFile(resolvedPath, content, { encoding: encoding as BufferEncoding });
      }
      return {
        tool: "file_write_preview",
        path: resolvedPath,
        bytes: Buffer.byteLength(content, encoding as BufferEncoding),
        metadata,
        overwrite,
        persisted: true,
      };
    },
  },
};

/** Whether a built-in executable tool performs outbound network I/O (for plan sandbox alignment). */
export function toolIdRequiresNetworkAccess(toolId: string): boolean {
  return BUILTIN_EXECUTABLE_TOOLS[toolId]?.requires_network === true;
}

/** Whether a built-in executable tool writes under `TOOL_FILESYSTEM_ROOT` (for plan sandbox alignment). */
export function toolIdRequiresFilesystemAccess(toolId: string): boolean {
  return BUILTIN_EXECUTABLE_TOOLS[toolId]?.requires_filesystem === true;
}

export class ExecutableToolGateway implements IToolGateway {
  constructor(private readonly registry: ExecutableToolRegistry = BUILTIN_EXECUTABLE_TOOLS) {}

  getToolDefinition(toolId: string): ExecutableToolDefinition | undefined {
    return this.registry[toolId];
  }

  async invoke(request: ToolInvokeRequest): Promise<ToolInvokeResult> {
    const definition = this.registry[request.tool_id];
    if (!definition) {
      return {
        allowed: false,
        reason: DENY_TOOL_UNAVAILABLE,
        message: `Tool '${request.tool_id}' is not implemented`,
        tool_id: request.tool_id,
      };
    }
    const start = Date.now();
    const result = await definition.execute(request);
    return {
      allowed: true,
      tool_id: request.tool_id,
      result,
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
