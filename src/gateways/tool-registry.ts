/**
 * Executable tool registry — builtins plus config-defined custom tools (WANT-029).
 * @see docs/SPEC/16_ToolGateway_Spec.md
 */

import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { z } from "zod";
import type { IToolGateway, ToolInvokeRequest, ToolInvokeResult } from "./types.js";

export type ToolExecutor = (request: ToolInvokeRequest) => Promise<unknown>;

export interface ExecutableToolDefinition {
  requires_network?: boolean;
  requires_filesystem?: boolean;
  execute: ToolExecutor;
}

export type ExecutableToolRegistry = Record<string, ExecutableToolDefinition>;

const CustomToolDefinitionSchema = z.object({
  id: z
    .string()
    .min(1)
    .regex(/^[a-z][a-z0-9_]*$/, "tool id must be lowercase snake_case"),
  kind: z.enum(["echo", "builtin_delegate"]),
  requires_network: z.boolean().optional(),
  requires_filesystem: z.boolean().optional(),
  delegate_id: z.string().min(1).optional(),
});

export type CustomToolDefinition = z.infer<typeof CustomToolDefinitionSchema>;

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

/** Built-in executable tools (always available). */
export const BUILTIN_EXECUTABLE_TOOLS: ExecutableToolRegistry = {
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

let cachedRegistry: ExecutableToolRegistry | null = null;

export function resetExecutableToolRegistryForTest(): void {
  cachedRegistry = null;
}

export function parseCustomToolDefinitionsFromEnv(
  raw = process.env.TOOL_GATEWAY_CUSTOM_TOOLS_JSON
): CustomToolDefinition[] {
  const trimmed = raw?.trim();
  if (!trimmed) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    throw new Error("TOOL_GATEWAY_CUSTOM_TOOLS_JSON must be valid JSON array");
  }
  if (!Array.isArray(parsed)) {
    throw new Error("TOOL_GATEWAY_CUSTOM_TOOLS_JSON must be a JSON array");
  }
  return parsed.map((entry, index) => {
    const result = CustomToolDefinitionSchema.safeParse(entry);
    if (!result.success) {
      throw new Error(
        `TOOL_GATEWAY_CUSTOM_TOOLS_JSON[${index}]: ${result.error.issues.map((i) => i.message).join("; ")}`
      );
    }
    return result.data;
  });
}

function callerAttribution(request: ToolInvokeRequest): Record<string, string | undefined> | undefined {
  if (!request.caller_identity) return undefined;
  return {
    org_id: request.caller_identity.org_id,
    app_id: request.caller_identity.app_id,
    user_id: request.caller_identity.user_id,
    trace_id: request.caller_identity.trace_id,
    invocation_id: request.caller_identity.invocation_id,
  };
}

function buildCustomToolDefinition(
  custom: CustomToolDefinition,
  builtins: ExecutableToolRegistry
): ExecutableToolDefinition {
  if (custom.kind === "builtin_delegate") {
    const delegateId = custom.delegate_id?.trim();
    if (!delegateId) {
      throw new Error(`Custom tool '${custom.id}' with kind builtin_delegate requires delegate_id`);
    }
    const delegate = builtins[delegateId];
    if (!delegate) {
      throw new Error(
        `Custom tool '${custom.id}' delegates to unknown builtin '${delegateId}'`
      );
    }
    return {
      requires_network: custom.requires_network ?? delegate.requires_network,
      requires_filesystem: custom.requires_filesystem ?? delegate.requires_filesystem,
      execute: (request) => delegate.execute(request),
    };
  }

  return {
    requires_network: custom.requires_network ?? false,
    requires_filesystem: custom.requires_filesystem ?? false,
    execute: async (request) => {
      await Promise.resolve();
      return {
        tool: custom.id,
        kind: "echo",
        params: request.params ?? {},
        caller: callerAttribution(request),
      };
    },
  };
}

/** Merge builtins with validated custom tools from env (deduped by id; custom cannot override builtins). */
export function buildExecutableToolRegistry(
  customTools: CustomToolDefinition[] = parseCustomToolDefinitionsFromEnv()
): ExecutableToolRegistry {
  const registry: ExecutableToolRegistry = { ...BUILTIN_EXECUTABLE_TOOLS };
  for (const custom of customTools) {
    if (registry[custom.id]) {
      throw new Error(
        `Custom tool id '${custom.id}' conflicts with an existing registry entry`
      );
    }
    registry[custom.id] = buildCustomToolDefinition(custom, BUILTIN_EXECUTABLE_TOOLS);
  }
  return registry;
}

/** Cached registry for runtime (rebuilt when cache cleared, e.g. in tests). */
export function getExecutableToolRegistry(): ExecutableToolRegistry {
  if (!cachedRegistry) {
    cachedRegistry = buildExecutableToolRegistry();
  }
  return cachedRegistry;
}

export function getExecutableToolDefinition(toolId: string): ExecutableToolDefinition | undefined {
  return getExecutableToolRegistry()[toolId];
}

/** Whether a registry tool performs outbound network I/O (plan sandbox alignment). */
export function toolIdRequiresNetworkAccess(toolId: string): boolean {
  return getExecutableToolDefinition(toolId)?.requires_network === true;
}

/** Whether a registry tool writes under `TOOL_FILESYSTEM_ROOT` (plan sandbox alignment). */
export function toolIdRequiresFilesystemAccess(toolId: string): boolean {
  return getExecutableToolDefinition(toolId)?.requires_filesystem === true;
}

const DENY_TOOL_UNAVAILABLE = "TOOL_NOT_IMPLEMENTED";

export class ExecutableToolGateway implements IToolGateway {
  constructor(private readonly registry: ExecutableToolRegistry = getExecutableToolRegistry()) {}

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
    try {
      const result = await definition.execute(request);
      return {
        allowed: true,
        tool_id: request.tool_id,
        result,
        duration_ms: Date.now() - start,
      };
    } catch (err) {
      return {
        allowed: false,
        reason: "TOOL_EXECUTION_FAILED",
        message: err instanceof Error ? err.message : String(err),
        tool_id: request.tool_id,
      };
    }
  }
}

export function createExecutableToolGateway(
  registry: ExecutableToolRegistry = getExecutableToolRegistry()
): ExecutableToolGateway {
  return new ExecutableToolGateway(registry);
}
