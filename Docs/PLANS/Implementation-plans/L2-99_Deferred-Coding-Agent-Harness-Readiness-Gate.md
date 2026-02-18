# L2-99 Deferred Coding Agent Harness Readiness Gate

## 0) Document Control
- Plan ID: L2-99
- Plan Name: Deferred Coding Agent Harness Readiness Gate
- Linked SPEC: `Docs/SPEC/19_Security_and_Isolation_Spec.md`, `Docs/SPEC/21_Test_and_Eval_Plan.md`, `Docs/SPEC/22_Runbooks_and_Operations.md`
- Owner(s): Program Lead, Security Lead
- Contributors: Platform Lead, Runtime Lead, SRE Lead, QA Lead, Governance Board
- Status: `draft`
- Priority: `P0`
- Created: 2026-02-18
- Last Updated: 2026-02-18
- Review Cadence: Daily during gate window + formal sign-off session

## 1) Purpose and Outcome
### 1.1 Purpose
Determine whether the platform has met objective readiness criteria to begin constrained coding-agent harness work in a future cycle.

### 1.2 Intended Outcomes
- Outcome 1: A complete readiness scorecard based on evidence from L2-01 through L2-08.
- Outcome 2: A signed go/no-go decision with explicit rationale and residual risk treatment.
- Outcome 3: If go, a tightly constrained pilot definition with safety guardrails and KPIs.

### 1.3 Non-Goals
- Non-goal 1: Implementing coding-agent harness execution in this plan.
- Non-goal 2: Expanding tool permissions beyond approved baseline controls.

## 2) Scope
### 2.1 In Scope
- Readiness scoring dimensions: security, policy enforcement, observability, reliability, operations, governance.
- Evidence collection and validation from upstream plan artifacts.
- Formal risk acceptance process and exception handling.
- Decision memo publication and next-cycle planning handoff.

### 2.2 Out of Scope
- Coding-agent development and production rollout.
- Non-readiness architecture redesign work.

### 2.3 Interfaces Touched
- API endpoints: None newly implemented.
- Internal modules: Governance artifacts, scorecard calculators, decision logs.
- Data stores: Risk register, readiness evidence index, approval records.
- External systems/tools: Governance workflow tooling and sign-off systems.

## 3) Dependencies
### 3.1 Upstream Dependencies
- `Docs/PLANS/Implementation-plans/L2-08_Rollout-and-Operational-Readiness-Implementation.md` complete.
- All L2-01 through L2-08 gates accepted or approved with documented exceptions.

### 3.2 Downstream Consumers
- Next cycle implementation planning for constrained coding-agent pilot (if approved).
- Executive roadmap and release governance decisions.

### 3.3 External Dependencies
- Availability of required signatories and governance reviewers.
- Policy and security board capacity for formal review.

## 4) Assumptions and Constraints
### 4.1 Assumptions
- Assumption 1: Upstream plans provide complete evidence artifacts.
- Assumption 2: Decision criteria are objective and approved before scoring begins.

### 4.2 Constraints
- Security constraints: No readiness approval without passing critical security thresholds.
- Performance constraints: Reliability and SLO evidence must meet minimum maturity baseline.
- Cost constraints: Projected harness pilot cost must fit approved budget envelope.
- Compliance constraints: Decision and exceptions must be auditable and time-bound.

### 4.3 Open Decisions
- Decision item: Exact go/no-go threshold weightings by readiness category.
- Decision owner: Program Lead with Security Lead concurrence.
- Decision deadline: Before Phase 1 scoring starts.

---

## 5) Phase Plan

### Phase 0 - Gate Framework and Criteria Finalization
**Phase Objective**
- Lock readiness dimensions, thresholds, and evidence requirements before scoring.

**Linked SPEC Clauses**
- Clause(s): `21 Test and Eval Plan`, `22 Runbooks and Operations`.

**Blocking Dependencies**
- Dependency: L2-08 handoff package complete.

**Deliverables**
- Deliverable 1: Approved scorecard framework with weighted criteria.
- Deliverable 2: Evidence checklist and ownership matrix.

**Workstreams**
- Governance readiness: Criteria definition and approval.
- Evaluation feedback loops: Define scoring methodology.
- Incident readiness: Include operational resilience thresholds.
- Knowledge transfer: Publish framework to stakeholders.

**Task List**
- [ ] Task P0-01: Define scoring categories and thresholds.
- [ ] Task P0-02: Assign evidence owners for each category.
- [ ] Task P0-03: Obtain pre-scoring approval from required signatories.

**Entry Criteria**
- Criteria: Upstream handoff artifacts received and indexed.

**Exit Criteria**
- Criteria: Gate framework approved and frozen for this cycle.

**Risks**
- Risk: Criteria ambiguity leads to contested decision outcomes.
- Mitigation: Freeze criteria before evidence scoring starts.

**Rollback/Fallback**
- Rollback condition: Criteria cannot be agreed by stakeholders.
- Rollback action: Pause gate and escalate to steering group for resolution.

---

### Phase 1 - Evidence Collection and Validation
**Phase Objective**
- Build a complete, verifiable evidence base for readiness scoring.

**Linked SPEC Clauses**
- Clause(s): `22 Runbooks and Operations`, `18 Observability Spec`.

**Blocking Dependencies**
- Dependency: Phase 0 criteria approved.

**Deliverables**
- Deliverable 1: Evidence repository mapped to all scorecard dimensions.
- Deliverable 2: Validation report confirming artifact completeness and freshness.

**Workstreams**
- Governance readiness: Evidence intake and traceability mapping.
- Evaluation feedback loops: Data quality and recency checks.
- Incident readiness: Validate drill outcomes and MTTR evidence.
- Knowledge transfer: Maintain evidence index documentation.

**Task List**
- [ ] Task P1-01: Collect evidence links from all prior plan gates.
- [ ] Task P1-02: Validate evidence against checklist requirements.
- [ ] Task P1-03: Flag missing or stale artifacts and assign remediation owners.

**Entry Criteria**
- Criteria: Scorecard framework frozen.

**Exit Criteria**
- Criteria: Evidence coverage >= 100% for required criteria or documented exceptions.

**Risks**
- Risk: Missing evidence delays decision timeline.
- Mitigation: Early evidence audit and owner escalation.

**Rollback/Fallback**
- Rollback condition: Critical evidence remains unavailable by deadline.
- Rollback action: Force provisional no-go and open remediation cycle.

---

### Phase 2 - Readiness Scoring and Risk Disposition
**Phase Objective**
- Produce objective readiness score and explicit risk posture.

**Linked SPEC Clauses**
- Clause(s): `19 Security and Isolation Spec`, `21 Test and Eval Plan`.

**Blocking Dependencies**
- Dependency: Evidence validation complete.

**Deliverables**
- Deliverable 1: Completed scorecard with category scores and weighted total.
- Deliverable 2: Updated risk register with accepted, mitigated, and rejected risks.

**Workstreams**
- Governance readiness: Score aggregation and validation.
- Evaluation feedback loops: Consistency checks on scoring outcomes.
- Incident readiness: Assess operational risk residuals.
- Knowledge transfer: Draft risk narrative and exception rationale.

**Task List**
- [ ] Task P2-01: Score each category using frozen thresholds.
- [ ] Task P2-02: Review scoring disputes and resolve with evidence.
- [ ] Task P2-03: Update risk register with owners and due dates.

**Entry Criteria**
- Criteria: Evidence package complete and validated.

**Exit Criteria**
- Criteria: Final score and risk disposition package approved for decision meeting.

**Risks**
- Risk: Subjective adjustments undermine score credibility.
- Mitigation: Require evidence-linked justification for any manual override.

**Rollback/Fallback**
- Rollback condition: Scoring process integrity is challenged or invalidated.
- Rollback action: Re-run scoring with independent review panel.

---

### Phase 3 - Go/No-Go Decision Session
**Phase Objective**
- Make a formal and accountable readiness decision.

**Linked SPEC Clauses**
- Clause(s): `22 Runbooks and Operations`.

**Blocking Dependencies**
- Dependency: Scoring and risk package finalized.

**Deliverables**
- Deliverable 1: Signed decision memo (go/no-go) with rationale.
- Deliverable 2: Approved exception list with time-bound remediation commitments.

**Workstreams**
- Governance readiness: Facilitate decision forum.
- Evaluation feedback loops: Present objective score outcomes.
- Incident readiness: Confirm operational capacity for next cycle.
- Knowledge transfer: Record decision assumptions and constraints.

**Task List**
- [ ] Task P3-01: Conduct formal go/no-go review session.
- [ ] Task P3-02: Record decision vote and rationale.
- [ ] Task P3-03: Publish signed memo and communicate outcome.

**Entry Criteria**
- Criteria: Required signatories present and briefing package complete.

**Exit Criteria**
- Criteria: Signed decision and exception dispositions published.

**Risks**
- Risk: Decision pressure overrides objective risk posture.
- Mitigation: Enforce mandatory threshold and veto conditions.

**Rollback/Fallback**
- Rollback condition: Sign-off process incomplete or invalid.
- Rollback action: Decision remains pending; reconvene with complete quorum.

---

### Phase 4 - Post-Decision Action Planning
**Phase Objective**
- Convert decision into executable follow-up actions and governance controls.

**Linked SPEC Clauses**
- Clause(s): `21 Test and Eval Plan`, `22 Runbooks and Operations`.

**Blocking Dependencies**
- Dependency: Decision memo published.

**Deliverables**
- Deliverable 1: If go, constrained pilot plan with explicit safety controls and KPIs.
- Deliverable 2: If no-go, remediation plan and re-gate timeline.

**Workstreams**
- Governance readiness: Action plan governance structure.
- Evaluation feedback loops: KPI and success criteria definition.
- Incident readiness: Guardrails and escalation model for pilot/remediation.
- Knowledge transfer: Roadmap and owner communication.

**Task List**
- [ ] Task P4-01: Draft follow-up plan based on decision branch.
- [ ] Task P4-02: Assign owners, milestones, and acceptance metrics.
- [ ] Task P4-03: Update master roadmap and governance tracker.

**Entry Criteria**
- Criteria: Decision finalized and communicated.

**Exit Criteria**
- Criteria: Next-cycle plan approved with owners and dates.

**Risks**
- Risk: Decision outcome not translated into concrete execution plan.
- Mitigation: Mandatory action plan sign-off within one week of decision.

**Rollback/Fallback**
- Rollback condition: Follow-up plan lacks owners or measurable outcomes.
- Rollback action: Escalate to steering committee and block next-cycle kickoff.

---

## 6) Detailed Backlog (Task Table)
| Task ID | Description | Owner Role | Estimate | Priority | Dependencies | Definition of Done | Verification Method |
|---|---|---|---|---|---|---|---|
| HRG-001 | Define readiness scorecard dimensions and thresholds | Program Lead | 0.75d | P0 | L2-08 | Scorecard framework approved by signatories | Approval record |
| HRG-002 | Build evidence checklist and owner matrix | Program Lead | 0.5d | P0 | HRG-001 | All criteria have evidence owner assigned | Checklist review |
| HRG-003 | Collect and validate upstream evidence artifacts | QA Lead | 1.25d | P0 | HRG-002 | Evidence completeness validated | Validation report |
| HRG-004 | Score readiness and update risk register | Security Lead | 1d | P0 | HRG-003 | Weighted score and risk dispositions complete | Review package |
| HRG-005 | Conduct formal go/no-go session and capture decision | Program Lead | 0.5d | P0 | HRG-004 | Signed decision memo published | Governance minutes |
| HRG-006 | Document accepted exceptions and remediation SLAs | Security Lead | 0.5d | P1 | HRG-005 | Exceptions tracked with owners and dates | Exception register |
| HRG-007 | Draft post-decision pilot/remediation plan | Platform Lead | 0.75d | P1 | HRG-005 | Action plan includes milestones, KPIs, owners | Plan review |
| HRG-008 | Update roadmap and communicate next-cycle plan | Program Lead | 0.5d | P1 | HRG-007 | Roadmap and communications delivered | Stakeholder acknowledgment |

## 7) Validation and Test Strategy
### 7.1 Unit
- Required unit coverage: Scorecard calculators and threshold logic (if automated).

### 7.2 Integration
- Required integration scenarios: Evidence ingestion, scoring, and reporting workflow.

### 7.3 End-to-End
- Required e2e scenarios: End-to-end readiness workflow from criteria definition to decision memo.

### 7.4 Negative and Failure Path Testing
- Required failure scenarios: Missing artifacts, disputed scoring, quorum/sign-off failure.

### 7.5 CI Quality Gates
- Required checks: Evidence completeness validation, scorecard consistency checks, decision artifact integrity.

## 8) Observability and Metrics
### 8.1 Required Instrumentation
- Logs: Gate workflow actions, approvals, and score changes.
- Metrics: Criteria completion %, readiness score trend, unresolved risk count.
- Traces: Optional workflow trace for automated gate tooling.
- Events: Decision state transitions and exception updates.

### 8.2 SLO/SLA Targets
- Latency targets: Readiness gate completes within planned gate window.
- Error rate targets: 0 untracked criteria or missing mandatory artifacts at decision time.
- Cost targets: Gate process overhead remains within governance budget allocation.

### 8.3 Alerting and Dashboards
- Alerts required: Missing critical evidence, overdue exception remediation, missed sign-off deadlines.
- Dashboard panels required: Readiness category scores, evidence completeness, open critical risks.

## 9) Security and Policy Checks
### 9.1 Threats Introduced by This Scope
- Threat: Governance process drift allows unsafe readiness decisions.

### 9.2 Required Controls
- Control: Evidence-linked thresholds, mandatory signatories, and auditable decision records.

### 9.3 Security Validation
- Static analysis: Validate completeness and integrity of decision artifacts.
- Runtime checks: Enforce access controls on approval workflows.
- Abuse/misuse tests: Attempt unauthorized decision edits or exception approvals.

### 9.4 Audit Artifacts
- Required artifacts: Readiness scorecard, risk register, signed decision memo, exception log.

## 10) Rollout Strategy
### 10.1 Feature Flags
- Flag name: `governance.harness_readiness_gate_active`
- Default state: true for gate workflow; harness execution flags remain false.
- Rollout criteria: Not applicable (governance process artifact).

### 10.2 Environment Progression
- Dev -> Staging -> Production path: N/A for runtime behavior; governance workflow only.

### 10.3 Canary/Cohort Plan
- Cohort definition: N/A; process applies to governance stakeholders.
- Success criteria: Decision process completes with complete evidence and valid approvals.

### 10.4 Kill Switch and Rollback
- Trigger conditions: Invalid sign-off process or critical evidence gaps.
- Rollback steps: Revert decision status to pending and re-run gate process.

## 11) Operational Readiness
### 11.1 Runbook Changes
- Runbook updates required: Harness readiness governance workflow and exception handling.

### 11.2 On-Call Readiness
- Alert owner: Program operations owner.
- Escalation path: Program Lead -> Security Lead -> Executive sponsor.

### 11.3 Support Handoff
- Documentation handoff: Decision memo template, scorecard template, risk register process.
- Training handoff: Governance board walkthrough of gate mechanics.

## 12) Acceptance Criteria (Final Gate)
### 12.1 Functional Acceptance
- Criterion: Readiness gate executes end-to-end with complete evidence and signed decision.

### 12.2 Non-Functional Acceptance
- Criterion: Process timelines and decision quality thresholds are met.

### 12.3 Security/Compliance Acceptance
- Criterion: No critical security readiness gaps are accepted without explicit exception process.

### 12.4 Documentation Acceptance
- Criterion: Decision artifacts, exception logs, and follow-up action plans are complete and accessible.

## 13) Post-Implementation Review
### 13.1 Review Date
- Date: 2 weeks after decision publication.

### 13.2 Success Metrics Review
- Metrics reviewed: Decision lead time, evidence completeness, exception closure progress, stakeholder confidence.
- Outcome: To be recorded after review.

### 13.3 Deferred Work
- Follow-up task: Refine readiness model using outcomes from next cycle.
- Target phase: Future governance iteration.
