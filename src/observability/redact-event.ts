/**
 * Shared telemetry event redaction (WANT-012) — used by emitter, sinks, and emit helpers.
 */

import type { TelemetryEvent } from "./events.js";
import { redact, resolveTelemetryRedactionLevel, type RedactionLevel } from "./redact.js";

export function resolveEventRedactionLevel(
  event: TelemetryEvent,
  defaultLevel?: RedactionLevel
): RedactionLevel {
  const fromEvent = event.redaction_level as RedactionLevel | undefined;
  if (fromEvent === "none" || fromEvent === "minimal" || fromEvent === "full") {
    return fromEvent;
  }
  return defaultLevel ?? resolveTelemetryRedactionLevel();
}

/** Redact a telemetry event for persistence or console output. */
export function redactTelemetryEvent(
  event: TelemetryEvent,
  defaultLevel?: RedactionLevel
): TelemetryEvent {
  const level = resolveEventRedactionLevel(event, defaultLevel);
  const withPayload: TelemetryEvent = {
    ...event,
    redaction_level: level,
    payload: event.payload
      ? (redact(event.payload, level, { payloadRoot: true }) as TelemetryEvent["payload"])
      : undefined,
  };
  return redact(withPayload, level) as TelemetryEvent;
}
