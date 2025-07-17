FROM node:18

RUN apt-get update && \
    apt-get install -y \
        apt-transport-https \
        ca-certificates \
        wget \
        gnupg2

RUN echo "deb http://apt-archive.postgresql.org/pub/repos/apt buster-pgdg main" > /etc/apt/sources.list.d/pgdg.list && \
    wget --quiet -O - https://www.postgresql.org/media/keys/ACCC4CF8.asc | apt-key add - && \
    apt-get update && \
    apt-get -y install \
        git \
        build-essential \
        software-properties-common \
        postgresql-client-12 && \
    rm -rf /var/lib/apt/lists/*

ENV WORK /opt/jore
WORKDIR ${WORK}

COPY package.json yarn.lock .env.production ./
RUN yarn install

COPY . .
CMD yarn run start:production
