/**
 * WANT-006 — Tools and memory only via gateways (and typed abstractions); policy gates tool allowlists
 * at dispatch (`query-handler.ts`). Pipelines must not import concrete memory backends.
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const srcDir = join(dirname(fileURLToPath(import.meta.url)), "..");

function readSrc(rel: string): string {
  return readFileSync(join(srcDir, rel), "utf8");
}

function importLines(src: string): string[] {
  return src
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.startsWith("import ") && (l.includes('from "') || l.includes("from '")));
}

describe("gateway access invariants (WANT-006)", () => {
  const pipelineFiles = [
    "pipelines/chat-pipeline.ts",
    "pipelines/coding-agent-pipeline.ts",
    "pipelines/decision-pipeline.ts",
    "pipelines/deep-research-pipeline.ts",
    "pipelines/nested-workflow-pipeline.ts",
  ];

  it("pipeline implementations only reach memory through IMemoryStore / memory_engine (no concrete store backends)", () => {
    const allowedMemoryImport = /\.\.\/memory\/(memory-abstraction\.js|types\.js)["']/;
    for (const rel of pipelineFiles) {
      const src = readSrc(rel);
      for (const line of importLines(src)) {
        if (!line.includes("../memory/")) continue;
        expect({ file: rel, line }).toEqual(
          expect.objectContaining({
            line: expect.stringMatching(allowedMemoryImport),
          })
        );
      }
    }
  });

  it("query-handler only imports memory via default-store and retrieval-service (orchestration wiring)", () => {
    const qh = readSrc("server/query-handler.ts");
    const allowed = /\.\.\/memory\/(default-store\.js|retrieval-service\.js)["']/;
    for (const line of importLines(qh)) {
      if (!line.includes("../memory/")) continue;
      expect({ line }).toEqual(expect.objectContaining({ line: expect.stringMatching(allowed) }));
    }
  });

  it("tool engine does not import memory modules", () => {
    const te = readSrc("engines/tool_engine.ts");
    expect(te).not.toMatch(/\.\.\/memory\//);
  });

  it("memory engine does not import tool gateway", () => {
    const me = readSrc("engines/memory_engine.ts");
    expect(me).not.toMatch(/tool-gateway|IToolGateway/);
  });
});
