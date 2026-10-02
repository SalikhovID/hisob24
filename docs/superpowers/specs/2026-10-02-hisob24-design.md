# Hisob24: dizayn va 1-bosqich rejasi

## Kontekst

Noldan multi-tenant SaaS quriladi: Go API, ikkita Telegram bot, ikkita Next.js ilova (admin panel + user app). Asosiy manba: foydalanuvchi bergan spec (`docs/SPEC.md` ga so'zma-so'z saqlanadi). Foydalanuvchining qo'shimcha talablari:
- `git@github.com:SalikhovID/hisob24.git` repoga push qilinadi. Faqat `main` branch ishlatiladi, alohida branch va PR ochilmaydi. Bu qoida `CLAUDE.md` ga ham yoziladi.
- Admin login/auth uchun `../enwin/enwin-admin` va `../mystore/admin` namuna sifatida olinadi.
- Lokal ishga tushirish uchun `start.sh` yoziladi (`../mystore/start.sh` va `../enwin/start.sh` namunasida).
- superpowers brainstorming ishlatiladi. Bu reja shu jarayonning natijasi.

Hozirgi holat:
- `/Users/salikhov_id/www/hisob24` mavjud emas. GitHub repo bor, lekin bo'sh.
- Docker yo'q: Docker Desktop o'chirilgan, symlinklar osilib qolgan. Homebrew `postgresql@17` `:5432` da ishlayapti.
- Lokal serverdagi `app` DB boshqa loyihaga tegishli. `hisob24db` va `hisob24_test` esa eski loyihaniki. Bu DB'larga tegilmaydi.
- Mavjud toollar: Go 1.26.1 (`GOTOOLCHAIN=auto`), Node 24.4, pnpm 10.24, sqlc 1.30, air. golangci-lint 2.11.4 go1.26 bilan qurilgan. `goose` CLI yo'q.
- Eng so'nggi versiyalar: Go 1.27.1, Next 16.3.8, goose v3.28.0, go-telegram/bot v1.27.0.

## Kelishilgan qarorlar

1. **Postgres:** lokal brew Postgres 17 ishlatiladi.
   - `start.sh` `hisob24` rolini (paroli `hisob24`, `CREATEDB` huquqi bilan) va `hisob24` DB'ni yaratadi.
   - Integration testlar `TEST_DATABASE_URL` orqali shu serverda vaqtinchalik `hisob24_it_*` DB'lar ochadi va ish tugagach o'chiradi.
   - `docker-compose.yml` (postgres:16) repoda qoladi, lekin ixtiyoriy.
2. **Namunadan olinadigan qo'shimchalar** (to'rttasi ham tanlangan):
   - `make otp`: lokal muhitda botsiz login uchun CLI. U HTTP endpoint emas.
   - Ruxsati yo'q foydalanuvchiga Telegram ID'si ko'rsatiladi.
   - Admin bot `/start` va boshqa xabarlarga javob beradi.
   - Mini App ichida logout tugmasi ko'rsatilmaydi.

## Spec'dan chetlanishlar (tasdiqlash uchun)

| # | Spec | Reja | Sabab |
|---|---|---|---|
| 1 | PG16, docker-compose, testcontainers-go | brew PG17, `TEST_DATABASE_URL` + vaqtinchalik DB | Docker yo'q (1-qaror) |
| 2 | `DATABASE_URL=postgres://app:app@…/app` | `postgres://hisob24:hisob24@localhost:5432/hisob24?sslmode=disable` | `app` DB boshqa loyihaniki |
| 3 | `apps/admin/middleware.ts` | `apps/admin/proxy.ts` | Next 16 `middleware` nomini `proxy` ga o'zgartirgan (enwin/mystore ham shunday) |
| 4 | env ro'yxati | qo'shiladi: `TEST_DATABASE_URL`, `API_URL` (Next rewrite manzili), `COOKIE_SECURE` (default `true`; `start.sh` http://localhost uchun `false` qiladi), `ADMIN_BOT_USERNAME` (login sahifadagi bot havolasi, server component'da runtime'da o'qiladi) | Sozlamalar, yangi funksiya emas |
| 5 | — | 2-qarordagi 4 ta qo'shimcha | Foydalanuvchi tanladi |
| 6 | — | Bot token bo'sh bo'lsa, bot ishga tushmaydi va log'ga ogohlantirish yoziladi. API ishlashda davom etadi | Namunadagi kabi; tokensiz dev |
| 7 | — | Cookie'lar `Path=/` bilan qo'yiladi | Brauzer `/api/...` ni ko'radi, Go esa `/...` ni |

## Arxitektura

Spec'dagi struktura saqlanadi. Qo'shimchalar `+` bilan belgilangan:

```
hisob24/
├── backend/
│   ├── cmd/api/main.go           # HTTP + ikkala bot, graceful shutdown
│   ├── cmd/otp/main.go         + # make otp (3-bosqich)
│   ├── internal/{config,db/queries,db/gen,httpx,auth,admin,company,billing,user,sms,bot/{adminbot,userbot}}
│   ├── internal/testutil/pgtest + # TEST_DATABASE_URL → template DB → har test uchun klon
│   ├── migrations/ (+embed.go)   # goose SQL; testlar va CLI embed FS'dan o'qiydi
│   ├── bin/                    + # make tools: goose, golangci-lint, sqlc (versiyalar pin qilingan, gitignore)
│   ├── .air.toml, .golangci.yml, sqlc.yaml, openapi.yaml
├── apps/admin (:3001), apps/web (:3000)   # Next 16, rewrites: /api/:path* → ${API_URL}/:path*
├── packages/api-client           # openapi-typescript + openapi-fetch, baseUrl "/api"
├── scripts/ensure-db.sh        + # DATABASE_URL'dan rol va DB'ni idempotent yaratadi
├── docker-compose.yml, Makefile, start.sh, .env.example, pnpm-workspace.yaml
├── docs/SPEC.md, docs/superpowers/specs/2026-10-02-hisob24-design.md, CLAUDE.md
```

- **So'rov oqimi:** brauzer yoki Telegram WebView → Next (bitta origin) `/api/*` → Go `:8080`. Kod bo'yicha: handler → service → sqlc.
- **Admin auth:** OTP yoki Mini App orqali kirilganda `admin_sessions` jadvaliga yozuv ochiladi. Cookie `admin_session` sessiyaning UUID'ini saqlaydi, muddati 12 soat (httpOnly, Secure, Lax). Middleware har so'rovda sessiyani va `is_active` ni tekshiradi.
- **User auth:**
  - Access JWT: HS256, `aud=app`, 15 daqiqa.
  - Refresh token: tasodifiy 32 bayt, bazada SHA-256 hash ko'rinishida saqlanadi, rotation qilinadi, 30 kunlik `refresh_token` cookie'da yuradi.
  - Admin va user token'lari bir-birining o'rnida ishlamaydi.
- **Botlar:** `go-telegram/bot` ishlatiladi.
  - Handler'lar `Sender` interfeysi orqali yozadi, testlarda fake client qo'yiladi.
  - Rejimlar: `polling` yoki `webhook`. Webhook rejimida `X-Telegram-Bot-Api-Secret-Token` tekshiriladi va `${PUBLIC_API_URL}/webhooks/...` ga `setWebhook` qilinadi.
- **Rate limit:** IP bo'yicha in-memory, daqiqasiga 5 ta.
  - IP sifatida `X-Forwarded-For` dagi eng o'ngdagi ishonchsiz manzil olinadi. Loopback va private tarmoqlar ishonchli proksi hisoblanadi, chunki so'rov Next proksi orqali keladi.

## Namunalardan nima olinadi va nima olinmaydi

**Olinadi:**
- `enwin-admin/app/login/page.tsx`:
  - InputOTP 6-raqamda avtomatik yuboradi, xato bo'lsa katakchalar tozalanadi.
  - TWA uchun SDK 1 soniyagacha kutiladi (10×100ms).
  - Holatlar: `checking`, `not_admin` ("Yopish" tugmasi bilan), `error`.
  - Login sahifasida bot havolasi.
- `components/ui/input-otp.tsx` (shadcn), `types/telegram.d.ts`, `topbar.tsx` (`isTWA` aniqlanganda logout yashiriladi), `layout.tsx` (`telegram-web-app.js` `beforeInteractive` bilan yuklanadi).
- `bot.ts`: `/start`, `/login` va catch-all handler'lar. Telegram'ga yuborish yiqilsa, yaratilgan kod o'chiriladi.
- `enwin-backend/pkg/telegram/webapp.go`: `ValidateInitData` (`now` inject qilinadi, `hmac.Equal` ishlatiladi) va `SignInitData` test helper'i. Maksimal muddat spec bo'yicha **24 soat** bo'ladi.
- `enwin-backend/internal/service/partner/auth_service.go`: `crypto/rand` bilan 6 xonali kod va unique to'qnashuvda 5 marta qayta urinish.
- `mystore/admin/app/api/auth/dev-otp`: g'oyasi olinadi, `make otp` CLI ko'rinishida.
- `enwin-partner/next.config.ts`: Mini App web.telegram.org ichida iframe'da ochilishi mumkin, shuning uchun `X-Frame-Options: DENY` qo'yilmaydi.
- `mystore/start.sh` va `enwin/start.sh`: portlarni bo'shatish, Postgres pre-flight, rangli prefiksli loglar, Ctrl+C bilan cleanup.

**Olinmaydi** (spec boshqacha talab qiladi):
- Next API route'lardagi auth, in-memory OTP store, jose JWT cookie.
- Sliding session (spec 12 soatlik qat'iy sessiyani talab qiladi).
- 300 soniyalik `auth_date` (spec 24 soat deydi).
- 3 tilli `next-intl` (spec faqat o'zbekcha lotin).
- "Minimal shadcn" yondashuvi (spec to'liq shadcn, TanStack Query va rhf+zod talab qiladi).

## Ish tartibi (har bosqich uchun)

- Bosqich tasdiqlangach, `superpowers:writing-plans` yordamida shu bosqichning batafsil rejasi yoziladi va bajariladi.
- 2-bosqichdan boshlab har bir xatti-harakat uchun TDD sikli bajariladi:
  1. RED: test yoziladi va yiqilish chiqishi saqlanadi. Kerak bo'lsa stub qo'yiladi.
  2. GREEN: test o'tadi va barcha eski testlar ham o'tishi tekshiriladi.
  3. REFACTOR.
- Har GREEN'dan keyin commit qilinadi: Conventional Commits, inglizcha, oxirida attribution trailer bilan.
- Bosqich oxirida: `make lint`, `make test` va bosqichning o'z tekshiruvi bajariladi. Keyin `git push origin main` qilinadi va hisobot beriladi (har funksiya uchun RED→GREEN). So'ng tasdiq kutiladi.
- 1-bosqichda ham Go kodi (`config`, `httpx`, `/healthz`) TDD bilan yoziladi. Testsiz faqat konfiguratsiya fayllari, Makefile, `start.sh` va scaffold yoziladi.

## 1-bosqich: Skelet

**0. Repo va hujjatlar**
- `mkdir ~/www/hisob24`, `git init -b main`, `git remote add origin git@github.com:SalikhovID/hisob24.git`.
- `docs/SPEC.md`: spec so'zma-so'z saqlanadi.
- `docs/superpowers/specs/2026-10-02-hisob24-design.md`: shu reja (qarorlar va chetlanishlar).
- `CLAUDE.md` (qisqa) quyidagi tartibda bo'ladi:
  1. **TDD (MAJBURIY)**: spec'ning 8-bo'limidan so'zma-so'z olinadi.
  2. **Git**: faqat `main`, branch/worktree/PR yo'q, `git push origin main`, push bosqich oxirida.
  3. **Stack**.
  4. **Buyruqlar**: `make dev` (= `./start.sh`), `make test`, `make migrate`, `make sqlc`, `make lint`, `make db`, `make tools`, `make otp`, `make api-client`.
  5. **Lokal muhit**: brew PG17, `hisob24` DB, portlar 8080/3001/3000, `COOKIE_SECURE=false`.
  6. **Qoidalar**: spec'ning "Umumiy qoidalar" bo'limi.
  7. Manbalar: `docs/SPEC.md` va dizayn hujjati.
- Commit.

**1. Root fayllar**
- `package.json`: `packageManager: pnpm@10.24.0`, `lint`/`typecheck`/`test` skriptlari `pnpm -r` orqali.
- `pnpm-workspace.yaml` (`apps/*`, `packages/*`), `.gitignore`, `.editorconfig`, `.nvmrc` (24).

**2. Backend**
- `go mod init github.com/SalikhovID/hisob24/backend` (`go 1.27.1`). Bog'liqliklar: chi, pgx/v5, slog.
- `make tools`: goose v3.28.0, sqlc v1.30.0 va go1.27 bilan qurilgan golangci-lint v2 `backend/bin/` ga o'rnatiladi. Global toollarga tegilmaydi.
- TDD sikllari:
  - `config.Load(getenv)`: required va default qiymatlar, `BOT_MODE` va `SMS_DRIVER` validatsiyasi (table-driven).
  - `httpx.JSON` / `httpx.Error`: `{"error","message"}` formati.
  - `GET /healthz` → 200 `{"status":"ok"}` (httptest).
- `cmd/api/main.go`: config → pgxpool → router → `http.Server` + `signal.NotifyContext` bilan graceful shutdown.
- `.air.toml`, `.golangci.yml` (v2).
- `openapi.yaml`: hozircha faqat `/healthz`.

**3. Frontend**
- `apps/admin` va `apps/web`: `create-next-app` (TS, Tailwind v4, App Router, ESLint), keyin `shadcn init`.
- Package nomlari: `@hisob24/admin` va `@hisob24/web`. Dev portlari mos ravishda `-p 3001` va `-p 3000`.
- `next.config.ts` ichida `/api/:path*` uchun rewrite.
- Vitest + RTL + jsdom sozlanadi. TDD: placeholder sahifa uchun smoke test (RED→GREEN).
- `typecheck` skripti.

**4. `packages/api-client`**
- `generate` skripti `openapi-typescript ../../backend/openapi.yaml` ni ishga tushiradi.
- `createApiClient(baseUrl="/api")` (openapi-fetch) TDD bilan yoziladi: fetch stub bilan `/api/healthz` chaqirilishi tekshiriladi.

**5. Infra fayllar**
- `.env.example`: spec ro'yxati + 4-chetlanishdagi env'lar, `DATABASE_URL` 2-chetlanishdagidek. `TEST_DATABASE_URL=postgres://hisob24:hisob24@localhost:5432/postgres?sslmode=disable`: `hisob24` roli `CREATEDB` huquqi bilan shu ulanishdan `hisob24_it_*` DB'larni yaratadi va o'chiradi. Boshqa nomdagi DB'larga tegilmaydi.
- `docker-compose.yml`: postgres:16, `hisob24/hisob24/hisob24`.
- `Makefile`: `-include .env` + `export`. Target'lar: `dev`, `db`, `tools`, `migrate`, `migrate-down`, `migrate-status`, `migrate-create`, `sqlc`, `test`, `test-go`, `test-web`, `lint`, `api-client`, `otp`. `test-go` va `migrate` `db` ga bog'liq, shuning uchun `make test` start.sh'siz ham ishlaydi. `TEST_DATABASE_URL` berilmagan bo'lsa, pgtest `t.Fatal` bilan yo'l-yo'riq chiqaradi (`t.Skip` ishlatilmaydi).
- `start.sh` tartibi:
  1. `PATH` ga brew pg17, GOPATH/bin va backend/bin qo'shiladi.
  2. `.env` bo'lmasa `.env.example` dan nusxa olinadi va `OTP_HMAC_SECRET` / `JWT_SECRET` `openssl rand -hex 32` bilan to'ldiriladi.
  3. `.env` source qilinadi va `COOKIE_SECURE=false` o'rnatiladi.
  4. 8080, 3000, 3001 portlari bo'shatiladi.
  5. `pg_isready` tekshiriladi. Postgres ishlamasa `brew services start postgresql@17` qilinib 30 soniyagacha kutiladi.
  6. `make db`, `make tools` (bin yo'q bo'lsa) va `make migrate` bajariladi. Migratsiya bo'lmasa, ogohlantirish chiqadi va ish davom etadi.
  7. `pnpm install` bajariladi.
  8. Servislar ishga tushadi: `[api]` (air, bo'lmasa `go run ./cmd/api`), `[admin]` va `[web]`, har biri rangli prefiks bilan.
  9. URL'lar chiqariladi. Trap cleanup portlarni tozalaydi va `kill 0` qiladi.

## 2–8-bosqichlar: yo'l xaritasi

Har biri tasdiqdan keyin batafsil rejalashtiriladi.

**2. Baza**
- `00001_init.sql` aynan spec sxemasi bilan, goose Up/Down va embed bilan.
- `pgtest` helper: template DB nomi migratsiya hash'iga bog'lanadi, advisory lock ishlatiladi, har test template'dan klon oladi.
- Migratsiya testi: admin 461603558 mavjudligi tekshiriladi.
- `sqlc.yaml` (pgx/v5) va barcha so'rovlar.
- `user.NormalizePhone` table-driven testlar bilan.

**3. Admin auth**
- `auth/initdata` (Telegram hujjatidagi algoritm va namuna bilan test, 24 soat).
- `admin_otp`: HMAC, 60 soniya, 5 urinish, eski kodlarni tozalash, atomik `UPDATE … RETURNING` bilan iste'mol qilish.
- `admin_session` (12 soat), admin middleware, rate limit (429).
- `/admin/auth/{otp,telegram,logout}` va `/admin/me` uchun integration testlar.
- adminbot: `/login`, `/start`, catch-all, ruxsatsizga ID. Testlarda fake sender ishlatiladi.
- Ishga tushganda `setChatMenuButton`, webhook secret tekshiruvi, `cmd/otp`.

**4. Admin API**
- company servisi (bitta tx), qo'shimcha user qo'shish.
- billing: `FOR UPDATE` va `GREATEST(end_date, CURRENT_DATE)+days`. Muddati o'tgan va o'tmagan holatlar uchun alohida testlar.
- Ro'yxat (search/status/page), detail, PATCH.
- Adminlar: o'zini o'chira olmaydi, oxirgi faol admin qoladi, sessiyalari o'chiriladi.
- `openapi.yaml` to'ldiriladi va client qayta generatsiya qilinadi.

**5. Admin panel**
- Login va `TelegramAutoLogin`, `proxy.ts`.
- Layout: mobile'da Sheet, theme, `themeParams`.
- Sahifalar: `/companies`, `/companies/new`, `/companies/[id]`, `/admins`.
- Testlar: Vitest/RTL, Playwright + MSW, 375px kenglikda.

**6. User auth va bot**
- `sms.Sender`: Log va Eskiz (Eskiz httptest fake bilan).
- sms_otp: yo'q raqamga ham 200, 60 soniyada 1 ta → 429, 2 daqiqa, 5 xato urinish.
- JWT va refresh rotation, switch-company, logout.
- User middleware: muddati o'tgan yoki faol bo'lmagan company → 402. `/app/me`.
- userbot: `request_contact`, `user_id` tekshiruvi, upsert, javob variantlari, klaviaturani olib tashlash.

**7. User app**
- Login 2 qadamda: `+998` niqob, InputOTP, qayta yuborish va 60 soniyalik taymer.
- `/select-company`, `/expired`, dashboard.
- Access token xotirada, 401 bo'lsa refresh qilib so'rov qayta yuboriladi.
- Vitest va Playwright.

**8. Yakuniy tekshiruv**
- Barcha testlar va linterlar.
- README: lokal ishga tushirish, BotFather (menu button, Mini App URL), prod'da webhook.

## Tekshiruv (1-bosqich)

- `cd backend && go vet ./... && bin/golangci-lint run && go test ./...` toza o'tadi. config, httpx va healthz testlari yashil.
- `pnpm lint && pnpm typecheck && pnpm test` toza o'tadi.
- `make dev` (`./start.sh`) fonda ishga tushiriladi:
  - `pg_isready` OK, `hisob24` DB mavjud.
  - `curl :8080/healthz` → 200 `{"status":"ok"}`.
  - `curl :3001/api/healthz` (rewrite orqali) → 200.
  - `curl :3000` → 200.
  - Keyin Ctrl+C yoki kill qilinadi va portlar bo'shaganini tekshiriladi.
- `git push origin main`, so'ng hisobot va tasdiq kutiladi.

## 2-bosqich qarorlari (2026-10-02)

Foydalanuvchi qarorlari:
1. Spec'dagi barcha oqimlar uchun 37 ta sqlc so'rovi 2-bosqichda yoziladi, har biriga real Postgres'da alohida integration test (`backend/internal/db/*_test.go`).
2. `POST /admin/admins` mavjud telegram_id bilan kelsa:
   - faol bo'lmagan admin qayta faollashtiriladi va `full_name` yangilanadi;
   - faol admin bo'lsa → 409 `admin_exists` (`CreateOrReactivateAdmin` qator qaytarmaydi).
3. `GET /admin/companies?status=`:
   - `active` = `end_date >= CURRENT_DATE AND is_active`;
   - `expired` = `end_date < CURRENT_DATE OR NOT is_active` (user middleware'dagi 402 bilan bir xil).
4. `POST /admin/companies/{id}/users` da user allaqachon a'zo bo'lsa, rol yangilanadi (`UpsertCompanyUser`).

Texnik eslatmalar:
- `CURRENT_DATE` DB sessiyasining TimeZone sozlamasiga bog'liq.
  - Lokal brew Postgres'da `Asia/Tashkent`.
  - Prod'da ham Asia/Tashkent bo'lishi kerak, aks holda muddat UTC yarim tunida tugaydi. 8-bosqich README'ga yoziladi.
- `pgtest` test DB'larini `DROP DATABASE` bilan o'chiradi, `WITH (FORCE)` ishlatilmaydi.
  - Test DB'ga ulangan autovacuum worker'ni FORCE superuser bo'lmagan rol uchun to'xtata olmaydi: "permission denied to terminate process" chiqardi, stress-run'da 40 dan 1 holat.
  - Oddiy DROP autovacuum'ni o'zi to'xtatadi: 100 dan 0 yiqilish.
