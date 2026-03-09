/**
 * HTTP Transport Layer Hardening – CORS, compression, connection management, backpressure.
 * L2-06 Phase 7.1: Connection management and transport layer productionization.
 */

import type { IncomingMessage, ServerResponse } from "node:http";
import { createGunzip, createInflate } from "node:zlib";

// ============================================================================
// CORS (Cross-Origin Resource Sharing)
// ============================================================================

export interface CorsOptions {
  /** Allowed origins (or '*' for any) */
  allowedOrigins: string[] | "*";
  /** Allowed HTTP methods */
  allowedMethods: string[];
  /** Allowed headers */
  allowedHeaders: string[];
  /** Whether credentials are allowed */
  allowCredentials: boolean;
  /** Max age for preflight cache in seconds */
  maxAge: number;
}

export const DefaultCorsOptions: CorsOptions = {
  allowedOrigins: "*",
  allowedMethods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Request-ID"],
  allowCredentials: false,
  maxAge: 86400, // 24 hours
};

/**
 * Handle CORS preflight and set CORS headers.
 */
export function handleCors(
  req: IncomingMessage,
  res: ServerResponse,
  options: Partial<CorsOptions> = {}
): boolean {
  const opts = { ...DefaultCorsOptions, ...options };
  const origin = req.headers.origin;

  // Set origin header
  if (opts.allowedOrigins === "*") {
    res.setHeader("Access-Control-Allow-Origin", "*");
  } else if (origin && opts.allowedOrigins.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
  }

  // Set credentials header
  if (opts.allowCredentials) {
    res.setHeader("Access-Control-Allow-Credentials", "true");
  }

  // Handle preflight requests
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Methods", opts.allowedMethods.join(", "));
    res.setHeader("Access-Control-Allow-Headers", opts.allowedHeaders.join(", "));
    res.setHeader("Access-Control-Max-Age", String(opts.maxAge));
    res.writeHead(204);
    res.end();
    return true; // Request handled
  }

  return false; // Continue processing
}

// ============================================================================
// Compression
// ============================================================================

export type CompressionEncoding = "gzip" | "deflate" | "identity";

export interface CompressionOptions {
  /** Minimum response size to compress (bytes) */
  threshold: number;
  /** Compression level (1-9, where 9 is best compression) */
  level: number;
}

export const DefaultCompressionOptions: CompressionOptions = {
  threshold: 1024, // 1KB
  level: 6,
};

/**
 * Parse Accept-Encoding header and select best encoding.
 */
export function selectEncoding(acceptEncoding: string | undefined): CompressionEncoding {
  if (!acceptEncoding) return "identity";

  const encodings = acceptEncoding
    .toLowerCase()
    .split(",")
    .map((e) => e.trim().split(";")[0].trim());

  // Prefer gzip, then deflate, then identity
  if (encodings.includes("gzip")) return "gzip";
  if (encodings.includes("deflate")) return "deflate";
  return "identity";
}

/**
 * Validate Accept-Encoding header values.
 */
export function isValidEncoding(encoding: string): boolean {
  const valid = ["gzip", "deflate", "identity", "*"];
  return encoding
    .toLowerCase()
    .split(",")
    .every((e) => {
      const name = e.trim().split(";")[0].trim();
      return valid.includes(name) || name.startsWith("x-");
    });
}

/**
 * Compress response body if appropriate.
 */
export function compressResponse(
  req: IncomingMessage,
  _res: ServerResponse,
  body: Buffer | string,
  options: Partial<CompressionOptions> = {}
): { body: Buffer | string; encoding: CompressionEncoding; compressed: boolean } {
  const opts = { ...DefaultCompressionOptions, ...options };

  // Don't compress if body is too small
  const bodyBuffer = Buffer.isBuffer(body) ? body : Buffer.from(body, "utf8");
  if (bodyBuffer.length < opts.threshold) {
    return { body, encoding: "identity", compressed: false };
  }

  const acceptEncoding = req.headers["accept-encoding"] as string | undefined;
  const encoding = selectEncoding(acceptEncoding);

  if (encoding === "identity") {
    return { body, encoding: "identity", compressed: false };
  }

  // Synchronous compression for small payloads
  try {
    if (encoding === "gzip") {
      const { gzipSync } = require("node:zlib");
      return { body: gzipSync(bodyBuffer, { level: opts.level }), encoding: "gzip", compressed: true };
    }
    if (encoding === "deflate") {
      const { deflateSync } = require("node:zlib");
      return {
        body: deflateSync(bodyBuffer, { level: opts.level }),
        encoding: "deflate",
        compressed: true,
      };
    }
  } catch {
    // Fall back to uncompressed on error
  }

  return { body, encoding: "identity", compressed: false };
}

/**
 * Create a decompression stream for request bodies.
 */
export function createDecompressionStream(
  contentEncoding: string | undefined
): ReturnType<typeof createGunzip> | ReturnType<typeof createInflate> | null {
  if (!contentEncoding) return null;

  const encoding = contentEncoding.toLowerCase().trim();
  if (encoding === "gzip") return createGunzip();
  if (encoding === "deflate") return createInflate();
  return null;
}

// ============================================================================
// Request Queue & Backpressure
// ============================================================================

export interface RequestQueueOptions {
  /** Maximum number of concurrent requests */
  maxConcurrent: number;
  /** Maximum queue depth for waiting requests */
  maxQueueDepth: number;
}

export class RequestQueue {
  private running = 0;
  private readonly queue: Array<() => void> = [];
  private readonly options: RequestQueueOptions;

  constructor(options: RequestQueueOptions) {
    this.options = options;
  }

  /**
   * Check if a new request can be accepted.
   */
  canAccept(): boolean {
    return this.running < this.options.maxConcurrent || this.queue.length < this.options.maxQueueDepth;
  }

  /**
   * Get current queue depth.
   */
  get depth(): number {
    return this.queue.length;
  }

  /**
   * Get current running count.
   */
  get active(): number {
    return this.running;
  }

  /**
   * Acquire a slot in the queue. Returns null if queue is full.
   */
  async acquire(): Promise<(() => void) | null> {
    if (this.running < this.options.maxConcurrent) {
      this.running++;
      return () => this.release();
    }

    if (this.queue.length >= this.options.maxQueueDepth) {
      return null;
    }

    return new Promise<(() => void) | null>((resolve) => {
      this.queue.push(() => {
        this.running++;
        resolve(() => this.release());
      });
    });
  }

  private release(): void {
    this.running = Math.max(0, this.running - 1);
    const next = this.queue.shift();
    if (next) next();
  }
}

/**
 * Send a 503 Service Unavailable response with Retry-After header.
 */
export function sendBackpressureResponse(res: ServerResponse, retryAfterSeconds = 10): void {
  res.writeHead(503, {
    "Content-Type": "application/json",
    "Retry-After": String(retryAfterSeconds),
  });
  res.end(
    JSON.stringify({
      status: "error",
      error: {
        code: "SERVICE_UNAVAILABLE",
        message: "Server is at capacity, please retry after the indicated time",
        retry_after_seconds: retryAfterSeconds,
      },
    })
  );
}

// ============================================================================
// Keep-Alive Configuration
// ============================================================================

export interface KeepAliveOptions {
  /** Enable/disable keep-alive */
  enabled: boolean;
  /** Timeout for idle connections in milliseconds */
  timeoutMs: number;
  /** Maximum number of requests per connection */
  maxRequests: number;
}

export const DefaultKeepAliveOptions: KeepAliveOptions = {
  enabled: true,
  timeoutMs: 30000, // 30 seconds
  maxRequests: 1000,
};

/**
 * Apply keep-alive headers to response.
 */
export function applyKeepAliveHeaders(res: ServerResponse, options: Partial<KeepAliveOptions> = {}): void {
  const opts = { ...DefaultKeepAliveOptions, ...options };

  if (opts.enabled) {
    res.setHeader("Connection", "keep-alive");
    res.setHeader("Keep-Alive", `timeout=${Math.floor(opts.timeoutMs / 1000)}, max=${opts.maxRequests}`);
  } else {
    res.setHeader("Connection", "close");
  }
}

// ============================================================================
// Request Decompression
// ============================================================================

/**
 * Read and decompress request body.
 */
export async function readDecompressedBody(req: IncomingMessage, maxBytes: number): Promise<Buffer> {
  const contentEncoding = req.headers["content-encoding"] as string | undefined;
  const decompressionStream = createDecompressionStream(contentEncoding);

  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let totalSize = 0;

    const onData = (chunk: Buffer) => {
      totalSize += chunk.length;
      if (totalSize > maxBytes) {
        cleanup();
        reject(new Error(`Decompressed body exceeds ${maxBytes} bytes`));
        return;
      }
      chunks.push(chunk);
    };

    const onEnd = () => {
      cleanup();
      resolve(Buffer.concat(chunks));
    };

    const onError = (err: Error) => {
      cleanup();
      reject(err);
    };

    const cleanup = () => {
      if (decompressionStream) {
        decompressionStream.removeListener("data", onData);
        decompressionStream.removeListener("end", onEnd);
        decompressionStream.removeListener("error", onError);
      }
      req.removeListener("data", onData);
      req.removeListener("end", onEnd);
      req.removeListener("error", onError);
    };

    if (decompressionStream) {
      decompressionStream.on("data", onData);
      decompressionStream.on("end", onEnd);
      decompressionStream.on("error", onError);
      req.pipe(decompressionStream);
    } else {
      req.on("data", onData);
      req.on("end", onEnd);
      req.on("error", onError);
    }
  });
}
