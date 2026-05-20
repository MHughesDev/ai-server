/**
 * Incident simulation drills — provider, policy, budget (PR-032).
 * @see docs/OPERATIONS/RUNBOOKS/Incident-Simulation-Drills.md
 */

import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

export type IncidentScenario = "provider" | "policy" | "budget";

export const INCIDENT_TRIAGE_RUNBOOKS: Record<IncidentScenario, string> = {
  provider: "docs/OPERATIONS/RUNBOOKS/Query-and-Policy-Failures.md#query-failure-general",
  policy: "docs/OPERATIONS/RUNBOOKS/Query-and-Policy-Failures.md#tool-denied",
  budget: "docs/OPERATIONS/RUNBOOKS/Query-and-Policy-Failures.md#budget-exceeded",
};

export type IncidentDrillStep = {
  name: string;
  duration_ms: number;
};

export type IncidentDrillScenarioResult = {
  scenario: IncidentScenario;
  passed: boolean;
  duration_ms: number;
  expected_error_code: string;
  observed_status_code: number;
  observed_error_code?: string;
  observed_response_status?: string;
  triage_runbook: string;
  steps: IncidentDrillStep[];
  detail?: Record<string, unknown>;
};

export type IncidentDrillEvidence = {
  schema_version: "1";
  drill_id: string;
  executed_at: string;
  passed: boolean;
  scenarios: IncidentDrillScenarioResult[];
};

export function buildIncidentDrillEvidence(
  scenarios: IncidentDrillScenarioResult[],
  drillId?: string
): IncidentDrillEvidence {
  return {
    schema_version: "1",
    drill_id: drillId ?? `incident-drill-${Date.now()}`,
    executed_at: new Date().toISOString(),
    passed: scenarios.every((s) => s.passed),
    scenarios,
  };
}

export async function writeIncidentDrillEvidence(
  evidence: IncidentDrillEvidence,
  outputPath?: string
): Promise<string> {
  const path =
    outputPath ??
    process.env.INCIDENT_DRILL_EVIDENCE_PATH ??
    join(process.cwd(), "artifacts", "incident-drill-evidence.json");
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
  return path;
}
