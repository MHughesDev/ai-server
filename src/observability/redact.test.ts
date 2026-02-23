/**
 * Redaction utility tests – L2-04 Phase 0
 */

import { redact, redactString } from "./redact.js";

describe("redact", () => {
  it("strips sensitive keys at minimal level", () => {
    const obj = {
      request_id: "req-1",
      password: "secret123",
      token: "bearer xyz",
      pipeline_type: "reactive_chat",
    };
    const out = redact(obj, "minimal");
    expect(out.request_id).toBe("req-1");
    expect(out.pipeline_type).toBe("reactive_chat");
    expect(out).not.toHaveProperty("password");
    expect(out).not.toHaveProperty("token");
  });

  it("allows allowlisted fields at minimal level", () => {
    const obj = {
      request_id: "r1",
      trace_id: "tr1",
      event_type: "POLICY_DECISION",
      allowed: true,
      deny_reason: undefined,
      token_budget: 4096,
      payload: { pipeline_type: "chat" },
    };
    const out = redact(obj, "minimal");
    expect(out.request_id).toBe("r1");
    expect(out.trace_id).toBe("tr1");
    expect(out.event_type).toBe("POLICY_DECISION");
    expect(out.allowed).toBe(true);
    expect(out.token_budget).toBe(4096);
    expect(out.payload).toEqual({ pipeline_type: "chat" });
  });

  it("redacts string values at full level", () => {
    const obj = { request_id: "r1", message: "user said something" };
    const out = redact(obj, "full");
    expect(out.request_id).toBe("[REDACTED]");
    expect(out.message).toBe("[REDACTED]");
  });

  it("redacts nested objects inside allowlisted keys", () => {
    const obj = { payload: { password: "x", pipeline_type: "chat" } };
    const out = redact(obj, "minimal") as { payload: Record<string, unknown> };
    expect(out.payload).not.toHaveProperty("password");
    expect(out.payload?.pipeline_type).toBe("chat");
  });

  it("returns empty object for null/undefined", () => {
    expect(redact(null)).toEqual({});
    expect(redact(undefined)).toEqual({});
  });
});

describe("redactString", () => {
  it("returns [REDACTED] for minimal and full", () => {
    expect(redactString("Bearer sk-xxx", "minimal")).toBe("[REDACTED]");
    expect(redactString("Bearer sk-xxx", "full")).toBe("[REDACTED]");
  });
  it("returns original for none", () => {
    expect(redactString("hello", "none")).toBe("hello");
  });
});
