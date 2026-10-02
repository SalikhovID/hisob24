# Hisob24

Multi-tenant SaaS. Platforma adminlari company yaratadi, obunasini uzaytiradi va adminlarni boshqaradi. Company userlari esa user app'da ishlaydi.

| Qism | Lokal manzil | Vazifasi |
|---|---|---|
| Go API (`backend/`) | http://localhost:8080 | HTTP API va ikkala Telegram bot, bitta jarayonda |
| Admin panel (`apps/admin`) | http://localhost:3001 | Company'lar, billing va adminlar. Admin botda Mini App sifatida ham ochiladi |
| User app (`apps/web`) | http://localhost:3000 | SMS kod bilan kirish, company tanlash |
| Admin bot | Telegram | `/login` → panelga kirish kodi |
| User bot | Telegram | Telefon raqamini `chat_id` bilan bog'laydi |

So'rov yo'li: brauzer yoki Telegram WebView → Next.js (`/api/*` rewrite, bitta origin) → Go API → PostgreSQL.

Hujjatlar:
- [`docs/SPEC.md`](docs/SPEC.md): spetsifikatsiya;
- [`docs/superpowers/specs/2026-10-02-hisob24-design.md`](docs/superpowers/specs/2026-10-02-hisob24-design.md): kelishilgan qarorlar va spec'dan tasdiqlangan chetlanishlar;
- [`CLAUDE.md`](CLAUDE.md): ish qoidalari (TDD, git);
- [`backend/openapi.yaml`](backend/openapi.yaml): API kontrakti.

## Talablar

- **macOS + Homebrew `postgresql@17`.** `start.sh` shu muhitga moslangan; boshqa muhitlar uchun pastdagi "Docker Compose" va "`start.sh` siz" bo'limlariga qarang.
- **Go 1.27.** Standart `GOTOOLCHAIN=auto` bilan `go.mod` dagi versiya o'zi yuklanadi.
- **Node 24 va pnpm 10.** Masalan `corepack enable` bilan.
- **`openssl`.** `start.sh` secret'larni shu bilan yaratadi.
- **`air` (ixtiyoriy).** API'ni hot-reload bilan ishga tushiradi; bo'lmasa `go run` ishlatiladi.

## Lokal ishga tushirish

```bash
git clone git@github.com:SalikhovID/hisob24.git
cd hisob24
make dev
```

`make dev` (= `./start.sh`) quyidagilarni bajaradi:

1. `.env` bo'lmasa, uni `.env.example` dan yaratadi. `OTP_HMAC_SECRET` va `JWT_SECRET` ni `openssl rand -hex 32` bilan to'ldiradi.
2. `.env` ni o'qiydi va `COOKIE_SECURE=false` qiladi, chunki lokal muhit http.
3. 8080, 3001 va 3000 portlarini bo'shatadi.
4. Postgres ishlamasa, `brew services start postgresql@17` qiladi.
5. `make db` (rol va DB), `make tools` (goose, sqlc, golangci-lint → `backend/bin`), `make migrate` va `pnpm install` ni bajaradi.
6. API, admin va web'ni rangli prefiksli loglar bilan ishga tushiradi. `Ctrl+C` hammasini to'xtatadi.

Tekshirish:
- `curl localhost:8080/healthz` → `{"status":"ok"}`;
- http://localhost:3001 (admin) va http://localhost:3000 (user app) `/login` ga olib boradi.

Bot tokeni bo'sh bo'lsa, o'sha bot ishga tushmaydi (logda ogohlantirish chiqadi), qolgani ishlayveradi. `SMS_DRIVER=log` rejimida SMS yuborilmaydi, kodlar API logiga yoziladi.

### Botsiz kirish

**Admin panel.** Migratsiya birinchi adminni yaratadi (Telegram ID `461603558`). Kodni botsiz olish mumkin:

```bash
make otp              # birinchi faol admin uchun
make otp ID=123456789 # boshqa admin uchun
# Kod: 482913 (1 daqiqa amal qiladi), admin 461603558
```

- Kodni http://localhost:3001/login dagi 6 ta katakka kiriting.
- `make otp` faqat `SMS_DRIVER=log` rejimida ishlaydi.
- O'z Telegram ID'ingizni panelning "Adminlar" sahifasida qo'shishingiz mumkin.

**User app.**
1. Admin panelda company yarating va egasining telefoni sifatida o'z raqamingizni kiriting.
2. http://localhost:3000 da shu raqam bilan kiring.
3. SMS kodini API logidan oling:

```
[api]    time=… level=INFO msg="sms (SMS_DRIVER=log, not sent)" phone=998901234567 text="Hisob24 kirish kodi: 482913"
```

Bir nechta company'da bo'lsangiz, avval company tanlanadi. Muddati o'tgan yoki bloklangan company'ga kirganda `/expired` sahifasi ochiladi.

### Docker Compose (ixtiyoriy)

`docker-compose.yml` PostgreSQL 16 ni ko'taradi (user, parol va DB: `hisob24`, port 5432).

```bash
brew services stop postgresql@17   # u ham 5432 ni egallaydi
docker compose up -d postgres
make dev
```

- `start.sh` Postgres'ni `pg_isready` bilan tekshiradi, shuning uchun PostgreSQL client toollari (`pg_isready`, `psql`) PATH'da bo'lishi kerak.
- Bu yo'l loyiha ishlab chiqilgan mashinada sinalmagan (u yerda Docker yo'q).

### `start.sh` siz

Masalan, Linux'da. Postgres'da `DATABASE_URL` dagi rol (`CREATEDB` huquqi bilan) va DB bo'lsin. `make db` ularni OS foydalanuvchisi superuser bo'lsa yarata oladi.

```bash
cp .env.example .env   # OTP_HMAC_SECRET va JWT_SECRET: openssl rand -hex 32
make tools migrate
pnpm install
set -a; . ./.env; set +a; export COOKIE_SECURE=false
(cd backend && go run ./cmd/api) &
pnpm --filter @hisob24/admin dev &
pnpm --filter @hisob24/web dev
```

## Buyruqlar

| Buyruq | Nima qiladi |
|---|---|
| `make dev` | `./start.sh`: Postgres, migratsiya, API + admin + web |
| `make test` | Go testlari (haqiqiy Postgres bilan) va Vitest |
| `make e2e` | Playwright: admin (3101-port) va user app (3102-port), 375px telefon va desktop, API MSW bilan mock qilinadi. Birinchi marta: `pnpm --filter @hisob24/admin exec playwright install chromium` |
| `make lint` | `go vet`, golangci-lint, eslint, typecheck |
| `make migrate`, `migrate-down`, `migrate-status`, `migrate-create name=…` | goose migratsiyalari (`backend/migrations`) |
| `make sqlc` | `backend/internal/db/gen` ni generatsiya qiladi (qo'lda tahrirlanmaydi) |
| `make api-client` | `openapi.yaml` → `packages/api-client` (qo'lda tahrirlanmaydi) |
| `make db` | `DATABASE_URL` dagi rol va DB'ni yaratadi (idempotent) |
| `make tools` | goose, sqlc va golangci-lint'ni `backend/bin` ga o'rnatadi (versiyalari pin qilingan) |
| `make otp [ID=…]` | Lokal admin login kodi (faqat `SMS_DRIVER=log`) |

Go integration testlari `TEST_DATABASE_URL` orqali serverning `postgres` bazasiga ulanadi. Ular faqat `hisob24_it_*` nomli vaqtinchalik bazalarni yaratadi va o'chiradi.

## Env

Hamma sozlamalar env orqali o'qiladi; ro'yxat: [`.env.example`](.env.example).

| O'zgaruvchi | Qachon kerak | Default | Ma'nosi |
|---|---|---|---|
| `DATABASE_URL` | doim | — | PostgreSQL ulanishi |
| `TEST_DATABASE_URL` | testlarda | — | Serverning `postgres` bazasi; testlar `hisob24_it_*` bazalarini shu ulanish orqali ochadi |
| `HTTP_ADDR` | — | `:8080` | API tinglaydigan manzil |
| `API_URL` | — | `http://localhost:8080` | Next `/api/*` rewrite manzili. **`next build` paytida o'qiladi**: o'zgarsa, frontend qayta build qilinadi |
| `COOKIE_SECURE` | — | `true` | Cookie'larning `Secure` atributi. `start.sh` lokal http uchun `false` qiladi |
| `ADMIN_BOT_TOKEN` | admin bot uchun | — | Bo'sh bo'lsa bot o'chiq. Mini App `initData` shu token bilan tekshiriladi |
| `ADMIN_BOT_USERNAME` | — | — | Admin login sahifasidagi bot havolasi (`@` siz). Runtime'da o'qiladi |
| `USER_BOT_TOKEN` | user bot uchun | — | Bo'sh bo'lsa bot o'chiq |
| `BOT_MODE` | — | `polling` | `polling` (dev) yoki `webhook` (prod) |
| `TELEGRAM_WEBHOOK_SECRET` | `webhook` da | — | Telegram'ning `X-Telegram-Bot-Api-Secret-Token` header'i |
| `PUBLIC_API_URL` | `webhook` da | — | Telegram yetadigan API manzili (https) |
| `ADMIN_PANEL_URL` | prod'da | — | Admin panel manzili. Bot menu tugmasi va CSRF himoyasidagi ishonchli origin shundan olinadi |
| `OTP_HMAC_SECRET` | doim | — | Admin va SMS kodlarining HMAC kaliti |
| `JWT_SECRET` | doim | — | User access token'ining imzosi (HS256) |
| `SMS_DRIVER` | — | `log` | `log` (SMS yuborilmaydi, kod logga yoziladi) yoki `eskiz` |
| `ESKIZ_EMAIL`, `ESKIZ_PASSWORD` | `eskiz` da | — | Eskiz.uz akkaunti |
| `ESKIZ_FROM` | — | `4546` | SMS jo'natuvchisi |

## Telegram botlarni sozlash (BotFather)

BotFather menyusidagi nomlar Telegram yangilanishlari bilan biroz o'zgarishi mumkin.

1. **Botlar.** [@BotFather](https://t.me/BotFather) da `/newbot` bilan ikkita bot oching: admin bot va user bot.
   - `.env` ga: `ADMIN_BOT_TOKEN`, `USER_BOT_TOKEN`;
   - admin botning username'ini (`@` siz) `ADMIN_BOT_USERNAME` ga yozing.
2. **Buyruqlar (ixtiyoriy).** `/setcommands` bilan beriladi, Telegram'dagi buyruqlar menyusida ko'rinadi:
   - admin bot: `login - Panelga kirish kodi`;
   - user bot: `start - Raqamni ulash`.

   Ikkala bot `/start` ga ham, boshqa xabarlarga ham javob beradi.
3. **Menu button (admin bot).**
   - API ishga tushganda `setChatMenuButton` bilan uni o'zi o'rnatadi: matni "Admin panel", manzili `ADMIN_PANEL_URL`.
   - Telegram faqat `https://` manzilni qabul qiladi. http bo'lsa, API logga ogohlantirish yozadi va ishlashda davom etadi.
   - Qo'lda ham o'rnatish mumkin: `/mybots` → admin bot → Bot Settings → Menu Button. Lekin API har ishga tushganda uni qayta yozadi.
4. **Mini App URL (admin bot).** `/mybots` → admin bot → Bot Settings → Configure Mini App → Enable Mini App → `ADMIN_PANEL_URL`.
   - Shundan keyin panel bot profilidan va `t.me/<bot>?startapp` havolasidan ham ochiladi.
   - Menu tugmasi bu sozlamasiz ham ishlaydi.
   - Telegram ichida panel `initData` bilan o'zi kiradi: kod so'ralmaydi.
5. **User bot** uchun Mini App ham, menu tugmasi ham kerak emas. U `/start` ga raqam so'raydi va yuborilgan kontaktni saqlaydi.
6. **Mini App'ni lokal sinash.** Telegram faqat https manzilni ochadi.
   - Admin panelni https tunnel orqali chiqaring (masalan `cloudflared tunnel --url http://localhost:3001`).
   - Berilgan manzilni `ADMIN_PANEL_URL` ga yozing va `make dev` ni qayta ishga tushiring.
   - `start.sh` `COOKIE_SECURE=false` qiladi. Shuning uchun sessiya Telegram'ning telefon va kompyuter ilovalarida ishlaydi, lekin brauzerdagi Telegram Web'da (iframe) cookie saqlanmaydi va panel "Kirib bo'lmadi" deydi. Telegram Web uchun https va `COOKIE_SECURE=true` kerak.

## Production'da webhook

1. `.env`:

   ```bash
   BOT_MODE=webhook
   PUBLIC_API_URL=https://api.example.com
   TELEGRAM_WEBHOOK_SECRET=…   # openssl rand -hex 32
   ```

   - `PUBLIC_API_URL`: Telegram internetdan yetadigan https manzil. Telegram webhook uchun faqat 443, 80, 88 va 8443 portlarini qabul qiladi.
   - `TELEGRAM_WEBHOOK_SECRET`: 1–256 belgi, faqat `A-Z`, `a-z`, `0-9`, `_` va `-`. `openssl rand -hex 32` bunga mos keladi.
   - Ikkalasi bo'lmasa, API ishga tushmaydi va sababini aytadi.
2. **Webhook o'rnatilishi.** API ishga tushganda har bir bot uchun `setWebhook` ni o'zi chaqiradi:
   - admin bot → `${PUBLIC_API_URL}/webhooks/admin-bot`;
   - user bot → `${PUBLIC_API_URL}/webhooks/user-bot`.

   `secret_token` sifatida `TELEGRAM_WEBHOOK_SECRET` beriladi. Telegram uni har bir update bilan `X-Telegram-Bot-Api-Secret-Token` header'ida qaytaradi; mos kelmasa, API 401 `invalid_secret_token` beradi. `setWebhook` xato bersa, API ishga tushmaydi (sababi logda).
3. **Reverse proxy** (nginx, Caddy va h.k.) `PUBLIC_API_URL` ostidagi `/webhooks/*` so'rovlarini API'ga (`HTTP_ADDR`) o'tkazishi kerak. Brauzerlar API'ga Next orqali boradi, shuning uchun API'ning internetga ochiq bo'lishi faqat shu webhook'lar uchun kerak.
4. **Tekshirish:**

   ```bash
   curl "https://api.telegram.org/bot<TOKEN>/getWebhookInfo"
   ```

   Javobdagi `url` to'g'ri, `last_error_message` esa bo'sh bo'lishi kerak.
5. **Polling'ga qaytish.** Bitta token bir vaqtda faqat bitta rejimda ishlaydi: webhook o'rnatilgan token bilan polling `409 Conflict` bilan yiqiladi.
   - API webhook'ni o'zi o'chirmaydi, chunki aks holda prod tokeni bilan yoqilgan lokal polling prod webhook'ini o'chirib yuborardi.
   - Kerak bo'lsa, qo'lda o'chiring:

     ```bash
     curl "https://api.telegram.org/bot<TOKEN>/deleteWebhook"
     ```

   - Lokal ish uchun alohida test botlar ochgan ma'qul.

## Production sozlamalari

- **HTTPS.** Hamma narsa https orqali ishlaydi. `COOKIE_SECURE=true` (default) bo'lsa, cookie'lar faqat https'da yuradi.
- **`ADMIN_PANEL_URL`:** admin panelning to'liq manzili, masalan `https://admin.example.com`.
- **SMS:** `SMS_DRIVER=eskiz` va `ESKIZ_EMAIL`, `ESKIZ_PASSWORD`, `ESKIZ_FROM`. SMS matni `Hisob24 kirish kodi: 123456`, bu shablon Eskiz akkauntida tasdiqlangan bo'lishi kerak.
- **Secret'lar** (`OTP_HMAC_SECRET`, `JWT_SECRET`, `TELEGRAM_WEBHOOK_SECRET`): `openssl rand -hex 32`.
- **Migratsiya:** `make migrate` yoki `goose -dir backend/migrations postgres "$DATABASE_URL" up`.
- **Build va ishga tushirish:**

  ```bash
  # API: sozlamalarni env'dan o'qiydi
  (cd backend && go build -o bin/api ./cmd/api)
  backend/bin/api

  # Frontend: API_URL build paytida rewrite'ga yoziladi
  pnpm install --frozen-lockfile
  API_URL=http://127.0.0.1:8080 pnpm --filter @hisob24/admin build
  API_URL=http://127.0.0.1:8080 pnpm --filter @hisob24/web build
  ADMIN_BOT_USERNAME=hisob24_admin_bot pnpm --filter @hisob24/admin start   # :3001
  pnpm --filter @hisob24/web start                                          # :3000
  ```

## Production: hisob24.uz (Docker Compose)

Server `prod` (144.91.116.251) boshqa loyihalar bilan umumiy. Stack `/var/www/hisob24-v2` da ishlaydi: [`docker-compose.prod.yml`](docker-compose.prod.yml) ichida PostgreSQL 16, API, admin va web bor. Portlar faqat `127.0.0.1` da ochiq, TLS'ni host'dagi nginx va certbot beradi.

| Domen | Servis | Port |
|---|---|---|
| `app.hisob24.uz` | web (user app) | `127.0.0.1:8092` |
| `admin.hisob24.uz` | admin panel | `127.0.0.1:8091` |
| `api.hisob24.uz` | API: faqat `/webhooks/` va `/healthz`, qolgani 404 | `127.0.0.1:8090` |

**Yangilash (lokal'dan, commit qilingan kod):**

```bash
deploy/ship.sh          # git archive HEAD → serverga, .env saqlanadi, keyin deploy/deploy.sh
```

[`deploy/deploy.sh`](deploy/deploy.sh) ketma-ketligi:
1. Image'larni build qiladi.
2. Postgres'ni ko'taradi.
3. Migratsiyalarni qo'llaydi (`goose`).
4. API, admin va web'ni `--wait` bilan qayta ishga tushiradi.

Oldingi kod daraxti `/var/www/hisob24-v2.prev` da qoladi.

**Serverda:**

```bash
cd /var/www/hisob24-v2
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs -f api    # SMS va webhook xatolari ham shu yerda
```

- `.env` faqat serverda turadi (`chmod 600`). Kalitlar [`.env.example`](.env.example) dagidek, qo'shimcha `POSTGRES_PASSWORD` bor. `DATABASE_URL` compose faylining o'zida quriladi.
- Postgres `timezone=Asia/Tashkent` bilan ishlaydi, shuning uchun obuna muddati (`CURRENT_DATE`) Toshkent vaqti bilan hisoblanadi.
- nginx sozlamasi: [`deploy/nginx-switch.py`](deploy/nginx-switch.py). U uchala saytni yuqoridagi portlarga ulaydi, certbot qatorlariga tegmaydi.
- **Backup.** Har kecha 02:30 da (server vaqti) [`deploy/backup.sh`](deploy/backup.sh) ishlaydi: `pg_dump` → `/var/backups/hisob24-v2/hisob24-<sana>.sql.gz`, 14 kun saqlanadi.
  - cron: [`deploy/hisob24-v2-backup.cron`](deploy/hisob24-v2-backup.cron) → `/etc/cron.d/`;
  - log: `journalctl -t hisob24-backup`;
  - tiklash: `gunzip -c <fayl> | docker compose -f docker-compose.prod.yml exec -T postgres psql -U hisob24 -d hisob24`.

## Loyiha tuzilmasi

```
backend/
  cmd/api/           HTTP API + ikkala bot (bitta jarayon)
  cmd/otp/           make otp: lokal admin kodi
  internal/          config, httpx, auth, admin, app, company, billing, user, sms, bot/{adminbot,userbot}
  internal/db/       queries/*.sql (sqlc) va gen/ (generatsiya)
  migrations/        goose
  openapi.yaml       API kontrakti
apps/admin/          admin panel (Next.js, shadcn), Telegram Mini App
apps/web/            user app (Next.js, shadcn)
packages/api-client/ openapi.yaml'dan generatsiya qilingan TS client
scripts/ensure-db.sh make db
start.sh             make dev
```

## Ma'lum cheklovlar

- User app uchun alohida URL env'i yo'q (spec ro'yxatida yo'q). Shuning uchun `Sec-Fetch-Site` yubormaydigan juda eski brauzerlar `/app` dagi o'zgartiruvchi so'rovlarda 403 oladi. Zamonaviy brauzerlarga bu ta'sir qilmaydi.
- Refresh token har refresh'da almashadi. Ikki tab bir vaqtda refresh qilsa, ulardan biri `/login` ga tushadi.
- Telegram Web'dagi Mini App sessiyasi `Partitioned` (CHIPS) cookie'ni qo'llaydigan brauzer talab qiladi. Aks holda panel cookie saqlanmaganini aytadi.
- `API_URL` frontend build'iga muhrlanadi.
