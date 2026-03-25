/**
 * WANT-005 / Architecture §9.5 — engines do not orchestrate or invoke other engines;
 * each engine uses at most one gateway (or memory store) per factory, wired via `registry.ts`.
 */

import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const enginesDir = dirname(fileURLToPath(import.meta.url));

function engineImplementationFiles(): string[] {
  return readdirSync(enginesDir).filter(
    (name) =>
      name.endsWith(".ts") &&
      !name.endsWith(".test.ts") &&
      name !== "registry.ts" &&
      name !== "base.ts"
  );
}

describe("engine architecture invariants (WANT-005)", () => {
  it("engine implementations only use ./base.js from the engines directory (no sibling engine imports)", () => {
    for (const file of engineImplementationFiles()) {
      const abs = join(enginesDir, file);
      const src = readFileSync(abs, "utf8");
      const re = /from\s+["'](\.\/[^"']+)["']/g;
      let m: RegExpExecArray | null;
      while ((m = re.exec(src)) !== null) {
        expect({ file, import: m[1] }).toEqual({ file, import: "./base.js" });
      }
    }
  });
});
