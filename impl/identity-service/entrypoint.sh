#!/bin/bash
# Identity service entrypoint — pulls config from env and starts under pm2-runtime.

if [ -n "$S3_CONFIG_BUCKET" ] && [ -n "$S3_CONFIG_PATH" ]; then
    aws s3 cp "s3://$S3_CONFIG_BUCKET/$S3_CONFIG_PATH/env.config" .env || true
fi

pm2-runtime dist/src/index.js --name identity-service
