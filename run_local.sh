#!/bin/bash

fetch_local.sh
unzip -o /tmp/build/latest.zip -d /opt/jore/data
yarn run docker:knex migrate:latest
yarn start
