#!/usr/bin/env bash
# Daily dump of the production database to
# /var/backups/hisob24-v2/hisob24-<date>.sql.gz, keeping 14 days. Run as root
# from cron (deploy/hisob24-v2-backup.cron).
set -euo pipefail
cd "$(dirname "$0")/.."
dir=/var/backups/hisob24-v2
install -d -m 700 "$dir"
file="$dir/hisob24-$(date +%F).sql.gz"
docker compose -f docker-compose.prod.yml exec -T postgres pg_dump -U hisob24 -d hisob24 --no-owner | gzip > "$file.tmp"
mv "$file.tmp" "$file"
find "$dir" -name 'hisob24-*.sql.gz' -mtime +14 -delete
