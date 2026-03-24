# Schema Ref Catalog

**Purpose:** Single source of truth for `schema_ref` URIs and artifact kinds used in Typed Artifacts across engines and brainstem. Use for consistent validation and documentation. See Architecture §8.4, SOW §7.
**Production-target reference:** `docs/ARCHITECTURE/Architecture_document_Finalized.md` (Sections 8 and 18).  
**Current-state delta reference:** `docs/OPERATIONS/Production-Readiness-Gaps-Report.md`.

**Convention:** `schema://<name>@v1` (version suffix may change in future; document in contracts CHANGELOG).

---

## Schema ref URIs (by source)

| schema_ref | artifact_kind(s) | Producer | Consumer / notes |
|------------|------------------|----------|-------------------|
| `schema://user_input@v1` | report | brainstem (canonicalToTypedArtifacts) | Engines (context_artifacts) |
| `schema://attachment_handle@v1` | document_chunk | brainstem (canonicalToTypedArtifacts) | Engines (context_artifacts) |
| `schema://report@v1` | report | Execution, Synthesis, Condensing engines; workflow runner | Downstream steps, ResponseEnvelope |
| `schema://workflow_plan@v1` | workflow_plan | Planning engine | Workflow runtime |
| `schema://evaluation_report@v1` | evaluation_report | Evaluation engine | Downstream steps |
| `schema://classification_result@v1` | (classification result) | Classification engine | Router / downstream |
| `schema://tool_result@v1` | tool_result | Tool engine | Execution / evaluation |
| `schema://memory_response@v1` | memory_response | Memory engine | Synthesis, citations |

---

## Artifact kinds (canonical list)

From `src/contracts/typed-artifact.ts` (ARTIFACT_KINDS):

- workflow_plan  
- evaluation_report  
- tool_result  
- memory_response  
- code_patch  
- report  
- diff  
- document_chunk  
- research_report  
- decision_memo  
- normalized_record  
- custom  

---

## References

- **Architecture:** `docs/ARCHITECTURE/Architecture_document_Finalized.md` §8.4 (Typed Artifact), §8.6 (Engine I/O).
- **Contracts:** `src/contracts/typed-artifact.ts`, `src/contracts/CHANGELOG.md`.
- **Brainstem:** `src/brainstem/canonical-to-artifacts.ts` (SCHEMA_REF_USER_INPUT, SCHEMA_REF_ATTACHMENT_HANDLE).
- **Engines:** Each engine sets `schema_ref` on result_artifacts; see `src/engines/*.ts`.
