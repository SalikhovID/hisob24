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

## 3-bosqich qarorlari (2026-10-02)

- **Rate limit IP'si.**
  - Next 16 rewrites mijozning `X-Forwarded-For` ini o'zgarishsiz uzatadi va o'zi qo'shmaydi; Go ulanishni 127.0.0.1 dan ko'radi (amalda tekshirilgan).
  - `httpx.ClientIP` loopback yoki private manzildan kelgan so'rovda XFF'ning eng o'ngdagi ommaviy manzilini oladi.
  - Production'da Next oldida mijoz IP'sini o'zi qo'shadigan proksi turishi shart (nginx: `proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for`). Aks holda XFF'ni soxtalashtirib limitni aylanib o'tish mumkin. 8-bosqich README'ga yoziladi.
- **Webhook.**
  - go-telegram/bot'ning `WebhookHandler` noto'g'ri secret kelganda ham 200 qaytaradi.
  - Shuning uchun `/webhooks/admin-bot` oldida `httpx.TelegramSecret` turadi va 401 qaytaradi.
- **Menu button.** Telegram faqat https Mini App URL qabul qiladi. `SetMenuButton` xatosi ishga tushishni to'xtatmaydi, faqat ogohlantirish yoziladi. `setWebhook` xatosi esa to'xtatadi.
- **Bot token bo'sh bo'lsa** admin bot o'chiq: API ishlaydi, `/webhooks/admin-bot` mount qilinmaydi.
- **`make otp`.**
  - Faqat `SMS_DRIVER=log` da ishlaydi. Bu spec'dagi "kodlar faqat log rejimida chiqishi mumkin" qoidasiga mos.
  - Kod `AdminAuth.IssueLoginCode` orqali bot bilan bir xil yo'ldan chiqadi.
- **initData testi.**
  - telegram-mini-apps e'lon qilgan namuna ishlatilgan (token `5768337691:…`, hash `c501b71e…`).
  - Hash core.telegram.org'dagi algoritm bo'yicha mustaqil hisoblab tasdiqlangan.
  - Imzosiz, boshqa bot imzolagan, o'zgartirilgan va 24 soatdan eski holatlar rad etiladi.

## 4-bosqich qarorlari (2026-10-02)

- **Majburiy maydonlar** spec yozuvidan olinadi. Spec ixtiyoriylarni `?` bilan belgilaydi (`{days, amount?, note?}`). Shuning uchun quyidagilar majburiy, bo'sh yoki faqat bo'shliq bo'lsa 400 `validation_error`:
  - `owner_full_name`;
  - user `full_name` va `role`;
  - admin `full_name`.
- **Javob shakli.**
  - Yaratish 201, admin o'chirish 204.
  - Ro'yxat `{items, total, page, page_size}`: sahifada 20 ta, `page` 1–1 000 000, bo'sh sahifada `items: []`.
- **Xato kodlari:** `validation_error` (400), `not_found` (404), `admin_exists`, `cannot_delete_self`, `last_admin` (409).
- **`days_left`** = `end_date − CURRENT_DATE` (baza sanasi, Unix soniyalarida). Muddati o'tgan bo'lsa manfiy. Bloklangan kompaniyada ham to'langan kunlarni ko'rsatadi, `status` filtri esa uni `expired` deb hisoblaydi. Frontend badge va billing preview shundan hisoblanadi.
- **Summa** JSON'da satr (`"150000.50"`), shuning uchun float xatosi yo'q.
  - Kirish formati `^\d{1,12}(\.\d{1,2})?$`.
  - `days` 1–3650 oralig'ida. Yuqori chegara uzoq sana to'lib ketishidan himoya qiladi.
- **Qidiruv** harfma-harf: `%`, `_` va `\` ILIKE ichida escape qilinadi.
- **Billing tarixi** `created_at DESC, id DESC` bo'yicha tartiblanadi. `created_at` tranzaksiya boshlangan vaqt. Shuning uchun bir soniyada ikki parallel to'lov tushsa, tartib zanjirdan farq qilishi mumkin, sanalar zanjiri esa lock tufayli to'g'ri qoladi.
- **Tranzaksiya va lock testlari:**
  - `pgtest.FailInserts` trigger orqali tranzaksiya o'rtasidagi insert'ni yiqitadi va hech narsa yozilmaganini tekshiradi (Create, AddUser, Extend).
  - `pgtest.WaitForLockWait` boshqa sessiya qatorni ushlab turganda chaqiruv lock kutishiga yetganini kutadi. Billing va "kamida bitta faol admin" testlari shu yo'l bilan deterministik.
  - Har biri tranzaksiyasiz yoki lock'siz mutatsiyada yiqilishi tekshirilgan.

## 5-bosqich qarorlari (2026-10-02)

- **Mini App sessiyasi va Telegram Web.** Foydalanuvchi qarori: "chat_id bazada topilsa, tasdiqlashlarsiz initData bilan ishlab ketishi kerak", Telegram Web'da ham.
  - Telegram Web Mini App'ni boshqa sayt ichida (iframe) ochadi, `SameSite=Lax` cookie esa u yerda saqlanmaydi. Shuning uchun `POST /admin/auth/telegram` cookie'ni `SameSite=None; Secure; Partitioned` (CHIPS) bilan qo'yadi. Cookie Telegram Web bo'limida yashaydi, native Telegram'da esa oddiy cookie kabi ishlaydi.
  - OTP login spec bo'yicha `Lax` qoladi. `COOKIE_SECURE=false` (lokal http) bo'lsa Mini App cookie'si ham `Lax`, chunki Secure'siz `None` cookie qabul qilinmaydi.
  - Logout ikkala variantni tozalaydi.
  - Cookie baribir saqlanmasa (CHIPS'siz eski brauzer), panel `/admin/me` bilan tekshiradi va redirect sikliga tushmasdan xabar ko'rsatadi.
- **CSRF.** `SameSite=None` sababli butun API Go'ning `http.CrossOriginProtection` bilan himoyalangan:
  - boshqa saytdan kelgan POST/PATCH/DELETE `Sec-Fetch-Site` yoki `Origin` bo'yicha 403 `forbidden` oladi;
  - `ADMIN_PANEL_URL` ishonchli origin;
  - header'siz so'rovlar (curl, Telegram webhook) o'tadi.
- **401 → /login** faqat `error: "unauthorized"` (sessiya yo'q) bo'lganda. Login xatolari (`invalid_code`, `invalid_init_data`) ham 401, lekin sahifada qoladi. 4xx qayta urinilmaydi.
- **Sahifalar:**
  - `/` → `/companies`.
  - Ro'yxat filtri (`search`, `status`, `page`) URL'da saqlanadi. Qidiruv 300 ms debounce bilan ishlaydi.
  - Jadvallar mobil ekranda kartochkaga aylanadi (`DataList`, `md` breakpoint). Sidebar `lg` dan kichik ekranda Sheet menyuga o'tadi.
  - Kompaniya sahifasida spec'dagi `PATCH (name, is_active)` uchun "Nomini o'zgartirish" va "Bloklash" (tasdiq bilan) / "Faollashtirish" bor.
  - Billing preview `end_date − days_left` ni bugun deb oladi, shunda brauzer soati ta'sir qilmaydi.
- **Mini App ko'rinishi:**
  - `html[data-telegram]` ichida shadcn tokenlari `--tg-theme-*` ranglariga ulangan;
  - mavzu `colorScheme` ga ergashadi;
  - logout va mavzu tugmasi yashiriladi;
  - admin bo'lmagan foydalanuvchiga Telegram ID va "Yopish" ko'rsatiladi.
- **Testlar:**
  - Vitest va Playwright bitta MSW handler to'plamidan foydalanadi (`mocks/`), u Go API kabi javob beradi.
  - e2e alohida dev serverda ishlaydi (3101-port, `.next-e2e`), har spec 375px telefon va desktop'da.
  - Topilgan nozik joy: Playwright `screenshot()` kursorni yashirish uchun fokusdagi input style'iga tegadi, bu hydration'dan oldin bo'lsa React mismatch beradi. Ilova xatosi emas, screenshot'larda `caret: "initial"` ishlatiladi.

## 6-bosqich qarorlari (2026-10-02)

Foydalanuvchi qarorlari:

1. **SMS 429 hamma raqamga bir xil.** Tizimda yo'q raqam uchun ham kod yoziladi (`sms_codes` da FK yo'q), faqat SMS ketmaydi. 60 soniya ichidagi ikkinchi so'rov har qanday raqamga 429 qaytaradi. Yo'q raqamning kodi to'g'ri topilsa ham hech kimni kiritmaydi.
2. **Refresh token company'ni eslaydi.**
   - Migratsiya `00002` `refresh_tokens.company_id` (`ON DELETE SET NULL`) ni qo'shadi.
   - Verify, refresh va switch-company yangi refresh token'ga company'ni yozadi.
   - Refresh a'zolikni qayta tekshiradi: yangi rol olinadi, a'zolik yo'qolgan bo'lsa company tanlanmagan holatga qaytadi.
3. **IP limiti:** `sms/send` va `sms/verify` uchun alohida, daqiqasiga 5 ta.
4. **SMS matni:** `Hisob24 kirish kodi: 123456`. Bu shablon Eskiz akkauntida tasdiqlangan bo'lishi shart.

Belgilangan tafsilotlar:

- **JWT:** HS256 (`JWT_SECRET`).
  - Claim'lar: `sub` = telefon, `aud` = `"app"` (spec'dagidek satr), `iat`, `exp` (15 daqiqa), `company_id` va `role` (tanlanmagan bo'lsa yo'q).
  - Faqat HS256 qabul qilinadi; `aud=app`, `exp` va `sub` majburiy.
- **Refresh token:** 32 tasodifiy bayt, bazada SHA-256.
  - Cookie: `refresh_token`, `Path=/`, `HttpOnly`, `Secure` (`COOKIE_SECURE`), `SameSite=Lax`, 30 kun.
  - Rotation, switch-company va verify'da tranzaksiya buzilsa hech narsa o'zgarmaydi (mutatsiya bilan tekshirilgan).
- **Javoblar:**
  - `sms/send` → `{"retry_after":60}`;
  - verify, refresh va switch → `{"access_token","expires_in":900,"company_id"|null}`;
  - `/app/me` → `{user, company|null, companies}`.
- **402 `subscription_expired`:** `/app/*` ning `auth` dan tashqari qismida, faqat company'li token'da. switch-company 402 dan ozod, shunda muddati o'tgan company'dan boshqasiga o'tish mumkin.
- **Token'lar almashmaydi:** admin sessiyasi faqat cookie, user faqat `Authorization: Bearer`. Ikki tomonlama test bor.
- **SMS yuborilmay qolsa** kod o'chiriladi, shunda qayta urinish bir daqiqa kutmaydi.
- **Eskiz:**
  - `POST /api/auth/login` → token xotirada saqlanadi.
  - `POST /api/message/sms/send` (`mobile_phone`, `message`, `from`).
  - 401 kelsa bir marta qayta login qilinadi.
  - Xato Eskiz javobi bilan qaytadi.
- **User bot:**
  - `/start` va boshqa har qanday xabarga raqam so'raladi (`request_contact` tugmasi, one-time).
  - Begona kontakt (`contact.user_id ≠ from.id`, jumladan 0) saqlanmaydi.
  - Natija xabari bilan klaviatura olib tashlanadi. Saqlashda xato bo'lsa tugma qoladi.
- **Paketlar:** `/app` HTTP qismi `internal/app` da (`internal/admin` ning juftligi). `internal/user` da qolsa `auth` ↔ `user` import sikli bo'lardi.
- **Ma'lum cheklov:** user app uchun alohida URL env'i yo'q (spec ro'yxatida yo'q). Shuning uchun `Sec-Fetch-Site` yubormaydigan juda eski brauzerlar `/app` dagi o'zgartiruvchi so'rovlarda 403 oladi. Zamonaviy brauzerlarga bu ta'sir qilmaydi.

## 7-bosqich qarorlari (2026-10-02)

Foydalanuvchi qarori: **almashtirish imkoniyati.**
- `POST /app/auth/switch-company {company_id: null}` tanlovni bekor qiladi: refresh token almashadi va company'siz token beriladi.
- `/expired` da "Boshqa kompaniyani tanlash" tugmasi bor.
- Dashboard'da "Kompaniyani almashtirish" havolasi chiqadi, lekin faqat tanlash mumkin bo'lgan boshqa company bo'lsa.

Belgilangan tafsilotlar:

- **`/app/me` da `days_left`.** Har bir company uchun `end_date − bugun` (bazaning sanasi bo'yicha, 402 tekshiruvi bilan bir manbadan).
  - `/select-company` muddati o'tgan company'ni shu qiymatdan biladi, brauzer soati ta'sir qilmaydi (admin'dagi `days_left` bilan bir xil).
  - Bu javobga qo'shilgan maydon. Spec `/app/me` shaklini belgilamagan.
- **Telefon maydoni:**
  - `+998` maydon yonidagi o'zgarmas qo'shimcha (shadcn `InputGroup` addon); maydonda faqat `90 123 45 67` turadi.
  - Sabab (e2e topgan bug): prefiks maydon ichida bo'lganda kursor uning oldiga tushishi mumkin edi (koddan `focus()` yoki "+998" ustiga bosish). Natijada `"9+998 "` → `+998 99 98…` bo'lardi.
  - Paste yoki autofill orqali kelgan `+998…` / `998…` (9 raqamdan uzun) boshidagi 998'ni yo'qotadi.
- **Hydration'gacha forma yopiq.** Telefon maydoni `readOnly`, "Kodni olish" esa `disabled` (`useHydrated`, `useSyncExternalStore` asosida).
  - Aks holda hydration'dan oldin terilgan raqam o'chib ketadi, tugma esa formani brauzer usulida GET bilan yuboradi va raqam URL'ga tushadi (`/login?phone=…`). Sekin internetda real holat.
  - e2e buni skriptlarni sun'iy kechiktirib tekshiradi.
- **Token oqimi:**
  - access token faqat xotirada (`lib/session`);
  - `unauthorized` kodli 401 → bitta umumiy refresh (single-flight) → so'rov body bilan bir marta qayta yuboriladi;
  - refresh rad etilsa, sessiya tozalanadi va `unauthorized` sahifaga yetadi → query client `/login` ni yangi sahifa sifatida ochadi;
  - qoida xato kodi bo'yicha, yo'l bo'yicha emas: switch-company `/app/auth/` ostida, lekin eskirgan Bearer'da refresh kerak; `invalid_code` esa refresh qilmaydi.
- **Logout:**
  - `POST /app/auth/logout` → token tozalanadi → `/login` to'liq sahifa yuklanishi bilan ochiladi (`lib/navigate`). Shunda xotirada sessiyadan hech narsa qolmaydi.
  - Logout yiqilsa toast chiqadi va sessiya saqlanadi, chunki cookie baribir qayta kiritib yuborardi.
- **Company almashtirish** keshdagi `/app/me` ni olib tashlaydi, shunda keyingi sahifa eski company'ni ko'rsatmaydi.
- **Sahifalar:**
  - `/`: 402 → `/expired`; company tanlanmagan → `/select-company`.
  - `/select-company`:
    - muddati o'tgan yoki bloklangan company badge bilan ko'rinadi, lekin tanlanmaydi;
    - faol company yo'q bo'lsa xabar va "Chiqish";
    - token'ning company'si muddati o'tgan bo'lsa (402) → `/expired`.
  - Yuklash, tanlash va almashtirish xatolari sababi bilan ko'rsatiladi, ro'yxat va dashboard'da "Qayta urinish" bor.
- **Testlar:**
  - e2e alohida dev serverda ishlaydi (3102-port, `.next-e2e`).
  - Mock bazasi Playwright jarayonida, shuning uchun test obunani "tugatib" qo'ya oladi.
  - Taymer `page.clock.runFor` bilan sinaladi. Mock'ning 60 soniyalik cooldown'i shu testda o'chiriladi.
- **Ma'lum cheklov:** single-flight refresh bitta tab ichida ishlaydi. Ikki tab bir vaqtda bir xil cookie bilan refresh qilsa (rotation), ikkinchisi 401 oladi va `/login` ga o'tadi.

## 8-bosqich qarorlari (2026-10-02)

- **Spec auditi** (har band uchun dalil: test yoki `fayl:qator`) uchta bo'shliq topdi. Uchalasi ham TDD bilan tuzatildi:
  - `openapi.yaml` da `/webhooks/admin-bot` va `/webhooks/user-bot` yo'q edi. Hujjatlashtirildi va contract testi qo'shildi: router `openapi.yaml` dagi yo'llarga aynan mos kelishi kerak (`internal/httpx/openapi_test.go`).
  - "Interfeys o'zbekcha" talabi bo'yicha: toast hududi "Notifications" → "Bildirishnomalar" (ikkala ilova), admin `Dialog`/`Sheet` yopish tugmasi "Close" → "Yopish".
  - Spec'dagi `/(app)` dashboard'i `app/(app)/page.tsx` ga ko'chirildi (URL `/` o'zgarmadi).
- **Nom farqi:** spec'dagi `TelegramAutoLogin` vazifasini admin'dagi `LoginScreen` bajaradi. U Telegram ichida `initData` bilan o'zi kiritadi, aks holda OTP formasini ko'rsatadi. Ikki qismni ajratish faqat nomni o'zgartirardi, shuning uchun qoldirildi.
- **`API_URL` build paytida muhrlanadi.** Tajriba: "A" bilan build qilingan, "B" bilan start qilingan ilova "A" ga proksi qildi. README'da yozilgan.
- **Polling eski webhook'ni o'chirmaydi** (ataylab). Prod tokeni bilan lokal polling prod webhook'ini buzmasligi uchun. README'da `deleteWebhook` yozilgan.
- **Sinalmagan** (tashqi resurs kerak):
  - Docker Compose (mashinada Docker yo'q);
  - haqiqiy Telegram (BotFather, menu button, webhook);
  - Eskiz orqali haqiqiy SMS.

  Bular unit/integration testlar va fake client'lar bilan qoplangan.

## Production deploy (2026-10-02)

Foydalanuvchi so'rovi: prod serverdagi joriy loyihani o'chirib, o'rniga shu loyihani joylash.

Foydalanuvchi qarorlari:
1. **Eski loyiha (`h24`, `github.com/hisob24/monolith`) backupsiz o'chirildi.** O'chirilgani:
   - konteynerlar, volume'lar (baza va MinIO), image'lar;
   - `/var/www/hisob24` (ichidagi eski backup'lar bilan);
   - backup cron'i;
   - `tg`/`files` nginx saytlari;
   - `hisob24` tizim user'i (eski CI SSH kaliti bilan).

   Ammo o'chirish faqat yangi stack ishlab, tekshirilgandan keyin bajarildi.
2. **Domenlar:** `app` → user app, `admin` → admin panel, `api` → API.
3. **Bot tokenlarini foydalanuvchi beradi.** Eski botga tegilmadi; uning webhook'i (`tg.hisob24.uz`) endi ishlamaydi.
4. **SMS:** eski Eskiz akkaunti (`SMS_DRIVER=eskiz`). Ma'lumotlar serverning o'zida ko'chirildi.

Belgilangan tafsilotlar:

- **Stack.**
  - `/var/www/hisob24-v2`, compose loyihasi `hisob24-v2`. Nom eski `hisob24` dan farq qiladi, shunda ikkala stack bir vaqtda ishlay oldi va volume'lar aralashmadi.
  - Portlar: `127.0.0.1:8090` (api), `8091` (admin), `8092` (web).
- **Image'lar serverda build qilinadi** (lokal'da Docker yo'q):
  - Go API: alpine, goose va migratsiyalar bilan;
  - ikkala Next ilova bitta image'da, `next start`; `API_URL=http://api:8080` build paytida beriladi.
- **nginx:**
  - `api.hisob24.uz` da faqat `/webhooks/` va `/healthz` ochiq, brauzerlar API'ga Next orqali boradi;
  - `admin.hisob24.uz.conf` sites-enabled'da birinchi, shuning uchun unga catch-all blok qo'shildi: notanish host'lar avvalgidek `app` ga 301 bo'ladi.
- **Postgres `timezone=Asia/Tashkent`.** `CURRENT_DATE` Toshkent sanasi bo'yicha hisoblanadi.
- **Eskiz:** akkaunt ishlaydi (`auth/login` 200). Lekin `Hisob24 kirish kodi: %d` shabloni tasdiqlanmagan. Tasdiqlangan o'zbekcha shablon: `Hisob24 dasturiga kirish uchun tasdiqlash kodi: %d Uni hech kimga bermang.` Qaror foydalanuvchida.
- **Eski prod `SMS_DRIVER=log` bilan ishlagan**, ya'ni u yerda SMS umuman yuborilmagan.
- **Backup:** kunlik `pg_dump` cron'i, 14 kun saqlanadi.
