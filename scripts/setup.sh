#!/bin/bash
#
# AI Server One-Command Setup Script
# Creates directories, sets permissions, generates config
#

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
RED=\033[0;31m
GREEN=\033[0;32m
YELLOW=\033[1;33m
BLUE=\033[0;34m
NC=\033[0m

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}AI Server Setup${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Check dependencies
command -v docker >/dev/null 2>&1 || { echo -e "${RED}Error: docker is required but not installed${NC}"; exit 1; }
command -v docker-compose >/dev/null 2>&1 || { echo -e "${RED}Error: docker-compose is required but not installed${NC}"; exit 1; }

# Create required directories
echo -e "${BLUE}Creating directories...${NC}"
mkdir -p /var/log/ai-server
mkdir -p /var/lib/ai-server
mkdir -p /etc/ai-server/tls

# Generate environment if not exists
if [ ! -f "$PROJECT_DIR/.env" ]; then
    echo -e "${BLUE}Generating environment configuration...${NC}"
    if [ -f "$SCRIPT_DIR/generate-env.sh" ]; then
        cd "$PROJECT_DIR"
        bash "$SCRIPT_DIR/generate-env.sh"
    else
        echo -e "${YELLOW}Warning: generate-env.sh not found${NC}"
    fi
else
    echo -e "${YELLOW}.env already exists, skipping generation${NC}"
fi

# Generate self-signed TLS certificates if not exists (for development)
if [ ! -f "$PROJECT_DIR/tls/key.pem" ] && [ ! -f "/etc/ai-server/tls/key.pem" ]; then
    echo -e "${BLUE}Generating self-signed TLS certificates...${NC}"
    mkdir -p "$PROJECT_DIR/tls"
    openssl req -x509 -newkey rsa:4096 -keyout "$PROJECT_DIR/tls/key.pem" -out "$PROJECT_DIR/tls/cert.pem" -days 365 -nodes -subj "/C=US/ST=State/L=City/O=Organization/CN=localhost" 2>/dev/null || {
        echo -e "${YELLOW}Warning: Could not generate TLS certificates${NC}"
    }
    echo "TLS_KEY_PATH=/app/tls/key.pem" >> "$PROJECT_DIR/.env"
    echo "TLS_CERT_PATH=/app/tls/cert.pem" >> "$PROJECT_DIR/.env"
fi

# Set permissions (adjust for production)
echo -e "${BLUE}Setting permissions...${NC}"
chmod 750 /var/log/ai-server 2>/dev/null || echo -e "${YELLOW}Note: Run with sudo for system directories${NC}"
chmod 700 /var/lib/ai-server 2>/dev/null || true

# Pull images
echo -e "${BLUE}Pulling Docker images...${NC}"
cd "$PROJECT_DIR"
docker-compose pull

# Build images
echo -e "${BLUE}Building AI Server image...${NC}"
docker-compose build

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Setup Complete!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "To start the server:"
echo "  cd $PROJECT_DIR"
echo "  docker-compose up -d"
echo ""
echo "To check health:"
echo "  curl http://localhost:3000/healthz"
echo ""
echo "To view logs:"
echo "  docker-compose logs -f ai-server"
echo ""
echo -e "${YELLOW}Important: Review and customize .env before production use${NC}"
