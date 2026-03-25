/**
 * Job queue idempotency (POST /v1/query/async semantics).
 */

import { jest } from "@jest/globals";
import { JobQueueService, IdempotencyKeyConflictError } from "./job-queue.js";
import { MemoryQueueBackend } from "./memory-backend.js";
import type { IngressResult } from "../ingress/types.js";
import type { ResponseEnvelope } from "../contracts/response-envelope.js";
import type { JobQueueConfig } from "./types.js";

const queueConfig: JobQueueConfig = {
  backend: "memory",
  workers: 1,
  max_retries: 3,
  retry_delays_ms: [1000],
  webhook_timeout_ms: 30000,
  webhook_retry_attempts: 3,
  job_timeout_ms: 60_000,
  cleanup_completed_after_hours: 24,
  cleanup_failed_after_hours: 168,
};

const stubResponse: ResponseEnvelope = {
  request_id: "550e8400-e29b-41d4-a716-446655440099",
  status: "ok",
  mode: "sync",
};

function makeIngress(text: string, requestId = "550e8400-e29b-41d4-a716-446655440000"): IngressResult {
  return {
    envelope: {
      request_id: requestId,
      caller: { app_id: "a", user_id: "u", org_id: "o", scopes: [] },
      input: { text, attachments: [] },
      preferences: { response_format: "text", verbosity: "medium", stream: false },
      contract_version: "v1",
    },
    callerContext: { appId: "a", userId: "u", orgId: "o", scopes: [] },
  };
}

describe("JobQueueService idempotency", () => {
  it("returns same job for duplicate key and same body fingerprint", async () => {
    const handler = jest.fn().mockResolvedValue(stubResponse);
    const svc = new JobQueueService(queueConfig, handler, new MemoryQueueBackend());
    const meta = { org_id: "o", app_id: "a", user_id: "u" };
    const fp = "same-fp";
    const j1 = await svc.submitJob({
      request: makeIngress("task"),
      metadata: meta,
      idempotency: { key: "k1", fingerprint: fp },
    });
    const j2 = await svc.submitJob({
      request: makeIngress("task"),
      metadata: meta,
      idempotency: { key: "k1", fingerprint: fp },
    });
    expect(j1.id).toBe(j2.id);
  });

  it("throws when key reused with different fingerprint after first job recorded", async () => {
    const handler = jest.fn().mockResolvedValue(stubResponse);
    const svc = new JobQueueService(queueConfig, handler, new MemoryQueueBackend());
    const meta = { org_id: "o", app_id: "a", user_id: "u" };
    await svc.submitJob({
      request: makeIngress("a"),
      metadata: meta,
      idempotency: { key: "k2", fingerprint: "fp-a" },
    });
    await expect(
      svc.submitJob({
        request: makeIngress("b"),
        metadata: meta,
        idempotency: { key: "k2", fingerprint: "fp-b" },
      })
    ).rejects.toBeInstanceOf(IdempotencyKeyConflictError);
  });

  it("scopes idempotency key by tenant metadata", async () => {
    const handler = jest.fn().mockResolvedValue(stubResponse);
    const svc = new JobQueueService(queueConfig, handler, new MemoryQueueBackend());
    const j1 = await svc.submitJob({
      request: makeIngress("x"),
      metadata: { org_id: "o1", app_id: "a", user_id: "u" },
      idempotency: { key: "k", fingerprint: "fp" },
    });
    const j2 = await svc.submitJob({
      request: makeIngress("x"),
      metadata: { org_id: "o2", app_id: "a", user_id: "u" },
      idempotency: { key: "k", fingerprint: "fp" },
    });
    expect(j1.id).not.toBe(j2.id);
  });

  it("merges concurrent duplicate submits into one job", async () => {
    const svc = new JobQueueService(
      queueConfig,
      () => Promise.resolve(stubResponse),
      new MemoryQueueBackend()
    );
    const meta = { org_id: "o", app_id: "a", user_id: "u" };
    const req = makeIngress("parallel");
    const fp = "fp-p";
    const [a, b] = await Promise.all([
      svc.submitJob({ request: req, metadata: meta, idempotency: { key: "pk", fingerprint: fp } }),
      svc.submitJob({ request: req, metadata: meta, idempotency: { key: "pk", fingerprint: fp } }),
    ]);
    expect(a.id).toBe(b.id);
  });

  it("rejects concurrent submit with same key but different fingerprint", async () => {
    const svc = new JobQueueService(
      queueConfig,
      () => Promise.resolve(stubResponse),
      new MemoryQueueBackend()
    );
    const meta = { org_id: "o", app_id: "a", user_id: "u" };
    const p1 = svc.submitJob({
      request: makeIngress("one"),
      metadata: meta,
      idempotency: { key: "same", fingerprint: "fp1" },
    });
    const p2 = svc.submitJob({
      request: makeIngress("two"),
      metadata: meta,
      idempotency: { key: "same", fingerprint: "fp2" },
    });
    const results = await Promise.allSettled([p1, p2]);
    const rejected = results.filter(
      (r): r is PromiseRejectedResult => r.status === "rejected"
    );
    expect(rejected.length).toBe(1);
    expect(rejected[0].reason).toBeInstanceOf(IdempotencyKeyConflictError);
  });
});
