#!/bin/bash
# ============================================================
#  hisob24 — lokal dev launcher
#  Postgres va hisob24 DB'ni tekshiradi, migratsiya qiladi,
#  keyin api + admin + web'ni rangli, prefiksli loglar bilan
#  ishga tushiradi. To'xtatish: Ctrl+C.
# ============================================================
set +e

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT_DIR" || exit 1

# Homebrew Postgres (psql, pg_isready), loyiha toollari va GOPATH/bin
export PATH="/opt/homebrew/opt/postgresql@17/bin:$ROOT_DIR/backend/bin:$PATH:$(go env GOPATH 2>/dev/null)/bin"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
CYAN='\033[0;36m'
NC='\033[0m'

# 8080 -> api, 3001 -> admin, 3000 -> web
PORTS=(8080 3001 3000)

info() { printf "${CYAN}[start]${NC}  %s\n" "$1"; }

free_ports() {
  for port in "${PORTS[@]}"; do
    pids=$(lsof -nP -iTCP:"$port" -sTCP:LISTEN -t 2>/dev/null)
    if [ -n "$pids" ]; then
      info "port $port bo'shatilmoqda (kill $pids)"
      kill $pids 2>/dev/null
    fi
  done
}

cleanup() {
  trap - SIGINT SIGTERM  # rekursiyaning oldini olish
  echo
  info "Hamma servislar to'xtatilmoqda…"
  # $! pipeline'da sed'ning PID'i, shuning uchun dev serverlar port orqali to'xtatiladi
  free_ports
  kill 0 2>/dev/null     # qolgan process-group (subshell, sed, air bolalari)
  exit 0
}
trap cleanup SIGINT SIGTERM

# --- .env ---
if [ ! -f .env ]; then
  info ".env topilmadi: .env.example'dan yaratilmoqda, secretlar avtomatik to'ldiriladi"
  cp .env.example .env
  for key in OTP_HMAC_SECRET JWT_SECRET; do
    value=$(openssl rand -hex 32)
    tmp=$(mktemp)
    sed "s|^$key=\$|$key=$value|" .env > "$tmp" && mv "$tmp" .env
  done
fi
set -a
. ./.env
set +a
# http://localhost'da Secure cookie'ni ba'zi brauzerlar (Safari) saqlamaydi
export COOKIE_SECURE=false

free_ports

# --- Postgres ---
if ! pg_isready -h localhost -p 5432 -q; then
  info "Postgres ishlamayapti: brew service yoqilmoqda…"
  brew services start postgresql@17 >/dev/null 2>&1
  for _ in $(seq 1 30); do
    pg_isready -h localhost -p 5432 -q && break
    sleep 1
  done
fi
if ! pg_isready -h localhost -p 5432 -q; then
  info "XATO: Postgres ko'tarilmadi (localhost:5432)"
  exit 1
fi

make db || exit 1
make tools || exit 1
make migrate || exit 1
pnpm install || exit 1

# --- Servislar (rangli prefiks, har biri alohida; sed -u: loglar TTY bo'lmasa ham darhol chiqadi) ---
if command -v air >/dev/null 2>&1; then
  API_CMD="air -c .air.toml"
else
  info "air topilmadi: 'go run ./cmd/api' (hot-reload yo'q)"
  API_CMD="go run ./cmd/api"
fi
(cd "$ROOT_DIR/backend" && $API_CMD 2>&1 | sed -u "s/^/$(printf "${RED}[api]${NC}    ")/") &
(pnpm --filter @hisob24/admin dev 2>&1 | sed -u "s/^/$(printf "${YELLOW}[admin]${NC}  ")/") &
(pnpm --filter @hisob24/web dev 2>&1 | sed -u "s/^/$(printf "${GREEN}[web]${NC}    ")/") &

printf "\n"
printf "  ${RED}api${NC}    -> http://localhost:8080/healthz\n"
printf "  ${YELLOW}admin${NC}  -> http://localhost:3001\n"
printf "  ${GREEN}web${NC}    -> http://localhost:3000\n"
printf "  ${CYAN}Ctrl+C${NC} — hammasini to'xtatadi.\n\n"

wait
