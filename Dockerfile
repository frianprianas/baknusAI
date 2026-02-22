FROM node:20-alpine AS base

# Install dependencies only when needed
FROM base AS deps
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NEXT_TELEMETRY_DISABLED 1

# Generate Prisma Client
RUN npx prisma generate

# Define dummy environment variables to prevent API initialization errors during build
ENV GROQ_API_KEY=dummy-key-for-build
ENV GEMINI_API_KEY=dummy-key-for-build
ENV DATABASE_URL=postgresql://dummy:dummy@localhost:5432/dummy
ENV JWT_SECRET=dummy-secret
ENV MAILCOW_API_KEY=dummy-mailcow-key

# Build Next.js app
RUN npm run build

# Production image, copy all the files and run next
FROM base AS runner
WORKDIR /app

ENV NODE_ENV production
ENV NEXT_TELEMETRY_DISABLED 1

# Install openssl for prisma client in runner
RUN apk add --no-cache openssl

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public

# Set the correct permission for prerender cache
RUN mkdir .next
RUN chown nextjs:nodejs .next

# Automatically leverage output traces to reduce image size
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Optional: Add Prisma generated client (standalone might have it in node_modules)
# But prisma query engine is native binary and might not be fully traced properly by Next standalone, so let's copy the entire node_modules from builder or what Next extracted. Next standalone traces .prisma/client and it should be fine. However, sometimes running `npx prisma migrate deploy` requires `prisma` CLI. I'll omit migration automation for now, assume db is migrated.

USER nextjs

EXPOSE 3000
ENV PORT 3000
ENV HOSTNAME "0.0.0.0"

CMD ["node", "server.js"]
