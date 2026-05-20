import { describe, it, expect, beforeEach, afterEach } from "@jest/globals";
import { jest } from "@jest/globals";
import { raceWithTimeout } from "./race-with-timeout.js";

describe("raceWithTimeout (PR-020)", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("resolves when the promise finishes first and clears the timeout timer", async () => {
    const result = await raceWithTimeout(Promise.resolve("ok"), 1_000, "timed out");
    expect(result).toBe("ok");
    expect(jest.getTimerCount()).toBe(0);
  });

  it("rejects with the timeout message when the timer elapses first", async () => {
    const pending = raceWithTimeout(new Promise<string>(() => {}), 50, "gateway timeout");
    const assertion = expect(pending).rejects.toThrow("gateway timeout");
    jest.advanceTimersByTime(50);
    await assertion;
    expect(jest.getTimerCount()).toBe(0);
  });

  it("passes through when ms is zero or negative", async () => {
    await expect(raceWithTimeout(Promise.resolve(7), 0)).resolves.toBe(7);
    await expect(raceWithTimeout(Promise.resolve(8), -1)).resolves.toBe(8);
    expect(jest.getTimerCount()).toBe(0);
  });
});
