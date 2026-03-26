import { describe, it, expect } from "@jest/globals";
import { withDeadline, RequestDeadlineExceededError } from "./async-deadline.js";

describe("withDeadline", () => {
  it("returns resolved value when promise finishes first", async () => {
    const v = await withDeadline(Promise.resolve(42), 5000);
    expect(v).toBe(42);
  });

  it("passes through when deadlineMs is undefined or zero", async () => {
    expect(await withDeadline(Promise.resolve("a"), undefined)).toBe("a");
    expect(await withDeadline(Promise.resolve("b"), 0)).toBe("b");
  });

  it("rejects with RequestDeadlineExceededError when time elapses first", async () => {
    await expect(
      withDeadline(new Promise(() => {}), 20)
    ).rejects.toMatchObject({
      name: "RequestDeadlineExceededError",
      deadlineMs: 20,
    });
    await expect(withDeadline(new Promise(() => {}), 20)).rejects.toBeInstanceOf(
      RequestDeadlineExceededError
    );
  });
});
