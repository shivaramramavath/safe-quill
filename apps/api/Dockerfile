
FROM node:20-alpine AS base

WORKDIR /app

RUN npm install -g pnpm


# Dependencies
FROM base AS deps

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

COPY packages/shared/package.json ./packages/shared/package.json
COPY apps/api/package.json ./apps/api/package.json

RUN pnpm install --frozen-lockfile


# Builder
FROM deps AS builder

COPY packages/shared ./packages/shared
COPY apps/api ./apps/api

RUN pnpm --filter @safe-quill/shared build

RUN pnpm --filter @safe-quill/api build


# Production
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=4000

COPY --from=builder /app/package.json ./package.json

COPY --from=builder /app/packages/shared/package.json ./packages/shared/package.json
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist

COPY --from=builder /app/apps/api/package.json ./apps/api/package.json
COPY --from=builder /app/apps/api/dist ./apps/api/dist

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/api/node_modules ./apps/api/node_modules

EXPOSE 8080

CMD ["node", "apps/api/dist/src/main.js"]
