# syntax=docker/dockerfile:1
FROM node:20-slim AS base

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

# Setup nsite user
RUN groupadd -r nsite && useradd -r -g nsite -G audio,video nsite && usermod -d /app nsite

# Install nginx and supervisor
RUN apt-get update && apt-get install -y nginx supervisor

# setup supervisor
COPY supervisord.conf /etc/supervisord.conf

# Setup nginx
COPY nginx/nginx.conf /etc/nginx/nginx.conf
COPY nginx/default.conf /etc/nginx/conf.d/default.conf
RUN chown nsite:nsite -R /etc/nginx

# install google chrome for screenshots. copied from (https://pptr.dev/troubleshooting#running-puppeteer-in-docker)

# Install latest chrome dev package and fonts to support major charsets (Chinese, Japanese, Arabic, Hebrew, Thai and a few others)
# Note: this installs the necessary libs to make the bundled version of Chrome for Testing that Puppeteer
# installs, work.
RUN apt-get update \
    && apt-get install -y wget gnupg \
    && wget -q -O - https://dl-ssl.google.com/linux/linux_signing_key.pub | apt-key add - \
    && sh -c 'echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google.list' \
    && apt-get update \
    && apt-get install -y google-chrome-stable fonts-ipafont-gothic fonts-wqy-zenhei fonts-thai-tlwg fonts-kacst fonts-freefont-ttf libxss1 \
      --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

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

# setup nsite
COPY --from=prod-deps /app/node_modules /app/node_modules
COPY --from=build ./app/build ./build

COPY ./public ./public
COPY tor-and-i2p.pac proxy.pac

VOLUME [ "/var/cache/nginx" ]
VOLUME [ "/screenshots" ]

EXPOSE 80 3000
ENV NSITE_PORT="3000"
ENV NGINX_CACHE_DIR="/var/cache/nginx"
ENV ENABLE_SCREENSHOTS="true"
ENV SCREENSHOTS_DIR="/screenshots"
ENV PUPPETEER_SKIP_DOWNLOAD="true"

COPY docker-entrypoint.sh /
RUN chmod +x /docker-entrypoint.sh

# change ownership of app
RUN chown nsite:nsite -R /app

# Run /docker-entrypoint as root so supervisor can run
ENTRYPOINT ["/docker-entrypoint.sh"]
CMD ["/usr/bin/supervisord", "-c", "/etc/supervisord.conf"]
