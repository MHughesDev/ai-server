import { describe, it, expect, beforeEach, afterEach } from "@jest/globals";
import { jest } from "@jest/globals";
import { RequestDeadlineExceededError } from "./async-deadline.js";
import {
  PipelineDeadline,
  checkDeadlineBlocked,
  resolvePipelineDeadline,
} from "./pipeline-deadline.js";

describe("PipelineDeadline (PR-023)", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("passes through when deadline is unset", async () => {
    const deadline = PipelineDeadline.fromPlan(undefined);
    const value = await deadline.run(() => Promise.resolve(42));
    expect(value).toBe(42);
  });

  it("rejects when remaining budget is exhausted before a hop", async () => {
    const deadline = PipelineDeadline.fromPlan(50);
    jest.advanceTimersByTime(60);
    await expect(deadline.run(() => Promise.resolve("late"))).rejects.toBeInstanceOf(
      RequestDeadlineExceededError
    );
  });

  it("resolvePipelineDeadline prefers request_started_at_ms anchor (WANT-015)", () => {
    const anchor = 1_000_000;
    const local = anchor + 500;
    const deadline = resolvePipelineDeadline(100, anchor, local);
    jest.setSystemTime(anchor + 90);
    expect(deadline.isExceeded()).toBe(false);
    jest.setSystemTime(anchor + 110);
    expect(deadline.isExceeded()).toBe(true);
  });

  it("checkDeadlineBlocked returns DEADLINE_EXCEEDED envelope when budget exhausted", () => {
    const deadline = PipelineDeadline.fromPlan(50, 1_000);
    jest.setSystemTime(1_060);
    const blocked = checkDeadlineBlocked(deadline, {
      requestId: "req-1",
      pipelineType: "chat",
      tokensIn: 10,
    });
    expect(blocked?.status).toBe("error");
    expect(blocked?.error?.code).toBe("DEADLINE_EXCEEDED");
    expect(blocked?.telemetry?.latency_ms).toBe(60);
    expect(blocked?.telemetry?.tokens_in).toBe(10);
  });

  it("times out a hop that exceeds remaining budget", async () => {
    const deadline = PipelineDeadline.fromPlan(30);
    const pending = deadline.run(
      () => new Promise<string>((resolve) => setTimeout(() => resolve("ok"), 100))
    );
    const assertion = expect(pending).rejects.toBeInstanceOf(RequestDeadlineExceededError);
    jest.advanceTimersByTime(30);
    await assertion;
  });
});
