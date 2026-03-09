/**
 * DNS caching and resolution utilities.
 * L2-06 Phase 9: DNS caching to reduce lookup latency and improve reliability.
 */

import { lookup as dnsLookup } from "node:dns";
import { promisify } from "node:util";

const lookupAsync = promisify(dnsLookup);

export interface DnsCacheEntry {
  /** Resolved addresses */
  addresses: string[];
  /** Timestamp when cached */
  cachedAt: number;
  /** TTL in milliseconds */
  ttlMs: number;
}

export interface DnsCacheOptions {
  /** Default TTL in milliseconds */
  defaultTtlMs: number;
  /** Maximum cache size */
  maxSize: number;
}

export class DnsCache {
  private cache = new Map<string, DnsCacheEntry>();
  private readonly options: DnsCacheOptions;

  constructor(options: Partial<DnsCacheOptions> = {}) {
    this.options = {
      defaultTtlMs: 300_000, // 5 minutes
      maxSize: 1000,
      ...options,
    };
  }

  /**
   * Lookup hostname with caching.
   */
  async lookup(hostname: string): Promise<string[]> {
    const cached = this.get(hostname);
    if (cached) {
      return cached.addresses;
    }

    try {
      const result = await lookupAsync(hostname, { all: true });
      const addresses = result.map((r) => r.address);
      this.set(hostname, addresses);
      return addresses;
    } catch (err) {
      throw new Error(`DNS lookup failed for ${hostname}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  /**
   * Get cached entry if not expired.
   */
  get(hostname: string): DnsCacheEntry | undefined {
    const entry = this.cache.get(hostname);
    if (!entry) return undefined;

    const now = Date.now();
    if (now - entry.cachedAt > entry.ttlMs) {
      this.cache.delete(hostname);
      return undefined;
    }

    return entry;
  }

  /**
   * Set cache entry.
   */
  set(hostname: string, addresses: string[], ttlMs?: number): void {
    // Evict oldest entries if at capacity
    if (this.cache.size >= this.options.maxSize) {
      const oldest = this.cache.keys().next().value;
      if (oldest) this.cache.delete(oldest);
    }

    this.cache.set(hostname, {
      addresses,
      cachedAt: Date.now(),
      ttlMs: ttlMs ?? this.options.defaultTtlMs,
    });
  }

  /**
   * Clear all cached entries.
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get cache statistics.
   */
  getStats(): { size: number; hits: number; misses: number } {
    return {
      size: this.cache.size,
      hits: 0, // Would need tracking
      misses: 0,
    };
  }
}

// Global DNS cache instance
let globalDnsCache: DnsCache | null = null;

/**
 * Get or create the global DNS cache.
 */
export function getGlobalDnsCache(): DnsCache {
  if (!globalDnsCache) {
    globalDnsCache = new DnsCache();
  }
  return globalDnsCache;
}

/**
 * Configure global DNS cache.
 */
export function configureGlobalDnsCache(options: Partial<DnsCacheOptions>): void {
  globalDnsCache = new DnsCache(options);
}

/**
 * Clear global DNS cache.
 */
export function clearGlobalDnsCache(): void {
  globalDnsCache?.clear();
}
