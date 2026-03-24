/**
 * Async Job Queue Types
 * Gap 3A: Async Mode Implementation
 * Provides job queue abstractions for async query processing
 */

import type { IngressResult } from "../ingress/types.js";
import type { ResponseEnvelope } from "../contracts/response-envelope.js";

export type JobStatus =
  | "pending"
  | "processing"
  | "completed"
  | "failed"
  | "cancelled"
  | "timeout";

export interface Job {
  id: string;
  status: JobStatus;
  request: IngressResult;
  response?: ResponseEnvelope;
  error?: {
    code: string;
    message: string;
    detail?: Record<string, unknown>;
  };
  created_at: string;
  started_at?: string;
  completed_at?: string;
  attempts: number;
  max_attempts: number;
  webhook_url?: string;
  metadata: {
    org_id?: string;
    app_id?: string;
    user_id?: string;
    trace_id?: string;
  };
}

export interface JobSubmission {
  request: IngressResult;
  webhook_url?: string;
  max_attempts?: number;
  priority?: number;
  metadata?: {
    org_id?: string;
    app_id?: string;
    user_id?: string;
    trace_id?: string;
  };
  /**
   * When set (from Idempotency-Key on POST /v1/query/async), duplicate submits with the same
   * tenant scope + key + body fingerprint return the same job; mismatched body → conflict.
   */
  idempotency?: {
    key: string;
    fingerprint: string;
  };
}

export interface JobResult {
  job_id: string;
  status: JobStatus;
  response?: ResponseEnvelope;
  error?: {
    code: string;
    message: string;
    detail?: Record<string, unknown>;
  };
  created_at: string;
  started_at?: string;
  completed_at?: string;
  attempts: number;
}

export interface JobQueueConfig {
  backend: "memory" | "redis" | "postgres";
  workers: number;
  max_retries: number;
  retry_delays_ms: number[];
  webhook_timeout_ms: number;
  webhook_retry_attempts: number;
  job_timeout_ms: number;
  cleanup_completed_after_hours: number;
  cleanup_failed_after_hours: number;
}

export interface QueueBackend {
  submit(job: Omit<Job, "id" | "created_at" | "status" | "attempts">): Promise<Job>;
  get(jobId: string): Promise<Job | null>;
  update(jobId: string, updates: Partial<Job>): Promise<Job | null>;
  cancel(jobId: string): Promise<boolean>;
  list(options: {
    status?: JobStatus;
    org_id?: string;
    app_id?: string;
    user_id?: string;
    limit?: number;
    offset?: number;
  }): Promise<Job[]>;
  claimForProcessing(workerId: string): Promise<Job | null>;
  complete(jobId: string, result: ResponseEnvelope): Promise<void>;
  fail(jobId: string, error: Job["error"]): Promise<void>;
  cleanup(): Promise<{ completed: number; failed: number }>;
}

export interface WebhookPayload {
  job_id: string;
  status: JobStatus;
  result?: ResponseEnvelope;
  error?: Job["error"];
  timestamp: string;
  attempts: number;
  metadata?: Job["metadata"];
}
