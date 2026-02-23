/**
 * Tool gateway unit tests – deny/stub-only behavior.
 * @see L2-05 Phase 2, SEC-004
 */

import { DenyOnlyToolGateway, getDefaultToolGateway, setDefaultToolGateway } from "./tool-gateway.js";

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
