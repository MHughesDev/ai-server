/**
 * Feature Flag Service
 * Gap 3D: Feature Flags Enforcement
 * Runtime flag evaluation with hierarchy support
 */

import type { Config, FeatureFlags } from "./schema.js";

export type FlagScope = "global" | "org" | "app" | "user";

export interface FlagValue {
  enabled: boolean;
  variant?: string;
  payload?: Record<string, unknown>;
  reason: "default" | "config" | "override" | "experiment";
}

export interface FlagOverride {
  flag_name: string;
  scope: FlagScope;
  scope_id: string;
  enabled: boolean;
  variant?: string;
  payload?: Record<string, unknown>;
  expires_at?: string;
}

export interface FeatureFlagConfig {
  backend: "config" | "database" | "launchdarkly";
  refreshIntervalMs: number;
  defaultValues: FeatureFlags;
  /** Allow dynamic updates without restart */
  enableDynamicUpdates: boolean;
}

export class FeatureFlagService {
  private config: FeatureFlagConfig;
  private overrides = new Map<string, FlagOverride[]>();
  private currentValues: FeatureFlags;
  private refreshTimer?: NodeJS.Timeout;
  private subscribers: Array<(flags: FeatureFlags) => void> = [];

  constructor(config: FeatureFlagConfig) {
    this.config = config;
    this.currentValues = { ...config.defaultValues };
  }

  async initialize(): Promise<void> {
    await this.loadFlags();

    if (this.config.enableDynamicUpdates) {
      this.refreshTimer = setInterval(() => {
        void this.loadFlags();
      }, this.config.refreshIntervalMs);
    }

    console.log("[feature-flags] Feature flag service initialized");
  }

  stop(): Promise<void> {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
    }
    return Promise.resolve();
  }

  private loadFlags(): Promise<void> {
    switch (this.config.backend) {
      case "config":
        // Flags are loaded from environment on bootstrap
        break;
      case "database":
        // Would load from database - simplified for now
        break;
      case "launchdarkly":
        // Would integrate with LaunchDarkly SDK
        break;
    }
    return Promise.resolve();
  }

  /**
   * Evaluate a feature flag with hierarchy resolution
   * Precedence: user -> app -> org -> global
   */
  evaluateFlag(
    flagName: keyof FeatureFlags,
    context?: {
      org_id?: string;
      app_id?: string;
      user_id?: string;
    }
  ): FlagValue {
    const defaultValue = this.currentValues[flagName] ?? false;

    // Check for overrides in hierarchy order
    if (context?.user_id) {
      const userOverride = this.getOverride(flagName, "user", context.user_id);
      if (userOverride) {
        return {
          enabled: userOverride.enabled,
          variant: userOverride.variant,
          payload: userOverride.payload,
          reason: "override",
        };
      }
    }

    if (context?.app_id) {
      const appOverride = this.getOverride(flagName, "app", context.app_id);
      if (appOverride) {
        return {
          enabled: appOverride.enabled,
          variant: appOverride.variant,
          payload: appOverride.payload,
          reason: "override",
        };
      }
    }

    if (context?.org_id) {
      const orgOverride = this.getOverride(flagName, "org", context.org_id);
      if (orgOverride) {
        return {
          enabled: orgOverride.enabled,
          variant: orgOverride.variant,
          payload: orgOverride.payload,
          reason: "override",
        };
      }
    }

    // Return default/config value
    return {
      enabled: defaultValue,
      reason: "config",
    };
  }

  private getOverride(flagName: string, scope: FlagScope, scopeId: string): FlagOverride | undefined {
    const scopeOverrides = this.overrides.get(`${scope}:${scopeId}`);
    if (!scopeOverrides) return undefined;

    const override = scopeOverrides.find(o => o.flag_name === flagName);
    if (override && override.expires_at && new Date(override.expires_at) < new Date()) {
      // Expired
      return undefined;
    }
    return override;
  }

  /**
   * Set a flag override (for admin API)
   */
  setOverride(override: FlagOverride): void {
    const key = `${override.scope}:${override.scope_id}`;
    const existing = this.overrides.get(key) ?? [];
    const filtered = existing.filter(o => o.flag_name !== override.flag_name);
    filtered.push(override);
    this.overrides.set(key, filtered);

    this.notifySubscribers();
  }

  /**
   * Remove a flag override
   */
  removeOverride(flagName: string, scope: FlagScope, scopeId: string): void {
    const key = `${scope}:${scopeId}`;
    const existing = this.overrides.get(key);
    if (existing) {
      const filtered = existing.filter(o => o.flag_name !== flagName);
      if (filtered.length > 0) {
        this.overrides.set(key, filtered);
      } else {
        this.overrides.delete(key);
      }
    }
    this.notifySubscribers();
  }

  /**
   * Get all overrides for a scope
   */
  getOverrides(scope: FlagScope, scopeId: string): FlagOverride[] {
    return this.overrides.get(`${scope}:${scopeId}`) ?? [];
  }

  /**
   * Get current flag values
   */
  getAllFlags(): FeatureFlags {
    return { ...this.currentValues };
  }

  /**
   * Update flag values (for dynamic updates)
   */
  updateFlags(newFlags: Partial<FeatureFlags>): void {
    this.currentValues = { ...this.currentValues, ...newFlags };
    this.notifySubscribers();
  }

  /**
   * Subscribe to flag changes
   */
  subscribe(callback: (flags: FeatureFlags) => void): () => void {
    this.subscribers.push(callback);
    return () => {
      const index = this.subscribers.indexOf(callback);
      if (index !== -1) {
        this.subscribers.splice(index, 1);
      }
    };
  }

  private notifySubscribers(): void {
    const flags = this.getAllFlags();
    for (const subscriber of this.subscribers) {
      try {
        subscriber(flags);
      } catch (err) {
        console.error("[feature-flags] Subscriber error:", err);
      }
    }
  }

  /**
   * A/B test variant assignment (consistent hash-based)
   */
  getVariant(flagName: string, context: { org_id?: string; app_id?: string; user_id?: string }, variants: string[]): string {
    // Create consistent hash from flag name + context
    const hashInput = `${flagName}:${context.org_id ?? ""}:${context.app_id ?? ""}:${context.user_id ?? ""}`;
    const hash = this.simpleHash(hashInput);
    const index = hash % variants.length;
    return variants[index];
  }

  private simpleHash(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return Math.abs(hash);
  }
}

// Singleton instance
let featureFlagService: FeatureFlagService | null = null;

export function initializeFeatureFlags(config: Config): FeatureFlagService {
  if (featureFlagService) return featureFlagService;

  const flagConfig: FeatureFlagConfig = {
    backend: (process.env.FEATURE_FLAG_BACKEND as FeatureFlagConfig["backend"]) ?? "config",
    refreshIntervalMs: parseInt(process.env.FEATURE_FLAG_REFRESH_INTERVAL_MS ?? "60000", 10),
    defaultValues: config.flags,
    enableDynamicUpdates: process.env.FEATURE_FLAG_ENABLE_DYNAMIC === "true",
  };

  featureFlagService = new FeatureFlagService(flagConfig);
  return featureFlagService;
}

export function getFeatureFlagService(): FeatureFlagService | null {
  return featureFlagService;
}

export function resetFeatureFlags(): void {
  if (featureFlagService) {
    void featureFlagService.stop();
    featureFlagService = null;
  }
}
