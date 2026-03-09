/**
 * Tool engine – unit tests (EngineInvocation → EngineResult; Tool Gateway only).
 * @see SOW M3 F.2
 */

import { createToolEngine } from "./tool_engine.js";
import type { EngineInvocation } from "../contracts/index.js";
import { validateEngineResult } from "../contracts/index.js";
import type { IToolGateway, ToolInvokeRequest, ToolInvokeResult } from "../gateways/types.js";

function minimalInvocation(overrides: Partial<EngineInvocation> = {}): EngineInvocation {
  return {
    invocation_id: "inv-tool-1",
    engine_type: "tool",
    task: {
      task_id: "t1",
      task_type: "invoke_tool",
      category: "action",
      objective: {
        formal_spec: { tool_id: "allowed_tool", parameters: { q: "test" } },
      },
    },
    context_artifacts: [],
    ...overrides,
  };
}

describe("Tool Engine", () => {
  it("implements IEngine and returns success when gateway allows", async () => {
    const mockGateway: IToolGateway = {
      async invoke(_req: ToolInvokeRequest): Promise<ToolInvokeResult> {
        await Promise.resolve();
        return {
          allowed: true,
          tool_id: _req.tool_id,
          result: { output: "ok" },
          duration_ms: 1,
        };
      },
    };
    const engine = createToolEngine(mockGateway);
    const inv = minimalInvocation();
    const result = await engine.invoke(inv);
    expect(result.invocation_id).toBe("inv-tool-1");
    expect(result.status).toBe("success");
    expect(result.result_artifacts).toHaveLength(1);
    expect(result.result_artifacts[0].artifact_kind).toBe("tool_result");
    expect((result.result_artifacts[0].content as { inline?: { result?: unknown } })?.inline?.result).toEqual({
      output: "ok",
    });
    validateEngineResult(result);
  });

  it("returns blocked when gateway denies", async () => {
    const mockGateway: IToolGateway = {
      async invoke(req: ToolInvokeRequest): Promise<ToolInvokeResult> {
        await Promise.resolve();
        return {
          allowed: false,
          reason: "TOOL_GATEWAY_DENY_STUB",
          message: "Tool execution disabled",
          tool_id: req.tool_id,
        };
      },
    };
    const engine = createToolEngine(mockGateway);
    const inv = minimalInvocation();
    const result = await engine.invoke(inv);
    expect(result.status).toBe("blocked");
    expect(result.error?.code).toBe("TOOL_GATEWAY_DENY_STUB");
    expect(result.error?.message).toContain("disabled");
    validateEngineResult(result);
  });

  it("returns fail when tool_id is missing", async () => {
    const mockGateway: IToolGateway = {
      async invoke(): Promise<ToolInvokeResult> {
        await Promise.resolve();
        return { allowed: true, tool_id: "x", result: {} };
      },
    };
    const engine = createToolEngine(mockGateway);
    const inv = minimalInvocation({
      task: {
        task_id: "t1",
        task_type: "invoke_tool",
        category: "action",
        objective: {},
      },
    });
    const result = await engine.invoke(inv);
    expect(result.status).toBe("fail");
    expect(result.error?.code).toBe("TOOL_INVOCATION_INVALID");
    validateEngineResult(result);
  });

  it("returns blocked when tool_id not in allowlist", async () => {
    const mockGateway: IToolGateway = {
      async invoke(req: ToolInvokeRequest): Promise<ToolInvokeResult> {
        await Promise.resolve();
        return { allowed: true, tool_id: req.tool_id, result: {} };
      },
    };
    const engine = createToolEngine(mockGateway, { allowlist: ["only_this"] });
    const inv = minimalInvocation({
      task: {
        task_id: "t1",
        task_type: "invoke_tool",
        category: "action",
        objective: { formal_spec: { tool_id: "forbidden_tool", parameters: {} } },
      },
    });
    const result = await engine.invoke(inv);
    expect(result.status).toBe("blocked");
    expect(result.error?.code).toBe("TOOL_NOT_ALLOWED");
    expect(result.error?.detail).toMatchObject({ tool_id: "forbidden_tool" });
    validateEngineResult(result);
  });

  it("allows tool when in allowlist", async () => {
    const mockGateway: IToolGateway = {
      async invoke(req: ToolInvokeRequest): Promise<ToolInvokeResult> {
        await Promise.resolve();
        return { allowed: true, tool_id: req.tool_id, result: { allowed: true } };
      },
    };
    const engine = createToolEngine(mockGateway, { allowlist: ["allowed_tool"] });
    const inv = minimalInvocation();
    const result = await engine.invoke(inv);
    expect(result.status).toBe("success");
    expect(result.result_artifacts[0].artifact_kind).toBe("tool_result");
    validateEngineResult(result);
  });

  it("forwards caller identity context to the tool gateway", async () => {
    let seenRequest: ToolInvokeRequest | undefined;
    const mockGateway: IToolGateway = {
      async invoke(req: ToolInvokeRequest): Promise<ToolInvokeResult> {
        seenRequest = req;
        await Promise.resolve();
        return { allowed: true, tool_id: req.tool_id, result: { ok: true } };
      },
    };
    const engine = createToolEngine(mockGateway);
    const inv = minimalInvocation({
      actor_context: {
        org_id: "org-1",
        app_id: "app-1",
        user_id: "user-1",
        roles: ["developer"],
      },
      metadata: {
        trace_id: "trace-1",
        contract_version: "v1",
      },
    });
    const result = await engine.invoke(inv);
    expect(result.status).toBe("success");
    expect(seenRequest?.caller_identity).toMatchObject({
      org_id: "org-1",
      app_id: "app-1",
      user_id: "user-1",
      roles: ["developer"],
      trace_id: "trace-1",
      invocation_id: "inv-tool-1",
    });
  });
});
