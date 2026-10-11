#!/usr/bin/env bash
# Builds the images and (re)starts the stack of this directory: PostgreSQL,
# the migrations, then the API and both apps. Run on the server from the
# project directory, with .env in place. The compose file is
# docker-compose.prod.yml unless HISOB24_COMPOSE names another (the test
# stack's docker-compose.test.yml).
set -euo pipefail
cd "$(dirname "$0")/.."
compose() { docker compose -f "${HISOB24_COMPOSE:-docker-compose.prod.yml}" "$@"; }

compose build
compose up -d --wait postgres
compose run --rm --no-deps api sh -c 'goose -dir /migrations postgres "$DATABASE_URL" up'
compose up -d --wait api admin web
compose ps
