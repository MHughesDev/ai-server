import { describe, it, expect, beforeEach, afterEach } from "@jest/globals";
import { jest } from "@jest/globals";
import { RequestDeadlineExceededError } from "./async-deadline.js";
import { PipelineDeadline } from "./pipeline-deadline.js";

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
