/**
 * In-Memory Job Queue Backend
 * Gap 3A: Async Mode Implementation
 * For development and single-instance deployments
 */

import type { Job, JobStatus, QueueBackend } from "./types.js";

export class MemoryQueueBackend implements QueueBackend {
  private jobs = new Map<string, Job>();
  private pendingQueue: string[] = [];
  private processing = new Set<string>();
  private sequenceId = 0;

  submit(jobData: Omit<Job, "id" | "created_at" | "status" | "attempts">): Promise<Job> {
    this.sequenceId++;
    const jobId = `job-${Date.now()}-${this.sequenceId}`;
    const now = new Date().toISOString();

    const job: Job = {
      ...jobData,
      id: jobId,
      status: "pending",
      attempts: 0,
      created_at: now,
      max_attempts: jobData.max_attempts ?? 3,
    };

    this.jobs.set(jobId, job);
    this.pendingQueue.push(jobId);

    return Promise.resolve({ ...job });
  }

  get(jobId: string): Promise<Job | null> {
    const job = this.jobs.get(jobId);
    return Promise.resolve(job ? { ...job } : null);
  }

  update(jobId: string, updates: Partial<Job>): Promise<Job | null> {
    const job = this.jobs.get(jobId);
    if (!job) return Promise.resolve(null);

    const updated = { ...job, ...updates };
    this.jobs.set(jobId, updated);
    return Promise.resolve({ ...updated });
  }

  cancel(jobId: string): Promise<boolean> {
    const job = this.jobs.get(jobId);
    if (!job) return Promise.resolve(false);

    if (job.status === "completed" || job.status === "failed" || job.status === "cancelled") {
      return Promise.resolve(false);
    }

    // Remove from pending queue if present
    const queueIndex = this.pendingQueue.indexOf(jobId);
    if (queueIndex !== -1) {
      this.pendingQueue.splice(queueIndex, 1);
    }

    // Remove from processing set if present
    this.processing.delete(jobId);

    job.status = "cancelled";
    job.completed_at = new Date().toISOString();
    return Promise.resolve(true);
  }

  list(options: {
    status?: JobStatus;
    org_id?: string;
    app_id?: string;
    user_id?: string;
    limit?: number;
    offset?: number;
  }): Promise<Job[]> {
    let jobs = Array.from(this.jobs.values());

    if (options.status) {
      jobs = jobs.filter(j => j.status === options.status);
    }
    if (options.org_id) {
      jobs = jobs.filter(j => j.metadata?.org_id === options.org_id);
    }
    if (options.app_id) {
      jobs = jobs.filter(j => j.metadata?.app_id === options.app_id);
    }
    if (options.user_id) {
      jobs = jobs.filter(j => j.metadata?.user_id === options.user_id);
    }

    // Sort by created_at descending
    jobs.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    const offset = options.offset ?? 0;
    const limit = options.limit ?? 100;

    return Promise.resolve(jobs.slice(offset, offset + limit).map(j => ({ ...j })));
  }

  claimForProcessing(_workerId: string): Promise<Job | null> {
    while (this.pendingQueue.length > 0) {
      const jobId = this.pendingQueue.shift()!;
      const job = this.jobs.get(jobId);

      if (!job) continue;
      if (job.status !== "pending") continue;

      job.status = "processing";
      job.started_at = new Date().toISOString();
      job.attempts++;
      this.processing.add(jobId);

      return Promise.resolve({ ...job });
    }
    return Promise.resolve(null);
  }

  complete(jobId: string, result: Job["response"]): Promise<void> {
    const job = this.jobs.get(jobId);
    if (!job) throw new Error(`Job ${jobId} not found`);

    job.status = "completed";
    job.response = result;
    job.completed_at = new Date().toISOString();
    this.processing.delete(jobId);
    return Promise.resolve();
  }

  fail(jobId: string, error: Job["error"]): Promise<void> {
    const job = this.jobs.get(jobId);
    if (!job) throw new Error(`Job ${jobId} not found`);

    job.error = error;
    this.processing.delete(jobId);

    if (job.attempts < job.max_attempts) {
      // Retry: put back in pending queue
      job.status = "pending";
      this.pendingQueue.push(jobId);
    } else {
      job.status = "failed";
      job.completed_at = new Date().toISOString();
    }
    return Promise.resolve();
  }

  cleanup(): Promise<{ completed: number; failed: number }> {
    const now = new Date();
    let completed = 0;
    let failed = 0;

    for (const [jobId, job] of this.jobs.entries()) {
      if (job.status === "completed" && job.completed_at) {
        const age = now.getTime() - new Date(job.completed_at).getTime();
        if (age > 24 * 60 * 60 * 1000) { // 24 hours
          this.jobs.delete(jobId);
          completed++;
        }
      }
      if (job.status === "failed" && job.completed_at) {
        const age = now.getTime() - new Date(job.completed_at).getTime();
        if (age > 7 * 24 * 60 * 60 * 1000) { // 7 days
          this.jobs.delete(jobId);
          failed++;
        }
      }
    }

    return Promise.resolve({ completed, failed });
  }

  // For testing
  reset(): void {
    this.jobs.clear();
    this.pendingQueue = [];
    this.processing.clear();
    this.sequenceId = 0;
  }
}
