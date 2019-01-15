#!/bin/bash

./fetch_daily.sh
unzip -o /tmp/build/latest.zip -d /opt/jore/data
yarn run docker:knex migrate:latest
yarn start
