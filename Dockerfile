# AI Server Production Dockerfile
# Multi-stage build for minimal, secure image

# Stage 1: Build
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies first (for layer caching)
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

# Copy source and build
COPY . .
RUN npm run build

# Stage 2: Production
FROM node:20-alpine AS production

# Security: Create non-root user
RUN addgroup -g 1001 -S ai-server && \
    adduser -u 1001 -S ai-server -G ai-server

WORKDIR /app

# Copy only necessary files from builder
COPY --from=builder --chown=ai-server:ai-server /app/dist ./dist
COPY --from=builder --chown=ai-server:ai-server /app/node_modules ./node_modules
COPY --from=builder --chown=ai-server:ai-server /app/package.json ./

# Create directories for logs and data
RUN mkdir -p /var/log/ai-server /var/lib/ai-server && \
    chown -R ai-server:ai-server /var/log/ai-server /var/lib/ai-server

# Switch to non-root user
USER ai-server

# Expose ports
EXPOSE 3000 3443

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD node -e "fetch('http://localhost:3000/healthz').then(r => r.ok ? process.exit(0) : process.exit(1)).catch(() => process.exit(1))" || exit 1

# Default command
CMD ["node", "dist/server/index.js"]
