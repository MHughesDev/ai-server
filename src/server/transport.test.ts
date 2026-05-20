import { describe, it, expect } from "@jest/globals";
import { RequestQueue } from "./transport.js";

describe("RequestQueue backpressure (PR-021)", () => {
  it("rejects acquire when concurrent and queue depth are exhausted", async () => {
    const queue = new RequestQueue({ maxConcurrent: 1, maxQueueDepth: 0 });
    const first = await queue.acquire();
    expect(first).not.toBeNull();
    const second = await queue.acquire();
    expect(second).toBeNull();
    first?.();
    const third = await queue.acquire();
    expect(third).not.toBeNull();
    third?.();
  });

  it("queues waiting acquires when under concurrent cap", async () => {
    const queue = new RequestQueue({ maxConcurrent: 1, maxQueueDepth: 1 });
    const first = await queue.acquire();
    expect(first).not.toBeNull();
    const waiting = queue.acquire();
    const rejected = await queue.acquire();
    expect(rejected).toBeNull();
    first?.();
    const release = await waiting;
    expect(release).not.toBeNull();
    release?.();
  });
});
