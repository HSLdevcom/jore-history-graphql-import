FROM hsldevcom/infodevops-docker-base-images:22-node-edge AS build

WORKDIR /opt/jore

COPY package.json package-lock.json ./
RUN npm ci

COPY src ./src
RUN npm run check-and-build && npm prune --omit=dev

FROM hsldevcom/infodevops-docker-base-images:22-node-edge AS production

ENV NODE_ENV=production
WORKDIR /opt/jore

RUN apt-get update && \
    apt-get install -y --no-install-recommends postgresql-client-15 && \
    rm -rf /var/lib/apt/lists/*

COPY --from=build /opt/jore/node_modules ./node_modules
COPY --from=build /opt/jore/package.json ./package.json
COPY --from=build /opt/jore/src ./src

CMD ["npm", "run", "start:production"]