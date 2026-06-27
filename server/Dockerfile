# LeadBridge — Fastify TypeScript Server Dockerfile
# Supports both the API server and BullMQ worker processes.

# Stage 1: Build
FROM node:22-alpine AS builder

WORKDIR /app

# Copy package files
COPY package.json package-lock.json ./

# Install all dependencies (including devDependencies for build)
RUN npm ci

# Copy source code
COPY tsconfig.json ./
COPY prisma/ ./prisma/
COPY src/ ./src/

# Generate Prisma client
RUN npx prisma generate

# Build TypeScript
RUN npm run build

# Stage 2: Production
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

# Install system dependencies for Prisma
RUN apk add --no-cache openssl

# Copy package files and install production dependencies only
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Install tsx globally for running worker processes
RUN npm install -g tsx

# Copy Prisma schema and generated client
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

# Copy compiled JS output
COPY --from=builder /app/dist ./dist

EXPOSE 3000

# Default: run the API server
CMD ["node", "dist/index.js"]
