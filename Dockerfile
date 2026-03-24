# AI Server Production Dockerfile
# Multi-stage build: full dev deps for compile, production-only runtime deps.

# Stage 1: Build
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci && npm cache clean --force

COPY . .
RUN npm run build

# Stage 2: Production
FROM node:20-alpine AS production

RUN addgroup -g 1001 -S ai-server && \
    adduser -u 1001 -S ai-server -G ai-server

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=builder --chown=ai-server:ai-server /app/dist ./dist

RUN mkdir -p /var/log/ai-server /var/lib/ai-server && \
    chown -R ai-server:ai-server /var/log/ai-server /var/lib/ai-server

USER ai-server

EXPOSE 3000 3443

# Sends Authorization when OPERATIONAL_BEARER_TOKEN is set (matches routes.ts).
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD node -e "const t=process.env.OPERATIONAL_BEARER_TOKEN;const h=t?{Authorization:'Bearer '+t}:{};fetch('http://127.0.0.1:3000/healthz',{headers:h}).then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "dist/server/index.js"]
