#!/usr/bin/env bash
# Deploys the committed tree (git archive HEAD) to the server: it replaces
# the project directory, keeping .env (the previous tree stays in <dir>.prev),
# then runs deploy/deploy.sh there. Usage: deploy/ship.sh [host] [dir];
# HISOB24_COMPOSE names the compose file deploy.sh uses (the test server:
# HISOB24_COMPOSE=docker-compose.test.yml deploy/ship.sh test /var/www/hisob24-dev).
set -euo pipefail
host=${1:-prod}
dir=${2:-/var/www/hisob24-v2}
compose=${HISOB24_COMPOSE:-docker-compose.prod.yml}

git -C "$(dirname "$0")/.." archive --format=tar.gz HEAD |
  ssh "$host" "set -euo pipefail
    tmp=\$(mktemp -d)
    tar -xzf - -C \"\$tmp\"
    cp -a '$dir/.env' \"\$tmp/.env\"
    rm -rf '$dir.prev'
    mv '$dir' '$dir.prev'
    mv \"\$tmp\" '$dir'
    chmod 750 '$dir'
    cd '$dir'
    HISOB24_COMPOSE='$compose' deploy/deploy.sh"
