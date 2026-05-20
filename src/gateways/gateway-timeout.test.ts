/**
 * Gateway timeout error mapping tests (WANT-027).
 */

import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals";
import {
  createGatewayTimeoutError,
  GATEWAY_TIMEOUT_SPEC,
  isGatewayTimeoutError,
  toolInvokeResultForGatewayTimeout,
} from "./gateway-timeout.js";
import { classifyGatewayTimeoutFailure } from "./gateway-timeout.js";
import { raceWithTimeout } from "../utils/race-with-timeout.js";

describe("GATEWAY_TIMEOUT_SPEC", () => {
  it("maps each scope to deterministic taxonomy codes", () => {
    expect(GATEWAY_TIMEOUT_SPEC.model).toEqual({
      code: "MODEL_FAILURE",
      retryable: true,
      message: "Model gateway timeout",
    });
    expect(GATEWAY_TIMEOUT_SPEC.tool).toEqual({
      code: "TOOL_TIMEOUT",
      retryable: true,
      message: "Tool execution timed out",
    });
    expect(GATEWAY_TIMEOUT_SPEC.job).toEqual({
      code: "TIMEOUT",
      retryable: true,
      message: "Job processing timed out",
    });
  });
});

describe("GatewayTimeoutError", () => {
  it("classifies model timeouts for retry wrapper", () => {
    const err = createGatewayTimeoutError("model");
    expect(classifyGatewayTimeoutFailure(err)).toEqual({
      code: "MODEL_FAILURE",
      retryable: true,
      message: "Model gateway timeout",
    });
  });

  it("maps tool timeouts to structured deny with taxonomy reason", () => {
    const err = createGatewayTimeoutError("tool");
    expect(toolInvokeResultForGatewayTimeout(err, "slow_tool")).toEqual({
      allowed: false,
      reason: "TOOL_TIMEOUT",
      message: "Tool execution timed out",
      tool_id: "slow_tool",
    });
  });
});

describe("raceWithTimeout + GatewayTimeoutError", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("rejects with the provided Error instance and clears timer (WANT-027)", async () => {
    const timeoutErr = createGatewayTimeoutError("job");
    const pending = raceWithTimeout(new Promise<string>(() => {}), 25, timeoutErr);
    const assertion = expect(pending).rejects.toBe(timeoutErr);
    jest.advanceTimersByTime(25);
    await assertion;
    expect(jest.getTimerCount()).toBe(0);
    expect(isGatewayTimeoutError(timeoutErr)).toBe(true);
    expect(timeoutErr.code).toBe("TIMEOUT");
  });
});
