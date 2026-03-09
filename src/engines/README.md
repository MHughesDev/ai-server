# Engines (Layer 2)

Bounded, reusable building blocks that operate on **Typed Artifacts**. Each engine implements **IEngine** and uses at most one gateway (Model, Tool, or Memory).

## Interface

- **`IEngine`** (`base.ts`): `invoke(inv: EngineInvocation): Promise<EngineResult>`
- All engines consume **EngineInvocation** and return **EngineResult** (see `src/contracts/` and `docs/Engines-and-Contracts.md`).

## Modules (M1)

| File | Engine | Role |
|------|--------|------|
| `execution_engine.ts` | Execution | Single-pass execution; may call Model Gateway |
| `synthesis_engine.ts` | Synthesis | Final response from context; may call Model Gateway |
| `classification_engine.ts` | Classification | Classification labels (stub) |
| `registry.ts` | — | Map `engine_type` → `IEngine` for workflow runtime |

## Usage

Pipelines (e.g. `pipelines/chat-pipeline.ts`) create engines (e.g. `createExecutionEngine(gateway)`), build **EngineInvocation** from the plan and canonical request, call `engine.invoke(inv)`, and assemble the response from **EngineResult**.

## Rule

**No engine may import another engine** for the purpose of invoking it. Only the workflow runtime or orchestrator dispatches engines. Tests may import the engine under test.

## References

- Contracts: `src/contracts/engine-invocation.ts`, `engine-result.ts`, `task.ts`, `typed-artifact.ts`
- Doc: `docs/Engines-and-Contracts.md`
- Architecture: §8.6, §9.5, §10
