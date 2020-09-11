#!/usr/bin/env bash

#IFS=$'\n'; TAGS_ARR=($TAGS); unset IFS;
#echo "TAGS_ARR: ${TAGS_ARR}"

CMD="docker build "

for tag in $(./docker-get-tag.sh); do
  CMD+=" -t ${tag}"
done

CMD+=" docker-image"
echo "${CMD}"
$CMD
