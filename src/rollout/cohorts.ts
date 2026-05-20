/**
 * Canary cohort definitions and request assignment (PR-031).
 * @see docs/PLANS/implementation/L2-08_Rollout-and-Operational-Readiness-Implementation.md §10.3
 */

import { createHash } from "node:crypto";
import { z } from "zod";

export const CanaryCohortStageSchema = z.enum(["internal", "low_risk", "broad"]);
export type CanaryCohortStage = z.infer<typeof CanaryCohortStageSchema>;

export const CanaryCohortMatchSchema = z
  .object({
    org_ids: z.array(z.string().min(1)).optional(),
    app_ids: z.array(z.string().min(1)).optional(),
    user_ids: z.array(z.string().min(1)).optional(),
  })
  .default({});

export type CanaryCohortMatch = z.infer<typeof CanaryCohortMatchSchema>;

export const CanaryCohortSchema = z.object({
  id: z.string().min(1),
  stage: CanaryCohortStageSchema,
  /** Percent of non-matched traffic eligible for this cohort (0–100). */
  traffic_percent: z.number().min(0).max(100).default(100),
  match: CanaryCohortMatchSchema.optional(),
});

export type CanaryCohort = z.infer<typeof CanaryCohortSchema>;

export const DEFAULT_CANARY_COHORTS: CanaryCohort[] = [
  {
    id: "internal",
    stage: "internal",
    traffic_percent: 100,
    match: { org_ids: ["internal", "ops"] },
  },
  {
    id: "low_risk",
    stage: "low_risk",
    traffic_percent: 10,
  },
  {
    id: "broad",
    stage: "broad",
    traffic_percent: 100,
  },
];

export type CanaryTenantScope = {
  org_id?: string;
  app_id?: string;
  user_id?: string;
};

/** Stable bucket 0–99 from tenant key for percent rollout. */
export function stableTrafficBucket(scope: CanaryTenantScope): number {
  const key = [scope.org_id ?? "", scope.app_id ?? "", scope.user_id ?? ""].join(":");
  const hash = createHash("sha256").update(key, "utf8").digest();
  return hash[0] % 100;
}

function matchesExplicitRules(scope: CanaryTenantScope, match: CanaryCohortMatch): boolean {
  if (match.org_ids?.length) {
    if (!scope.org_id || !match.org_ids.includes(scope.org_id)) return false;
  }
  if (match.app_ids?.length) {
    if (!scope.app_id || !match.app_ids.includes(scope.app_id)) return false;
  }
  if (match.user_ids?.length) {
    if (!scope.user_id || !match.user_ids.includes(scope.user_id)) return false;
  }
  const hasRule =
    (match.org_ids?.length ?? 0) > 0 ||
    (match.app_ids?.length ?? 0) > 0 ||
    (match.user_ids?.length ?? 0) > 0;
  return hasRule;
}

/**
 * Resolve which cohort a request belongs to.
 * - Explicit match rules win (first cohort in list order).
 * - Otherwise, when `activeCohortId` is set, percent rollout applies to that cohort only.
 * - Returns `stable` when not in an active canary cohort.
 */
export function resolveCanaryCohort(
  scope: CanaryTenantScope,
  cohorts: CanaryCohort[],
  activeCohortId?: string
): { cohort_id: string; stage?: CanaryCohortStage } {
  for (const cohort of cohorts) {
    const match = cohort.match ?? {};
    if (matchesExplicitRules(scope, match)) {
      return { cohort_id: cohort.id, stage: cohort.stage };
    }
  }

  if (!activeCohortId) {
    return { cohort_id: "stable" };
  }

  const active = cohorts.find((c) => c.id === activeCohortId);
  if (!active) {
    return { cohort_id: "stable" };
  }

  const bucket = stableTrafficBucket(scope);
  if (bucket < active.traffic_percent) {
    return { cohort_id: active.id, stage: active.stage };
  }

  return { cohort_id: "stable" };
}

export function parseCanaryCohorts(input: unknown): CanaryCohort[] {
  if (!Array.isArray(input)) return DEFAULT_CANARY_COHORTS;
  const parsed: CanaryCohort[] = [];
  for (const item of input) {
    const result = CanaryCohortSchema.safeParse(item);
    if (result.success) parsed.push(result.data);
  }
  return parsed.length > 0 ? parsed : DEFAULT_CANARY_COHORTS;
}
