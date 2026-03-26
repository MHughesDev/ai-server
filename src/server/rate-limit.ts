/**
 * Ingress rate limiting – deterministic fixed-window limiter with Redis and in-memory backends.
 * L2-05: Shared backend rate limiting (Redis) for multi-instance consistency.
 */

import type { IncomingMessage, ServerResponse } from "node:http";
import type { IngressRateLimitConfig } from "../config/schema.js";
import { getErrorMeta } from "../contracts/errors.js";
import type { IngressRejection } from "../ingress/errors.js";
import type { CallerContext } from "../ingress/types.js";
import { safeLogError } from "../observability/redact.js";

interface BucketState {
  windowStartMs: number;
  count: number;
}

export interface RateLimitDecision {
  allowed: boolean;
  limit: number;
  remaining: number;
  windowMs: number;
  retryAfterMs: number;
}

/** Rate limit backend interface for pluggable implementations (memory, Redis, etc.) */
export interface RateLimitBackend {
  consume(key: string, nowMs: number, maxRequests: number, windowMs: number): Promise<RateLimitDecision> | RateLimitDecision;
}

class FixedWindowRateLimiter implements RateLimitBackend {
  private readonly buckets = new Map<string, BucketState>();

  private lastPruneAtMs = 0;

  constructor(
    private readonly maxRequests: number,
    private readonly windowMs: number
  ) {}

  consume(key: string, nowMs: number): RateLimitDecision {
    if (this.maxRequests <= 0) {
      return {
        allowed: true,
        limit: 0,
        remaining: Number.MAX_SAFE_INTEGER,
        windowMs: this.windowMs,
        retryAfterMs: 0,
      };
    }
    this.prune(nowMs);
    const windowStartMs = nowMs - (nowMs % this.windowMs);
    const existing = this.buckets.get(key);
    if (!existing || existing.windowStartMs !== windowStartMs) {
      this.buckets.set(key, { windowStartMs, count: 1 });
      return {
        allowed: true,
        limit: this.maxRequests,
        remaining: Math.max(0, this.maxRequests - 1),
        windowMs: this.windowMs,
        retryAfterMs: 0,
      };
    }
    if (existing.count >= this.maxRequests) {
      return {
        allowed: false,
        limit: this.maxRequests,
        remaining: 0,
        windowMs: this.windowMs,
        retryAfterMs: Math.max(0, existing.windowStartMs + this.windowMs - nowMs),
      };
    }
    existing.count += 1;
    return {
      allowed: true,
      limit: this.maxRequests,
      remaining: Math.max(0, this.maxRequests - existing.count),
      windowMs: this.windowMs,
      retryAfterMs: 0,
    };
  }

  private prune(nowMs: number): void {
    if (nowMs - this.lastPruneAtMs < this.windowMs) return;
    this.lastPruneAtMs = nowMs;
    for (const [key, bucket] of this.buckets.entries()) {
      if (bucket.windowStartMs + this.windowMs <= nowMs) {
        this.buckets.delete(key);
      }
    }
  }
}

/** Simple Redis-like backend interface for rate limiting */
export interface RedisLikeClient {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, options?: { px?: number }): Promise<void>;
  incr(key: string): Promise<number>;
}

/**
 * Redis-backed fixed window rate limiter for multi-instance consistency.
 * Uses atomic INCR and key expiration for window management.
 */
class RedisFixedWindowRateLimiter implements RateLimitBackend {
  constructor(
    private readonly redis: RedisLikeClient,
    private readonly maxRequests: number,
    private readonly windowMs: number,
    private readonly keyPrefix = "ratelimit"
  ) {}

  async consume(key: string, nowMs: number): Promise<RateLimitDecision> {
    if (this.maxRequests <= 0) {
      return {
        allowed: true,
        limit: 0,
        remaining: Number.MAX_SAFE_INTEGER,
        windowMs: this.windowMs,
        retryAfterMs: 0,
      };
    }

    const windowStartMs = nowMs - (nowMs % this.windowMs);
    const redisKey = `${this.keyPrefix}:${key}:${windowStartMs}`;
    const ttlMs = this.windowMs + 1000; // Add buffer for clock skew

    try {
      const count = await this.redis.incr(redisKey);

      // If this is the first request in the window, set expiration
      if (count === 1) {
        await this.redis.set(redisKey, "1", { px: ttlMs });
      }

      const remaining = Math.max(0, this.maxRequests - count);
      const allowed = count <= this.maxRequests;
      const retryAfterMs = allowed ? 0 : Math.max(0, windowStartMs + this.windowMs - nowMs);

      return {
        allowed,
        limit: this.maxRequests,
        remaining,
        windowMs: this.windowMs,
        retryAfterMs,
      };
    } catch (err) {
      // Fail open: if Redis fails, allow the request
      console.error("[rate-limit] Redis error, failing open:", safeLogError(err));
      return {
        allowed: true,
        limit: this.maxRequests,
        remaining: 0,
        windowMs: this.windowMs,
        retryAfterMs: 0,
      };
    }
  }
}

let limiterConfigSignature = "";
let limiter: RateLimitBackend | undefined;
let redisClient: RedisLikeClient | undefined;

/**
 * Configure Redis client for distributed rate limiting.
 * Must be called before getLimiter() to use Redis backend.
 */
export function setRedisClient(client: RedisLikeClient | undefined): void {
  redisClient = client;
  // Reset limiter so next call creates new one with Redis
  limiter = undefined;
  limiterConfigSignature = "";
}

export function getRedisClient(): RedisLikeClient | undefined {
  return redisClient;
}

function getLimiter(config: IngressRateLimitConfig): RateLimitBackend {
  const signature = `${config.max_requests}:${config.window_ms}:${redisClient ? "redis" : "memory"}`;
  if (!limiter || limiterConfigSignature !== signature) {
    if (redisClient) {
      limiter = new RedisFixedWindowRateLimiter(redisClient, config.max_requests, config.window_ms);
    } else {
      limiter = new FixedWindowRateLimiter(config.max_requests, config.window_ms);
    }
    limiterConfigSignature = signature;
  }
  return limiter;
}

export function resetQueryRateLimiterForTest(): void {
  limiter = undefined;
  limiterConfigSignature = "";
  redisClient = undefined;
}

export function buildRateLimitKey(
  callerContext: CallerContext,
  remoteAddress: string | undefined
): string {
  const remote = remoteAddress?.trim() || "unknown";
  return `${callerContext.orgId}:${callerContext.appId}:${callerContext.userId}:${remote}`;
}

export function checkQueryRateLimit(
  config: IngressRateLimitConfig,
  callerContext: CallerContext,
  remoteAddress: string | undefined,
  nowMs: number = Date.now()
): RateLimitDecision {
  const key = buildRateLimitKey(callerContext, remoteAddress);
  const backend = getLimiter(config);
  const result = backend.consume(key, nowMs, config.max_requests, config.window_ms);
  // Handle both sync and async results
  if (result instanceof Promise) {
    throw new Error("Async rate limiter not supported in sync context. Use checkQueryRateLimitAsync instead.");
  }
  return result;
}

/**
 * Async version of checkQueryRateLimit for Redis backends.
 */
export async function checkQueryRateLimitAsync(
  config: IngressRateLimitConfig,
  callerContext: CallerContext,
  remoteAddress: string | undefined,
  nowMs: number = Date.now()
): Promise<RateLimitDecision> {
  const key = buildRateLimitKey(callerContext, remoteAddress);
  const backend = getLimiter(config);
  return await backend.consume(key, nowMs, config.max_requests, config.window_ms);
}

export function createRateLimitedRejection(decision: RateLimitDecision): IngressRejection {
  const code = "RATE_LIMITED";
  return {
    code,
    message: "Request rate limit exceeded",
    detail: {
      limit: decision.limit,
      remaining: decision.remaining,
      window_ms: decision.windowMs,
      retry_after_ms: decision.retryAfterMs,
    },
    httpStatus: getErrorMeta(code).httpStatus,
    retryable: getErrorMeta(code).retryable,
  };
}

/** HTTP headers for rate limit communication (L2-05) */
export const RATE_LIMIT_HEADERS = {
  LIMIT: "X-RateLimit-Limit",
  REMAINING: "X-RateLimit-Remaining",
  RESET: "X-RateLimit-Reset",
  RETRY_AFTER: "Retry-After",
} as const;

/**
 * Attach rate limit headers to response (L2-05).
 * Call this for both allowed and rejected requests.
 */
export function attachRateLimitHeaders(
  res: ServerResponse,
  decision: RateLimitDecision,
  nowMs: number = Date.now()
): void {
  if (decision.limit > 0) {
    res.setHeader(RATE_LIMIT_HEADERS.LIMIT, String(decision.limit));
    res.setHeader(RATE_LIMIT_HEADERS.REMAINING, String(decision.remaining));
    const resetMs = decision.windowMs - (nowMs % decision.windowMs);
    res.setHeader(RATE_LIMIT_HEADERS.RESET, String(Math.ceil(resetMs / 1000)));
  }
  if (!decision.allowed && decision.retryAfterMs > 0) {
    res.setHeader(RATE_LIMIT_HEADERS.RETRY_AFTER, String(Math.ceil(decision.retryAfterMs / 1000)));
  }
}

/** Abuse detection patterns (L2-05) */
interface AbusePattern {
  name: string;
  check: (req: IncomingMessage, callerContext: CallerContext, history: RequestHistory) => boolean;
}

interface RequestHistory {
  requestCount: number;
  errorCount: number;
  lastRequests: Array<{ timestamp: number; path: string; error?: boolean }>;
}

const MAX_HISTORY_SIZE = 100;

// In-memory abuse tracking (per-process, for multi-instance use Redis)
const abuseHistory = new Map<string, RequestHistory>();

function getOrCreateHistory(key: string): RequestHistory {
  if (!abuseHistory.has(key)) {
    abuseHistory.set(key, {
      requestCount: 0,
      errorCount: 0,
      lastRequests: [],
    });
  }
  return abuseHistory.get(key)!;
}

function recordRequest(key: string, path: string, error?: boolean): void {
  const history = getOrCreateHistory(key);
  history.requestCount += 1;
  if (error) {
    history.errorCount += 1;
  }
  history.lastRequests.push({
    timestamp: Date.now(),
    path,
    error,
  });
  // Trim history
  if (history.lastRequests.length > MAX_HISTORY_SIZE) {
    history.lastRequests.shift();
  }
}

const ABUSE_PATTERNS: AbusePattern[] = [
  {
    name: "high_error_rate",
    check: (_req, _caller, history) => {
      if (history.requestCount < 10) return false;
      const errorRate = history.errorCount / history.requestCount;
      return errorRate > 0.8; // 80% error rate
    },
  },
  {
    name: "rapid_requests",
    check: (_req, _caller, history) => {
      const now = Date.now();
      const recentRequests = history.lastRequests.filter(r => now - r.timestamp < 1000);
      return recentRequests.length > 100; // More than 100 requests in 1 second
    },
  },
  {
    name: "repeated_auth_failures",
    check: (_req, _caller, history) => {
      const now = Date.now();
      const recentAuthErrors = history.lastRequests.filter(
        r => r.error && r.path.includes("auth") && now - r.timestamp < 60000
      );
      return recentAuthErrors.length > 10; // More than 10 auth errors in 1 minute
    },
  },
];

export interface AbuseDetectionResult {
  detected: boolean;
  patterns: string[];
}

/**
 * Detect abuse patterns for a caller (L2-05).
 * Returns detected patterns if abuse is suspected.
 */
export function detectAbuse(
  req: IncomingMessage,
  callerContext: CallerContext,
  hadError?: boolean
): AbuseDetectionResult {
  const key = `${callerContext.orgId}:${callerContext.appId}:${callerContext.userId}`;
  const path = req.url || "/";

  recordRequest(key, path, hadError);

  const history = getOrCreateHistory(key);
  const detectedPatterns = ABUSE_PATTERNS
    .filter(p => p.check(req, callerContext, history))
    .map(p => p.name);

  return {
    detected: detectedPatterns.length > 0,
    patterns: detectedPatterns,
  };
}

export function resetAbuseDetectionForTest(): void {
  abuseHistory.clear();
}
