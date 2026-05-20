/**
 * Tool gateway unit tests – deny/stub-only; allowlist + sandbox (M3).
 * @see L2-05 Phase 2, SEC-004, SOW M3 F.3–F.4
 */

import { describe, it, expect } from "@jest/globals";
import { jest } from "@jest/globals";
import {
  DenyOnlyToolGateway,
  AllowlistToolGateway,
  StubAllowedToolGateway,
  ExecutableToolGateway,
  getDefaultToolGateway,
  setDefaultToolGateway,
  toolIdRequiresFilesystemAccess,
  toolIdRequiresNetworkAccess,
} from "./tool-gateway.js";

describe("toolIdRequiresNetworkAccess / toolIdRequiresFilesystemAccess", () => {
  it("reflects builtin executable tool metadata", () => {
    expect(toolIdRequiresNetworkAccess("web_search")).toBe(true);
    expect(toolIdRequiresNetworkAccess("stub_tool")).toBe(false);
    expect(toolIdRequiresFilesystemAccess("file_write_preview")).toBe(true);
    expect(toolIdRequiresFilesystemAccess("stub_tool")).toBe(false);
  });
});

describe("DenyOnlyToolGateway", () => {
  const gateway = new DenyOnlyToolGateway();

  it("returns structured deny for any invoke", async () => {
    const result = await gateway.invoke({
      tool_id: "web_search",
      params: { query: "test" },
    });
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe("TOOL_GATEWAY_DENY_STUB");
    expect(result.message).toContain("deny/stub-only");
    expect(result.tool_id).toBe("web_search");
  });

  it("denies without params", async () => {
    const result = await gateway.invoke({ tool_id: "any_tool" });
    expect(result.allowed).toBe(false);
    expect(result.tool_id).toBe("any_tool");
  });
});

describe("AllowlistToolGateway", () => {
  const stubDelegate = new StubAllowedToolGateway({ output: "ok" });

  it("denies when tool_id not in allowlist", async () => {
    const gateway = new AllowlistToolGateway({
      allowlist: ["allowed_tool"],
      delegate: stubDelegate,
    });
    const result = await gateway.invoke({ tool_id: "forbidden_tool", params: {} });
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe("TOOL_NOT_IN_ALLOWLIST");
    expect(result.tool_id).toBe("forbidden_tool");
  });

  it("allows and returns result when tool_id in allowlist", async () => {
    const gateway = new AllowlistToolGateway({
      allowlist: ["allowed_tool"],
      delegate: stubDelegate,
    });
    const result = await gateway.invoke({ tool_id: "allowed_tool", params: { q: 1 } });
    expect(result.allowed).toBe(true);
    expect(result.tool_id).toBe("allowed_tool");
    expect((result as { result?: unknown }).result).toEqual({ q: 1, _result: { output: "ok" } });
  });

  it("returns result within timeout when sandbox.timeout_ms is set", async () => {
    const gateway = new AllowlistToolGateway({
      allowlist: ["fast_tool"],
      sandbox: { timeout_ms: 5000 },
      delegate: stubDelegate,
    });
    const result = await gateway.invoke({ tool_id: "fast_tool" });
    expect(result.allowed).toBe(true);
    expect(result.tool_id).toBe("fast_tool");
  });

  it("returns deterministic timeout deny when delegate exceeds sandbox timeout", async () => {
    const slowDelegate = {
      async invoke() {
        await new Promise((resolve) => setTimeout(resolve, 30));
        return { allowed: true, tool_id: "slow_tool", result: {} } as const;
      },
    };
    const gateway = new AllowlistToolGateway({
      allowlist: ["slow_tool"],
      sandbox: { timeout_ms: 5 },
      delegate: slowDelegate,
    });
    const result = await gateway.invoke({ tool_id: "slow_tool" });
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe("TOOL_TIMEOUT");
  });

  it("clears sandbox timeout timer when delegate resolves first (PR-020)", async () => {
    jest.useFakeTimers();
    try {
      const gateway = new AllowlistToolGateway({
        allowlist: ["fast_tool"],
        sandbox: { timeout_ms: 5_000 },
        delegate: new StubAllowedToolGateway({ output: "ok" }),
      });
      const result = await gateway.invoke({ tool_id: "fast_tool" });
      expect(result.allowed).toBe(true);
      expect(jest.getTimerCount()).toBe(0);
    } finally {
      jest.useRealTimers();
    }
  });

  it("denies tool when sandbox blocks required network access", async () => {
    const gateway = new AllowlistToolGateway({
      allowlist: ["web_search"],
      sandbox: { network_access: false, timeout_ms: 1000 },
      delegate: new ExecutableToolGateway(),
    });
    const result = await gateway.invoke({ tool_id: "web_search", params: { query: "test" } });
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe("TOOL_SANDBOX_NETWORK_DENIED");
  });

  it("denies tool when sandbox blocks required filesystem access", async () => {
    const gateway = new AllowlistToolGateway({
      allowlist: ["file_write_preview"],
      sandbox: { filesystem_access: false, timeout_ms: 1000 },
      delegate: new ExecutableToolGateway(),
    });
    const result = await gateway.invoke({ tool_id: "file_write_preview", params: { path: "x.txt" } });
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe("TOOL_SANDBOX_FILESYSTEM_DENIED");
  });
});

describe("StubAllowedToolGateway", () => {
  it("returns allowed with structured result", async () => {
    const gateway = new StubAllowedToolGateway({ value: 42 });
    const result = await gateway.invoke({ tool_id: "stub_tool", params: { x: 1 } });
    expect(result.allowed).toBe(true);
    expect(result.tool_id).toBe("stub_tool");
    expect((result as { result?: { x?: number; _result?: { value?: number } } }).result).toMatchObject({
      x: 1,
      _result: { value: 42 },
    });
  });
});

describe("ExecutableToolGateway", () => {
  it("executes implemented tool and returns result payload", async () => {
    const gateway = new ExecutableToolGateway();
    const result = await gateway.invoke({
      tool_id: "stub_tool",
      params: { prompt: "hello" },
      caller_identity: { org_id: "o1", app_id: "a1", user_id: "u1" },
    });
    expect(result.allowed).toBe(true);
    expect(result.tool_id).toBe("stub_tool");
    expect((result as { result?: { tool?: string; output?: string } }).result?.tool).toBe("stub_tool");
    expect((result as { result?: { output?: string } }).result?.output).toContain("hello");
  });

  it("returns deterministic deny when tool is not implemented", async () => {
    const gateway = new ExecutableToolGateway();
    const result = await gateway.invoke({ tool_id: "does_not_exist" });
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe("TOOL_NOT_IMPLEMENTED");
  });
});

describe("getDefaultToolGateway", () => {
  afterEach(() => {
    setDefaultToolGateway(null);
  });

  it("returns singleton deny-only gateway", async () => {
    const g = getDefaultToolGateway();
    const result = await g.invoke({ tool_id: "x" });
    expect(result.allowed).toBe(false);
    expect(getDefaultToolGateway()).toBe(g);
  });
});
