/**
 * Redaction utility tests – L2-04 Phase 0
 */

import { redact, redactString, safeLogError } from "./redact.js";

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

  it("strips OAuth-style keys at none level", () => {
    const obj = {
      request_id: "r",
      client_secret: "cs",
      access_token: "at",
      refresh_token: "rt",
    };
    const out = redact(obj, "none");
    expect(out.request_id).toBe("r");
    expect(out).not.toHaveProperty("client_secret");
    expect(out).not.toHaveProperty("access_token");
    expect(out).not.toHaveProperty("refresh_token");
  });

  it("keeps primitive array elements (no spurious { value } wrappers)", () => {
    const obj = { org_id: "o1", patterns: ["p1", "p2"] };
    expect(redact(obj, "none")).toEqual({ org_id: "o1", patterns: ["p1", "p2"] });
    const nested = { payload: { tags: ["a", "b"], password: "x" } };
    const outMin = redact(nested, "minimal") as { payload: Record<string, unknown> };
    expect(outMin.payload.tags).toEqual(["a", "b"]);
    expect(outMin.payload).not.toHaveProperty("password");
  });

  it("redacts non-empty strings inside arrays at full level inside payload", () => {
    const obj = { payload: { tags: ["hello", "world"] } };
    const out = redact(obj, "full") as { payload: { tags: unknown[] } };
    expect(out.payload.tags).toEqual(["[REDACTED]", "[REDACTED]"]);
  });
});

describe("safeLogError", () => {
  it("returns Error.message only (no stack)", () => {
    const e = new Error("nope");
    e.stack = "should not appear";
    expect(safeLogError(e)).toBe("nope");
  });

  it("stringifies non-Error values", () => {
    expect(safeLogError("plain")).toBe("plain");
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
