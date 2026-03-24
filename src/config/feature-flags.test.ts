/**
 * Feature flag service – shared resolution helper tests.
 */

import {
  resolveFeatureFlagEnabled,
  initializeFeatureFlags,
  resetFeatureFlags,
} from "./feature-flags.js";
import { ConfigSchema } from "./schema.js";

function minimalConfig(flags: Record<string, boolean>) {
  return ConfigSchema.parse({
    env: "dev",
    logLevel: "info",
    maxRequestBodyBytes: 1_000_000,
    flags,
  });
}

describe("resolveFeatureFlagEnabled", () => {
  afterEach(() => {
    resetFeatureFlags();
  });

  it("falls back to config when feature flag service is not initialized", () => {
    const config = minimalConfig({ enable_org_memory: true });
    expect(resolveFeatureFlagEnabled("enable_org_memory", config)).toBe(true);
    const off = minimalConfig({ enable_org_memory: false });
    expect(resolveFeatureFlagEnabled("enable_org_memory", off)).toBe(false);
  });

  it("applies org-scoped override when service is initialized", () => {
    const config = minimalConfig({ enable_org_memory: false });
    const svc = initializeFeatureFlags(config);
    svc.setOverride({
      flag_name: "enable_org_memory",
      scope: "org",
      scope_id: "org-x",
      enabled: true,
    });
    expect(
      resolveFeatureFlagEnabled("enable_org_memory", config, {
        org_id: "org-x",
        app_id: "app1",
        user_id: "user1",
      })
    ).toBe(true);
    expect(resolveFeatureFlagEnabled("enable_org_memory", config, { org_id: "other" })).toBe(
      false
    );
  });
});
