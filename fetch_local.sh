#!/bin/bash
set -e

mkdir -p ./data
mkdir -p ./tmp

curl --list-only ftp://195.255.176.166/karttainfopoiminta/ --user $FTPUSER:$FTPPASSWORD > ./tmp/allfiles.txt

grep -E '^.*\.zip$' ./tmp/allfiles.txt > ./tmp/latestfile.txt
export LATEST_FILE=`tail -1 ./tmp/latestfile.txt`
rm ./tmp/allfiles.txt
rm ./tmp/latestfile.txt

echo "Latest file is $LATEST_FILE"

curl ftp://195.255.176.166/karttainfopoiminta/$LATEST_FILE --user $FTPUSER:$FTPPASSWORD --output ./tmp/$LATEST_FILE

unzip ./tmp/$LATEST_FILE -d ./data
echo "Latest build unzipped into ./data"
