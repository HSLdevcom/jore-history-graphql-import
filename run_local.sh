#!/bin/bash

fetch_local.sh
unzip -o /tmp/build/latest.zip -d /opt/jore/data
npm run knex -- migrate:latest
npm start
