# syntax=docker/dockerfile:1
# check=error=true

FROM hsldevcom/infodevops-docker-base-images:1.0.2-22-node AS build
WORKDIR /usr/app
COPY package.json package-lock.json ./
RUN npm ci
COPY src ./src

FROM build AS tester
CMD ["npm", "run", "check-and-build"]

FROM build AS production-dependencies
RUN npm prune --omit=dev

FROM hsldevcom/infodevops-docker-base-images:1.0.2-22-node AS production
WORKDIR /usr/app
ENV NODE_ENV=production
RUN apt-get update \
    && apt-get install -y --no-install-recommends postgresql-client-15 \
    && rm -rf /var/lib/apt/lists/*
COPY --from=production-dependencies /usr/app/src ./src
COPY --from=production-dependencies /usr/app/package.json /usr/app/package-lock.json ./
COPY --from=production-dependencies /usr/app/node_modules ./node_modules
CMD ["npm", "run", "start:production"]