/**
 * Rate limiting tests – Redis backend, headers, abuse detection.
 * @see L2-05 Phase 4
 */

import {
  checkQueryRateLimitAsync,
  attachRateLimitHeaders,
  detectAbuse,
  setRedisClient,
  resetQueryRateLimiterForTest,
  resetAbuseDetectionForTest,
  RATE_LIMIT_HEADERS,
  type RedisLikeClient,
  type RateLimitDecision,
} from "./rate-limit.js";
import type { CallerContext } from "../ingress/types.js";
import type { IncomingMessage } from "node:http";

describe("rate limiting", () => {
  const mockCaller: CallerContext = {
    orgId: "org-1",
    appId: "app-1",
    userId: "user-1",
  };

  beforeEach(() => {
    resetQueryRateLimiterForTest();
    resetAbuseDetectionForTest();
  });

  describe("in-memory backend", () => {
    it("allows requests under limit", async () => {
      const decision = await checkQueryRateLimitAsync(
        { max_requests: 10, window_ms: 60000 },
        mockCaller,
        "127.0.0.1"
      );
      expect(decision.allowed).toBe(true);
      expect(decision.remaining).toBe(9);
      expect(decision.limit).toBe(10);
    });

    it("blocks requests over limit", async () => {
      const config = { max_requests: 2, window_ms: 60000 };
      // First 2 requests allowed
      await checkQueryRateLimitAsync(config, mockCaller, "127.0.0.1");
      await checkQueryRateLimitAsync(config, mockCaller, "127.0.0.1");
      // Third request blocked
      const decision = await checkQueryRateLimitAsync(config, mockCaller, "127.0.0.1");
      expect(decision.allowed).toBe(false);
      expect(decision.remaining).toBe(0);
      expect(decision.retryAfterMs).toBeGreaterThan(0);
    });

    it("disables limiting when max_requests is 0", async () => {
      const decision = await checkQueryRateLimitAsync(
        { max_requests: 0, window_ms: 60000 },
        mockCaller,
        "127.0.0.1"
      );
      expect(decision.allowed).toBe(true);
      expect(decision.remaining).toBe(Number.MAX_SAFE_INTEGER);
    });
  });

  describe("Redis backend", () => {
    const createMockRedis = (): RedisLikeClient & { store: Map<string, string> } => {
      const store = new Map<string, string>();
      return {
        store,
        get(key: string): Promise<string | null> {
          return Promise.resolve(store.get(key) ?? null);
        },
        set(key: string, value: string, options?: { px?: number }): Promise<void> {
          store.set(key, value);
          if (options?.px) {
            setTimeout(() => store.delete(key), options.px);
          }
          return Promise.resolve();
        },
        incr(key: string): Promise<number> {
          const current = parseInt(store.get(key) ?? "0", 10);
          const next = current + 1;
          store.set(key, String(next));
          return Promise.resolve(next);
        },
      };
    };

    it("uses Redis when configured", async () => {
      const redis = createMockRedis();
      setRedisClient(redis);

      const decision = await checkQueryRateLimitAsync(
        { max_requests: 10, window_ms: 60000 },
        mockCaller,
        "127.0.0.1"
      );

      expect(decision.allowed).toBe(true);
      expect(redis.store.size).toBeGreaterThan(0);
    });

    it("fails open on Redis error", async () => {
      const failingRedis: RedisLikeClient = {
        get(): Promise<string | null> {
          return Promise.reject(new Error("Redis down"));
        },
        set(): Promise<void> {
          return Promise.reject(new Error("Redis down"));
        },
        incr(): Promise<number> {
          return Promise.reject(new Error("Redis down"));
        },
      };
      setRedisClient(failingRedis);

      const decision = await checkQueryRateLimitAsync(
        { max_requests: 10, window_ms: 60000 },
        mockCaller,
        "127.0.0.1"
      );

      expect(decision.allowed).toBe(true);
    });
  });

  describe("rate limit headers", () => {
    const createMockResponse = () => {
      const headers: Record<string, string | number> = {};
      return {
        headers,
        setHeader(name: string, value: string | number) {
          headers[name] = value;
        },
      };
    };

    it("attaches headers for allowed request", () => {
      const res = createMockResponse();
      const decision: RateLimitDecision = {
        allowed: true,
        limit: 100,
        remaining: 99,
        windowMs: 60000,
        retryAfterMs: 0,
      };

      attachRateLimitHeaders(res as unknown as import("node:http").ServerResponse, decision);

      expect(res.headers[RATE_LIMIT_HEADERS.LIMIT]).toBe("100");
      expect(res.headers[RATE_LIMIT_HEADERS.REMAINING]).toBe("99");
      expect(res.headers[RATE_LIMIT_HEADERS.RESET]).toBeDefined();
    });

    it("attaches retry-after for blocked request", () => {
      const res = createMockResponse();
      const decision: RateLimitDecision = {
        allowed: false,
        limit: 100,
        remaining: 0,
        windowMs: 60000,
        retryAfterMs: 45000,
      };

      attachRateLimitHeaders(res as unknown as import("node:http").ServerResponse, decision);

      expect(res.headers[RATE_LIMIT_HEADERS.LIMIT]).toBe("100");
      expect(res.headers[RATE_LIMIT_HEADERS.REMAINING]).toBe("0");
      expect(res.headers[RATE_LIMIT_HEADERS.RETRY_AFTER]).toBe("45");
    });

    it("skips headers when limit is 0", () => {
      const res = createMockResponse();
      const decision: RateLimitDecision = {
        allowed: true,
        limit: 0,
        remaining: Number.MAX_SAFE_INTEGER,
        windowMs: 60000,
        retryAfterMs: 0,
      };

      attachRateLimitHeaders(res as unknown as import("node:http").ServerResponse, decision);

      expect(res.headers[RATE_LIMIT_HEADERS.LIMIT]).toBeUndefined();
      expect(res.headers[RATE_LIMIT_HEADERS.REMAINING]).toBeUndefined();
    });
  });

  describe("abuse detection", () => {
    const createMockRequest = (url = "/v1/query"): IncomingMessage => {
      return {
        url,
        headers: {},
      } as unknown as IncomingMessage;
    };

    it("detects high error rate", () => {
      const req = createMockRequest();

      // Simulate 10 requests with 9 errors (90% error rate)
      for (let i = 0; i < 10; i++) {
        detectAbuse(req, mockCaller, i < 9);
      }

      const result = detectAbuse(req, mockCaller, false);
      expect(result.detected).toBe(true);
      expect(result.patterns).toContain("high_error_rate");
    });

    it("does not detect abuse for normal usage", () => {
      const req = createMockRequest();

      // Simulate normal usage: 10 requests, 1 error (10% error rate)
      for (let i = 0; i < 10; i++) {
        detectAbuse(req, mockCaller, i === 0);
      }

      const result = detectAbuse(req, mockCaller, false);
      expect(result.detected).toBe(false);
      expect(result.patterns).toHaveLength(0);
    });

    it("tracks requests per caller separately", () => {
      const req = createMockRequest();
      const caller2: CallerContext = {
        orgId: "org-2",
        appId: "app-1",
        userId: "user-1",
      };

      // First caller has high error rate
      for (let i = 0; i < 10; i++) {
        detectAbuse(req, mockCaller, true);
      }

      // Second caller has no errors
      const result1 = detectAbuse(req, caller2, false);
      expect(result1.detected).toBe(false);

      // First caller still detected
      const result2 = detectAbuse(req, mockCaller, false);
      expect(result2.detected).toBe(true);
    });
  });
});
