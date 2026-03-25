/**
 * Auth helpers – token exchange and AI JWT verification.
 */

import { createHmac, createPublicKey, createVerify, timingSafeEqual } from "node:crypto";
import type {
  AuthAppRegistryEntry,
  AuthIdpRegistryEntry,
  AuthClaimMapping,
  Config,
} from "../config/schema.js";
import { getErrorMeta, type ErrorCode } from "../contracts/errors.js";
import type { IngressRejection } from "../ingress/errors.js";
import type { CallerContext } from "../ingress/types.js";

interface JwtHeader {
  alg?: string;
  kid?: string;
}

type JwtPayload = Record<string, unknown> & {
  iss?: string;
  aud?: string | string[];
  exp?: number;
  nbf?: number;
  iat?: number;
};

interface ParsedJwt {
  header: JwtHeader;
  payload: JwtPayload;
  signingInput: string;
  signature: Buffer;
}

interface TokenExchangeRequestBody {
  subject_token: string;
  client_id: string;
  client_secret: string;
  requested_scopes?: string[];
}

export interface TokenExchangeSuccess {
  access_token: string;
  token_type: "Bearer";
  issued_token_type: "urn:ietf:params:oauth:token-type:jwt";
  expires_in: number;
  scope: string;
}

function createRejection(
  code: ErrorCode,
  message: string,
  detail: Record<string, unknown> = {}
): IngressRejection {
  return {
    code,
    message,
    detail: Object.keys(detail).length ? detail : undefined,
    httpStatus: getErrorMeta(code).httpStatus,
    retryable: getErrorMeta(code).retryable,
  };
}

function rejectAuth(message: string, detail: Record<string, unknown> = {}): never {
  throw createRejection("AUTH_INVALID", message, detail);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseScopesValue(value: unknown, claimName: string): string[] {
  if (value === undefined || value === null) return [];
  if (typeof value === "string") {
    const scopes = value
      .split(/\s+/)
      .map((s) => s.trim())
      .filter(Boolean);
    return Array.from(new Set(scopes));
  }
  if (Array.isArray(value) && value.every((v) => typeof v === "string")) {
    const scopes = value.map((v) => v.trim()).filter(Boolean);
    return Array.from(new Set(scopes));
  }
  rejectAuth("Invalid scopes claim", { claim: claimName });
}

function parseBearerToken(authHeader: string | undefined): string | undefined {
  if (!authHeader) return undefined;
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!match) return undefined;
  const token = match[1]?.trim();
  return token || undefined;
}

function parseJwt(token: string): ParsedJwt {
  const parts = token.split(".");
  if (parts.length !== 3 || parts.some((part) => !part)) {
    rejectAuth("Invalid token format");
  }
  const [encodedHeader, encodedPayload, encodedSignature] = parts;
  let headerRaw: string;
  let payloadRaw: string;
  let signature: Buffer;
  try {
    headerRaw = Buffer.from(encodedHeader, "base64url").toString("utf8");
    payloadRaw = Buffer.from(encodedPayload, "base64url").toString("utf8");
    signature = Buffer.from(encodedSignature, "base64url");
  } catch {
    rejectAuth("Invalid token encoding");
  }
  if (signature.length === 0) {
    rejectAuth("Invalid token signature");
  }
  let header: JwtHeader;
  let payload: JwtPayload;
  try {
    header = JSON.parse(headerRaw) as JwtHeader;
    payload = JSON.parse(payloadRaw) as JwtPayload;
  } catch {
    rejectAuth("Invalid token payload");
  }
  if (!isRecord(header) || !isRecord(payload)) {
    rejectAuth("Invalid token payload");
  }
  return {
    header,
    payload,
    signingInput: `${encodedHeader}.${encodedPayload}`,
    signature,
  };
}

function verifyHs256Signature(parsed: ParsedJwt, secret: string): void {
  if (parsed.header.alg !== "HS256") {
    rejectAuth("Unsupported token algorithm", { alg: parsed.header.alg ?? "unknown" });
  }
  const expected = createHmac("sha256", secret).update(parsed.signingInput).digest();
  if (parsed.signature.length !== expected.length) {
    rejectAuth("Invalid token signature");
  }
  if (!timingSafeEqual(parsed.signature, expected)) {
    rejectAuth("Invalid token signature");
  }
}

interface JwkRsa {
  kty: "RSA";
  kid?: string;
  alg?: string;
  use?: string;
  n: string;
  e: string;
  [key: string]: unknown;
}

interface JwksDocument {
  keys: JwkRsa[];
}

const JWKS_CACHE_TTL_MS = 5 * 60 * 1000;
const jwksCache = new Map<string, { fetchedAt: number; data: JwksDocument }>();

async function fetchJwks(uri: string): Promise<JwksDocument> {
  const cached = jwksCache.get(uri);
  if (cached && Date.now() - cached.fetchedAt < JWKS_CACHE_TTL_MS) {
    return cached.data;
  }
  const response = await fetch(uri, { method: "GET" });
  if (!response.ok) {
    rejectAuth("Failed to fetch JWKS", { jwks_uri: uri, status: response.status });
  }
  const doc = (await response.json()) as JwksDocument;
  if (!doc || !Array.isArray(doc.keys)) {
    rejectAuth("Invalid JWKS payload", { jwks_uri: uri });
  }
  jwksCache.set(uri, { fetchedAt: Date.now(), data: doc });
  return doc;
}

function selectJwk(parsed: ParsedJwt, doc: JwksDocument): JwkRsa {
  const kid = parsed.header.kid;
  const rsaKeys = doc.keys.filter((key) => key.kty === "RSA" && key.n && key.e);
  if (!rsaKeys.length) {
    rejectAuth("No RSA keys in JWKS");
  }
  if (kid) {
    const keyed = rsaKeys.find((key) => key.kid === kid);
    if (keyed) return keyed;
    rejectAuth("No matching JWKS key for token kid", { kid });
  }
  return rsaKeys[0];
}

async function verifyRs256Signature(parsed: ParsedJwt, jwksUri: string): Promise<void> {
  if (parsed.header.alg !== "RS256") {
    rejectAuth("Unsupported token algorithm", { alg: parsed.header.alg ?? "unknown" });
  }
  const jwks = await fetchJwks(jwksUri);
  const jwk = selectJwk(parsed, jwks);
  const publicKey = createPublicKey({
    key: jwk as unknown as Record<string, unknown>,
    format: "jwk",
  } as Parameters<typeof createPublicKey>[0]);
  const verify = createVerify("RSA-SHA256");
  verify.update(parsed.signingInput);
  verify.end();
  const ok = verify.verify(publicKey, parsed.signature);
  if (!ok) {
    rejectAuth("Invalid token signature");
  }
}

function getRequiredStringClaim(payload: JwtPayload, claimName: string): string {
  const value = payload[claimName];
  if (typeof value !== "string" || !value.trim()) {
    rejectAuth("Missing required token claim", { claim: claimName });
  }
  return value;
}

function getOptionalStringClaim(payload: JwtPayload, claimName: string): string | undefined {
  const value = payload[claimName];
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "string" || !value.trim()) {
    rejectAuth("Invalid token claim", { claim: claimName });
  }
  return value;
}

function getRequiredNumberClaim(payload: JwtPayload, claimName: string): number {
  const value = payload[claimName];
  if (typeof value !== "number" || !Number.isFinite(value)) {
    rejectAuth("Missing required token claim", { claim: claimName });
  }
  return value;
}

function audienceMatches(audClaim: unknown, expectedAudience: string): boolean {
  if (typeof audClaim === "string") return audClaim === expectedAudience;
  if (Array.isArray(audClaim) && audClaim.every((item) => typeof item === "string")) {
    return audClaim.includes(expectedAudience);
  }
  return false;
}

function assertRegisteredIssuer(
  idpRegistry: AuthIdpRegistryEntry[],
  issuer: string
): AuthIdpRegistryEntry {
  const idp = idpRegistry.find((entry) => entry.issuer === issuer);
  if (!idp) {
    rejectAuth("Unknown token issuer", { issuer });
  }
  return idp;
}

function assertClientCredentials(
  appRegistry: AuthAppRegistryEntry[],
  clientId: string,
  clientSecret: string
): AuthAppRegistryEntry {
  const app = appRegistry.find(
    (entry) => entry.client_id === clientId && entry.client_secret === clientSecret
  );
  if (!app) {
    rejectAuth("Invalid client credentials");
  }
  return app;
}

/** Clock skew tolerance in seconds (L2-05: 5-10s leeway for exp/nbf claims) */
const CLOCK_SKEW_TOLERANCE_SECONDS = 10;

/**
 * Upper bound on exp−iat for AI JWTs accepted on `/v1/query` (WANT-011 / short-lived tokens).
 * Keep aligned with `AuthConfigSchema` `ai_jwt_ttl_seconds` `.max()`.
 */
const AI_JWT_MAX_ACCEPTED_LIFETIME_SECONDS = 3600;

/**
 * AI JWTs used for query must include iat, sane exp−iat, and sub aligned with user_id (SPEC 19–style binding).
 */
function assertAiJwtQueryShape(payload: JwtPayload, nowMs: number): void {
  const nowSec = Math.floor(nowMs / 1000);
  const iat = getRequiredNumberClaim(payload, "iat");
  if (!Number.isInteger(iat)) {
    rejectAuth("Invalid token claim", { claim: "iat" });
  }
  if (iat > nowSec + CLOCK_SKEW_TOLERANCE_SECONDS) {
    rejectAuth("Token issued in the future", { iat, now: nowSec });
  }
  const exp = getRequiredNumberClaim(payload, "exp");
  if (!Number.isInteger(exp)) {
    rejectAuth("Invalid token claim", { claim: "exp" });
  }
  if (exp <= iat) {
    rejectAuth("Invalid token lifetime", { exp, iat });
  }
  const lifetimeSec = exp - iat;
  if (lifetimeSec > AI_JWT_MAX_ACCEPTED_LIFETIME_SECONDS) {
    rejectAuth("Token lifetime exceeds maximum", {
      max_seconds: AI_JWT_MAX_ACCEPTED_LIFETIME_SECONDS,
      lifetime_seconds: lifetimeSec,
    });
  }
  const userId = getRequiredStringClaim(payload, "user_id");
  const sub = getRequiredStringClaim(payload, "sub");
  if (sub !== userId) {
    rejectAuth("Token subject does not match user_id claim");
  }
}

function assertStandardClaims(
  payload: JwtPayload,
  expectedIssuer: string,
  expectedAudience: string,
  nowMs: number
): void {
  const nowSec = Math.floor(nowMs / 1000);
  const issuer = getRequiredStringClaim(payload, "iss");
  if (issuer !== expectedIssuer) {
    rejectAuth("Token issuer mismatch", {
      expected_issuer: expectedIssuer,
      received_issuer: issuer,
    });
  }
  if (!audienceMatches(payload.aud, expectedAudience)) {
    rejectAuth("Token audience mismatch", {
      expected_audience: expectedAudience,
      received_audience: payload.aud,
    });
  }
  const exp = getRequiredNumberClaim(payload, "exp");
  // L2-05: Allow clock skew tolerance for exp claim
  if (exp <= nowSec - CLOCK_SKEW_TOLERANCE_SECONDS) {
    rejectAuth("Token expired", { exp, now: nowSec, skew_tolerance: CLOCK_SKEW_TOLERANCE_SECONDS });
  }
  const nbf = payload.nbf;
  if (nbf !== undefined) {
    if (typeof nbf !== "number" || !Number.isFinite(nbf)) {
      rejectAuth("Invalid token claim", { claim: "nbf" });
    }
    // L2-05: Allow clock skew tolerance for nbf claim
    if (nbf > nowSec + CLOCK_SKEW_TOLERANCE_SECONDS) {
      rejectAuth("Token not yet valid", { nbf, now: nowSec, skew_tolerance: CLOCK_SKEW_TOLERANCE_SECONDS });
    }
  }
}

function parseTokenExchangeRequest(body: unknown): TokenExchangeRequestBody {
  if (!isRecord(body)) {
    rejectAuth("Invalid token exchange payload");
  }
  const subjectToken = body.subject_token;
  const clientId = body.client_id;
  const clientSecret = body.client_secret;
  if (typeof subjectToken !== "string" || !subjectToken.trim()) {
    rejectAuth("subject_token is required");
  }
  if (typeof clientId !== "string" || !clientId.trim()) {
    rejectAuth("client_id is required");
  }
  if (typeof clientSecret !== "string" || !clientSecret.trim()) {
    rejectAuth("client_secret is required");
  }

  let requestedScopes: string[] | undefined;
  if ("requested_scopes" in body) {
    requestedScopes = parseScopesValue(body.requested_scopes, "requested_scopes");
  } else if ("scope" in body) {
    requestedScopes = parseScopesValue(body.scope, "scope");
  }
  return {
    subject_token: subjectToken,
    client_id: clientId,
    client_secret: clientSecret,
    requested_scopes: requestedScopes,
  };
}

function readMappedClaim(
  payload: JwtPayload,
  mapping: AuthClaimMapping,
  claimKey: keyof AuthClaimMapping
): unknown {
  const claimName = mapping[claimKey];
  return payload[claimName];
}

function issueJwt(payload: JwtPayload, secret: string): string {
  const header = { alg: "HS256", typ: "JWT" };
  const encodedHeader = Buffer.from(JSON.stringify(header), "utf8").toString("base64url");
  const encodedPayload = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const signingInput = `${encodedHeader}.${encodedPayload}`;
  const signature = createHmac("sha256", secret).update(signingInput).digest("base64url");
  return `${signingInput}.${signature}`;
}

function resolveIssuedScopes(
  externalScopes: string[],
  appEntry: AuthAppRegistryEntry,
  requestedScopes: string[] | undefined
): string[] {
  const allowedScopes = new Set(appEntry.allowed_scopes);
  const effectiveExternalScopes = externalScopes.filter((scope) => allowedScopes.has(scope));
  if (effectiveExternalScopes.length === 0) {
    rejectAuth("No allowed scopes for client");
  }
  if (!requestedScopes || requestedScopes.length === 0) {
    return Array.from(new Set(effectiveExternalScopes));
  }
  const uniqueRequested = Array.from(new Set(requestedScopes));
  const denied = uniqueRequested.filter(
    (scope) => !allowedScopes.has(scope) || !externalScopes.includes(scope)
  );
  if (denied.length > 0) {
    rejectAuth("Requested scopes are not allowed", { denied_scopes: denied });
  }
  return uniqueRequested;
}

export async function exchangeToken(
  body: unknown,
  config: Config,
  nowMs: number = Date.now()
): Promise<TokenExchangeSuccess> {
  const request = parseTokenExchangeRequest(body);
  const appEntry = assertClientCredentials(
    config.auth.app_registry,
    request.client_id,
    request.client_secret
  );
  const parsedExternal = parseJwt(request.subject_token);
  const externalIssuer = getRequiredStringClaim(parsedExternal.payload, "iss");
  const idpEntry = assertRegisteredIssuer(config.auth.idp_registry, externalIssuer);
  if (!appEntry.allowed_issuers.includes(idpEntry.issuer)) {
    rejectAuth("Issuer not allowed for client", { issuer: idpEntry.issuer });
  }
  if (idpEntry.jwt_algorithm === "RS256") {
    if (!idpEntry.jwks_uri) {
      rejectAuth("jwks_uri is required for RS256 issuer");
    }
    await verifyRs256Signature(parsedExternal, idpEntry.jwks_uri);
  } else {
    if (!idpEntry.jwt_secret) {
      rejectAuth("jwt_secret is required for HS256 issuer");
    }
    verifyHs256Signature(parsedExternal, idpEntry.jwt_secret);
  }
  assertStandardClaims(parsedExternal.payload, idpEntry.issuer, idpEntry.audience, nowMs);

  const mapping = idpEntry.claim_mapping;
  const orgIdClaim = readMappedClaim(parsedExternal.payload, mapping, "org_id");
  const userIdClaim = readMappedClaim(parsedExternal.payload, mapping, "user_id");
  const appIdClaim = readMappedClaim(parsedExternal.payload, mapping, "app_id");
  const sessionIdClaim = readMappedClaim(parsedExternal.payload, mapping, "session_id");
  const scopesClaim = readMappedClaim(parsedExternal.payload, mapping, "scopes");
  const orgId = typeof orgIdClaim === "string" && orgIdClaim.trim() ? orgIdClaim : undefined;
  if (!orgId) {
    rejectAuth("Missing required token claim", { claim: mapping.org_id });
  }
  const userId = typeof userIdClaim === "string" && userIdClaim.trim() ? userIdClaim : undefined;
  if (!userId) {
    rejectAuth("Missing required token claim", { claim: mapping.user_id });
  }
  if (typeof appIdClaim === "string" && appIdClaim.trim() && appIdClaim !== appEntry.app_id) {
    rejectAuth("App claim mismatch", { expected_app_id: appEntry.app_id, received_app_id: appIdClaim });
  }
  let sessionId: string | undefined;
  if (sessionIdClaim !== undefined && sessionIdClaim !== null) {
    if (typeof sessionIdClaim !== "string" || !sessionIdClaim.trim()) {
      rejectAuth("Invalid token claim", { claim: mapping.session_id });
    }
    sessionId = sessionIdClaim;
  }
  const externalScopes = parseScopesValue(scopesClaim, mapping.scopes);
  const issuedScopes = resolveIssuedScopes(
    externalScopes,
    appEntry,
    request.requested_scopes
  );

  const issuedAt = Math.floor(nowMs / 1000);
  const expiresIn = config.auth.ai_jwt_ttl_seconds;
  const expiresAt = issuedAt + expiresIn;
  const payload: JwtPayload = {
    iss: config.auth.ai_jwt_issuer,
    aud: config.auth.ai_jwt_audience,
    iat: issuedAt,
    exp: expiresAt,
    sub: userId,
    org_id: orgId,
    app_id: appEntry.app_id,
    user_id: userId,
    scopes: issuedScopes,
    scope: issuedScopes.join(" "),
    client_id: appEntry.client_id,
  };
  if (sessionId) {
    payload.session_id = sessionId;
  }
  const accessToken = issueJwt(payload, config.auth.ai_jwt_secret);
  return {
    access_token: accessToken,
    token_type: "Bearer",
    issued_token_type: "urn:ietf:params:oauth:token-type:jwt",
    expires_in: expiresIn,
    scope: issuedScopes.join(" "),
  };
}

export function queryRequiresAiJwt(config: Config): boolean {
  return config.env === "production" || config.requireAuthHeader;
}

export function verifyQueryCallerFromAuthHeader(
  authHeader: string | undefined,
  config: Config,
  nowMs: number = Date.now()
): CallerContext | undefined {
  const token = parseBearerToken(authHeader);
  if (!token) {
    if (queryRequiresAiJwt(config)) {
      rejectAuth("Missing or invalid authorization");
    }
    return undefined;
  }
  const parsed = parseJwt(token);
  verifyHs256Signature(parsed, config.auth.ai_jwt_secret);
  assertStandardClaims(
    parsed.payload,
    config.auth.ai_jwt_issuer,
    config.auth.ai_jwt_audience,
    nowMs
  );
  assertAiJwtQueryShape(parsed.payload, nowMs);
  const scopes = parseScopesValue(parsed.payload.scopes ?? parsed.payload.scope, "scopes");
  const missingScopes = config.auth.query_required_scopes.filter(
    (scope) => !scopes.includes(scope)
  );
  if (missingScopes.length) {
    rejectAuth("Token scope mismatch", { missing_scopes: missingScopes });
  }
  const appId = getRequiredStringClaim(parsed.payload, "app_id");
  const userId = getRequiredStringClaim(parsed.payload, "user_id");
  const orgId = getRequiredStringClaim(parsed.payload, "org_id");
  const sessionId = getOptionalStringClaim(parsed.payload, "session_id");
  return {
    appId,
    userId,
    orgId,
    sessionId,
    scopes,
  };
}
