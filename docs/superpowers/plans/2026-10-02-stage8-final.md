# 8-bosqich: Yakuniy tekshiruv va README — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Spec'ning 10-bo'limi, 8-bandi: "Barcha testlar va linterlar. README: loyihani local'da ishga tushirish, botlarni BotFather'da sozlash (menu button, Mini App URL) va productionda webhook o'rnatish."

**Architecture:** Yangi funksiya yo'q. Ish uch qismdan iborat:
1. Spec'ni band-bandi bilan kod va testlarga solishtirish (har band uchun dalil).
2. Production build'ni tekshirish.
3. README yozish. README'dagi har bir buyruq va fakt ishlatib ko'rilgan bo'lishi kerak.

Tekshiruv bug topsa, uni TDD bilan tuzataman (RED → GREEN). Spec savoli chiqsa, foydalanuvchidan so'rayman.

**Tech Stack:** Mavjud stack: Go 1.27, Next 16.3, Playwright, Postgres 17 (brew).

---

## Fayl tuzilmasi

| Fayl | Mas'uliyat |
|---|---|
| `README.md` (yangi) | Lokal ishga tushirish, env, testlar, BotFather, production webhook, cheklovlar |
| `CLAUDE.md` | "Manbalar" ga `README.md` |
| `docs/superpowers/specs/2026-10-02-hisob24-design.md` | "8-bosqich qarorlari" (agar qaror bo'lsa) |
| scratchpad: `audit.md`, smoke skriptlari | Tekshiruv dalillari (repo'ga kirmaydi) |

---

### Task 1: Spec auditi (dalil bilan)

Har band uchun dalil: test nomi yoki `fayl:qator`. Natija `scratchpad/audit.md` ga yoziladi.

- [ ] **4. Sxema:** migratsiya spec bilan bir xil (stage 2 migratsiya testi), admin 461603558 seed.
- [ ] **5.1 Admin OTP (8 band):**
  - `/login`, ruxsatsizga "Sizda ruxsat yo'q";
  - eski va muddati o'tgan kodlarni tozalash;
  - `crypto/rand` 6 xona;
  - HMAC saqlash, 60 soniya, 5 urinish (unique);
  - `Kod: <code>` (`<code>` format);
  - InputOTP 6-raqamda avtomatik yuboradi;
  - `used_at` va 12 soatlik sessiya, cookie `httpOnly/Secure/Lax`;
  - IP limiti 5/daqiqa → 429.
- [ ] **5.2 Mini App:**
  - `setChatMenuButton` → `ADMIN_PANEL_URL`;
  - `initData` HMAC va 24 soat, `source='miniapp'`;
  - rewrites;
  - mobile-first: Sheet, kartochkalar, `themeParams`.
- [ ] **5.3:** company + owner bitta tx'da, `ON CONFLICT DO NOTHING`, `/users` endpoint.
- [ ] **5.4:** `FOR UPDATE`, `GREATEST(end_date, CURRENT_DATE) + days`, `prev/new_end_date`, tarix.
- [ ] **5.5 SMS login:**
  - normalizatsiya;
  - yo'q raqamga 200 va SMS yo'q;
  - 60 soniya/429;
  - 6 xona, 2 daqiqa, **HMAC** (SHA emas — tekshirish);
  - 5 xato → o'chirish;
  - JWT claim'lari (`sub`, `company_id`, `role`, `aud=app`), 15 daqiqa;
  - refresh 30 kun, httpOnly cookie, hash;
  - bitta company avtomatik;
  - switch, rotation, logout;
  - 402 `subscription_expired`.
- [ ] **5.6 User bot:**
  - `/start` + `request_contact`;
  - `contact.user_id == from.id` (xabar "Iltimos, o'z raqamingizni yuboring");
  - normalizatsiya va `chat_id` bo'yicha upsert;
  - "✅ Akkauntingiz ulandi" / "Raqamingiz saqlandi";
  - klaviatura olib tashlanadi.
- [ ] **5.7:** adminlar ro'yxati, qo'shish, `is_active=false` va sessiyalarni o'chirish, o'zini o'chira olmaydi, oxirgi faol admin qoladi.
- [ ] **6. API ro'yxati:**
  - `openapi.yaml` dagi har bir yo'l router'da bor (va aksincha);
  - xato formati `{error, message}`;
  - `BOT_MODE` va webhook secret header.
- [ ] **7. Frontend:** admin sahifalari va web sahifalari (stage 5 va 7 testlari).
- [ ] **8. Umumiy qoidalar:**
  - hash'lar;
  - kodda secret yo'q (`git grep` bilan token/kalit naqshlari);
  - token'lar almashmaydi;
  - `db/gen` va TS client faqat generatsiya (`make sqlc` va `make api-client` dan keyin `git diff` bo'sh);
  - linterlar.
- [ ] **9. Env:** koddagi har bir `getenv`/`process.env` kaliti `.env.example` da bor (test-ichki `NEXT_DIST_DIR` va `CI` bundan mustasno).
- [ ] Bo'shliq topilsa: bug bo'lsa TDD bilan tuzatiladi, spec savoli bo'lsa foydalanuvchidan so'raladi.

### Task 2: Production build

- [ ] `cd backend && go build -o "$SCRATCH/bin/" ./cmd/api ./cmd/otp` → exit 0.
- [ ] `pnpm --filter @hisob24/admin build` va `pnpm --filter @hisob24/web build` → exit 0. Ogohlantirishlar ko'rib chiqiladi.
- [ ] **`API_URL` build paytida o'qiladimi yoki runtime'da** (README uchun). Tajriba:
  - ikkita mini server: `:18081` "A" deb, `:18082` "B" deb javob beradi (python `http.server`, `healthz` fayli);
  - `API_URL=http://127.0.0.1:18081` bilan build;
  - `API_URL=http://127.0.0.1:18082 next start -p 3200`;
  - `curl :3200/api/healthz` → `A` bo'lsa build paytida, `B` bo'lsa runtime'da o'qiladi.
- [ ] Build artefaktlari tozalanadi (`.next` dev uchun qayta tiklanadi).

### Task 3: README.md

O'zbekcha (lotin). Bo'limlar:

1. **Hisob24 nima:** 4 qism (admin panel, user app, admin bot, user bot) va arxitektura qatori: brauzer/WebView → Next `/api/*` → Go API (bitta jarayonda HTTP + ikkala bot) → Postgres.
2. **Talablar:** macOS + Homebrew `postgresql@17` (yoki Docker Compose), Go 1.27, Node 24, pnpm 10, ixtiyoriy `air`.
3. **Lokal ishga tushirish:**
   - `make dev` (= `start.sh`): `.env` yo'q bo'lsa `.env.example` dan yaratadi va `OTP_HMAC_SECRET`/`JWT_SECRET` ni `openssl rand -hex 32` bilan to'ldiradi;
   - keyin portlarni bo'shatadi, Postgres'ni tekshiradi, `make db`, `make tools`, `make migrate`, `pnpm install`;
   - URL'lar: API `:8080/healthz`, admin `:3001`, web `:3000`.
4. **Botsiz kirish (lokal):**
   - admin: `make otp [ID=…]` → kod `/login` sahifasiga (`SMS_DRIVER=log`); birinchi admin 461603558 migratsiyada;
   - user: admin panelda company yarating (egasining telefoni), web'da shu raqam bilan kiring; SMS kodi `[api]` log'ida (`sms (SMS_DRIVER=log, not sent)` qatori).
5. **Docker Compose varianti:** `docker compose up -d postgres` (brew Postgres to'xtatilgan bo'lsin, port 5432); bu mashinada sinalmagan deb yoziladi.
6. **Buyruqlar jadvali:** `dev`, `test`, `e2e` (+ `playwright install chromium`), `lint`, `migrate`/`migrate-down`/`migrate-status`/`migrate-create name=…`, `sqlc`, `api-client`, `db`, `tools`, `otp`.
7. **Env jadvali:** `.env.example` dagi har bir kalit: majburiy/ixtiyoriy, default, ma'nosi; `COOKIE_SECURE`, `API_URL` (Task 2 natijasiga ko'ra build yoki runtime), `ADMIN_BOT_USERNAME` (runtime).
8. **BotFather:**
   - ikkita bot (`/newbot`) → `ADMIN_BOT_TOKEN`, `USER_BOT_TOKEN`, `ADMIN_BOT_USERNAME`;
   - **menu button:** API ishga tushganda `setChatMenuButton` bilan avtomatik o'rnatadi ("Admin panel" → `ADMIN_PANEL_URL`, faqat https). Qo'lda: `/mybots` → bot → Bot Settings → Menu Button;
   - **Mini App URL:** Bot Settings → Configure Mini App → Enable → `ADMIN_PANEL_URL`;
   - buyruqlar: admin bot `/login`, `/start`; user bot `/start` (`/setcommands`);
   - lokal Mini App sinovi uchun https tunnel kerak.
9. **Production'da webhook:**
   - `BOT_MODE=webhook`, `PUBLIC_API_URL` (https, Telegram yetadigan port: 443/80/88/8443), `TELEGRAM_WEBHOOK_SECRET` (1–256 belgi, `A-Z a-z 0-9 _ -`);
   - API ishga tushganda ikkala bot uchun `setWebhook`: `${PUBLIC_API_URL}/webhooks/admin-bot`, `/webhooks/user-bot`, `secret_token` bilan; header noto'g'ri bo'lsa 401;
   - reverse proxy `/webhooks/*` ni API'ga o'tkazishi kerak;
   - tekshirish: `getWebhookInfo`;
   - polling'ga qaytish `deleteWebhook` ni talab qiladi (kod buni avtomatik qilmaydi: dev prod tokeni bilan polling'ni yoqsa, prod webhook o'chib ketmasin);
   - bitta token bir vaqtda bitta rejimda ishlaydi.
10. **Production sozlamalari (qisqa):** `COOKIE_SECURE=true`, `ADMIN_PANEL_URL` (CSRF'da ishonchli origin), `SMS_DRIVER=eskiz` + `ESKIZ_*` (shablon tasdiqlangan bo'lsin), secret generatsiyasi, migratsiya, build/start buyruqlari.
11. **Loyiha tuzilmasi va hujjatlar:** `docs/SPEC.md`, dizayn hujjati, `CLAUDE.md`.
12. **Ma'lum cheklovlar:**
    - `Sec-Fetch-Site` siz eski brauzerlar `/app` POST'da 403;
    - ikki tab bir vaqtda refresh qilsa;
    - Telegram Web'da Mini App cookie CHIPS talab qiladi.

### Task 4: README bo'yicha toza clone'dan ishga tushirish

- [ ] `git clone` (lokal repo) → scratchpad'da `make dev` fonda:
  - `.env` avtomatik yaratilishi;
  - `make tools` (toza `backend/bin`);
  - migratsiya;
  - `pnpm install`.
- [ ] Clone'dagi stack'da `curl` bilan tekshiriladi: `:8080/healthz` 200, `:3001/login` 200, `:3000/login` 200; `make otp` kod beradi.
- [ ] To'xtatish (SIGTERM), portlar bo'sh, clone o'chiriladi.

### Task 5: Haqiqiy stack smoke (asosiy repo, `make dev`)

- [ ] Admin: `real-smoke.cjs` (OTP login → company → user → billing → admin), 375px.
- [ ] Web: `real-smoke-web.cjs` (11 qadam), 375px.
- [ ] Konsolda kutilmagan xato yo'q; stack to'xtatiladi.

### Task 6: Yakun

- [ ] `CLAUDE.md` "Manbalar" ga `README.md`; dizayn hujjatiga "8-bosqich qarorlari" (agar bo'lsa).
- [ ] `make lint`, `make test`, `make e2e`, `go test -count=1 ./...`.
- [ ] Commit (`docs: README …`), `git push origin main`.
- [ ] Hisobot:
  - audit natijasi (bo'shliqlar va tuzatishlar RED → GREEN bilan);
  - build;
  - README;
  - nima sinalmadi (Docker Compose, real Telegram/Eskiz, webhook — tashqi resurs talab qiladi).
