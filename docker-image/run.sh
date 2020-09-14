#!/usr/bin/env bash

USE_GREENLOCK=0

if [[ $GREENLOCK == "1" ]]; then
  USE_GREENLOCK=1
fi
STAGING=0

if [[ $USE_GREENLOCK -eq 1 ]]; then
  echo "GREENLOCK_SUBJECT: ${GREENLOCK_SUBJECT}"
  if [[ -z $GREENLOCK_MAINTAINER ]]; then
    echo "! greenlock maintainer is missing, disabling greenlock [env GREENLOCK_MAINTAINER]"
    USE_GREENLOCK=0
  fi
  if [[ -z $GREENLOCK_SUBJECT ]]; then
    echo "! greenlock subject is missing, disabling greenlock [env GREENLOCK_SUBJECT]"
    USE_GREENLOCK=0
  fi
fi

if [[ $USE_GREENLOCK -eq 1 ]]; then
  echo "will use greenlock"
  echo "greenlock subject: ${GREENLOCK_SUBJECT}"
  echo "greenlock alt names: ${GREENLOCK_ALT_NAMES}"
  if [[ "${GREENLOCK_STAGING}" == "1" ]]; then
    echo "will use fake certificates"
    STAGING=1
  fi
  if [[ ! -f .greenlockrc ]]; then
    npx greenlock init --config-dir ./greenlock.d --maintainer-email "${GREENLOCK_MAINTAINER}"
  fi
  npx greenlock add --subject "${GREENLOCK_SUBJECT}" --altnames "${GREENLOCK_SUBJECT} ${GREENLOCK_ALT_NAMES}"
  mv .greenlockrc greenlock.d dist/
else
  echo "will not use greenlock"
fi

CMD="node /usr/local/lib/node_modules/spa-ssr-proxy/dist/server.js"

if [[ $STAGING -eq 1 ]]; then
  CMD+=" --staging"
fi
CMD+=" start"
CMD+=" $*"
echo "${CMD}"
$CMD
