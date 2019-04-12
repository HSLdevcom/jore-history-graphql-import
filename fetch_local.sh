#!/bin/bash
set -e

mkdir -p /tmp/build

if [ ! -d "/source" ]; then
    echo "Source not found. Add the /source dir and put a JORE export in it."
    echo "Exiting!" 1>&2
    exit 64
fi

find /source -type f -name "*.zip" -exec basename {} \; | head -n 1 > /tmp/latestfile.txt
export LATEST_FILE=`tail -1 /tmp/latestfile.txt`
rm /tmp/latestfile.txt

echo "Latest file is ${LATEST_FILE}"

if [ -f "/tmp/build/$LATEST_FILE" ]
then
    echo "Latest build was already found, won't run it again"
    echo "Exiting!" 1>&2
    exit 64
fi

rm -rf /tmp/build/*

ln -s /source/${LATEST_FILE} /tmp/build/latest.zip
echo "Latest build can be accessed as /tmp/build/latest.zip"
