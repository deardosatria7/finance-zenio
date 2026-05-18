# =========================================
# Stage 1 — Dependencies
# =========================================
FROM node:20-alpine AS deps

WORKDIR /app

# Install dependencies
COPY package.json package-lock.json* ./

RUN npm install

# =========================================
# Stage 2 — Builder
# =========================================
FROM node:20-alpine AS builder

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build Next.js app
RUN npm run build

# =========================================
# Stage 3 — Runner
# =========================================
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

# Copy only necessary files
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/next.config.* ./

# Optional: drizzle config/migrations
COPY --from=builder /app/drizzle ./drizzle

EXPOSE 3000

CMD ["npm", "start"]