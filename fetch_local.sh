#!/bin/bash
set -e

mkdir -p ./processed
mkdir -p ./data
mkdir -p ./tmp/build

curl --list-only https://dev-kartat.hsldev.com/poiminta/ | jq -r '.[0].name' > ./tmp/allfiles.txt

grep -E '^.*\.zip$' ./tmp/allfiles.txt > ./tmp/latestfile.txt
export LATEST_FILE=`tail -1 ./tmp/latestfile.txt`
rm ./tmp/allfiles.txt
rm ./tmp/latestfile.txt

echo "Latest file is $LATEST_FILE"

curl https://dev-kartat.hsldev.com/poiminta/${LATEST_FILE} --output /tmp/build/${LATEST_FILE}

unzip ./tmp/build/$LATEST_FILE -d ./data
echo "Latest build unzipped into ./data"
