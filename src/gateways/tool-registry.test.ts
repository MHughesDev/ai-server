/**
 * Tool registry tests (WANT-029).
 */

import {
  buildExecutableToolRegistry,
  parseCustomToolDefinitionsFromEnv,
  resetExecutableToolRegistryForTest,
  toolIdRequiresFilesystemAccess,
  toolIdRequiresNetworkAccess,
} from "./tool-registry.js";
import { AllowlistToolGateway } from "./tool-gateway.js";
import { ExecutableToolGateway } from "./tool-registry.js";

const originalEnv = process.env;

beforeEach(() => {
  resetExecutableToolRegistryForTest();
});

afterAll(() => {
  process.env = originalEnv;
});

describe("parseCustomToolDefinitionsFromEnv", () => {
  it("returns empty when env unset", () => {
    delete process.env.TOOL_GATEWAY_CUSTOM_TOOLS_JSON;
    expect(parseCustomToolDefinitionsFromEnv()).toEqual([]);
  });

  it("parses echo and builtin_delegate tools", () => {
    process.env.TOOL_GATEWAY_CUSTOM_TOOLS_JSON = JSON.stringify([
      { id: "team_echo", kind: "echo" },
      {
        id: "search_alias",
        kind: "builtin_delegate",
        delegate_id: "web_search",
        requires_network: true,
      },
    ]);
    const defs = parseCustomToolDefinitionsFromEnv();
    expect(defs).toHaveLength(2);
    expect(defs[1].delegate_id).toBe("web_search");
  });

  it("rejects invalid JSON", () => {
    process.env.TOOL_GATEWAY_CUSTOM_TOOLS_JSON = "not-json";
    expect(() => parseCustomToolDefinitionsFromEnv()).toThrow(/valid JSON/);
  });
});

describe("buildExecutableToolRegistry", () => {
  it("exposes sandbox metadata for custom network tools (router alignment)", () => {
    const registry = buildExecutableToolRegistry([
      { id: "custom_fetch", kind: "echo", requires_network: true },
    ]);
    resetExecutableToolRegistryForTest();
    process.env.TOOL_GATEWAY_CUSTOM_TOOLS_JSON = JSON.stringify([
      { id: "custom_fetch", kind: "echo", requires_network: true },
    ]);
    expect(toolIdRequiresNetworkAccess("custom_fetch")).toBe(true);
    expect(toolIdRequiresFilesystemAccess("custom_fetch")).toBe(false);
    expect(registry.custom_fetch.requires_network).toBe(true);
  });

  it("echo tool returns auditable caller attribution", async () => {
    const registry = buildExecutableToolRegistry([{ id: "team_echo", kind: "echo" }]);
    const gateway = new ExecutableToolGateway(registry);
    const result = await gateway.invoke({
      tool_id: "team_echo",
      params: { note: "hi" },
      caller_identity: {
        org_id: "org-1",
        app_id: "app-1",
        user_id: "user-1",
        trace_id: "trace-1",
        invocation_id: "inv-1",
      },
    });
    expect(result.allowed).toBe(true);
    expect((result as { result?: { caller?: Record<string, string> } }).result?.caller).toEqual({
      org_id: "org-1",
      app_id: "app-1",
      user_id: "user-1",
      trace_id: "trace-1",
      invocation_id: "inv-1",
    });
  });
});

describe("AllowlistToolGateway + custom registry sandbox", () => {
  it("denies custom network tool when plan sandbox has network_access=false", async () => {
    const registry = buildExecutableToolRegistry([
      { id: "custom_fetch", kind: "echo", requires_network: true },
    ]);
    const gateway = new AllowlistToolGateway({
      allowlist: ["custom_fetch"],
      sandbox: { network_access: false, timeout_ms: 1000 },
      delegate: new ExecutableToolGateway(registry),
    });
    const result = await gateway.invoke({ tool_id: "custom_fetch", params: {} });
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe("TOOL_SANDBOX_NETWORK_DENIED");
  });

  it("allows custom echo tool through allowlist without network requirement", async () => {
    const registry = buildExecutableToolRegistry([{ id: "team_echo", kind: "echo" }]);
    const gateway = new AllowlistToolGateway({
      allowlist: ["team_echo"],
      sandbox: { timeout_ms: 1000 },
      delegate: new ExecutableToolGateway(registry),
    });
    const result = await gateway.invoke({
      tool_id: "team_echo",
      params: { x: 1 },
      caller_identity: { org_id: "o", app_id: "a", user_id: "u" },
    });
    expect(result.allowed).toBe(true);
  });
});
