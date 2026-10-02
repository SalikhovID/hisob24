# Production image of both Next.js apps (admin and web), built from the pnpm
# workspace. API_URL is baked into the /api/* rewrite at build time, so it
# points at the api service of docker-compose.prod.yml.
FROM node:24-bookworm-slim
RUN corepack enable && corepack prepare pnpm@10.24.0 --activate
WORKDIR /repo
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/admin/package.json apps/admin/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/api-client/package.json packages/api-client/package.json
RUN pnpm install --frozen-lockfile
COPY apps apps
COPY packages packages
ARG API_URL=http://api:8080
ENV API_URL=$API_URL NEXT_TELEMETRY_DISABLED=1
RUN pnpm --filter @hisob24/admin build && pnpm --filter @hisob24/web build \
  && chown -R node:node apps/admin/.next apps/web/.next
ENV NODE_ENV=production
USER node
# docker-compose.prod.yml picks the app with working_dir and the port.
WORKDIR /repo/apps/web
CMD ["node_modules/.bin/next", "start", "-p", "3000"]
