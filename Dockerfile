# ── base ──────────────────────────────────────────────────────────────────────
FROM oven/bun:1.1 AS base

WORKDIR /app

# ── deps: install dependencies ────────────────────────────────────────────────
FROM base AS deps

RUN apt-get update && apt-get install -y \
    openssl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY package.json bun.lockb* ./
RUN bun install

# ── builder: build Next.js + Prisma ───────────────────────────────────────────
FROM base AS builder
RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Prisma client
RUN bunx prisma generate

# Placeholder secret so better-auth doesn't throw during static page generation.
# The real secret must be injected at runtime via environment variable.
ARG BETTER_AUTH_SECRET=build-placeholder
ENV BETTER_AUTH_SECRET=$BETTER_AUTH_SECRET

# Next build
RUN bun run build

# ── runner: production image ──────────────────────────────────────────────────
FROM base AS runner
RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 bunjs
RUN adduser --system --uid 1001 bunuser

COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma ./prisma

# standalone output (нужно output: 'standalone' в next.config)
COPY --from=builder --chown=bunuser:bunjs /app/.next/standalone ./
COPY --from=builder --chown=bunuser:bunjs /app/.next/static ./.next/static

USER bunuser

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["bun", "server.js"]