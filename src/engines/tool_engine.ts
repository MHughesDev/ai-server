/**
 * Tool Engine – executes tool calls via Tool Gateway only; no model or other engine.
 * WANT-029: Emits TOOL_START/TOOL_END with caller identity hints and TOOL_ACCESS audit for every
 * governed invocation (workflows, harnesses, registry) when policy + security flags allow.
 * @see Architecture §10.4; SOW M3 F.1
 * Rule: No file under src/engines/ may import another under src/engines/.
 */

import type { IEngine } from "./base.js";
import type {
  EngineInvocation,
  EngineResult,
  TypedArtifact,
} from "../contracts/index.js";
import type { IToolGateway, ToolCallerIdentity } from "../gateways/types.js";
import { getConfig } from "../bootstrap/index.js";
import { resolveFeatureFlagEnabled } from "../config/feature-flags.js";
import { getTraceContext } from "../observability/context.js";
import { getObservability } from "../observability/index.js";
import { redact, type RedactionLevel } from "../observability/redact.js";
import { writeAuditEvent } from "../security/audit-logger.js";
import { randomUUID } from "node:crypto";

const SCHEMA_REF_TOOL_RESULT = "schema://tool_result@v1";

function isAllowed(
  r: { allowed: boolean }
): r is { allowed: true; tool_id: string; result?: unknown; duration_ms?: number } {
  return r.allowed === true;
}

function buildToolCallerIdentity(inv: EngineInvocation): ToolCallerIdentity | undefined {
  if (!inv.actor_context) return undefined;
  return {
    org_id: inv.actor_context.org_id,
    app_id: inv.actor_context.app_id,
    user_id: inv.actor_context.user_id,
    session_id: inv.metadata?.trace_id,
    roles: inv.actor_context.roles,
    trace_id: inv.metadata?.trace_id,
    invocation_id: inv.invocation_id,
  };
}

function toolTelemetryPayload(
  toolId: string,
  invocationId: string,
  identity: ToolCallerIdentity | undefined,
  extra?: { duration_ms?: number }
): Record<string, unknown> {
  return {
    tool_id: toolId,
    invocation_id: invocationId,
    ...(identity
      ? {
          caller_org: identity.org_id,
          caller_app: identity.app_id,
          caller_user: identity.user_id,
        }
      : {}),
    ...extra,
  };
}

function emitToolLifecycle(
  eventType: "TOOL_START" | "TOOL_END",
  payload: Record<string, unknown>
): void {
  const obs = getObservability();
  const ctx = getTraceContext();
  if (obs?.events) {
    obs.events.emit({
      event_type: eventType,
      request_id: ctx?.request_id ?? "unknown",
      trace_id: ctx?.trace_id,
      timestamp_iso: new Date().toISOString(),
      redaction_level: "minimal",
      payload,
    });
  }
}

function writeToolAccessAudit(params: {
  inv: EngineInvocation;
  toolId: string;
  status: EngineResult["status"];
  durationMs: number;
  identity: ToolCallerIdentity | undefined;
}): void {
  const auditLevel = params.inv.metadata?.audit_level ?? "summary";
  if (auditLevel === "none") return;

  let securityAuditEnabled = false;
  try {
    securityAuditEnabled = resolveFeatureFlagEnabled(
      "security_hard_controls_enabled",
      getConfig(),
      params.identity
        ? {
            org_id: params.identity.org_id,
            app_id: params.identity.app_id,
            user_id: params.identity.user_id,
          }
        : undefined
    );
  } catch {
    /* bootstrap not called in some tests */
  }
  if (!securityAuditEnabled) return;

  const ctx = getTraceContext();
  const redactionLevel = (params.inv.metadata?.redaction_level ?? "minimal") as RedactionLevel;
  writeAuditEvent({
    event_type: "TOOL_ACCESS",
    request_id: ctx?.request_id ?? "unknown",
    trace_id: ctx?.trace_id,
    timestamp_iso: new Date().toISOString(),
    payload: redact(
      {
        tool_id: params.toolId,
        invocation_id: params.inv.invocation_id,
        allowed: params.status === "success",
        status: params.status,
        duration_ms: params.durationMs,
        caller_org: params.identity?.org_id,
        caller_app: params.identity?.app_id,
        caller_user: params.identity?.user_id,
        roles: params.identity?.roles,
      },
      redactionLevel
    ),
  });
}

export interface CreateToolEngineOptions {
  /** When set, only these tool_ids may be invoked; otherwise all are passed to gateway. */
  allowlist?: string[];
}

/**
 * Create Tool Engine that calls the Tool Gateway only.
 * Uses task.objective.formal_spec for { tool_id, parameters } when present.
 */
export function createToolEngine(
  gateway: IToolGateway,
  options: CreateToolEngineOptions = {}
): IEngine {
  const { allowlist } = options;

  return {
    async invoke(inv: EngineInvocation): Promise<EngineResult> {
      const start = Date.now();
      const formalSpec = inv.task.objective?.formal_spec;
      const toolId = (formalSpec?.tool_id as string) ?? undefined;
      const params =
        (formalSpec?.parameters as Record<string, unknown>) ??
        (formalSpec?.params as Record<string, unknown>);

      if (!toolId || typeof toolId !== "string") {
        const durationMs = Date.now() - start;
        return {
          invocation_id: inv.invocation_id,
          status: "fail",
          result_artifacts: [],
          error: {
            code: "TOOL_INVOCATION_INVALID",
            message: "Missing tool_id in task objective",
          },
          metrics: { duration_ms: durationMs },
        };
      }

      const identity = buildToolCallerIdentity(inv);

      if (allowlist != null && allowlist.length > 0 && !allowlist.includes(toolId)) {
        emitToolLifecycle("TOOL_START", toolTelemetryPayload(toolId, inv.invocation_id, identity));
        const durationMs = Date.now() - start;
        emitToolLifecycle(
          "TOOL_END",
          toolTelemetryPayload(toolId, inv.invocation_id, identity, { duration_ms: durationMs })
        );
        writeToolAccessAudit({ inv, toolId, status: "blocked", durationMs, identity });
        return {
          invocation_id: inv.invocation_id,
          status: "blocked",
          result_artifacts: [],
          error: {
            code: "TOOL_NOT_ALLOWED",
            message: `Tool ${toolId} is not in the allowlist`,
            detail: { tool_id: toolId, allowlist },
          },
          metrics: { duration_ms: durationMs },
        };
      }

      emitToolLifecycle("TOOL_START", toolTelemetryPayload(toolId, inv.invocation_id, identity));

      const gatewayStart = Date.now();
      let gwResult: Awaited<ReturnType<IToolGateway["invoke"]>>;
      try {
        gwResult = await gateway.invoke({
          tool_id: toolId,
          params: params ?? undefined,
          caller_identity: identity,
        });
      } finally {
        emitToolLifecycle(
          "TOOL_END",
          toolTelemetryPayload(toolId, inv.invocation_id, identity, {
            duration_ms: Date.now() - gatewayStart,
          })
        );
      }

      const durationMs = Date.now() - start;

      if (!isAllowed(gwResult)) {
        writeToolAccessAudit({ inv, toolId, status: "blocked", durationMs, identity });
        return {
          invocation_id: inv.invocation_id,
          status: "blocked",
          result_artifacts: [],
          error: {
            code: gwResult.reason,
            message: gwResult.message,
            detail: { tool_id: gwResult.tool_id },
          },
          metrics: { duration_ms: durationMs },
        };
      }

      writeToolAccessAudit({ inv, toolId, status: "success", durationMs, identity });

      const artifact: TypedArtifact = {
        artifact_id: randomUUID(),
        artifact_kind: "tool_result",
        schema_ref: SCHEMA_REF_TOOL_RESULT,
        encoding: "json",
        content: {
          inline: {
            tool_id: gwResult.tool_id,
            result: gwResult.result,
            duration_ms: gwResult.duration_ms ?? durationMs,
          },
        },
      };

      return {
        invocation_id: inv.invocation_id,
        status: "success",
        result_artifacts: [artifact],
        metrics: { duration_ms: durationMs },
      };
    },
  };
}
