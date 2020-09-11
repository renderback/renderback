#!/usr/bin/env bash

IS_SHA_VERSION=0
CLEAN=1
if ! git diff-files --quiet --ignore-submodules --; then
  CLEAN=0
fi
VERSION=$(cat .version)
if [[ $VERSION == "SNAPSHOT" ]] | [[ $CLEAN -eq 0 ]]; then
  SHA=$(git rev-parse HEAD | cut -c 1-7)
  IS_SHA_VERSION=1
  if [[ $CLEAN -eq 0 ]]; then
    VERSION="${SHA}-SNAPSHOT"
  else
    VERSION="${SHA}"
  fi
fi
USER_NAME=yurique
IMAGE_NAME=spa-ssr-proxy

IMAGE="ghcr.io/${USER_NAME}/${IMAGE_NAME}"
echo "${IMAGE}:$VERSION"
if [[ $IS_SHA_VERSION -eq 0 ]]; then
  echo "${IMAGE}:latest"
else
  echo "${IMAGE}:snapshot"
fi