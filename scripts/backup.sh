#!/bin/bash
#
# Backup audit logs and state
#

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
BACKUP_DIR="/var/backups/ai-server"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_NAME="ai-server-backup-${TIMESTAMP}"

echo "Creating backup..."

# Create backup directory
mkdir -p "$BACKUP_DIR"

cd "$PROJECT_DIR"

# Backup Docker volumes
echo "Backing up Docker volumes..."
docker run --rm \
    -v ai-server_ai-server-logs:/source/logs:ro \
    -v ai-server_ai-server-data:/source/data:ro \
    -v ai-server_redis-data:/source/redis:ro \
    -v "$BACKUP_DIR:/backup" \
    alpine \
    tar czf "/backup/${BACKUP_NAME}.tar.gz" -C /source .

# Backup environment (excluding secrets)
echo "Backing up configuration..."
grep -v "SECRET\|PASSWORD\|KEY" .env > "$BACKUP_DIR/${BACKUP_NAME}.env" 2>/dev/null || true

echo ""
echo "Backup complete: $BACKUP_DIR/${BACKUP_NAME}.tar.gz"
echo ""
echo "To restore:"
echo "  tar xzf $BACKUP_DIR/${BACKUP_NAME}.tar.gz -C /var/lib/ai-server"
