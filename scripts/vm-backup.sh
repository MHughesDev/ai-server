#!/bin/bash
#
# Backup script for VM deployments
# Backs up audit logs, Redis data, and configuration
#

set -e

BACKUP_DIR="/var/backups/ai-server"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_NAME="ai-server-${TIMESTAMP}"
S3_BUCKET="${S3_BACKUP_BUCKET:-}"
RETENTION_DAYS=7

echo "Starting backup..."

# Create backup directory
mkdir -p "$BACKUP_DIR"
cd "$BACKUP_DIR"

# Backup audit logs
if [ -d "/var/log/ai-server" ]; then
    echo "Backing up audit logs..."
    tar czf "${BACKUP_NAME}-logs.tar.gz" -C /var/log ai-server 2>/dev/null || true
fi

# Backup Redis
echo "Backing up Redis..."
redis-cli SAVE 2>/dev/null || true
if [ -f /var/lib/redis/dump.rdb ]; then
    cp /var/lib/redis/dump.rdb "${BACKUP_NAME}-redis.rdb" 2>/dev/null || true
fi

# Backup configuration
echo "Backing up configuration..."
tar czf "${BACKUP_NAME}-config.tar.gz" \
    -C /etc ai-server 2>/dev/null || true

# Create manifest
cat > "${BACKUP_NAME}-manifest.txt" <<EOF
Backup: ${BACKUP_NAME}
Created: $(date -Iseconds)
Hostname: $(hostname)
EOF

# Upload to S3 if configured
if [ -n "$S3_BUCKET" ]; then
    echo "Uploading to S3..."
    aws s3 cp "${BACKUP_NAME}-logs.tar.gz" "s3://${S3_BUCKET}/backups/" 2>/dev/null || true
    aws s3 cp "${BACKUP_NAME}-config.tar.gz" "s3://${S3_BUCKET}/backups/" 2>/dev/null || true
    aws s3 cp "${BACKUP_NAME}-redis.rdb" "s3://${S3_BUCKET}/backups/" 2>/dev/null || true
fi

# Cleanup old backups
echo "Cleaning up old backups..."
find "$BACKUP_DIR" -name "ai-server-*.tar.gz" -mtime +$RETENTION_DAYS -delete 2>/dev/null || true
find "$BACKUP_DIR" -name "ai-server-*.rdb" -mtime +$RETENTION_DAYS -delete 2>/dev/null || true

echo "Backup complete: $BACKUP_NAME"
