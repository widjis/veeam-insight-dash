# Multi-stage Docker build for Veeam Insight Dashboard
# Stage 1: Frontend Build
FROM node:18-alpine AS frontend-build

WORKDIR /app/frontend

# Copy frontend package files
COPY package*.json ./
COPY bun.lockb ./

# Install frontend dependencies
RUN npm ci --only=production

# Copy frontend source code
COPY . .

# Build frontend for production
RUN npm run build

# Stage 2: Backend Build
FROM node:18-alpine AS backend-build

WORKDIR /app/backend

# Copy backend package files
COPY server/package*.json ./

# Install backend dependencies
RUN npm ci --only=production

# Copy backend source code
COPY server/ .

# Build backend (if TypeScript)
RUN npm run build

# Stage 3: Production Runtime
FROM node:18-alpine AS production

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Create app user for security
RUN addgroup -g 1001 -S nodejs
RUN adduser -S veeam -u 1001

# Set working directory
WORKDIR /app

# Copy built frontend assets
COPY --from=frontend-build --chown=veeam:nodejs /app/frontend/dist ./public

# Copy built backend
COPY --from=backend-build --chown=veeam:nodejs /app/backend/dist ./dist
COPY --from=backend-build --chown=veeam:nodejs /app/backend/node_modules ./node_modules
COPY --from=backend-build --chown=veeam:nodejs /app/backend/package*.json ./

# Create logs directory
RUN mkdir -p /app/logs && chown -R veeam:nodejs /app/logs

# Switch to non-root user
USER veeam

# Expose ports
EXPOSE 3001 3002

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3001/api/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })"

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start the application
CMD ["node", "dist/server.js"]