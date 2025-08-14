# Multi-stage Docker build for Veeam Insight Dashboard
# Stage 1: Frontend Build
FROM node:18-alpine AS frontend-build

WORKDIR /app/frontend

# Copy frontend package files
COPY package*.json ./
COPY bun.lockb ./

# Install frontend dependencies (including devDependencies for build)
RUN npm ci

# Copy frontend source code (exclude server directory)
COPY src ./src
COPY public ./public
COPY index.html ./
COPY vite.config.ts ./
COPY tsconfig*.json ./
COPY tailwind.config.ts ./
COPY postcss.config.js ./
COPY components.json ./
COPY eslint.config.js ./

# Build frontend for production
RUN npm run build

# Stage 2: Backend Build
FROM node:18-alpine AS backend-build

WORKDIR /app/backend

# Copy backend package files
COPY server/package*.json ./
COPY server/tsconfig.json ./

# Install all dependencies (including devDependencies for build)
RUN npm ci

# Copy backend source code
COPY server/src ./src

# Build backend TypeScript
RUN npm run build

# Install production dependencies only
RUN npm ci --only=production && npm cache clean --force

# Stage 3: Production Runtime
FROM node:18-alpine AS production

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Create app user for security
RUN addgroup -g 1001 -S nodejs
RUN adduser -S veeam -u 1001

# Set working directory
WORKDIR /app

# Copy built frontend assets to a temporary location
COPY --from=frontend-build --chown=veeam:nodejs /app/frontend/dist ./frontend-dist

# Copy built backend
COPY --from=backend-build --chown=veeam:nodejs /app/backend/dist ./dist
COPY --from=backend-build --chown=veeam:nodejs /app/backend/node_modules ./node_modules
COPY --from=backend-build --chown=veeam:nodejs /app/backend/package*.json ./

# Copy environment files
COPY .env.production /app/.env.production
COPY server/.env.production /app/server/.env.production

# Copy entrypoint script
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# Create logs, tokens, and public directories
RUN mkdir -p /app/logs /app/tokens /app/public && chown -R veeam:nodejs /app/logs /app/tokens /app/public

# Switch to non-root user
USER veeam

# Expose ports
EXPOSE 3003 3002

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3003/api/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })"

# Set entrypoint
ENTRYPOINT ["/entrypoint.sh"]

# Start the application
CMD ["node", "dist/server.js"]