/**
 * Event schema and taxonomy tests – L2-04 Phase 0
 */

import {
  REQUIRED_EVENT_TYPES,
  isRequiredEventType,
  validateTelemetryEvent,
  TelemetryEventSchema,
} from "./events.js";

describe("observability events", () => {
  it("defines all required event types from SPEC 18 and Architecture §13", () => {
    const expected = [
      "ROUTE_DECISION",
      "POLICY_DECISION",
      "BUDGET_ASSIGN",
      "PIPELINE_START",
      "PIPELINE_END",
      "WORKFLOW_START",
      "WORKFLOW_END",
      "ENGINE_START",
      "ENGINE_END",
      "TOOL_START",
      "TOOL_END",
      "MEMORY_QUERY",
      "MEMORY_WRITE",
      "VERIFY_RESULT",
      "FINAL_SYNTH",
      "ERROR",
      "HARNESS_ITERATION",
    ];
    expect(REQUIRED_EVENT_TYPES).toEqual(expected);
  });

  it("isRequiredEventType returns true for taxonomy values", () => {
    expect(isRequiredEventType("POLICY_DECISION")).toBe(true);
    expect(isRequiredEventType("ROUTE_DECISION")).toBe(true);
    expect(isRequiredEventType("ENGINE_START")).toBe(true);
    expect(isRequiredEventType("ENGINE_END")).toBe(true);
    expect(isRequiredEventType("ERROR")).toBe(true);
    expect(isRequiredEventType("HARNESS_ITERATION")).toBe(true);
    expect(isRequiredEventType("unknown")).toBe(false);
  });

  it("validates telemetry event with request_id and event_type", () => {
    const event = validateTelemetryEvent({
      event_type: "POLICY_DECISION",
      request_id: "550e8400-e29b-41d4-a716-446655440000",
      trace_id: "tr_abc",
      payload: { allowed: true },
    });
    expect(event.event_type).toBe("POLICY_DECISION");
    expect(event.request_id).toBe("550e8400-e29b-41d4-a716-446655440000");
    expect((event.payload as { allowed: boolean }).allowed).toBe(true);
  });

  it("throws when event_type or request_id missing", () => {
    expect(() =>
      validateTelemetryEvent({
        request_id: "550e8400-e29b-41d4-a716-446655440000",
      } as unknown)
    ).toThrow();
    expect(() =>
      validateTelemetryEvent({
        event_type: "POLICY_DECISION",
      } as unknown)
    ).toThrow();
  });

  it("parses valid base event with optional fields", () => {
    const parsed = TelemetryEventSchema.parse({
      event_type: "BUDGET_ASSIGN",
      request_id: "550e8400-e29b-41d4-a716-446655440000",
      trace_id: "tr_xyz",
      timestamp_iso: "2026-02-18T12:00:00.000Z",
      redaction_level: "minimal",
      payload: { token_budget: 4096 },
    });
    expect(parsed.redaction_level).toBe("minimal");
    expect((parsed.payload as { token_budget: number }).token_budget).toBe(4096);
  });
});
