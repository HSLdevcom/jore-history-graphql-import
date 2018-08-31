#!/bin/bash
set -e

mkdir -p /tmp/build

curl --list-only http://dev-kartat.hsldev.com/poiminta/  | jq -r '.[0].name' > /tmp/allfiles.txt

grep -E '^.*\.zip$' /tmp/allfiles.txt > /tmp/latestfile.txt
export LATEST_FILE=`tail -1 /tmp/latestfile.txt`
rm /tmp/allfiles.txt
rm /tmp/latestfile.txt

echo "Latest file is ${LATEST_FILE}"

if [ -f "/tmp/build/$LATEST_FILE" ]
then
    echo "Latest build was already found, won't run it again"
    echo "Exiting!" 1>&2
    exit 64
fi

rm -rf /tmp/build/*

curl http://dev-kartat.hsldev.com/poiminta/${LATEST_FILE} --output /tmp/build/${LATEST_FILE}

ln -s /tmp/build/${LATEST_FILE} /tmp/build/latest.zip
echo "Latest build can be accessed as /tmp/build/latest.zip"
