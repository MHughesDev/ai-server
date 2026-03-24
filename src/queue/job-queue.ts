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

export class JobQueueService {
  private backend: QueueBackend;
  private config: JobQueueConfig;
  private workers: Map<string, AbortController> = new Map();
  private isRunning = false;
  private queryHandler: (request: IngressResult) => Promise<ResponseEnvelope>;
  private cleanupInterval?: NodeJS.Timeout;

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

  async submitJob(submission: JobSubmission): Promise<Job> {
    const job = await this.backend.submit({
      request: submission.request,
      webhook_url: submission.webhook_url,
      max_attempts: submission.max_attempts ?? this.config.max_retries,
      metadata: submission.metadata ?? {},
    });

    console.log(`[job-queue] Submitted job ${job.id}`);
    return job;
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
