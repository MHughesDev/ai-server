/**
 * L2-04 Phase 4: Final observability acceptance suite.
 * Validates event taxonomy, redaction, trace context, metrics, and eval regression.
 * Run with: npm test -- --testPathPattern=observability-acceptance
 */

import { bootstrap } from "../bootstrap/index.js";
import { validateIngress } from "../ingress/validate.js";
import { handleQuery } from "../server/query-handler.js";
import {
  setObservability,
  createEmitter,
  getTraceContext,
  createContext,
  runWithContextAsync,
  payloadHasSensitiveKeys,
  type TelemetryEvent,
} from "./index.js";
import { resetMetrics, getCounterSnapshot, getHistogramSnapshot, METRIC_REQUESTS_TOTAL } from "./metrics.js";
import { runEvalHarness } from "../eval/runner.js";
import type { EvalCase } from "../eval/types.js";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));

const REQUIRED_LIFECYCLE_EVENTS = [
  "POLICY_DECISION",
  "BUDGET_ASSIGN",
  "ROUTE_DECISION",
  "PIPELINE_START",
  "PIPELINE_END",
  "FINAL_SYNTH",
];

/** Event order for span hierarchy: pipeline → workflow → engines */
const LIFECYCLE_ORDER = [
  "POLICY_DECISION",
  "BUDGET_ASSIGN",
  "ROUTE_DECISION",
  "PIPELINE_START",
  "WORKFLOW_START",
  "ENGINE_START",
  "ENGINE_END",
  "ENGINE_START",
  "ENGINE_END",
  "WORKFLOW_END",
  "PIPELINE_END",
  "FINAL_SYNTH",
];

const validEnvelope = {
  request_id: "550e8400-e29b-41d4-a716-446655440000",
  caller: { app_id: "a1", user_id: "u1", org_id: "o1", scopes: [] as string[] },
  input: { text: "Hello", attachments: [] as unknown[] },
  preferences: { response_format: "text" as const, verbosity: "medium" as const, stream: false },
  contract_version: "v1",
};

describe("L2-04 Observability Acceptance Suite", () => {
  beforeAll(() => {
    try {
      bootstrap();
    } catch {
      // already bootstrapped
    }
  });

  describe("event taxonomy and lifecycle", () => {
    it("emits required governance and lifecycle events for a successful query", async () => {
      const captured: TelemetryEvent[] = [];
      const emitter = createEmitter({ capture: captured, redactionLevel: "minimal" });
      setObservability({ events: emitter, getContext: getTraceContext });

      const ingressResult = validateIngress(validEnvelope, {
        maxBodyBytes: 1_000_000,
        contractVersion: "v1",
      });
      await handleQuery(ingressResult);

      const eventTypes = captured.map((e) => e.event_type);
      for (const required of REQUIRED_LIFECYCLE_EVENTS) {
        expect(eventTypes).toContain(required);
      }
    });

    it("every emitted event has request_id and trace_id when context is set", async () => {
      const captured: TelemetryEvent[] = [];
      const emitter = createEmitter({ capture: captured, redactionLevel: "minimal" });
      setObservability({ events: emitter, getContext: getTraceContext });

      const ingressResult = validateIngress(validEnvelope, {
        maxBodyBytes: 1_000_000,
        contractVersion: "v1",
      });
      await handleQuery(ingressResult);

      for (const event of captured) {
        expect(event.request_id).toBeDefined();
        expect(event.request_id).toBe(validEnvelope.request_id);
        expect(event.trace_id).toBeDefined();
      }
    });

    it("event order reflects span hierarchy (pipeline → workflow → engines)", async () => {
      const captured: TelemetryEvent[] = [];
      const emitter = createEmitter({ capture: captured, redactionLevel: "minimal" });
      setObservability({ events: emitter, getContext: getTraceContext });

      const ingressResult = validateIngress(validEnvelope, {
        maxBodyBytes: 1_000_000,
        contractVersion: "v1",
      });
      await handleQuery(ingressResult);

      const eventTypes = captured.map((e) => e.event_type);
      let lastIndex = -1;
      for (const expectedType of LIFECYCLE_ORDER) {
        const idx = eventTypes.indexOf(expectedType, lastIndex + 1);
        expect(idx).toBeGreaterThan(lastIndex);
        lastIndex = idx;
      }
    });
  });

  describe("redaction", () => {
    it("redacted payloads do not contain sensitive keys", async () => {
      const captured: TelemetryEvent[] = [];
      const emitter = createEmitter({ capture: captured, redactionLevel: "minimal" });
      setObservability({ events: emitter, getContext: getTraceContext });

      const ingressResult = validateIngress(validEnvelope, {
        maxBodyBytes: 1_000_000,
        contractVersion: "v1",
      });
      await handleQuery(ingressResult);

      for (const event of captured) {
        if (event.payload && typeof event.payload === "object") {
          expect(payloadHasSensitiveKeys(event.payload)).toBe(false);
        }
      }
    });
  });

  describe("metrics", () => {
    it("increments request and latency metrics after a successful query", async () => {
      resetMetrics();
      const captured: TelemetryEvent[] = [];
      const emitter = createEmitter({ capture: captured });
      setObservability({ events: emitter, getContext: getTraceContext });

      const ingressResult = validateIngress(validEnvelope, {
        maxBodyBytes: 1_000_000,
        contractVersion: "v1",
      });
      await handleQuery(ingressResult);

      const counters = getCounterSnapshot();
      const histograms = getHistogramSnapshot();
      const hasRequestMetric =
        Object.keys(counters).some((k) => k.startsWith(METRIC_REQUESTS_TOTAL)) ||
        Object.keys(histograms).length > 0;
      expect(hasRequestMetric).toBe(true);
    });
  });

  describe("eval regression", () => {
    it("baseline gold dataset passes eval harness", async () => {
      const baselinePath = resolve(__dirname, "../eval/baseline.json");
      const baselineRaw = readFileSync(baselinePath, "utf-8");
      const cases: EvalCase[] = JSON.parse(baselineRaw);
      const result = await runEvalHarness(cases);
      expect(result.total).toBeGreaterThan(0);
      expect(result.results).toHaveLength(result.total);
      expect(result.passed + result.failed).toBe(result.total);
      expect(result.passed).toBe(result.total);
    });
  });

  describe("trace context propagation", () => {
    it("getTraceContext returns context inside runWithContextAsync", async () => {
      const ctx = createContext("req-acceptance", "trace-acceptance");
      let received: ReturnType<typeof getTraceContext> = undefined;
      await runWithContextAsync(ctx, async () => {
        await Promise.resolve();
        received = getTraceContext();
      });
      expect(received?.request_id).toBe("req-acceptance");
      expect(received?.trace_id).toBe("trace-acceptance");
    });
  });
});
