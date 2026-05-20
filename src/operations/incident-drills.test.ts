/**
 * Incident drill evidence builder tests (PR-032).
 */

import {
  buildIncidentDrillEvidence,
  INCIDENT_TRIAGE_RUNBOOKS,
} from "./incident-drills.js";

describe("incident drill evidence (PR-032)", () => {
  it("marks failed when any scenario fails", () => {
    const evidence = buildIncidentDrillEvidence([
      {
        scenario: "policy",
        passed: true,
        duration_ms: 10,
        expected_error_code: "POLICY_BLOCKED",
        observed_status_code: 200,
        observed_error_code: "POLICY_BLOCKED",
        triage_runbook: INCIDENT_TRIAGE_RUNBOOKS.policy,
        steps: [],
      },
      {
        scenario: "budget",
        passed: false,
        duration_ms: 5,
        expected_error_code: "BUDGET_EXCEEDED",
        observed_status_code: 500,
        triage_runbook: INCIDENT_TRIAGE_RUNBOOKS.budget,
        steps: [],
      },
    ]);
    expect(evidence.passed).toBe(false);
    expect(evidence.scenarios).toHaveLength(2);
  });
});
