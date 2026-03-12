FROM node:22-alpine AS base
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

FROM base AS deps
ENV NODE_ENV=development
COPY package.json package-lock.json ./
COPY apps/web/package.json ./apps/web/package.json
COPY packages/worker/package.json ./packages/worker/package.json
RUN npm ci

FROM base AS builder
ENV NODE_ENV=development
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM base AS runner
ENV NODE_ENV=production
ENV PORT=10000
COPY --from=builder /app ./
EXPOSE 10000
CMD ["npm", "run", "start"]
