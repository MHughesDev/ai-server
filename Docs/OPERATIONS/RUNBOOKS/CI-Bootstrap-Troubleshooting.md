# CI and Bootstrap Troubleshooting

Runbook for CI failures and local bootstrap issues introduced by L2-01 (Contracts and Project Scaffold).

## Source Alignment

- Normative production requirements: `docs/ARCHITECTURE/Architecture_document_Finalized.md` (Sections 18.9, 18.11, 18.12).
- Current implementation deltas/gaps: `docs/OPERATIONS/Production-Readiness-Gaps-Report.md`.

---

## CI job fails

### Lint fails

- **Symptom:** `npm run lint` reports errors.
- **Actions:**
  1. Run `npm run lint` locally and fix reported files.
  2. ESLint uses `tsconfig.eslint.json` (includes tests). If type-aware rules complain, ensure types are correct; avoid `// eslint-disable` unless necessary.
  3. Commit fixes and re-run CI.

### Typecheck fails

- **Symptom:** `npm run typecheck` (tsc --noEmit) fails.
- **Actions:**
  1. Run `npm run typecheck` locally.
  2. Fix type errors in `src/`. Main tsconfig excludes `*.test.ts`; Jest compiles tests separately.
  3. If you added new contract fields, update types and validators together.

### Tests fail

- **Symptom:** `npm run test` or `npm run test:ci` fails.
- **Actions:**
  1. Run `npm run test -- --runInBand` locally to avoid flakiness.
  2. Contract tests must stay deterministic (no network, no random data). Fix any new test that depends on env or time.
  3. If a validator or schema changed, update the corresponding test and CHANGELOG.

### Startup smoke fails

- **Symptom:** `node dist/bootstrap/index.js` exits non-zero or doesn’t print "Bootstrap OK".
- **Actions:**
  1. Run `npm run build` then `node dist/bootstrap/index.js` locally.
  2. If config validation fails, check required env/defaults in `src/config/schema.ts`. No secrets in defaults; use env vars for secrets.
  3. Ensure Node version >= 20.

---

## Local bootstrap fails

- **Symptom:** `node dist/bootstrap/index.js` or `npm run start:dev` fails.
- **Actions:**
  1. Confirm `dist/` is up to date: `npm run build`.
  2. Config is loaded from `process.env`. Invalid values (e.g. invalid `env` or `logLevel`) cause parse failure. See `src/config/schema.ts` for allowed values.
  3. For ESM issues, ensure you’re running Node 20+ and that `package.json` has `"type": "module"`.

---

## Schema migration notes

- **Adding optional fields to contracts:** Add to Zod schema with `.optional()` or `.default(...)`; update CHANGELOG; add tests for new behavior.
- **New contract version (e.g. v2):** Add to supported list in `request-envelope.ts` (e.g. `z.enum(["v1", "v2"])`), update CHANGELOG and handoff compatibility matrix, then roll out behind a feature flag if needed.
- **Breaking change:** Introduce new version; document migration path in CHANGELOG; keep v1 supported until clients migrate (per version policy).

---

## Escalation

- **Owner:** Platform Lead (contracts, config, CI).
- **Next:** Runtime Lead (scaffold, bootstrap, L2-02 path).
