#!/usr/bin/env node
/**
 * Structural validation for k8s/ deployment manifests (PR-030).
 */

import { readFile, readdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const K8S_ROOT = join(__dirname, "..", "k8s");

async function listYamlFiles(dir) {
  const out = [];
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...(await listYamlFiles(full)));
    } else if (entry.isFile() && (entry.name.endsWith(".yaml") || entry.name.endsWith(".yml"))) {
      out.push(full);
    }
  }
  return out;
}

function parseKustomizationResources(content) {
  const resources = [];
  const lines = content.split("\n");
  let inResources = false;
  for (const line of lines) {
    if (/^resources:\s*$/.test(line)) {
      inResources = true;
      continue;
    }
    if (inResources) {
      const m = line.match(/^\s+-\s+(.+)$/);
      if (m) {
        resources.push(m[1].trim());
        continue;
      }
      if (/^\S/.test(line) && !line.startsWith("#")) {
        inResources = false;
      }
    }
  }
  return resources;
}

async function main() {
  const errors = [];
  const yamlFiles = await listYamlFiles(K8S_ROOT);

  for (const file of yamlFiles) {
    const content = await readFile(file, "utf8");
    const rel = file.replace(`${K8S_ROOT}/`, "");

    if (rel.endsWith("kustomization.yaml")) {
      const dir = dirname(file);
      for (const res of parseKustomizationResources(content)) {
        if (res.startsWith("../../")) continue;
        const candidate = join(dir, res);
        try {
          await readFile(candidate, "utf8");
        } catch {
          errors.push(`${rel}: missing resource ${res}`);
        }
      }
      continue;
    }

    if (!/^apiVersion:\s/m.test(content)) {
      errors.push(`${rel}: missing apiVersion`);
    }
    if (!/^kind:\s/m.test(content)) {
      errors.push(`${rel}: missing kind`);
    }

    if (rel.endsWith("deployment.yaml")) {
      if (!/terminationGracePeriodSeconds:\s*45/.test(content)) {
        errors.push(`${rel}: expected terminationGracePeriodSeconds: 45 (PR-022)`);
      }
      if (!/livenessProbe:/.test(content)) {
        errors.push(`${rel}: missing livenessProbe`);
      }
      if (!/readinessProbe:/.test(content)) {
        errors.push(`${rel}: missing readinessProbe`);
      }
      if (!/RELEASE_ID/.test(content)) {
        errors.push(`${rel}: missing RELEASE_ID env for traceability`);
      }
      if (!/OPERATIONAL_BEARER_TOKEN|Bearer/.test(content)) {
        errors.push(`${rel}: probes should send Bearer when operational token is set`);
      }
    }
  }

  for (const overlay of ["dev", "staging", "prod"]) {
    const kust = join(K8S_ROOT, "overlays", overlay, "kustomization.yaml");
    try {
      const content = await readFile(kust, "utf8");
      if (!content.includes("../../base")) {
        errors.push(`overlays/${overlay}: must reference ../../base`);
      }
    } catch {
      errors.push(`overlays/${overlay}/kustomization.yaml: missing`);
    }
  }

  if (errors.length > 0) {
    console.error("[validate-k8s] Failed:");
    for (const e of errors) console.error(`  - ${e}`);
    process.exit(1);
  }

  console.log(`[validate-k8s] OK (${yamlFiles.length} YAML files)`);
}

main().catch((err) => {
  console.error("[validate-k8s] Failed:", err);
  process.exit(1);
});
