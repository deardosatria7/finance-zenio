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

# URL situs untuk metadataBase (Open Graph). Dibutuhkan saat build, bukan runtime.
ARG NEXT_PUBLIC_SITE_URL="http://localhost:3001"

# Build Next.js app.
# BETTER_AUTH_SECRET di sini semata agar `next build` tidak jatuh ke secret
# default better-auth. Nilai asli WAJIB datang dari environment runtime;
# placeholder ini sengaja dikenali dan ditolak oleh app/api/auth/[...all].
RUN BETTER_AUTH_SECRET="build-only-placeholder-do-not-use-at-runtime" NEXT_PUBLIC_SITE_URL="$NEXT_PUBLIC_SITE_URL" npm run build

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

# Migration + config-nya, supaya bisa `npx drizzle-kit migrate` dari container
COPY --from=builder /app/drizzle ./drizzle
COPY --from=builder /app/drizzle.config.ts ./

EXPOSE 3000

CMD ["npm", "start"]