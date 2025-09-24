FROM node:18-alpine AS base

# Install required packages
RUN apk add --no-cache \
    bash \
    git \
    build-base \
    wget \
    curl \
    postgresql-client \
    ca-certificates \
    openssl

ENV WORK /opt/jore
WORKDIR ${WORK}

COPY package.json yarn.lock .env.production ./
RUN yarn install --frozen-lockfile

COPY . .

CMD ["yarn", "run", "start:production"]
