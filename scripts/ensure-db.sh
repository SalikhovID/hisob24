#!/usr/bin/env bash
# Ensures the role and database named in DATABASE_URL exist on the local
# Postgres, and that the role may create databases (integration tests clone
# hisob24_it_* databases). Idempotent. Creating them needs a superuser:
# Homebrew Postgres makes the OS user one, so psql connects as that user.
set -euo pipefail

export PATH="/opt/homebrew/opt/postgresql@17/bin:$PATH"
: "${DATABASE_URL:?DATABASE_URL is not set: copy .env.example to .env}"

ready=$(psql "$DATABASE_URL" -qtAX -c "SELECT rolcreatedb OR rolsuper FROM pg_roles WHERE rolname = current_user" 2>/dev/null || true)
if [[ "$ready" == "t" ]]; then
  exit 0
fi

# postgres://user[:password]@host[:port]/dbname[?params]
rest="${DATABASE_URL#*://}"
userinfo="${rest%%@*}"
rest="${rest#*@}"
hostport="${rest%%/*}"
db_name="${rest#*/}"
db_name="${db_name%%\?*}"
db_user="${userinfo%%:*}"
db_pass=""
[[ "$userinfo" == *:* ]] && db_pass="${userinfo#*:}"
db_host="${hostport%%:*}"
db_port="5432"
[[ "$hostport" == *:* ]] && db_port="${hostport##*:}"

admin_psql() {
  psql -h "$db_host" -p "$db_port" -d postgres -v ON_ERROR_STOP=1 -qtAX "$@"
}

if [[ "$(admin_psql -c "SELECT 1 FROM pg_roles WHERE rolname = '$db_user'")" != "1" ]]; then
  echo "[db] creating role $db_user"
  if [[ -n "$db_pass" ]]; then
    admin_psql -c "CREATE ROLE \"$db_user\" LOGIN CREATEDB PASSWORD '$db_pass'"
  else
    admin_psql -c "CREATE ROLE \"$db_user\" LOGIN CREATEDB"
  fi
else
  admin_psql -c "ALTER ROLE \"$db_user\" CREATEDB"
fi

if [[ "$(admin_psql -c "SELECT 1 FROM pg_database WHERE datname = '$db_name'")" != "1" ]]; then
  echo "[db] creating database $db_name"
  admin_psql -c "CREATE DATABASE \"$db_name\" OWNER \"$db_user\""
fi

psql "$DATABASE_URL" -qtAX -c "SELECT 1" >/dev/null
echo "[db] $db_user@$db_host:$db_port/$db_name is ready"
