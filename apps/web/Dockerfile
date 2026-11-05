
FROM node:20-alpine AS base

WORKDIR /app

RUN npm install -g pnpm


# Builder
FROM base AS builder

COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./

COPY packages/shared ./packages/shared
COPY apps/web ./apps/web

RUN pnpm install --frozen-lockfile

RUN pnpm --filter @safe-quill/shared build

RUN pnpm --filter @safe-quill/web build


# Runner
FROM base AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

COPY --from=builder /app/package.json ./package.json

COPY --from=builder /app/apps/web/.next ./apps/web/.next

COPY --from=builder /app/apps/web/package.json ./apps/web/package.json

COPY --from=builder /app/node_modules ./node_modules

COPY --from=builder /app/apps/web/node_modules ./apps/web/node_modules

EXPOSE 3000

CMD ["pnpm", "--filter", "@safe-quill/web", "start"]
