# syntax=docker/dockerfile:1

FROM node:20-bookworm-slim AS deps
WORKDIR /app
ARG NPM_REGISTRY=https://registry.npmjs.org
COPY package.json package-lock.json ./
RUN npm ci --registry="$NPM_REGISTRY"

FROM deps AS builder
WORKDIR /app
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
ENV DOCKER_BUILD=1
RUN npm run build

FROM node:20-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=43127
ENV HOSTNAME=0.0.0.0
ENV HOSTING=vps

COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
COPY --from=builder /app/data ./seed
COPY docker-entrypoint.sh /app/docker-entrypoint.sh
RUN chmod +x /app/docker-entrypoint.sh && mkdir -p /app/data

EXPOSE 43127
ENTRYPOINT ["/app/docker-entrypoint.sh"]
