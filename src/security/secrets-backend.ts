/**
 * Scoped secrets backends – stub for dev; env / AWS SM / Vault integration for production.
 * @see docs/SPEC/19_Security_and_Isolation_Spec.md, PR-005
 */

export type SecretsBackendKind = "stub" | "env" | "aws_secrets_manager" | "vault";

export interface SecretsBackend {
  readonly kind: SecretsBackendKind;
  resolve(key: string): Promise<string | null>;
}

/** Dev-only: never returns real secret material. */
export class StubSecretsBackend implements SecretsBackend {
  readonly kind = "stub" as const;

  resolve(_key: string): Promise<string | null> {
    return Promise.resolve("[REDACTED]");
  }
}

function normalizeEnvKey(key: string, prefix: string): string {
  const safe = key.replace(/[^a-zA-Z0-9]/g, "_").toUpperCase();
  return `${prefix}${safe}`;
}

/**
 * Resolves secrets from process env (SCOPED_SECRETS_JSON and/or SCOPED_SECRETS_ENV_PREFIX).
 * Production platforms inject values from K8s secrets, External Secrets, AWS SM, or Vault agents.
 */
export class EnvSecretsBackend implements SecretsBackend {
  readonly kind: SecretsBackendKind;

  private readonly map: Record<string, string>;
  private readonly prefix: string;

  constructor(kind: Exclude<SecretsBackendKind, "stub"> = "env") {
    this.kind = kind;
    this.prefix = (process.env.SCOPED_SECRETS_ENV_PREFIX ?? "SCOPED_SECRET_").trim();
    const raw = process.env.SCOPED_SECRETS_JSON?.trim();
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as unknown;
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
          this.map = Object.fromEntries(
            Object.entries(parsed as Record<string, unknown>).filter(
              ([, v]) => typeof v === "string" && v.length > 0
            ) as [string, string][]
          );
        } else {
          this.map = {};
        }
      } catch {
        this.map = {};
      }
    } else {
      this.map = {};
    }
  }

  resolve(key: string): Promise<string | null> {
    const trimmed = key.trim();
    if (!trimmed) return Promise.resolve(null);
    const fromMap = this.map[trimmed];
    if (fromMap) return Promise.resolve(fromMap);
    const envName = normalizeEnvKey(trimmed, this.prefix);
    const fromEnv = process.env[envName]?.trim();
    return Promise.resolve(fromEnv || null);
  }
}

let activeBackend: SecretsBackend | null = null;

export function createSecretsBackend(kind: SecretsBackendKind): SecretsBackend {
  if (kind === "stub") return new StubSecretsBackend();
  return new EnvSecretsBackend(kind);
}

export function initializeSecretsBackend(kind: SecretsBackendKind): SecretsBackend {
  const backend = createSecretsBackend(kind);
  activeBackend = backend;
  return backend;
}

export function getSecretsBackend(): SecretsBackend {
  if (!activeBackend) {
    activeBackend = createSecretsBackend("stub");
  }
  return activeBackend;
}

/** Test-only: reset backend singleton. */
export function resetSecretsBackendForTest(): void {
  activeBackend = null;
}
