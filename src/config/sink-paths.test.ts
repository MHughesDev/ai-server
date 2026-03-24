/**
 * Production sink path validation (WANT-039).
 */

import { chmodSync, mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { assertProductionSinkPathsWritable } from "./sink-paths.js";
import type { Config } from "./schema.js";

function prodCfg(partial: Pick<Config, "auditLogPath" | "observabilityEventSinkPath">): Config {
  return { env: "production", ...partial } as Config;
}

describe("assertProductionSinkPathsWritable", () => {
  it("no-ops when env is not production", () => {
    expect(() =>
      assertProductionSinkPathsWritable({
        env: "dev",
        auditLogPath: "/nonexistent/foo.log",
      } as Config)
    ).not.toThrow();
  });

  it("no-ops when no sink paths configured", () => {
    expect(() => assertProductionSinkPathsWritable(prodCfg({}))).not.toThrow();
  });

  it("throws when audit sink parent directory is missing", () => {
    expect(() =>
      assertProductionSinkPathsWritable(
        prodCfg({ auditLogPath: "/nonexistent-dir-xyz-12345/audit.jsonl" })
      )
    ).toThrow(/AUDIT_LOG_PATH/);
  });

  it("passes when parent exists and file may be created", () => {
    const dir = mkdtempSync(join(tmpdir(), "sink-ok-"));
    try {
      const path = join(dir, "audit.jsonl");
      expect(() => assertProductionSinkPathsWritable(prodCfg({ auditLogPath: path }))).not.toThrow();
    } finally {
      rmSync(dir, { recursive: true });
    }
  });

  it("throws when existing sink file is not writable", () => {
    if (process.platform === "win32") {
      return;
    }
    const dir = mkdtempSync(join(tmpdir(), "sink-ro-"));
    const path = join(dir, "audit.jsonl");
    try {
      writeFileSync(path, "{}\n");
      chmodSync(path, 0o444);
      expect(() => assertProductionSinkPathsWritable(prodCfg({ auditLogPath: path }))).toThrow(
        /writable/
      );
    } finally {
      rmSync(dir, { recursive: true });
    }
  });
});
