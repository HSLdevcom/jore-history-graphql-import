FROM node:20-slim

RUN apt-get update && \
    apt-get install -y \
        apt-transport-https \
        ca-certificates \
        wget \
        gnupg2 \
        git \
        build-essential \
        software-properties-common \
        postgresql-client-15 \
    && rm -rf /var/lib/apt/lists/*

ENV WORK /opt/jore
WORKDIR ${WORK}

COPY package.json yarn.lock .env.production ./
RUN yarn install

COPY . .
CMD ["yarn", "run", "start:production"]
