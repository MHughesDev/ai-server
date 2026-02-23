/**
 * Application bootstrap – deterministic startup and config validation.
 * @see L2-01 Phase 1: bootstrap path with startup checks
 */

import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadConfigFromEnv, type Config } from "../config/index.js";
import { CONTRACT_VERSION } from "../contracts/index.js";
import { validateReleaseConfig } from "../rollout/policy.js";

let config: Config | null = null;

/** Load and validate config; throws on invalid env. Call once at startup. */
export function bootstrap(): Config {
  if (config) return config;
  config = loadConfigFromEnv();
  // L2-08: Release config validation – warn in production without traceability
  const releaseValidation = validateReleaseConfig({
    env: config.env,
    release_id: config.release?.release_id,
    build_id: config.release?.build_id,
  });
  if (!releaseValidation.valid) {
    console.warn("[bootstrap] release config:", releaseValidation.errors.join("; "));
  }
  // Startup validation: non-secret settings (for logs / runbooks)
  const safeDump = {
    env: config.env,
    logLevel: config.logLevel,
    maxRequestBodyBytes: config.maxRequestBodyBytes,
    flags: config.flags,
    contractVersion: CONTRACT_VERSION,
  };
  if (config.logLevel === "debug") {
    console.debug("[bootstrap] config validated", JSON.stringify(safeDump));
  }
  return config;
}

/** Return current config; must call bootstrap() first. */
export function getConfig(): Config {
  if (!config) throw new Error("bootstrap() must be called before getConfig()");
  return config;
}

/** Test-only: clear config cache so next bootstrap() reloads from env. Use in isolation tests (e.g. L2-06 retrieval). */
export function resetConfigForTest(): void {
  config = null;
}

/** Entrypoint for CLI: validate config and exit 0. */
function main(): void {
  try {
    bootstrap();
    console.info("Bootstrap OK");
    process.exit(0);
  } catch (err) {
    console.error("Bootstrap failed:", err);
    process.exit(1);
  }
}

const scriptPath = resolve(fileURLToPath(import.meta.url));
const isEntry = process.argv[1] ? resolve(process.argv[1]) === scriptPath : false;
if (isEntry) {
  main();
}
