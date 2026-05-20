/**
 * Rollback drill — measure kill-switch MTTR and emit evidence (PR-031).
 */

import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import {
  PRODUCTION_ROLLOUT_DISABLED_ERROR,
  getDefaultRolloutPolicy,
  loadRolloutPolicyFromEnv,
  type RolloutPolicy,
} from "./policy.js";

export type RollbackDrillStep = {
  name: string;
  duration_ms: number;
};

export type RollbackDrillEvidence = {
  schema_version: "1";
  drill_id: string;
  executed_at: string;
  mttr_ms: number;
  max_rollback_mttr_ms: number;
  passed: boolean;
  kill_switch_error_code: string;
  steps: RollbackDrillStep[];
};

export type RollbackDrillOptions = {
  /** Flip rollout kill-switch (e.g. PLATFORM_PRODUCTION_ROLLOUT_ENABLED=false + bootstrap). */
  activateKillSwitch: () => void | Promise<void>;
  /** Poll until this returns 503 POLICY_BLOCKED or timeout. */
  pollKillSwitchActive: () => Promise<{ statusCode: number; errorCode?: string }>;
  maxMttrMs?: number;
  policy?: RolloutPolicy;
  drillId?: string;
};

/**
 * Measure time from rollback activation until kill-switch blocks traffic.
 */
export async function measureRollbackKillSwitchMttr(
  options: RollbackDrillOptions
): Promise<RollbackDrillEvidence> {
  const policy = options.policy ?? loadRolloutPolicyFromEnv();
  const maxMttrMs = options.maxMttrMs ?? policy.max_rollback_mttr_ms;
  const steps: RollbackDrillStep[] = [];
  const drillId = options.drillId ?? `rollback-drill-${Date.now()}`;
  const started = Date.now();

  const activateStart = Date.now();
  await options.activateKillSwitch();
  steps.push({ name: "activate_kill_switch", duration_ms: Date.now() - activateStart });

  const deadline = started + maxMttrMs;
  let statusCode = 0;
  let errorCode: string | undefined;
  let polls = 0;

  while (Date.now() < deadline) {
    const pollStart = Date.now();
    const res = await options.pollKillSwitchActive();
    polls += 1;
    statusCode = res.statusCode;
    errorCode = res.errorCode;
    if (
      statusCode === 503 &&
      errorCode === PRODUCTION_ROLLOUT_DISABLED_ERROR.code
    ) {
      const mttr_ms = pollStart - started;
      return buildEvidence({
        drillId,
        mttr_ms,
        maxMttrMs,
        steps: [
          ...steps,
          { name: "kill_switch_observed", duration_ms: pollStart - activateStart },
          { name: "poll_attempts", duration_ms: polls },
        ],
        passed: mttr_ms <= maxMttrMs,
      });
    }
    await new Promise((r) => setTimeout(r, 10));
  }

  const mttr_ms = Date.now() - started;
  return buildEvidence({
    drillId,
    mttr_ms,
    maxMttrMs,
    steps: [
      ...steps,
      { name: "timeout", duration_ms: mttr_ms },
      { name: "last_status", duration_ms: statusCode },
    ],
    passed: false,
  });
}

function buildEvidence(args: {
  drillId: string;
  mttr_ms: number;
  maxMttrMs: number;
  steps: RollbackDrillStep[];
  passed: boolean;
}): RollbackDrillEvidence {
  return {
    schema_version: "1",
    drill_id: args.drillId,
    executed_at: new Date().toISOString(),
    mttr_ms: args.mttr_ms,
    max_rollback_mttr_ms: args.maxMttrMs,
    passed: args.passed,
    kill_switch_error_code: PRODUCTION_ROLLOUT_DISABLED_ERROR.code,
    steps: args.steps,
  };
}

export async function writeRollbackDrillEvidence(
  evidence: RollbackDrillEvidence,
  outputPath?: string
): Promise<string> {
  const path =
    outputPath ??
    process.env.ROLLBACK_DRILL_EVIDENCE_PATH ??
    join(process.cwd(), "artifacts", "rollback-drill-evidence.json");
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
  return path;
}

/** Default MTTR SLO for drills when policy is not loaded. */
export const DEFAULT_ROLLBACK_DRILL_MTTR_MS = getDefaultRolloutPolicy().max_rollback_mttr_ms;
