#!/bin/bash
#
# Generate environment configuration for AI Server
# Interactive script to create .env file with secure defaults
#

set -e

ENV_FILE=".env"
RED=\033[0;31m
GREEN=\033[0;32m
YELLOW=\033[1;33m
NC=\033[0m # No Color

echo "=========================================="
echo "AI Server Environment Configuration"
echo "=========================================="
echo ""

# Check if .env already exists
if [ -f "$ENV_FILE" ]; then
    echo -e "${YELLOW}Warning: .env already exists${NC}"
    read -p "Overwrite? (y/N): " overwrite
    if [[ ! $overwrite =~ ^[Yy]$ ]]; then
        echo "Aborted."
        exit 1
    fi
fi

# Generate secure tokens
generate_token() {
    openssl rand -hex 32 2>/dev/null || head -c 32 /dev/urandom | xxd -p
}

OPERATIONAL_TOKEN=$(generate_token)
AI_JWT_SECRET=$(generate_token)
APP_CLIENT_SECRET=$(generate_token)

echo "# AI Server Environment Configuration" > "$ENV_FILE"
echo "# Generated: $(date -Iseconds)" >> "$ENV_FILE"
echo "" >> "$ENV_FILE"

# Operational security
echo "# Operational Security" >> "$ENV_FILE"
echo "OPERATIONAL_BEARER_TOKEN=${OPERATIONAL_TOKEN}" >> "$ENV_FILE"
echo "" >> "$ENV_FILE"

# Model Provider
echo "# Model Provider Configuration" >> "$ENV_FILE"
echo "# Enter your OpenAI-compatible API key:"
read -s -p "API Key: " api_key
echo ""
echo "MODEL_PROVIDER_API_KEY=${api_key}" >> "$ENV_FILE"
echo "MODEL_GATEWAY_PROVIDERS_JSON='[$(cat <<EOF
  {
    \"id\": \"openai\",
    \"kind\": \"openai_compatible\",
    \"default_model\": \"gpt-4\",
    \"base_url\": \"https://api.openai.com/v1\",
    \"api_key_env\": \"MODEL_PROVIDER_API_KEY\",
    \"input_cost_per_million_usd\": 30.0,
    \"output_cost_per_million_usd\": 60.0
  }
EOF
)'" >> "$ENV_FILE"
echo "" >> "$ENV_FILE"

# Auth Configuration
echo "# Authentication Configuration" >> "$ENV_FILE"
echo "AUTH_AI_JWT_SECRET=${AI_JWT_SECRET}" >> "$ENV_FILE"
echo "AUTH_IDP_REGISTRY_JSON='[$(cat <<EOF
  {
    \"issuer\": \"https://idp.local/default\",
    \"audience\": \"ai-server-token-exchange\",
    \"jwt_algorithm\": \"HS256\",
    \"jwt_secret\": \"dev-external-idp-secret\",
    \"claim_mapping\": {}
  }
EOF
)'" >> "$ENV_FILE"
echo "AUTH_APP_REGISTRY_JSON='[$(cat <<EOF
  {
    \"client_id\": \"app-client\",
    \"client_secret\": \"${APP_CLIENT_SECRET}\",
    \"app_id\": \"a1\",
    \"allowed_issuers\": [\"https://idp.local/default\"],
    \"allowed_scopes\": [\"query:invoke\"]
  }
EOF
)'" >> "$ENV_FILE"
echo "" >> "$ENV_FILE"

# Feature Flags
echo "# Feature Flags" >> "$ENV_FILE"
echo "ENABLE_ORG_MEMORY=false" >> "$ENV_FILE"
echo "ENABLE_COST_CAPS=true" >> "$ENV_FILE"
echo "MEMORY_RETRIEVAL_ENABLED=false" >> "$ENV_FILE"
echo "PLATFORM_PRODUCTION_ROLLOUT_ENABLED=false" >> "$ENV_FILE"
echo "" >> "$ENV_FILE"

# Async Jobs
echo "# Async Job Queue" >> "$ENV_FILE"
echo "QUEUE_WORKERS_COUNT=2" >> "$ENV_FILE"
echo "" >> "$ENV_FILE"

echo ""
echo -e "${GREEN}✓ Environment configuration generated: ${ENV_FILE}${NC}"
echo ""
echo "Important values (save these securely):"
echo "  Operational Bearer Token: ${OPERATIONAL_TOKEN:0:8}..."
echo "  AI JWT Secret: ${AI_JWT_SECRET:0:8}..."
echo "  App Client Secret: ${APP_CLIENT_SECRET:0:8}..."
echo ""
echo "To start the server:"
echo "  docker-compose up -d"
echo ""
echo -e "${YELLOW}Note: Review ${ENV_FILE} and customize as needed${NC}"
