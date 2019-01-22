FROM node:10

RUN apt-get update && DEBIAN_FRONTEND=noninteractive apt-get install -y unzip && apt-get install -y jq

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
CMD ./run_daily.sh
