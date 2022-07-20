#!/usr/bin/env bash

docker run --rm -it \
  -p 43000:3000 \
  -e DEBUG='browserless*' \
  -e PREBOOT_CHROME=true \
  -e KEEP_ALIVE=true \
  -e MAX_CONCURRENT_SESSIONS=5 \
  -e CONNECTION_TIMEOUT=30000 \
  -e FUNCTION_ENABLE_INCOGNITO_MODE=true \
  -e DEFAULT_BLOCK_ADS=false \
  -e EXIT_ON_HEALTH_FAILURE=true \
  --name browserless \
  --net=renderback \
  browserless/chrome:latest
