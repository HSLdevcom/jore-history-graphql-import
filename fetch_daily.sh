#!/bin/bash
set -e

if [[ -z "${FTP_USERNAME}" ]]; then
  echo "FTP Username is not set, exiting!"
  exit 2
fi

if [[ -z "${FTP_PASSWORD}" ]]; then
  echo "FTP Password is not set, exiting!"
  exit 2
fi

mkdir -p /tmp/build

curl --list-only ftp://${FTP_HOST}:${FTP_PORT}/karttainfopoiminta/ --user "${FTP_USERNAME}:${FTP_PASSWORD}" > /tmp/allfiles.txt

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


curl ftp://${FTP_HOST}:${FTP_PORT}/karttainfopoiminta/${LATEST_FILE} --user "${FTP_USERNAME}:${FTP_PASSWORD}" --output /tmp/build/${LATEST_FILE}

ln -s /tmp/build/${LATEST_FILE} /tmp/build/latest.zip
echo "Latest build can be accessed as /tmp/build/latest.zip"
