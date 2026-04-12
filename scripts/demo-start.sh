#!/usr/bin/env bash
set -euo pipefail
echo "Starting KadenaTrace demo environment..."
docker compose up -d
echo "Waiting for Postgres and Redis..."
sleep 5
npm run build 2>/dev/null || true
echo "Starting API on :4000 and web on :3000..."
npm run dev
