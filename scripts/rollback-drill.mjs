#!/usr/bin/env node
/**
 * Run rollback kill-switch drill via Jest and write MTTR evidence (PR-031).
 * Requires: npm run build
 */

import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, "..");

const result = spawnSync(
  "npm",
  [
    "test",
    "--",
    "--runInBand",
    "--testPathPattern=rollback-drill.integration",
    "--testNamePattern=measures kill-switch MTTR",
  ],
  {
    cwd: REPO_ROOT,
    env: {
      ...process.env,
      ROLLBACK_DRILL_EVIDENCE_PATH:
        process.env.ROLLBACK_DRILL_EVIDENCE_PATH ??
        join(REPO_ROOT, "artifacts", "rollback-drill-evidence.json"),
    },
    stdio: "inherit",
  }
);

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}

console.log("[rollback-drill] Evidence written (see artifacts/rollback-drill-evidence.json)");
