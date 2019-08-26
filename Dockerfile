FROM node:12

RUN apt-get update && apt-get -y install postgresql-client && rm -rf /var/lib/apt/lists/*

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
