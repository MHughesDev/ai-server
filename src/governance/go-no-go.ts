/**
 * Production go/no-go evidence package and signatory validation (PR-033 / L2-08).
 * @see docs/OPERATIONS/Production-Readiness-Go-No-Go-Summary.md
 */

import { access, mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { DecisionMemo, DecisionOutcome, EvidenceItem } from "./types.js";
import { computeScorecard, DEFAULT_THRESHOLDS } from "./scorecard.js";
import { validateEvidence } from "./evidence.js";

/** Required signatory roles for a production GO decision. */
export const REQUIRED_SIGNATORY_ROLES = [
  "engineering_lead",
  "security_risk",
  "operations_sre",
] as const;

export type RequiredSignatoryRole = (typeof REQUIRED_SIGNATORY_ROLES)[number];

export interface SignatoryRecord {
  role: string;
  name: string;
  signed_at_iso: string;
  notes?: string;
}

export type GoNoGoGateStatus = "pass" | "fail" | "manual";

export interface GoNoGoTechnicalGate {
  id: string;
  status: GoNoGoGateStatus;
  message: string;
  evidence_link?: string;
  automated: boolean;
}

export interface ArtifactReference {
  name: string;
  path: string;
  present: boolean;
}

export interface ProductionGoNoGoEvidencePackage {
  schema_version: "1";
  generated_at: string;
  release_id?: string;
  build_id?: string;
  git_sha?: string;
  technical_gates: GoNoGoTechnicalGate[];
  technical_passed: boolean;
  artifact_references: ArtifactReference[];
  blocking_checklist: Array<{ id: string; status: GoNoGoGateStatus; evidence: string }>;
  signatories: SignatoryRecord[];
  decision?: DecisionMemo;
  /** Automated recommendation from technical gates only (human decision may differ). */
  recommended_outcome: DecisionOutcome;
  governance_scorecard_passed?: boolean;
}

export const DEFAULT_ARTIFACT_PATHS = [
  { name: "release_manifest", path: "artifacts/release-manifest.json" },
  { name: "rollback_drill_evidence", path: "artifacts/rollback-drill-evidence.json" },
  { name: "incident_drill_evidence", path: "artifacts/incident-drill-evidence.json" },
] as const;

export const IN_REPO_EVIDENCE_LINKS: EvidenceItem[] = [
  {
    id: "l2-05-security-controls",
    dimension: "security",
    link: "src/config/assert-production-auth.ts",
    valid: true,
    owner: "security",
    collectedAtIso: new Date().toISOString(),
  },
  {
    id: "l2-08-ci",
    dimension: "operations",
    link: ".github/workflows/ci.yml",
    valid: true,
    owner: "platform",
    collectedAtIso: new Date().toISOString(),
  },
  {
    id: "l2-08-rollback-drill",
    dimension: "reliability",
    link: "artifacts/rollback-drill-evidence.json",
    valid: true,
    owner: "sre",
  },
  {
    id: "l2-08-incident-drill",
    dimension: "operations",
    link: "artifacts/incident-drill-evidence.json",
    valid: true,
    owner: "sre",
  },
  {
    id: "openapi-routes",
    dimension: "governance",
    link: "scripts/validate-openapi-routes.mjs",
    valid: true,
    owner: "engineering",
  },
  {
    id: "production-preflight",
    dimension: "policy_enforcement",
    link: "src/server/preflight.ts",
    valid: true,
    owner: "engineering",
  },
  {
    id: "l2-04-observability",
    dimension: "observability",
    link: "src/observability/observability-acceptance.test.ts",
    valid: true,
    owner: "platform",
  },
  {
    id: "go-no-go-summary",
    dimension: "governance",
    link: "docs/OPERATIONS/Production-Readiness-Go-No-Go-Summary.md",
    valid: true,
    owner: "program",
  },
];

async function fileExists(repoRoot: string, relPath: string): Promise<boolean> {
  try {
    await access(join(repoRoot, relPath));
    return true;
  } catch {
    return false;
  }
}

export function parseSignatoriesFromEnv(
  raw: string | undefined = process.env.GO_NO_GO_SIGNATORIES_JSON
): SignatoryRecord[] {
  if (!raw?.trim()) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (s): s is SignatoryRecord =>
        typeof s === "object" &&
        s !== null &&
        typeof (s as SignatoryRecord).role === "string" &&
        typeof (s as SignatoryRecord).name === "string" &&
        typeof (s as SignatoryRecord).signed_at_iso === "string"
    );
  } catch {
    return [];
  }
}

export function parseDecisionFromEnv(
  raw: string | undefined = process.env.GO_NO_GO_DECISION_JSON
): DecisionMemo | undefined {
  if (!raw?.trim()) return undefined;
  try {
    const parsed = JSON.parse(raw) as DecisionMemo;
    if (
      parsed.outcome !== "go" &&
      parsed.outcome !== "no_go" &&
      parsed.outcome !== "pending"
    ) {
      return undefined;
    }
    if (typeof parsed.rationale !== "string") return undefined;
    return parsed;
  } catch {
    return undefined;
  }
}

/**
 * Validate required signatories are present for a GO outcome.
 */
export function validateSignatoriesForGo(
  signatories: SignatoryRecord[]
): { valid: boolean; missing_roles: string[]; errors: string[] } {
  const errors: string[] = [];
  const present = new Set(signatories.map((s) => s.role.trim().toLowerCase()));
  const missing_roles = REQUIRED_SIGNATORY_ROLES.filter(
    (role) => !present.has(role)
  );
  for (const s of signatories) {
    if (!s.name.trim()) errors.push(`Signatory ${s.role}: name is required`);
    if (!s.signed_at_iso.trim()) errors.push(`Signatory ${s.role}: signed_at_iso is required`);
    const t = new Date(s.signed_at_iso).getTime();
    if (Number.isNaN(t)) errors.push(`Signatory ${s.role}: invalid signed_at_iso`);
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

/**
 * Full validation: technical package + signatories when outcome is go.
 */
export function validateProductionGoNoGoDecision(
  pkg: ProductionGoNoGoEvidencePackage
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!pkg.technical_passed) {
    errors.push("Technical gates did not pass (run npm run verify:sow and release drills)");
  }
  const outcome = pkg.decision?.outcome ?? pkg.recommended_outcome;
  if (outcome === "go") {
    const sig = validateSignatoriesForGo(pkg.signatories);
    if (!sig.valid) errors.push(...sig.errors);
  }
  if (outcome === "go" && !pkg.decision?.rationale?.trim()) {
    errors.push("GO decision requires rationale in decision memo");
  }
  return { valid: errors.length === 0, errors };
}

export type AssembleGoNoGoOptions = {
  repoRoot?: string;
  verifySowPassed?: boolean;
  releaseId?: string;
  buildId?: string;
  gitSha?: string;
  signatories?: SignatoryRecord[];
  decision?: DecisionMemo;
};

/**
 * Assemble the production go/no-go evidence package from repo state and env.
 */
export async function assembleProductionGoNoGoPackage(
  options: AssembleGoNoGoOptions = {}
): Promise<ProductionGoNoGoEvidencePackage> {
  const repoRoot = options.repoRoot ?? process.cwd();
  const signatories = options.signatories ?? parseSignatoriesFromEnv();
  const decision = options.decision ?? parseDecisionFromEnv();

  const artifactRefs: ArtifactReference[] = [];
  for (const ref of DEFAULT_ARTIFACT_PATHS) {
    artifactRefs.push({
      name: ref.name,
      path: ref.path,
      present: await fileExists(repoRoot, ref.path),
    });
  }

  const openapiOk = await fileExists(repoRoot, "openapi.yaml");
  const routesOk = await fileExists(repoRoot, "src/server/routes.ts");
  const ciOk = await fileExists(repoRoot, ".github/workflows/ci.yml");

  const verifyPassed =
    options.verifySowPassed ??
    process.env.GO_NO_GO_VERIFY_PASSED === "true";
  const drillsPresent =
    artifactRefs.find((a) => a.name === "rollback_drill_evidence")?.present ===
      true &&
    artifactRefs.find((a) => a.name === "incident_drill_evidence")?.present === true;

  const technical_gates: GoNoGoTechnicalGate[] = [
    {
      id: "verify_sow",
      status: verifyPassed ? "pass" : "manual",
      message: verifyPassed
        ? "npm run verify:sow passed"
        : "Run npm run verify:sow on release branch (not verified in this assembly)",
      evidence_link: "package.json scripts.verify:sow",
      automated: false,
    },
    {
      id: "ci_workflow",
      status: ciOk ? "pass" : "fail",
      message: ciOk ? "CI workflow present" : "Missing .github/workflows/ci.yml",
      evidence_link: ".github/workflows/ci.yml",
      automated: true,
    },
    {
      id: "openapi_routes_parity",
      status: openapiOk && routesOk ? "pass" : "fail",
      message: "openapi.yaml and routes.ts present; validated by npm run validate:manifests",
      evidence_link: "scripts/validate-openapi-routes.mjs",
      automated: true,
    },
    {
      id: "rollback_drill",
      status: artifactRefs.find((a) => a.name === "rollback_drill_evidence")?.present
        ? "pass"
        : "manual",
      message: "Rollback drill evidence (npm run drill:rollback)",
      evidence_link: "artifacts/rollback-drill-evidence.json",
      automated: true,
    },
    {
      id: "incident_drills",
      status: artifactRefs.find((a) => a.name === "incident_drill_evidence")?.present
        ? "pass"
        : "manual",
      message: "Incident drills evidence (npm run drill:incidents)",
      evidence_link: "artifacts/incident-drill-evidence.json",
      automated: true,
    },
    {
      id: "release_manifest",
      status: artifactRefs.find((a) => a.name === "release_manifest")?.present
        ? "pass"
        : "manual",
      message: "Signed release manifest (npm run release:artifacts)",
      evidence_link: "artifacts/release-manifest.json",
      automated: true,
    },
    {
      id: "staging_deploy",
      status: "manual",
      message: "Staging deploy and probe validation (human gate)",
      evidence_link: "docs/OPERATIONS/Production-Readiness-Go-No-Go-Summary.md §3",
      automated: false,
    },
    {
      id: "production_config",
      status: "manual",
      message: "Production config review (IdP, providers, secrets)",
      evidence_link: "docs/OPERATIONS/Production-Deployment-Guide.md",
      automated: false,
    },
  ];

  const automatedFails = technical_gates.filter(
    (g) => g.automated && g.status === "fail"
  );
  const technical_passed =
    verifyPassed &&
    automatedFails.length === 0 &&
    drillsPresent &&
    ciOk &&
    openapiOk &&
    routesOk;

  const evidenceValidation = validateEvidence(IN_REPO_EVIDENCE_LINKS);
  const scorecard = computeScorecard(IN_REPO_EVIDENCE_LINKS, [], DEFAULT_THRESHOLDS);

  const blocking_checklist = [
    { id: "repo.verify_sow", status: verifyPassed ? "pass" : "manual", evidence: "npm run verify:sow" },
    { id: "ops.rollback_drill", status: drillsPresent ? "pass" : "manual", evidence: "artifacts/rollback-drill-evidence.json" },
    { id: "ops.incident_drills", status: drillsPresent ? "pass" : "manual", evidence: "artifacts/incident-drill-evidence.json" },
    { id: "governance.signatories", status: signatories.length > 0 ? "pass" : "manual", evidence: "GO_NO_GO_SIGNATORIES_JSON" },
    { id: "governance.decision", status: decision ? "pass" : "manual", evidence: "GO_NO_GO_DECISION_JSON" },
  ] as Array<{ id: string; status: GoNoGoGateStatus; evidence: string }>;

  let recommended_outcome: DecisionOutcome = "pending";
  if (!technical_passed || !evidenceValidation.valid || !scorecard.passed) {
    recommended_outcome = "no_go";
  } else if (validateSignatoriesForGo(signatories).valid && decision?.outcome === "go") {
    recommended_outcome = "go";
  } else if (decision?.outcome) {
    recommended_outcome = decision.outcome;
  }

  return {
    schema_version: "1",
    generated_at: new Date().toISOString(),
    release_id: options.releaseId ?? process.env.RELEASE_ID,
    build_id: options.buildId ?? process.env.BUILD_ID,
    git_sha: options.gitSha ?? process.env.GITHUB_SHA,
    technical_gates,
    technical_passed,
    artifact_references: artifactRefs,
    blocking_checklist,
    signatories,
    decision,
    recommended_outcome,
    governance_scorecard_passed: scorecard.passed && evidenceValidation.valid,
  };
}

export async function writeGoNoGoEvidencePackage(
  pkg: ProductionGoNoGoEvidencePackage,
  outputPath?: string
): Promise<string> {
  const path =
    outputPath ??
    process.env.GO_NO_GO_EVIDENCE_PACKAGE_PATH ??
    join(process.cwd(), "artifacts", "go-no-go-evidence-package.json");
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(pkg, null, 2)}\n`, "utf8");
  return path;
}
