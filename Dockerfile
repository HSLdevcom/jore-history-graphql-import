# Using the node:13 base image
FROM node:13

# Replace the Stretch sources with Buster ones to avoid issues with deprecated Stretch repos
RUN echo "deb http://deb.debian.org/debian buster main contrib non-free" > /etc/apt/sources.list && \
    echo "deb http://security.debian.org/debian-security buster/updates main contrib non-free" >> /etc/apt/sources.list && \
    echo "deb http://deb.debian.org/debian buster-updates main contrib non-free" >> /etc/apt/sources.list

# Update and install required software
RUN apt-get update && \
    apt-get -y install git build-essential software-properties-common postgresql-client-11 && \
    rm -rf /var/lib/apt/lists/*

ENV WORK /opt/jore

WORKDIR ${WORK}

# Install app dependencies
COPY package.json ${WORK}
COPY yarn.lock ${WORK}

# Copy the env file for production
COPY .env.production ${WORK}/.env

RUN yarn install

# Copy app source
COPY . ${WORK}
CMD yarn run start:production
