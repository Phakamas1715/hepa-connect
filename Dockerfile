FROM node:22-alpine AS base
WORKDIR /app
ENV NODE_ENV=production

FROM base AS deps
COPY package.json pnpm-lock.yaml ./
RUN corepack enable && pnpm install --frozen-lockfile

FROM deps AS build
COPY . .
ENV NODE_OPTIONS=--max-old-space-size=4096
RUN pnpm build

FROM base AS runner
RUN corepack enable
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/server.mjs ./server.mjs
COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/data ./data
EXPOSE 3000
ENV HOST=0.0.0.0
ENV PORT=3000
CMD ["node", "server.mjs"]
