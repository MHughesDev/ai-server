/**
 * WANT-012 — redaction at audit source and sink defensive layer.
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it, expect } from "@jest/globals";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

describe("WANT-012 invariants", () => {
  it("audit logger redacts before hash chain", () => {
    const src = readFileSync(join(REPO_ROOT, "src/security/audit-logger.ts"), "utf8");
    expect(src).toMatch(/redactAuditEvent/);
    expect(src).toMatch(/const safeEvent = redactAuditEvent\(event\)/);
    expect(src).toMatch(/pendingEvents\.push\(redactAuditEvent\(event\)\)/);
  });

  it("file event sink applies redactTelemetryEvent on write", () => {
    const src = readFileSync(join(REPO_ROOT, "src/observability/event-sink.ts"), "utf8");
    expect(src).toMatch(/redactTelemetryEvent\(event\)/);
    expect(src).toMatch(/payloadHasSensitiveKeys/);
  });

  it("taxonomy events use canonical emitTelemetryEvent", () => {
    const src = readFileSync(join(REPO_ROOT, "src/observability/taxonomy-events.ts"), "utf8");
    expect(src).toMatch(/emitTelemetryEvent/);
    expect(src).not.toMatch(/obs\.events\.emit/);
  });
});
