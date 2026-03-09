#!/bin/bash
#
# Setup SSL certificates using Let's Encrypt
#

set -e

DOMAIN="${1:-}"
EMAIL="${2:-admin@example.com}"

if [ -z "$DOMAIN" ]; then
    echo "Usage: $0 <domain> [email]"
    echo "Example: $0 api.example.com admin@example.com"
    exit 1
fi

echo "Setting up SSL for $DOMAIN..."

# Request certificate
certbot certonly --standalone -d "$DOMAIN" --agree-tos -m "$EMAIL" --non-interactive

# Set permissions
chown -R ai-server:ai-server /etc/letsencrypt/live/$DOMAIN
chown -R ai-server:ai-server /etc/letsencrypt/archive/$DOMAIN

# Update environment
cat >> /etc/ai-server/environment <<EOF
TLS_KEY_PATH=/etc/letsencrypt/live/$DOMAIN/privkey.pem
TLS_CERT_PATH=/etc/letsencrypt/live/$DOMAIN/fullchain.pem
HTTPS_PORT=3443
EOF

# Create renewal hook
cat > /etc/letsencrypt/renewal-hooks/deploy/ai-server.sh <<EOF
#!/bin/bash
chown -R ai-server:ai-server /etc/letsencrypt/live/$DOMAIN
chown -R ai-server:ai-server /etc/letsencrypt/archive/$DOMAIN
systemctl restart ai-server
EOF

chmod +x /etc/letsencrypt/renewal-hooks/deploy/ai-server.sh

echo "SSL setup complete!"
echo "Certificate path: /etc/letsencrypt/live/$DOMAIN/"
echo "Auto-renewal is enabled via cron"
