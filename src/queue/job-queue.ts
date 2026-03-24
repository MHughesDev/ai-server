/**
 * Job Queue Service
 * Gap 3A: Async Mode Implementation
 * Manages async job processing with multiple backend support
 */

import type { ResponseEnvelope } from "../contracts/response-envelope.js";
import type { Config } from "../config/schema.js";
import type { IngressResult } from "../ingress/types.js";
import type {
  Job,
  JobStatus,
  JobSubmission,
  JobResult,
  QueueBackend,
  JobQueueConfig,
  WebhookPayload,
} from "./types.js";
import { MemoryQueueBackend } from "./memory-backend.js";
import { idempotencyCompositeKey } from "./async-idempotency.js";

/** Same key + tenant scope but different request fingerprint (async path only). */
export class IdempotencyKeyConflictError extends Error {
  constructor() {
    super("Idempotency-Key reused with different request body for this tenant scope");
    this.name = "IdempotencyKeyConflictError";
  }
}

export class JobQueueService {
  private backend: QueueBackend;
  private config: JobQueueConfig;
  private workers: Map<string, AbortController> = new Map();
  private isRunning = false;
  private queryHandler: (request: IngressResult) => Promise<ResponseEnvelope>;
  private cleanupInterval?: NodeJS.Timeout;
  /** In-flight async submits keyed by tenant + Idempotency-Key */
  private idempotencyInflight = new Map<string, { fingerprint: string; promise: Promise<Job> }>();
  /** Completed idempotency slots for replay (TTL-pruned) */
  private idempotencyDone = new Map<
    string,
    { jobId: string; fingerprint: string; createdAtMs: number }
  >();
  private static readonly IDEMPOTENCY_DONE_TTL_MS = 24 * 60 * 60 * 1000;

  constructor(
    config: JobQueueConfig,
    queryHandler: (request: IngressResult) => Promise<ResponseEnvelope>,
    backend?: QueueBackend
  ) {
    this.config = config;
    this.queryHandler = queryHandler;
    this.backend = backend ?? new MemoryQueueBackend();
  }

  start(): Promise<void> {
    if (this.isRunning) return Promise.resolve();
    this.isRunning = true;

    // Start workers
    for (let i = 0; i < this.config.workers; i++) {
      this.startWorker(`worker-${i}`);
    }

    // Start cleanup interval
    this.cleanupInterval = setInterval(() => {
      void this.backend.cleanup();
    }, 60 * 60 * 1000); // Every hour

    console.log(`[job-queue] Started ${this.config.workers} workers`);
    return Promise.resolve();
  }

  stop(): Promise<void> {
    this.isRunning = false;

    // Stop all workers
    for (const [workerId, controller] of this.workers.entries()) {
      controller.abort();
      this.workers.delete(workerId);
    }

    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }

    console.log("[job-queue] Stopped all workers");
    return Promise.resolve();
  }

  private startWorker(workerId: string): void {
    const controller = new AbortController();
    this.workers.set(workerId, controller);

    const processLoop = async () => {
      while (this.isRunning && !controller.signal.aborted) {
        try {
          const job = await this.backend.claimForProcessing(workerId);
          if (!job) {
            // No jobs available, wait before checking again
            await sleep(1000);
            continue;
          }

          console.log(`[job-queue] Worker ${workerId} processing job ${job.id}`);

          try {
            // Process the job with timeout
            const result = await Promise.race([
              this.queryHandler(job.request),
              createTimeout(this.config.job_timeout_ms),
            ]);

            await this.backend.complete(job.id, result);
            console.log(`[job-queue] Job ${job.id} completed`);

            // Send webhook if configured
            if (job.webhook_url) {
              void this.sendWebhook(job, result, undefined);
            }
          } catch (err) {
            const error = {
              code: "JOB_PROCESSING_ERROR",
              message: err instanceof Error ? err.message : String(err),
              detail: err instanceof Error ? { stack: err.stack } : undefined,
            };

            await this.backend.fail(job.id, error);
            console.error(`[job-queue] Job ${job.id} failed:`, error.message);

            // Send webhook for failure
            if (job.webhook_url) {
              void this.sendWebhook(job, undefined, error);
            }
          }
        } catch (err) {
          console.error(`[job-queue] Worker ${workerId} error:`, err);
          await sleep(5000); // Wait longer on error
        }
      }
    };

    void processLoop();
  }

  private async sendWebhook(
    job: Job,
    result?: ResponseEnvelope,
    error?: { code: string; message: string; detail?: Record<string, unknown> }
  ): Promise<void> {
    if (!job.webhook_url) return;

    const payload: WebhookPayload = {
      job_id: job.id,
      status: error ? "failed" : "completed",
      result,
      error,
      timestamp: new Date().toISOString(),
      attempts: job.attempts,
      metadata: job.metadata,
    };

    for (let attempt = 0; attempt < this.config.webhook_retry_attempts; attempt++) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), this.config.webhook_timeout_ms);

        const response = await fetch(job.webhook_url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Job-ID": job.id,
            "X-Webhook-Attempt": String(attempt + 1),
          },
          body: JSON.stringify(payload),
          signal: controller.signal,
        });

        clearTimeout(timeout);

        if (response.ok) {
          console.log(`[job-queue] Webhook sent for job ${job.id}`);
          return;
        }

        throw new Error(`HTTP ${response.status}`);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        console.warn(`[job-queue] Webhook attempt ${attempt + 1} failed:`, errorMessage);

        if (attempt < this.config.webhook_retry_attempts - 1) {
          await sleep(Math.pow(2, attempt) * 1000); // Exponential backoff
        }
      }
    }

    console.error(`[job-queue] All webhook attempts failed for job ${job.id}`);
  }

  // Public API methods

  private pruneIdempotencyDone(): void {
    const cutoff = Date.now() - JobQueueService.IDEMPOTENCY_DONE_TTL_MS;
    for (const [k, v] of this.idempotencyDone) {
      if (v.createdAtMs < cutoff) this.idempotencyDone.delete(k);
    }
  }

  async submitJob(submission: JobSubmission): Promise<Job> {
    const idem = submission.idempotency;
    if (!idem) {
      const job = await this.backend.submit({
        request: submission.request,
        webhook_url: submission.webhook_url,
        max_attempts: submission.max_attempts ?? this.config.max_retries,
        metadata: submission.metadata ?? {},
      });
      console.log(`[job-queue] Submitted job ${job.id}`);
      return job;
    }

    this.pruneIdempotencyDone();
    const composite = idempotencyCompositeKey(submission.metadata, idem.key);

    const inflight = this.idempotencyInflight.get(composite);
    if (inflight) {
      if (inflight.fingerprint !== idem.fingerprint) {
        throw new IdempotencyKeyConflictError();
      }
      return inflight.promise;
    }

    const done = this.idempotencyDone.get(composite);
    if (done) {
      if (done.fingerprint !== idem.fingerprint) {
        throw new IdempotencyKeyConflictError();
      }
      const existing = await this.backend.get(done.jobId);
      if (existing) {
        return { ...existing };
      }
      this.idempotencyDone.delete(composite);
    }

    const promise = this.backend
      .submit({
        request: submission.request,
        webhook_url: submission.webhook_url,
        max_attempts: submission.max_attempts ?? this.config.max_retries,
        metadata: submission.metadata ?? {},
      })
      .then(job => {
        this.idempotencyDone.set(composite, {
          jobId: job.id,
          fingerprint: idem.fingerprint,
          createdAtMs: Date.now(),
        });
        console.log(`[job-queue] Submitted job ${job.id}`);
        return job;
      })
      .finally(() => {
        this.idempotencyInflight.delete(composite);
      });

    this.idempotencyInflight.set(composite, { fingerprint: idem.fingerprint, promise });
    return promise;
  }

  async getJob(jobId: string): Promise<JobResult | null> {
    const job = await this.backend.get(jobId);
    if (!job) return null;

    return {
      job_id: job.id,
      status: job.status,
      response: job.response,
      error: job.error,
      created_at: job.created_at,
      started_at: job.started_at,
      completed_at: job.completed_at,
      attempts: job.attempts,
    };
  }

  async cancelJob(jobId: string): Promise<boolean> {
    return this.backend.cancel(jobId);
  }

  async listJobs(options: {
    status?: JobStatus;
    org_id?: string;
    app_id?: string;
    user_id?: string;
    limit?: number;
    offset?: number;
  }): Promise<JobResult[]> {
    const jobs = await this.backend.list(options);
    return jobs.map(job => ({
      job_id: job.id,
      status: job.status,
      response: job.response,
      error: job.error,
      created_at: job.created_at,
      started_at: job.started_at,
      completed_at: job.completed_at,
      attempts: job.attempts,
    }));
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function createTimeout(ms: number): Promise<never> {
  return new Promise((_, reject) => {
    setTimeout(() => reject(new Error("Job timeout")), ms);
  });
}

// Factory function
export function createJobQueueService(
  _config: Config,
  queryHandler: (request: IngressResult) => Promise<ResponseEnvelope>
): JobQueueService | null {
  // Only enable if explicitly configured
  if (!process.env.QUEUE_WORKERS_COUNT) {
    return null;
  }

  const queueConfig: JobQueueConfig = {
    backend: (process.env.QUEUE_BACKEND as JobQueueConfig["backend"]) ?? "memory",
    workers: parseInt(process.env.QUEUE_WORKERS_COUNT, 10) || 2,
    max_retries: parseInt(process.env.QUEUE_MAX_RETRIES ?? "3", 10),
    retry_delays_ms: [1000, 2000, 4000],
    webhook_timeout_ms: parseInt(process.env.QUEUE_WEBHOOK_TIMEOUT_MS ?? "30000", 10),
    webhook_retry_attempts: parseInt(process.env.QUEUE_WEBHOOK_RETRY_ATTEMPTS ?? "3", 10),
    job_timeout_ms: parseInt(process.env.QUEUE_JOB_TIMEOUT_MS ?? "300000", 10), // 5 minutes
    cleanup_completed_after_hours: parseInt(process.env.QUEUE_CLEANUP_COMPLETED_HOURS ?? "24", 10),
    cleanup_failed_after_hours: parseInt(process.env.QUEUE_CLEANUP_FAILED_HOURS ?? "168", 10), // 7 days
  };

  return new JobQueueService(queueConfig, queryHandler);
}
