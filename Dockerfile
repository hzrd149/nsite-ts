# syntax=docker/dockerfile:1
FROM node:20-alpine AS base

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

RUN apk update && apk add --no-cache nginx supervisor
COPY supervisord.conf /etc/supervisord.conf

WORKDIR /app
COPY package.json .
COPY pnpm-lock.yaml .

FROM base AS prod-deps
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --prod --frozen-lockfile

FROM base AS build
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile
COPY tsconfig.json .
COPY src ./src
RUN pnpm build

FROM base AS main

# Setup user
RUN addgroup -S nsite && adduser -S nsite -G nsite
RUN chown -R nsite:nsite /app

# Setup nginx
COPY nginx/nginx.conf /etc/nginx/nginx.conf
COPY nginx/default.conf /etc/nginx/conf.d/default.conf

# setup nsite
COPY --from=prod-deps /app/node_modules /app/node_modules
COPY --from=build ./app/build ./build

COPY ./public ./public
COPY ./proxy.pac .

VOLUME [ "/var/cache/nginx" ]

EXPOSE 80 3000
ENV NSITE_PORT="3000"
ENV NGINX_CACHE_DIR="/var/cache/nginx"

COPY docker-entrypoint.sh /
RUN chmod +x /docker-entrypoint.sh
ENTRYPOINT ["/docker-entrypoint.sh"]

CMD ["/usr/bin/supervisord", "-c", "/etc/supervisord.conf"]
