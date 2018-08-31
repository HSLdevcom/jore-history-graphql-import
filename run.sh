#!/bin/bash

./fetch.sh
unzip -o /tmp/build/latest.zip -d /opt/jore/data
cp terminaaliryhma.dat /opt/jore/data/terminaaliryhma.dat
yarn run docker:knex migrate:latest
yarn start
