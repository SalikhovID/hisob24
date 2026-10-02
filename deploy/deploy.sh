#!/usr/bin/env bash
# Builds the images and (re)starts the production stack of this directory:
# PostgreSQL, the migrations, then the API and both apps. Run on the server
# from the project directory, with .env in place.
set -euo pipefail
cd "$(dirname "$0")/.."
compose() { docker compose -f docker-compose.prod.yml "$@"; }

compose build
compose up -d --wait postgres
compose run --rm --no-deps api sh -c 'goose -dir /migrations postgres "$DATABASE_URL" up'
compose up -d --wait api admin web
compose ps
