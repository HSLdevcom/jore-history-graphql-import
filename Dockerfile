FROM node:10

RUN apt-get update && DEBIAN_FRONTEND=noninteractive apt-get install -y unzip

ENV WORK /opt/jore

# Create app directory
RUN mkdir -p ${WORK}
RUN mkdir -p ${WORK}/data
RUN mkdir -p ${WORK}/processed
WORKDIR ${WORK}
# Install app dependencies
COPY package.json ${WORK}
COPY yarn.lock ${WORK}
RUN yarn install

# Copy app source
COPY . ${WORK}

# Fetch and import data
CMD ./fetch.sh && \
  unzip -o /tmp/build/latest.zip -d ${WORK}/data && \
  cp terminaaliryhma.dat ${WORK}/data/terminaaliryhma.dat && \
  yarn run docker:knex migrate:latest && \
  yarn start
