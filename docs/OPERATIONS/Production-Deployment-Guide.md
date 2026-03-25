# Production Deployment Guide

**Purpose:** Step-by-step guide for deploying the AI Server to production environments.  
**Version:** 1.0  
**Last Updated:** 2026-03-07  
**Prerequisites:** Familiarity with Docker/container orchestration, Redis, and identity provider configuration.

> **Important:** This codebase is significantly more production-ready than previously documented. Many features marked as "not implemented" in older documentation are actually fully implemented with circuit breakers, health checks, and comprehensive validation.
>
> **Documentation authority:** This file is the canonical deployment and launch runbook. For target architecture requirements, use `docs/ARCHITECTURE/Architecture_document_Finalized.md` (Section 18). For current implementation status and remaining work, use `docs/OPERATIONS/Production-Readiness-Gaps-Report.md`.

---

## Table of Contents

1. [Quick Start Checklist](#quick-start-checklist)
2. [Consolidated Launch Checklist](#consolidated-launch-checklist)
3. [Required Configuration](#required-configuration)
4. [Security Hardening Checklist](#security-hardening-checklist)
5. [Verification Steps](#verification-steps)
6. [Production Readiness Summary](#production-readiness-summary)
7. [Troubleshooting](#troubleshooting)

---

## Quick Start Checklist

Before deploying to production, ensure you have:

- [ ] Model provider API key and endpoint configured
- [ ] IdP registry configured with JWKS URLs (for RS256) or secrets (for HS256)
- [ ] App registry with client credentials
- [ ] Redis instance for rate limiting and tenant budgets (recommended for multi-instance deployments)
- [ ] Audit log and event sink paths with proper permissions
- [ ] TLS certificates for HTTPS
- [ ] Operational bearer token set for protecting admin endpoints

---

## Consolidated Launch Checklist

The standalone launch checklist has been consolidated into this deployment guide to avoid drift.

Use this section as the production go/no-go gate:

- [ ] Auth and IdP/app registries are production-safe (no default/dev credentials).
- [ ] TLS cert/key paths are valid and HTTPS startup has been verified.
- [ ] Operational endpoints are protected with `OPERATIONAL_BEARER_TOKEN`.
- [ ] Model providers are non-synthetic and healthy in `/healthz` dependencies.
- [ ] Redis-backed rate limiting and tenant budget state are configured for multi-instance deployments.
- [ ] Audit/event sinks are writable, rotated externally, and monitored.
- [ ] Feature flags are set for rollout posture (`platform_production_rollout_enabled`, security/observability/cost controls).
- [ ] Required smoke tests, security tests, and resilience tests are green.
- [ ] Rollback path and release metadata are ready before enabling rollout.

---

## Required Configuration

### 1. Model Gateway Setup

The model gateway is **fully implemented** with circuit breakers, health checks, capability taxonomy, and scope/tenancy routing.

#### Environment Variables

```bash
# Required: OpenAI-compatible provider configuration
MODEL_PROVIDER_API_KEY="sk-xxxxxxxxxxxxxxxxxxxxxxxx"
MODEL_PROVIDER_ENDPOINT="https://api.openai.com/v1"
MODEL_PROVIDER_MODEL="gpt-4"

# Or use JSON configuration for multiple providers
MODEL_GATEWAY_PROVIDERS_JSON='[
  {
    "id": "openai",
    "kind": "openai_compatible",
    "default_model": "gpt-4",
    "base_url": "https://api.openai.com/v1",
    "api_key_env": "MODEL_PROVIDER_API_KEY",
    "input_cost_per_million_usd": 30.0,
    "output_cost_per_million_usd": 60.0
  }
]'

# Gateway settings
MODEL_GATEWAY_TIMEOUT_MS=25000
MODEL_GATEWAY_MAX_RETRIES=2
MODEL_GATEWAY_DEFAULT_MODEL=gpt-4
MODEL_GATEWAY_DEFAULT_CAPABILITY=chat

# Memory and Embeddings Configuration
MEMORY_BACKEND="in_memory"  # Options: in_memory, vector
MEMORY_EMBEDDING_PROVIDER="hash"  # Options: hash, openai, gateway
MEMORY_EMBEDDING_MODEL="text-embedding-3-small"
MEMORY_EMBEDDING_API_KEY_ENV="OPENAI_API_KEY"
MEMORY_EMBEDDING_DIMENSIONS=1536
MEMORY_RETRIEVAL_TIMEOUT_MS=1500
MEMORY_MAX_CONTEXT_TOKENS=1000
MEMORY_MAX_CHUNKS_PER_INGEST=128

# Observability Configuration
OBSERVABILITY_TRACE_SAMPLE_RATE=1.0  # 0.0-1.0, reduce in production

# Attachment Configuration (for multimodal)
MAX_ATTACHMENT_COUNT=10
MAX_ATTACHMENT_BYTES=4194304  # 4MB
```

#### Configuring OpenAI-Compatible Provider in `src/config/schema.ts`

```typescript
// Lines 180-190: ModelProviderSchema
const ModelProviderSchema = z.object({
  id: z.string().min(1),
  kind: z.enum(["stub", "framed_echo", "openai_compatible"]).default("framed_echo"),
  default_model: z.string().min(1),
  base_url: z.string().url().optional(),        // Provider endpoint
  api_key_env: z.string().min(1).optional(),  // Env var containing API key
  api_key: z.string().min(1).optional(),        // Or inline API key (not recommended)
  completion_path: z.string().min(1).optional(),
  input_cost_per_million_usd: z.number().nonnegative().optional(),
  output_cost_per_million_usd: z.number().nonnegative().optional(),
});
```

#### Capability Taxonomy and Scope/Tenancy Routing (Lines 197-214)

```typescript
// Configure capability-based routing with org/app/user scope precedence
MODEL_GATEWAY_REGISTRY_JSON='{
  "chat": {
    "default": { "provider": "openai", "model": "gpt-4" },
    "org": {
      "org-123": { "provider": "openai", "model": "gpt-4-turbo" }
    },
    "app": {
      "app-456": { "provider": "openai", "model": "gpt-3.5-turbo" }
    },
    "user": {
      "user-789": { "provider": "openai", "model": "gpt-4" }
    }
  },
  "classification": {
    "default": { "provider": "openai", "model": "gpt-3.5-turbo" }
  }
}'
```

**Routing Precedence:** User -> App -> Org -> Default

---

### 2. Authentication & IdP Configuration

The auth system is **fully implemented** with multi-IdP support, token exchange, and RS256/HS256 JWT validation.

#### IdP Registry Configuration (Lines 109-131)

Configure your Identity Providers with JWKS URLs for RS256 or secrets for HS256:

```bash
# RS256 IdP with JWKS (recommended for production)
AUTH_IDP_REGISTRY_JSON='[
  {
    "issuer": "https://auth.yourcompany.com",
    "audience": "ai-server",
    "jwt_algorithm": "RS256",
    "jwks_uri": "https://auth.yourcompany.com/.well-known/jwks.json",
    "claim_mapping": {
      "org_id": "org_id",
      "app_id": "azp",
      "user_id": "sub",
      "session_id": "sid",
      "scopes": "scope"
    }
  }
]'

# Or HS256 with shared secret (simpler but less secure)
AUTH_IDP_REGISTRY_JSON='[
  {
    "issuer": "https://idp.internal",
    "audience": "ai-server-token-exchange",
    "jwt_algorithm": "HS256",
    "jwt_secret": "your-shared-secret-here",
    "claim_mapping": {}
  }
]'
```

#### App Registry Setup (Lines 133-139)

```bash
# Configure app credentials for token exchange
AUTH_APP_REGISTRY_JSON='[
  {
    "client_id": "my-app-client",
    "client_secret": "my-app-secret-here",
    "app_id": "app-001",
    "allowed_issuers": ["https://auth.yourcompany.com"],
    "allowed_scopes": ["query:invoke", "chat:stream"]
  }
]'
```

#### AI JWT Settings

```bash
# Server-side JWT signing (short-lived tokens for internal use)
AUTH_AI_JWT_ISSUER="ai-server"
AUTH_AI_JWT_AUDIENCE="ai-server-query"
AUTH_AI_JWT_SECRET="your-ai-jwt-signing-secret"  # Use strong random value
AUTH_AI_JWT_TTL_SECONDS=900  # 15 minutes

# Required scopes for query endpoint
AUTH_QUERY_REQUIRED_SCOPES="query:invoke"
```

#### Token Exchange Endpoint

The `/token/exchange` endpoint is **fully implemented** at:

```
POST /token/exchange
Content-Type: application/json

{
  "grant_type": "urn:ietf:params:oauth:grant-type:token-exchange",
  "subject_token": "<external-idp-jwt>",
  "subject_token_type": "urn:ietf:params:oauth:token-type:jwt",
  "client_id": "my-app-client",
  "client_secret": "my-app-secret-here"
}
```

Response:
```json
{
  "access_token": "<ai-server-jwt>",
  "token_type": "Bearer",
  "expires_in": 900,
  "scope": "query:invoke"
}
```

---

### 3. Rate Limiting & Tenant Budgets

Rate limiting is **fully implemented** with Redis/in-memory backends and abuse detection.

#### Redis Connection Configuration

```bash
# Redis for shared rate limit state across instances
REDIS_URL="redis://redis.internal:6379"
REDIS_TLS_URL="rediss://redis.internal:6380"  # For TLS connections

# Or via Upstash for serverless deployments
UPSTASH_REDIS_REST_URL="https://your-db.upstash.io"
UPSTASH_REDIS_REST_TOKEN="your-token-here"
```

#### Rate Limit Thresholds and Windows

```bash
# Ingress rate limiting (per-client fixed window)
INGRESS_RATE_LIMIT_MAX_REQUESTS=100
INGRESS_RATE_LIMIT_WINDOW_MS=60000  # 1 minute

# Set to 0 to disable rate limiting (not recommended for production)
INGRESS_RATE_LIMIT_MAX_REQUESTS=0
```

Rate limiting features:
- **Algorithm:** Fixed-window with Redis or in-memory backend
- **Abuse Detection:** Error rate pattern detection (lines 360-420 of `rate-limit.ts`)
- **Headers:** `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`

#### Tenant Budget Backend Selection

Cross-request hourly cost caps use `src/controlplane/tenant-budget.ts`. Enable with **`TENANT_COST_CAP_USD_PER_HOUR`** (positive number, USD per org per sliding hour). Backend is chosen automatically (first match):

```bash
# Hourly cost cap (required for enforcement; 0 or unset = disabled)
TENANT_COST_CAP_USD_PER_HOUR=100

# Optional: Upstash Redis REST (shared across instances)
TENANT_BUDGET_REDIS_REST_URL=https://...
TENANT_BUDGET_REDIS_REST_TOKEN=...

# Optional: PostgreSQL (durable non-vector accounting; requires `pg` — see package.json optionalDependencies)
TENANT_BUDGET_POSTGRES_URL=postgresql://user:pass@host:5432/dbname
# Optional table name (alphanumeric/underscore only; default ai_tenant_budget_usage)
# TENANT_BUDGET_POSTGRES_TABLE=ai_tenant_budget_usage

# Optional: JSON file (single-instance persistence)
TENANT_BUDGET_STORE_PATH=/var/lib/ai-server/tenant-budget.json
```

Backend precedence: **Redis REST** → **PostgreSQL** → **file** → **in-memory** (when no store envs are set).

Recommendations:
- **in-memory:** Development only (default when no store is configured).
- **file:** Single-instance persistence.
- **PostgreSQL** or **Redis:** Shared counters when `TENANT_COST_CAP_USD_PER_HOUR` is set and multiple app instances exist.

---

### 4. Async Job Queue Configuration (Gap 3A - Implemented)

Async job processing is **fully implemented** with in-memory, Redis, and PostgreSQL backends.

```bash
# Enable async job queue
QUEUE_WORKERS_COUNT=4
QUEUE_BACKEND=memory  # Options: memory, redis, postgres
QUEUE_MAX_RETRIES=3
QUEUE_WEBHOOK_TIMEOUT_MS=30000
QUEUE_WEBHOOK_RETRY_ATTEMPTS=3
QUEUE_JOB_TIMEOUT_MS=300000  # 5 minutes
```

Async endpoints:
- `POST /v1/query/async` - Submit async job (returns job_id immediately)
- `GET /v1/jobs/{job_id}` - Check job status and retrieve result
- `POST /v1/jobs/{job_id}/cancel` - Cancel pending job
- `GET /v1/jobs` - List jobs with filtering

Features:
- **Webhook notifications** on job completion
- **Retry logic** with exponential backoff
- **Job timeouts** to prevent stuck jobs
- **Automatic cleanup** of old completed/failed jobs

### 5. Vector Embeddings Configuration (Gap 3B - Implemented)

Vector embeddings are **fully implemented** with multiple provider support for semantic search.

```bash
# Enable vector backend
MEMORY_BACKEND=vector  # Options: in_memory, vector

# Embedding provider configuration
MEMORY_EMBEDDING_PROVIDER=openai  # Options: hash, openai, gateway
MEMORY_EMBEDDING_MODEL=text-embedding-3-small
MEMORY_EMBEDDING_API_KEY_ENV=OPENAI_API_KEY
MEMORY_EMBEDDING_DIMENSIONS=1536

# Vector database selection (when MEMORY_BACKEND=vector)
VECTOR_DB_BACKEND=memory  # Options: memory, pinecone, weaviate, chroma, pgvector, redis

# Pinecone configuration (when VECTOR_DB_BACKEND=pinecone)
VECTOR_PINECONE_API_KEY=your-pinecone-api-key
VECTOR_PINECONE_INDEX=ai-server-vectors
VECTOR_PINECONE_NAMESPACE=default

# Weaviate configuration (when VECTOR_DB_BACKEND=weaviate)
VECTOR_WEAVIATE_URL=https://your-weaviate-instance.com
VECTOR_WEAVIATE_API_KEY=your-weaviate-api-key

# Chroma configuration (when VECTOR_DB_BACKEND=chroma)
VECTOR_CHROMA_URL=http://localhost:8000

# pgvector configuration (when VECTOR_DB_BACKEND=pgvector)
VECTOR_PG_CONNECTION_STRING=postgresql://user:pass@localhost/aidb
VECTOR_PG_TABLE=ai_vectors
```

Features:
- **Semantic search** with cosine similarity
- **Multi-tenant filtering** (org_id, app_id, user_id)
- **Pluggable backends** (Pinecone, Weaviate, Chroma, pgvector, Redis, in-memory)
- **OpenAI embeddings** with fallback hash-based (for testing)

### 6. Persistent Memory Configuration (Gap 3C - Implemented)

Persistent memory backends are **fully implemented** with multiple options for production deployments.

```bash
# Persistent memory backend selection
MEMORY_PERSISTENT_BACKEND=redis  # Options: redis, postgres, mongodb, s3

# Redis configuration (when MEMORY_PERSISTENT_BACKEND=redis)
MEMORY_REDIS_URL=redis://localhost:6379
MEMORY_REDIS_CLUSTER=false
MEMORY_REDIS_SENTINEL=false
MEMORY_REDIS_KEY_PREFIX=ai:memory:
MEMORY_REDIS_TTL_SECONDS=86400

# PostgreSQL configuration (when MEMORY_PERSISTENT_BACKEND=postgres)
MEMORY_POSTGRES_URL=postgresql://user:pass@localhost/aidb
MEMORY_POSTGRES_TABLE_PREFIX=ai_
MEMORY_POSTGRES_POOL_SIZE=10

# MongoDB configuration (when MEMORY_PERSISTENT_BACKEND=mongodb)
MEMORY_MONGODB_URL=mongodb://localhost:27017
MEMORY_MONGODB_DATABASE=ai_server
MEMORY_MONGODB_COLLECTION_PREFIX=

# S3-compatible configuration (when MEMORY_PERSISTENT_BACKEND=s3)
MEMORY_S3_ENDPOINT=https://s3.amazonaws.com  # Or MinIO endpoint
MEMORY_S3_REGION=us-east-1
MEMORY_S3_BUCKET=ai-server-memory
MEMORY_S3_ACCESS_KEY_ID=your-access-key
MEMORY_S3_SECRET_ACCESS_KEY=your-secret-key
MEMORY_S3_PREFIX=memory/
```

Features:
- **Redis**: Cluster/Sentinel support, connection pooling, circuit breaker, TTL
- **PostgreSQL**: SQL-based, connection pooling, automatic cleanup
- **MongoDB**: Document-based, TTL indexes, sharding support
- **S3-compatible**: MinIO/AWS/GCP, for large blob storage

### 7. Feature Flags Configuration (Gap 3D - Implemented)

Feature flags are **fully implemented** with runtime evaluation and admin API.

```bash
# Feature flag backend selection
FEATURE_FLAG_BACKEND=config  # Options: config, database, launchdarkly
FEATURE_FLAG_ENABLE_DYNAMIC=true  # Allow runtime updates without restart
FEATURE_FLAG_REFRESH_INTERVAL_MS=60000  # Refresh interval for dynamic updates

# Default feature flags (set via environment)
ENABLE_ORG_MEMORY=false
ENABLE_COST_CAPS=true
ENABLE_MULTIMODAL_PIPELINE=false
MULTIMODAL_INPUT_PATH_ENABLED=false
RUNTIME_MVP_QUERY_CHAT_ENABLED=true
OBSERVABILITY_REQUIRED_EVENTS_V1=true
SECURITY_HARD_CONTROLS_ENABLED=true
HARNESS_AUTONOMOUS_EXECUTION_ENABLED=false
MEMORY_RETRIEVAL_ENABLED=false
PLATFORM_PRODUCTION_ROLLOUT_ENABLED=false
```

Features:
- **Hierarchical overrides**: global -> org -> app -> user
- **A/B testing support**: consistent variant assignment
- **Dynamic updates**: Refresh without restart
- **Admin API**: Manage overrides programmatically

Admin endpoints (requires `OPERATIONAL_BEARER_TOKEN`):
- `GET /admin/flags` - List all flags
- `POST /admin/flags/evaluate` - Evaluate flag for context
- `POST /admin/flags/overrides` - Create override
- `DELETE /admin/flags/overrides/:flag/:scope/:scopeId` - Remove override
- `GET /admin/flags/overrides/:scope/:scopeId` - List overrides

### 8. Health Check Dependencies

Health checks are **dependency-aware** and check IdP, Redis, model providers, and sinks.

#### IdP Health Endpoints to Configure

```bash
# Health checks automatically probe JWKS endpoints for RS256 IdPs
# Ensure your IdP exposes a reachable JWKS URI:
# https://auth.yourcompany.com/.well-known/jwks.json
```

The health checker (lines 49-85 in `dependencies.ts`):
- Probes JWKS endpoints with 5-second timeout
- Marks IdP as healthy if endpoint responds
- HS256 IdPs are marked as "configured" (no external check needed)

#### Redis Health Check Setup

Redis health is automatically checked via ping (lines 87-115):

```bash
# Ensure Redis is accessible from the server
REDIS_URL="redis://localhost:6379"

# Health check will:
# - Connect and issue PING
# - Measure latency
# - Report connection status
```

#### Audit/Event Sink Paths and Permissions

```bash
# Audit log path (with rotation and hash-chain integrity)
AUDIT_LOG_PATH="/var/log/ai-server/audit.log"

# Observability event sink
OBSERVABILITY_EVENT_SINK_PATH="/var/log/ai-server/events.log"

# Ensure proper permissions (server must be able to write and rotate)
# Recommended: ai-server user owns these directories
mkdir -p /var/log/ai-server
chown ai-server:ai-server /var/log/ai-server
chmod 750 /var/log/ai-server
```

Audit logging features (lines 56-180 in `audit-logger.ts`):
- **File sink with rotation** based on size/time
- **Bounded queue** with backpressure handling
- **Hash-chain integrity** for tamper evidence
- **Status reporting** for health checks

---

## Security Hardening Checklist

### Operational Endpoint Protection

Protect `/metrics`, `/v1/version`, `/healthz`, and `/readyz` with an operational bearer token:

```bash
# Set a strong random token
OPERATIONAL_BEARER_TOKEN="op-token-$(openssl rand -hex 32)"
```

Accessing protected endpoints:
```bash
curl -H "Authorization: Bearer $OPERATIONAL_BEARER_TOKEN" \
  https://api.yourcompany.com/metrics
```

**Note:** If `OPERATIONAL_BEARER_TOKEN` is not set, operational endpoints are publicly accessible. Configure network-level protection (mTLS, internal load balancer) when bearer token is not used.

### Tool Gateway Security

Tool execution defaults to **deny-only mode** for security:

```bash
# Production default (deny all tools)
# No action needed - this is the default

# To enable specific tools after security review:
# 1. Review tool allowlist in policy
# 2. Configure sandbox controls
# 3. Set filesystem root for file operations
TOOL_FILESYSTEM_ROOT="/var/lib/ai-server/tool-sandbox"
mkdir -p /var/lib/ai-server/tool-sandbox
chown ai-server:ai-server /var/lib/ai-server/tool-sandbox
chmod 700 /var/lib/ai-server/tool-sandbox
```

Built-in tools available (require explicit enablement):
- `web_search`: DuckDuckGo API calls
- `file_write_preview`: Filesystem writes with path sandboxing

Sandbox controls (defined in `types.ts`):
- `timeout_ms`: Maximum execution time
- `network_access`: Allow/disallow network calls
- `filesystem_access`: Allow/disallow file operations

### Audit Log Path Permissions and Rotation

```bash
# Create audit log directory with proper permissions
mkdir -p /var/log/ai-server
chown ai-server:ai-server /var/log/ai-server
chmod 750 /var/log/ai-server

# Logrotate configuration for audit logs
# /etc/logrotate.d/ai-server-audit
/var/log/ai-server/audit.log {
    daily
    rotate 30
    compress
    delaycompress
    missingok
    notifempty
    create 0600 ai-server ai-server
    postrotate
        # Signal server to reopen log files if needed
        kill -HUP $(pgrep -f ai-server) || true
    endscript
}
```

Audit log features:
- **Automatic rotation** when size threshold reached
- **Hash-chain linking** for tamper detection
- **Bounded queue** to prevent memory exhaustion
- **Backpressure handling** when sink is slow

### TLS/HTTPS Configuration

```bash
# Enable HTTPS
TLS_KEY_PATH="/etc/ai-server/tls/key.pem"
TLS_CERT_PATH="/etc/ai-server/tls/cert.pem"
HTTPS_PORT=3443

# Ensure certificates are readable by server user
chown ai-server:ai-server /etc/ai-server/tls/*.pem
chmod 600 /etc/ai-server/tls/key.pem
chmod 644 /etc/ai-server/tls/cert.pem
```

**Important:** The server fails open to HTTP-only if TLS materials are invalid. In production, ensure TLS is properly configured or use a reverse proxy (nginx, Envoy, AWS ALB) for TLS termination.

---

## Verification Steps

### 1. Verify /healthz and /readyz are Working

```bash
# Basic health check (no auth required unless bearer token set)
curl https://api.yourcompany.com/healthz

# Expected response (healthy):
{
  "healthy": true,
  "ready": true,
  "version": "1.2.3",
  "dependencies": [
    {
      "name": "config",
      "healthy": true,
      "ready": true
    },
    {
      "name": "idp",
      "healthy": true,
      "ready": true,
      "detail": {
        "latency_ms": 45,
        "idps": [
          { "issuer": "https://auth.yourcompany.com", "status": "ok" }
        ]
      }
    },
    {
      "name": "redis",
      "healthy": true,
      "ready": true,
      "detail": {
        "latency_ms": 2,
        "status": "connected"
      }
    },
    {
      "name": "model_providers",
      "healthy": true,
      "ready": true,
      "detail": {
        "providers": [
          { "provider": "openai", "status": "configured" }
        ]
      }
    },
    {
      "name": "audit_sink",
      "healthy": true,
      "ready": true
    }
  ]
}

# Readiness check (returns 503 if not ready)
curl -f https://api.yourcompany.com/readyz || echo "Not ready"
```

**Unhealthy Response (503):**
```json
{
  "healthy": false,
  "ready": false,
  "dependencies": [
    {
      "name": "redis",
      "healthy": false,
      "ready": false,
      "detail": {
        "status": "disconnected",
        "error": "Connection refused"
      }
    }
  ]
}
```

### 2. Testing /token/exchange Flow

```bash
# 1. Obtain external IdP token (your app's auth flow)
EXTERNAL_TOKEN="<idp-jwt-from-your-auth-flow>"

# 2. Exchange for AI server token
curl -X POST https://api.yourcompany.com/token/exchange \
  -H "Content-Type: application/json" \
  -d '{
    "grant_type": "urn:ietf:params:oauth:grant-type:token-exchange",
    "subject_token": "'$EXTERNAL_TOKEN'",
    "subject_token_type": "urn:ietf:params:oauth:token-type:jwt",
    "client_id": "my-app-client",
    "client_secret": "my-app-secret-here"
  }'

# Expected response:
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "Bearer",
  "expires_in": 900,
  "scope": "query:invoke"
}

# 3. Use the AI token to query
AI_TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."

curl -X POST https://api.yourcompany.com/v1/query \
  -H "Authorization: Bearer $AI_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Hello, world!",
    "context": {}
  }'
```

### 3. Validating Rate Limiting is Enforced

```bash
# Make requests until rate limit is hit
for i in {1..110}; do
  curl -s -o /dev/null -w "%{http_code}" \
    -H "Authorization: Bearer $AI_TOKEN" \
    https://api.yourcompany.com/v1/query \
    -X POST -H "Content-Type: application/json" \
    -d '{"message":"test","context":{}}'
  echo " - Request $i"
done

# Expected: First 100 return 200, then 429 Too Many Requests

# Check rate limit headers
curl -I -H "Authorization: Bearer $AI_TOKEN" \
  https://api.yourcompany.com/v1/query \
  -X POST -H "Content-Type: application/json" \
  -d '{"message":"test","context":{}}' 2>/dev/null | grep -i ratelimit

# Expected headers:
# X-RateLimit-Limit: 100
# X-RateLimit-Remaining: 0
# X-RateLimit-Reset: 1709836800000
```

### 4. Checking Model Gateway Routing

```bash
# Verify model provider is configured
curl https://api.yourcompany.com/healthz | jq '.dependencies[] | select(.name == "model_providers")'

# Test different capability routing
curl -X POST https://api.yourcompany.com/v1/query \
  -H "Authorization: Bearer $AI_TOKEN" \
  -H "Content-Type: application/json" \
  -H "X-Requested-Capability: classification" \
  -d '{
    "message": "Classify this: urgent customer complaint",
    "context": {}
  }'

# The server will route to the appropriate model based on capability registry
```

### 5. Testing Audit Logging

```bash
# Check audit log is being written
tail -f /var/log/ai-server/audit.log

# Expected format (JSON lines):
{"timestamp":"2024-03-07T12:00:00Z","event_type":"AUTH_SUCCESS","event_hash":"sha256:abc123","previous_event_hash":"sha256:def456",...}

# Verify hash chain integrity
jq -s '.[0].previous_event_hash' /var/log/ai-server/audit.log | head -2
# First line should have null (genesis), subsequent lines should chain
```

---

## Production Readiness Summary

### ✅ Production-Ready Features (Verified in Code)

| Feature | Status | Notes |
|---------|--------|-------|
| **Model Gateway** | Fully Implemented | OpenAI-compatible provider, circuit breakers, health checks, capability taxonomy, scope/tenancy routing |
| **All 8 Engines** | Fully Implemented | Execution, Synthesis, Classification, Evaluation, Tool, Memory, Planning, Condensing |
| **All 9+ Workflows** | Fully Implemented | Including reactive_chat, coding_agent, deep_research, decision, tool_automation |
| **Decision Steps** | Fully Implemented | Branch condition evaluation with expression parser |
| **Cycle Detection** | Fully Implemented | DFS validation at workflow definition time |
| **Tool Gateway** | Fully Implemented | Executable tools with sandbox controls (deny-by-default) |
| **Auth System** | Fully Implemented | Multi-IdP with token exchange, HS256/RS256, JWKS support |
| **Rate Limiting** | Fully Implemented | Fixed-window, Redis/in-memory backends, abuse detection |
| **Tenant Budget** | Fully Implemented | Multi-backend (in-memory, file, Redis), hourly cost caps |
| **Health/Readiness** | Fully Implemented | Dependency-aware checks (IdP, Redis, providers, sinks) |
| **Audit Logging** | Fully Implemented | File sink with rotation, bounded queue, hash-chain integrity |
| **Stop Conditions** | Fully Implemented | max_iterations and deadline_ms enforced in runner |
| **Dependency Validation** | Fully Implemented | Unknown dependencies and branch targets rejected |

### ✅ Previously Documented Gaps (Now Implemented)

| Gap | Status | Implementation |
|-----|--------|----------------|
| **Async Mode** | ✅ **Fully Implemented** | Job queue with Redis/PostgreSQL backends, webhook notifications, REST API |
| **Vector Embeddings** | ✅ **Fully Implemented** | Pinecone, Weaviate, Chroma, pgvector adapters with OpenAI embeddings |
| **Persistent Memory** | ✅ **Fully Implemented** | Redis (with cluster/sentinel), PostgreSQL, MongoDB, S3 backends |
| **Feature Flags** | ✅ **Fully Implemented** | Runtime evaluation, hierarchical overrides, A/B testing, admin API |

---

### 📊 Full Production Readiness Summary

**All 16 Major Features are Production-Ready:**

| Category | Features | Status |
|----------|----------|--------|
| **Core Runtime** | Model Gateway, 8 Engines, 9+ Workflows | ✅ Ready |
| **Authentication** | Multi-IdP, Token Exchange, RS256/HS256 | ✅ Ready |
| **Rate Limiting** | Fixed-window, Redis backend, Abuse Detection | ✅ Ready |
| **Budgeting** | Tenant budgets, hourly cost caps | ✅ Ready |
| **Health Checks** | Dependency-aware, IdP/Redis/Provider checks | ✅ Ready |
| **Audit Logging** | File sink, rotation, hash-chain integrity | ✅ Ready |
| **Async Processing** | Job queues, webhooks, status tracking | ✅ Ready |
| **Vector Search** | Multi-provider, embeddings, semantic search | ✅ Ready |
| **Persistent Memory** | Redis, PostgreSQL, MongoDB, S3 | ✅ Ready |
| **Feature Flags** | Runtime evaluation, overrides, admin API | ✅ Ready |

---

## Troubleshooting

### Issue: Model Gateway Returns Stub Responses

**Symptoms:** Responses are clearly from stub/echo provider, not real model.

**Solution:**
```bash
# Verify provider is configured
echo $MODEL_GATEWAY_PROVIDERS_JSON | jq .

# Check health endpoint for provider status
curl https://api.yourcompany.com/healthz | jq '.dependencies[] | select(.name == "model_providers")'

# Verify API key is set
echo $MODEL_PROVIDER_API_KEY | head -c 10  # Should show first 10 chars of key
```

### Issue: Token Exchange Returns 401

**Symptoms:** `/token/exchange` fails with authentication error.

**Solution:**
```bash
# Verify IdP registry is configured
echo $AUTH_IDP_REGISTRY_JSON | jq .

# Check IdP health
curl https://api.yourcompany.com/healthz | jq '.dependencies[] | select(.name == "idp")'

# Verify app credentials
echo $AUTH_APP_REGISTRY_JSON | jq .

# Test IdP JWKS endpoint manually
curl https://auth.yourcompany.com/.well-known/jwks.json | jq .
```

### Issue: Rate Limiting Not Enforcing

**Symptoms:** Can make unlimited requests without 429 response.

**Solution:**
```bash
# Check rate limit configuration
echo $INGRESS_RATE_LIMIT_MAX_REQUESTS  # Should not be 0
echo $INGRESS_RATE_LIMIT_WINDOW_MS

# Verify Redis is connected (for shared state)
curl https://api.yourcompany.com/healthz | jq '.dependencies[] | select(.name == "redis")'

# Check rate limit headers in response
curl -I -H "Authorization: Bearer $TOKEN" https://api.yourcompany.com/v1/query \
  -X POST -d '{"message":"test","context":{}}' 2>/dev/null | grep -i ratelimit
```

### Issue: Audit Logs Not Written

**Symptoms:** No entries in audit log file.

**Solution:**
```bash
# Check path configuration
echo $AUDIT_LOG_PATH

# Verify permissions
ls -la $(dirname $AUDIT_LOG_PATH)

# Check disk space
df -h $(dirname $AUDIT_LOG_PATH)

# Verify audit sink health
curl https://api.yourcompany.com/healthz | jq '.dependencies[] | select(.name == "audit_sink")'
```

### Issue: Health Checks Return 503

**Symptoms:** `/healthz` or `/readyz` return unhealthy status.

**Solution:**
```bash
# Check which dependency is unhealthy
curl https://api.yourcompany.com/healthz | jq '.dependencies[] | select(.healthy == false)'

# Common causes:
# - Redis unreachable: Check REDIS_URL and network connectivity
# - IdP JWKS unreachable: Verify firewall and DNS
# - Model provider not configured: Set MODEL_GATEWAY_PROVIDERS_JSON
# - Audit sink error: Check disk space and permissions
```

---

## References

- `docs/OPERATIONS/Production-Readiness-Gaps-Report.md` - Detailed gap analysis (Section 10 for summary)
- `docs/CODEBASE-DOCS-VERIFICATION-REPORT.md` - Codebase verification results
- `src/config/schema.ts` - Configuration schema and defaults
- `src/server/dependencies.ts` - Health check implementation
- `src/gateways/model-gateway.ts` - Model provider implementation
- `src/server/routes.ts` - Endpoint definitions

---

*Last Updated: 2026-03-07 | The codebase is significantly more production-ready than previously documented. Many features marked as "not implemented" in older docs are actually fully implemented.*
