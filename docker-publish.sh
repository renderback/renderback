#!/usr/bin/env bash

for tag in $(./docker-get-tag.sh); do
  CMD="docker push ${tag}"
  echo $CMD
  $CMD
done
