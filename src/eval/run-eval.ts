/**
 * CLI entrypoint for evaluation harness – run baseline and exit 1 if regression.
 * @see L2-04 Phase 2, Task OBS-006 CI regression gate
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { runEvalHarness } from "./runner.js";
import type { EvalCase } from "./types.js";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const baselinePath = resolve(__dirname, "baseline.json");

function loadBaseline(): EvalCase[] {
  const raw = readFileSync(baselinePath, "utf8");
  const data: unknown = JSON.parse(raw);
  if (!Array.isArray(data)) throw new Error("baseline.json must be an array of eval cases");
  return data as EvalCase[];
}

async function main(): Promise<void> {
  const cases = loadBaseline();
  const result = await runEvalHarness(cases);
  console.info(
    `Eval: ${result.passed}/${result.total} passed, ${result.failed} failed, ${result.duration_ms}ms`
  );
  for (const r of result.results) {
    if (!r.passed) {
      console.error(`  FAIL ${r.case_id}: status_match=${r.status_match} latency_ok=${r.latency_ok} pipeline_match=${r.pipeline_match} ${r.error ?? ""}`);
    }
  }
  if (result.failed > 0) {
    process.exit(1);
  }
  process.exit(0);
}

main().catch((err) => {
  console.error("Eval harness failed:", err);
  process.exit(1);
});
