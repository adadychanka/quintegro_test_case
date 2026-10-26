#!/usr/bin/env bash
# Runs the e2e suite inside the official Playwright image, on the app's docker network.
# Prerequisite: the stack is up (see README "End-to-end tests").
set -euo pipefail
cd "$(dirname "$0")"
[ -d node_modules ] || npm ci
NETWORK="${E2E_NETWORK:-quintegro-tech-2_app-network}"
NGINX="${E2E_NGINX_CONTAINER:-quintegro-tech-2-nginx-1}"
# The Vite dev server rejects unknown host names (like "nginx") but accepts IP addresses.
NGINX_IP=$(docker inspect -f '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' "$NGINX")
docker run --rm --network "$NETWORK" \
  -v "$PWD":/e2e -w /e2e \
  -e E2E_BASE_URL="http://${NGINX_IP}:8080/runtime/" \
  mcr.microsoft.com/playwright:v1.48.2-jammy \
  npx playwright test "$@"
