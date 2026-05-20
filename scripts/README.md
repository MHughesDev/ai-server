# AI Server Docker Deployment Scripts

This directory contains scripts for deploying the AI Server using Docker and Docker Compose.

## Quick Start

```bash
# 1. Run setup script (generates .env and TLS certificates)
./scripts/setup.sh

# 2. Start the server
./scripts/start.sh

# 3. Check health
curl http://localhost:3000/healthz
```

## Scripts

| Script | Purpose |
|--------|---------|
| `setup.sh` | One-time setup: creates directories, generates config, builds images |
| `generate-env.sh` | Interactive script to generate .env file |
| `start.sh` | Start AI Server and dependencies |
| `stop.sh` | Gracefully stop all services |
| `logs.sh` | View aggregated logs from all services |
| `backup.sh` | Backup audit logs and state |
| `validate-k8s-manifests.mjs` | Structural checks for `k8s/` manifests (CI) |
| `validate-openapi-routes.mjs` | `openapi.yaml` ↔ `routes.ts` parity (CI) |
| `pre-release-smoke.mjs` | Start server, probe `/healthz`, `/readyz`, `/v1/version` |
| `release/build-artifact-manifest.mjs` | SHA-256 manifest for `dist/` |
| `release/sign-artifact-manifest.mjs` | HMAC sign manifest (`RELEASE_SIGNING_KEY`) |
| `release/verify-artifact-manifest.mjs` | Verify checksums + signature |
| `rollback-drill.mjs` | Kill-switch MTTR drill + evidence JSON (PR-031) |
| `incident-drills.mjs` | Provider / policy / budget incident drills + evidence (PR-032) |

## Manual Setup

If you prefer manual setup:

```bash
# 1. Create .env file
cp .env.example .env
# Edit .env with your configuration

# 2. Build and start
docker-compose build
docker-compose up -d

# 3. Check health
curl http://localhost:3000/healthz
```

## Services

| Service | Port | Purpose |
|---------|------|---------|
| ai-server | 3000/3443 | Main AI Server API |
| redis | 6379 | Rate limiting, memory, job queue |
| weaviate | 8080 | Vector database (optional) |
| chroma | 8000 | Vector database (optional) |

## Environment Variables

See `../docs/OPERATIONS/Production-Deployment-Guide.md` for complete configuration reference.

## Production Checklist

- [ ] Set `OPERATIONAL_BEARER_TOKEN` for admin endpoint protection
- [ ] Configure `MODEL_GATEWAY_PROVIDERS_JSON` with real API keys
- [ ] Set up `AUTH_IDP_REGISTRY_JSON` for your IdP
- [ ] Enable HTTPS with proper TLS certificates
- [ ] Configure persistent memory backend (Redis/PostgreSQL)
- [ ] Set up log rotation for `/var/log/ai-server`
- [ ] Configure backup script with S3/object storage target
- [ ] Review and adjust rate limiting settings
- [ ] Enable feature flags as needed

## Troubleshooting

### Health check fails
```bash
./scripts/logs.sh
```

### Reset everything
```bash
docker-compose down -v
docker-compose up -d
```

### Check service status
```bash
docker-compose ps
```
