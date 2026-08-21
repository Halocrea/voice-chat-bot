# Pinned on purpose. "node:alpine" silently followed every major release, so an
# image that built fine one day could ship an incompatible Node the next — and
# this project now requires Node 22 or newer.
FROM node:22-alpine AS build

WORKDIR /app

COPY package*.json tsconfig.json ./
# ci rather than install: it installs exactly what the lockfile pins, and fails
# loudly if the lockfile and package.json disagree
RUN npm ci

COPY src ./src
RUN npm run build


FROM node:22-alpine AS runtime

WORKDIR /app

# Log timestamps follow this zone. Override it at run time with -e TZ=Europe/Paris
RUN apk add --no-cache tzdata
ENV TZ=UTC

COPY package*.json ./
# No build toolchain here: better-sqlite3 ships prebuilt binaries for musl on
# both x64 and arm64, which is why the old python/make/g++ block is gone. It had
# been broken for years anyway — Alpine dropped the "python" package long ago.
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=build /app/build ./build

# The SQLite databases live here and must outlive the container. Mount a host
# directory over it, or every restart starts from an empty configuration.
RUN mkdir -p /app/saves
VOLUME /app/saves

# node directly rather than through npm: one less process between the container
# and the signals it has to react to when told to stop
CMD ["node", "build/index.js"]
