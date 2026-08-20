FROM node:24-alpine AS build

ENV HUSKY=0
RUN corepack enable
WORKDIR /workspace

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/package.json
RUN pnpm install --frozen-lockfile --filter @elpa/api...

COPY apps/api apps/api
RUN pnpm --filter @elpa/api build
RUN pnpm --filter @elpa/api deploy --prod --legacy /app
RUN cp -R apps/api/dist /app/dist

FROM node:24-alpine AS runtime

ENV NODE_ENV=production
WORKDIR /app

COPY --from=build /app ./

USER node
EXPOSE 3000
CMD ["node", "dist/main.js"]
