# Build off-device. Never copy macOS node_modules or a host's .next into Linux.
FROM node:24-bookworm-slim AS build
WORKDIR /app
RUN npm install --global pnpm@11.19.0
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1 NEXT_PUBLIC_APP_MODE=browser-core
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @chess-review/web build

FROM node:24-bookworm-slim AS runtime
ARG RELEASE_ID=unknown
LABEL org.opencontainers.image.version=$RELEASE_ID
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 HOSTNAME=0.0.0.0 PORT=3000 \
    NODE_OPTIONS=--max-old-space-size=768 APP_RELEASE=$RELEASE_ID
WORKDIR /app
COPY --from=build --chown=node:node /app/apps/web/.next/standalone ./
COPY --from=build --chown=node:node /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=build --chown=node:node /app/apps/web/public ./apps/web/public
USER node
EXPOSE 3000
CMD ["node", "apps/web/server.js"]
