#!/usr/bin/env node
/**
 * Record L2-99 harness readiness decision (PR-034).
 */

import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, "..");

async function main() {
  const { assembleHarnessReadinessDecision, writeHarnessReadinessDecision, validateHarnessReadinessDecision } =
    await import("../dist/governance/harness-readiness.js");

  const record = await assembleHarnessReadinessDecision({
    repoRoot: REPO_ROOT,
    releaseId: process.env.RELEASE_ID,
    buildId: process.env.BUILD_ID,
    gitSha: process.env.GITHUB_SHA,
  });

  const outPath =
    process.env.HARNESS_READINESS_DECISION_PATH ??
    join(REPO_ROOT, "artifacts", "harness-readiness-decision.json");
  await writeHarnessReadinessDecision(record, outPath);

  console.log(`[harness-readiness] Wrote ${outPath}`);
  console.log(
    `[harness-readiness] scorecard.passed=${record.scorecard.passed} outcome=${record.decision.outcome} harness_enablement_approved=${record.harness_enablement_approved}`
  );

  if (record.decision.outcome === "go") {
    const validation = validateHarnessReadinessDecision(record);
    if (!validation.valid) {
      console.error("[harness-readiness] GO validation failed:");
      for (const e of validation.errors) console.error(`  - ${e}`);
      process.exit(1);
    }
    console.log(
      "[harness-readiness] After deploy approval, set HARNESS_AUTONOMOUS_EXECUTION_ENABLED=true"
    );
  }
}

main().catch((err) => {
  console.error("[harness-readiness] Failed:", err);
  process.exit(1);
});
