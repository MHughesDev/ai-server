#!/usr/bin/env node
/**
 * Run incident simulation drills (provider, policy, budget) via Jest (PR-032).
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
    "--testPathPattern=incident-drills.integration",
  ],
  {
    cwd: REPO_ROOT,
    env: {
      ...process.env,
      INCIDENT_DRILL_EVIDENCE_PATH:
        process.env.INCIDENT_DRILL_EVIDENCE_PATH ??
        join(REPO_ROOT, "artifacts", "incident-drill-evidence.json"),
    },
    stdio: "inherit",
  }
);

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}

console.log(
  "[incident-drills] Evidence written (see artifacts/incident-drill-evidence.json)"
);
