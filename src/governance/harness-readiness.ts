/**
 * L2-99 harness readiness decision record — scorecard, evidence, signatories (PR-034).
 * @see docs/PLANS/implementation/L2-99_Deferred-Coding-Agent-Harness-Readiness-Gate.md
 */

import { access, mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { computeScorecard, DEFAULT_THRESHOLDS } from "./scorecard.js";
import { validateEvidence, type ValidationResult } from "./evidence.js";
import type {
  DecisionMemo,
  DecisionOutcome,
  EvidenceItem,
  ReadinessScorecard,
  RiskEntry,
} from "./types.js";
import type { SignatoryRecord } from "./go-no-go.js";
import { parseSignatoriesFromEnv, parseDecisionFromEnv } from "./go-no-go.js";

/** Required signatories to enable autonomous harness in production (L2-99 Phase 3). */
export const HARNESS_READINESS_SIGNATORY_ROLES = [
  "program_lead",
  "security_lead",
] as const;

export type HarnessReadinessSignatoryRole =
  (typeof HARNESS_READINESS_SIGNATORY_ROLES)[number];

export interface HarnessReadinessDecisionRecord {
  schema_version: "1";
  plan_id: "L2-99";
  generated_at: string;
  release_id?: string;
  build_id?: string;
  git_sha?: string;
  evidence: EvidenceItem[];
  evidence_validation: ValidationResult;
  scorecard: ReadinessScorecard;
  risks: RiskEntry[];
  signatories: SignatoryRecord[];
  decision: DecisionMemo;
  /** True when scorecard + evidence pass and decision is go with valid signatories. */
  harness_enablement_approved: boolean;
  /** Env flag to set after GO: HARNESS_AUTONOMOUS_EXECUTION_ENABLED=true */
  enablement_flag: "harness_autonomous_execution_enabled";
  pilot_constraints?: {
    max_tool_rounds?: number;
    require_allowlisted_tools: boolean;
    observability_events_required: boolean;
  };
}

/** Default in-repo evidence index for L2-99 dimensions (PR-034 / OPS-006). */
export const DEFAULT_HARNESS_EVIDENCE: EvidenceItem[] = [
  {
    id: "hrg-security-auth",
    dimension: "security",
    sourcePlan: "L2-05",
    link: "src/config/assert-production-auth.ts",
    owner: "Security Lead",
    valid: true,
    collectedAtIso: new Date().toISOString(),
  },
  {
    id: "hrg-security-tools",
    dimension: "security",
    sourcePlan: "L2-05",
    link: "src/config/assert-production-tool-execution.ts",
    owner: "Security Lead",
    valid: true,
  },
  {
    id: "hrg-policy-preflight",
    dimension: "policy_enforcement",
    sourcePlan: "L2-03",
    link: "src/server/preflight.ts",
    owner: "Platform Lead",
    valid: true,
  },
  {
    id: "hrg-policy-evaluator",
    dimension: "policy_enforcement",
    sourcePlan: "L2-03",
    link: "src/controlplane/policy-evaluator.ts",
    owner: "Platform Lead",
    valid: true,
  },
  {
    id: "hrg-observability-acceptance",
    dimension: "observability",
    sourcePlan: "L2-04",
    link: "src/observability/observability-acceptance.test.ts",
    owner: "SRE Lead",
    valid: true,
  },
  {
    id: "hrg-observability-harness-events",
    dimension: "observability",
    sourcePlan: "L2-04",
    link: "src/observability/events.ts",
    owner: "SRE Lead",
    valid: true,
  },
  {
    id: "hrg-reliability-rollback-drill",
    dimension: "reliability",
    sourcePlan: "L2-08",
    link: "artifacts/rollback-drill-evidence.json",
    owner: "SRE Lead",
    valid: true,
  },
  {
    id: "hrg-operations-incident-drill",
    dimension: "operations",
    sourcePlan: "L2-08",
    link: "artifacts/incident-drill-evidence.json",
    owner: "Operations Lead",
    valid: true,
  },
  {
    id: "hrg-operations-ci",
    dimension: "operations",
    sourcePlan: "L2-01",
    link: ".github/workflows/ci.yml",
    owner: "Platform Lead",
    valid: true,
  },
  {
    id: "hrg-governance-go-no-go",
    dimension: "governance",
    sourcePlan: "L2-08",
    link: "artifacts/go-no-go-evidence-package.json",
    owner: "Program Lead",
    valid: true,
  },
  {
    id: "hrg-governance-harness-pipeline",
    dimension: "governance",
    sourcePlan: "L2-99",
    link: "src/pipelines/coding-agent-pipeline.ts",
    owner: "Runtime Lead",
    valid: true,
  },
  {
    id: "hrg-governance-harness-test",
    dimension: "governance",
    sourcePlan: "L2-99",
    link: "src/pipelines/coding-agent-pipeline.test.ts",
    owner: "QA Lead",
    valid: true,
  },
];

const ARTIFACT_EVIDENCE_IDS = new Set([
  "hrg-reliability-rollback-drill",
  "hrg-operations-incident-drill",
  "hrg-governance-go-no-go",
]);

async function fileExists(repoRoot: string, relPath: string): Promise<boolean> {
  try {
    await access(join(repoRoot, relPath));
    return true;
  } catch {
    return false;
  }
}

export async function resolveHarnessEvidence(
  repoRoot: string,
  base: EvidenceItem[] = DEFAULT_HARNESS_EVIDENCE
): Promise<EvidenceItem[]> {
  const resolved: EvidenceItem[] = [];
  for (const item of base) {
    const link = item.link ?? "";
    const needsFile =
      ARTIFACT_EVIDENCE_IDS.has(item.id) || link.startsWith("artifacts/");
    const present = needsFile && link ? await fileExists(repoRoot, link) : true;
    resolved.push({
      ...item,
      valid: item.valid && present,
      collectedAtIso: item.collectedAtIso ?? new Date().toISOString(),
    });
  }
  return resolved;
}

export function parseHarnessSignatoriesFromEnv(
  raw: string | undefined = process.env.HARNESS_READINESS_SIGNATORIES_JSON
): SignatoryRecord[] {
  return parseSignatoriesFromEnv(raw);
}

export function parseHarnessDecisionFromEnv(
  raw: string | undefined = process.env.HARNESS_READINESS_DECISION_JSON
): DecisionMemo {
  const parsed = parseDecisionFromEnv(raw);
  if (parsed) return parsed;
  return {
    outcome: "pending",
    rationale:
      "Automated L2-99 scorecard assembled; formal sign-off and decision meeting required before enabling HARNESS_AUTONOMOUS_EXECUTION_ENABLED.",
  };
}

export function validateHarnessSignatoriesForGo(
  signatories: SignatoryRecord[]
): { valid: boolean; missing_roles: string[]; errors: string[] } {
  const errors: string[] = [];
  const present = new Set(signatories.map((s) => s.role.trim().toLowerCase()));
  const missing_roles = HARNESS_READINESS_SIGNATORY_ROLES.filter(
    (role) => !present.has(role)
  );
  for (const s of signatories) {
    if (!s.name.trim()) errors.push(`Signatory ${s.role}: name is required`);
    if (!s.signed_at_iso.trim()) {
      errors.push(`Signatory ${s.role}: signed_at_iso is required`);
    }
  }
  if (missing_roles.length > 0) {
    errors.push(`Missing required signatories: ${missing_roles.join(", ")}`);
  }
  return {
    valid: missing_roles.length === 0 && errors.length === 0,
    missing_roles: [...missing_roles],
    errors,
  };
}

export type AssembleHarnessReadinessOptions = {
  repoRoot?: string;
  evidence?: EvidenceItem[];
  risks?: RiskEntry[];
  signatories?: SignatoryRecord[];
  decision?: DecisionMemo;
  releaseId?: string;
  buildId?: string;
  gitSha?: string;
};

/**
 * Assemble L2-99 harness readiness decision record (scorecard + evidence + decision).
 */
export async function assembleHarnessReadinessDecision(
  options: AssembleHarnessReadinessOptions = {}
): Promise<HarnessReadinessDecisionRecord> {
  const repoRoot = options.repoRoot ?? process.cwd();
  const evidence = await resolveHarnessEvidence(
    repoRoot,
    options.evidence ?? DEFAULT_HARNESS_EVIDENCE
  );
  const risks = options.risks ?? [];
  const signatories =
    options.signatories ?? parseHarnessSignatoriesFromEnv();
  const decision = options.decision ?? parseHarnessDecisionFromEnv();

  const evidence_validation = validateEvidence(evidence);
  const scorecard = computeScorecard(evidence, risks, DEFAULT_THRESHOLDS);

  const sigOk = validateHarnessSignatoriesForGo(signatories);
  const technicalReady =
    evidence_validation.valid && scorecard.passed && evidence_validation.errors.length === 0;

  let recommendedOutcome: DecisionOutcome = "pending";
  if (!technicalReady) {
    recommendedOutcome = "no_go";
  } else if (decision.outcome === "go" && sigOk.valid) {
    recommendedOutcome = "go";
  } else if (decision.outcome !== "pending") {
    recommendedOutcome = decision.outcome;
  }

  const finalDecision: DecisionMemo = {
    ...decision,
    outcome: decision.outcome === "pending" ? recommendedOutcome : decision.outcome,
    signatories: signatories.map((s) => s.role),
  };

  const harness_enablement_approved =
    finalDecision.outcome === "go" &&
    technicalReady &&
    sigOk.valid &&
    Boolean(finalDecision.rationale?.trim());

  return {
    schema_version: "1",
    plan_id: "L2-99",
    generated_at: new Date().toISOString(),
    release_id: options.releaseId ?? process.env.RELEASE_ID,
    build_id: options.buildId ?? process.env.BUILD_ID,
    git_sha: options.gitSha ?? process.env.GITHUB_SHA,
    evidence,
    evidence_validation,
    scorecard,
    risks,
    signatories,
    decision: finalDecision,
    harness_enablement_approved,
    enablement_flag: "harness_autonomous_execution_enabled",
    pilot_constraints: harness_enablement_approved
      ? {
          max_tool_rounds: 8,
          require_allowlisted_tools: true,
          observability_events_required: true,
        }
      : undefined,
  };
}

export function validateHarnessReadinessDecision(
  record: HarnessReadinessDecisionRecord
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!record.evidence_validation.valid) {
    errors.push(...record.evidence_validation.errors);
  }
  if (!record.scorecard.passed) {
    errors.push(
      `Scorecard did not pass (weighted=${record.scorecard.weightedTotal}, evidence=${record.scorecard.evidenceCompletenessPercent}%)`
    );
  }
  if (record.decision.outcome === "go") {
    const sig = validateHarnessSignatoriesForGo(record.signatories);
    if (!sig.valid) errors.push(...sig.errors);
    if (!record.decision.rationale?.trim()) {
      errors.push("GO decision requires rationale");
    }
    if (!record.harness_enablement_approved) {
      errors.push("harness_enablement_approved is false despite outcome go");
    }
  }
  return { valid: errors.length === 0, errors };
}

export async function writeHarnessReadinessDecision(
  record: HarnessReadinessDecisionRecord,
  outputPath?: string
): Promise<string> {
  const path =
    outputPath ??
    process.env.HARNESS_READINESS_DECISION_PATH ??
    join(process.cwd(), "artifacts", "harness-readiness-decision.json");
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(record, null, 2)}\n`, "utf8");
  return path;
}
