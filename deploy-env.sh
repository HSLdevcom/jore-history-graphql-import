#!/bin/bash
set -e

PS3='Select an environment:'
option_labels=("Local" "Development" "Staging" "Production" "Old")
select opt in "${option_labels[@]}"; do
  case $opt in
  "Latest")
    echo "You chose Latest"
    ENV=latest
    break
    ;;
  "Development")
    echo "You chose Development"
    ENV=dev
    break
    ;;
  "Staging")
    echo "You chose Staging"
    ENV=stage
    break
    ;;
  "Production")
    echo "You chose Production"
    ENV=production
    break
    ;;
  *)
    ENV=production
    break
    ;;
  esac
done

echo "Building for the $opt ($ENV) environment..."

ORG=${ORG:-hsldevcom}
DOCKER_IMAGE=${ORG}/jore-history-graphql-import:${ENV}

docker build -t ${DOCKER_IMAGE} .
docker push ${DOCKER_IMAGE}
