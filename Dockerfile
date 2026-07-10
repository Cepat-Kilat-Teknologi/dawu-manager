FROM node:22-alpine AS base

# Install pnpm (pin to v10 for broad compatibility)
RUN corepack enable && corepack prepare pnpm@10 --activate

# --- Dependencies ---
FROM base AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
# Use shamefully-hoist to avoid symlink issues in Docker overlay filesystem
# --ignore-scripts skips postinstall prisma generate (schema not available yet)
RUN pnpm install --frozen-lockfile --shamefully-hoist --ignore-scripts

# --- Build ---
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Create build-time DB for prerendering, then build (prisma generate + next build)
ENV NEXT_TELEMETRY_DISABLED=1
ENV DATABASE_URL=file:./build.db
RUN pnpm exec prisma migrate deploy && pnpm build

# --- Production ---
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV DATABASE_URL=file:/data/dawu.db

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs && \
    mkdir -p /data && chown nextjs:nodejs /data

# Copy built standalone app
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Copy Prisma migrations + lightweight migrate script (uses node:sqlite built-in)
COPY --from=builder /app/prisma/migrations ./prisma/migrations
COPY --chown=nextjs:nodejs migrate.mjs ./migrate.mjs

# Copy entrypoint script
COPY --chown=nextjs:nodejs entrypoint.sh ./entrypoint.sh
RUN chmod +x entrypoint.sh

USER nextjs

EXPOSE 3789
ENV PORT=3789
ENV HOSTNAME="0.0.0.0"

ENTRYPOINT ["./entrypoint.sh"]
