#!/bin/bash
#
# AI Server VM/Bare Metal Installation Script
# Supports Ubuntu 22.04 LTS, Debian 12, RHEL 9, CentOS Stream 9
#

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
NODE_VERSION="20"
APP_USER="ai-server"
APP_DIR="/opt/ai-server"
LOG_DIR="/var/log/ai-server"
DATA_DIR="/var/lib/ai-server"

echo "========================================"
echo "AI Server VM Installation"
echo "========================================"
echo ""

# Detect OS
if [ -f /etc/os-release ]; then
    . /etc/os-release
    OS=$NAME
    VER=$VERSION_ID
else
    echo "Cannot detect OS"
    exit 1
fi

echo "Detected OS: $OS $VER"
echo ""

# Install dependencies
echo "Installing dependencies..."

if [[ "$OS" == *"Ubuntu"* ]] || [[ "$OS" == *"Debian"* ]]; then
    apt-get update
    apt-get install -y curl wget git build-essential redis-server logrotate
    
    # Install Node.js
    curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | bash -
    apt-get install -y nodejs
    
    # Install PM2
    npm install -g pm2
    
    # Install Certbot
    apt-get install -y certbot
    
elif [[ "$OS" == *"Red Hat"* ]] || [[ "$OS" == *"CentOS"* ]] || [[ "$OS" == *"Rocky"* ]]; then
    dnf update -y
    dnf install -y curl wget git gcc-c++ make redis logrotate
    
    # Install Node.js
    curl -fsSL https://rpm.nodesource.com/setup_${NODE_VERSION}.x | bash -
    dnf install -y nodejs
    
    # Install PM2
    npm install -g pm2
    
    # Install Certbot
    dnf install -y certbot
    
    # Enable Redis
    systemctl enable redis
    systemctl start redis
else
    echo "Unsupported OS: $OS"
    exit 1
fi

# Create user
echo "Creating ai-server user..."
if ! id "$APP_USER" &>/dev/null; then
    useradd -r -s /bin/false -d "$APP_DIR" "$APP_USER"
fi

# Create directories
echo "Creating directories..."
mkdir -p "$APP_DIR"
mkdir -p "$LOG_DIR"
mkdir -p "$DATA_DIR"
mkdir -p /etc/ai-server

chown -R "$APP_USER:$APP_USER" "$APP_DIR"
chown -R "$APP_USER:$APP_USER" "$LOG_DIR"
chown -R "$APP_USER:$APP_USER" "$DATA_DIR"

chmod 750 "$LOG_DIR"
chmod 700 "$DATA_DIR"

# Install application
echo "Installing AI Server..."
cd "$APP_DIR"

# Clone or copy application
git clone https://github.com/your-org/ai-server.git . 2>/dev/null || {
    echo "Note: Cloning from GitHub failed. Please copy application files to $APP_DIR"
}

# Install dependencies
npm ci --only=production

# Build
npm run build

# Create systemd service
echo "Creating systemd service..."
cat > /etc/systemd/system/ai-server.service <<'EOF'
[Unit]
Description=AI Server
After=network.target redis.service
Wants=redis.service

[Service]
Type=simple
User=ai-server
Group=ai-server
WorkingDirectory=/opt/ai-server
Environment=NODE_ENV=production
Environment=LOG_LEVEL=info
Environment=REDIS_URL=redis://localhost:6379
Environment=AUDIT_LOG_PATH=/var/log/ai-server/audit.log
Environment=OBSERVABILITY_EVENT_SINK_PATH=/var/log/ai-server/events.log
EnvironmentFile=-/etc/ai-server/environment
ExecStart=/usr/bin/node dist/server/index.js
Restart=always
RestartSec=5
StandardOutput=append:/var/log/ai-server/service.log
StandardError=append:/var/log/ai-server/error.log

[Install]
WantedBy=multi-user.target
EOF

# Create logrotate config
cat > /etc/logrotate.d/ai-server <<'EOF'
/var/log/ai-server/*.log {
    daily
    rotate 30
    compress
    delaycompress
    missingok
    notifempty
    create 0600 ai-server ai-server
    sharedscripts
    postrotate
        /bin/kill -HUP $(cat /var/run/syslogd.pid 2> /dev/null) 2> /dev/null || true
    endscript
}
EOF

# Reload systemd
systemctl daemon-reload

echo ""
echo "========================================"
echo "Installation Complete!"
echo "========================================"
echo ""
echo "Next steps:"
echo "1. Configure environment variables in /etc/ai-server/environment"
echo "2. Set up TLS certificates (optional): sudo certbot certonly --standalone -d your-domain.com"
echo "3. Start the service: sudo systemctl start ai-server"
echo "4. Enable auto-start: sudo systemctl enable ai-server"
echo ""
echo "View logs: sudo journalctl -u ai-server -f"
echo "Check status: sudo systemctl status ai-server"
