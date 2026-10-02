# CLAUDE.md

## TDD: avval test, keyin kod (MAJBURIY)

Har bir yangi funksiya, endpoint, servis yoki bug fix uchun quyidagi tartibga qat'iy amal qil:

1. **RED.** Avval kutilgan xatti-harakatni tavsiflovchi test yoz. Kod hali yozilmaydi.
2. **Testni ishga tushir va yiqilishini ko'r.** Buyruqni (`go test ./...`, `pnpm test`) va yiqilish natijasini menga ko'rsat. Test to'g'ri sabab bilan yiqilishi kerak. Masalan, funksiya kutilgan qiymatni qaytarmagani uchun. Kompilyatsiya xatosi yoki noto'g'ri import sabab bo'lsa, bu hisoblanmaydi. Kerak bo'lsa, avval bo'sh stub yoz (`return nil, errors.New("not implemented")`), shunda test kompilyatsiya bo'ladi va mantiq bo'yicha yiqiladi.
3. **GREEN.** Faqat shu testni o'tkazish uchun yetarli bo'lgan minimal kodni yoz.
4. **Testni qayta ishga tushir va o'tganini ko'rsat.** Shuningdek, oldingi testlarning hammasi ham o'tishini tekshir.
5. **REFACTOR.** Kerak bo'lsa, kodni tozala va testlarni yana ishga tushir.

Taqiqlar:
- Testi yo'q production kod yozma.
- Testni o'tkazish uchun testning o'zini o'zgartirma yoki uni o'chirib qo'yma (`t.Skip`, `.skip`). Agar testning o'zi noto'g'ri bo'lsa, buni menga ayt va sababini tushuntir.
- Bir vaqtda bir nechta funksiya uchun test va kod yozma. Har bir sikl bitta aniq xatti-harakatni qamrab olsin.

Qaysi turdagi test yoziladi:
- **Servis va biznes logika** (OTP, billing sanasi, telefon normalizatsiyasi, `initData` tekshiruvi): Go unit testlar, table-driven uslubda.
- **Endpointlar:** `httptest` va haqiqiy Postgres bilan integration testlar (testcontainers-go).
  - Tasdiqlangan chetlanish: mashinada Docker yo'q. Shuning uchun testcontainers o'rniga lokal Postgres ishlatiladi. Har bir test `TEST_DATABASE_URL` orqali vaqtinchalik `hisob24_it_*` DB oladi (`internal/testutil/pgtest`).
- **Botlar:** handler logikasi Telegram API'dan interfeys orqali ajratiladi, testlarda fake client ishlatiladi.
- **Frontend:** komponent va hook'lar uchun Vitest + React Testing Library. Asosiy oqimlar (admin OTP login, user SMS login) uchun Playwright e2e testlar, API esa MSW orqali mock qilinadi.

Faqat 1-bosqichdagi skelet sozlamalari (konfiguratsiya fayllari, Docker, Makefile) testlarsiz yozilishi mumkin.

## Git

- Faqat `main` branch'da ishlanadi. Alohida branch, worktree va PR ochilmaydi.
- Remote: `git@github.com:SalikhovID/hisob24.git`. Push: `git push origin main`.
- Har bir GREEN sikldan keyin commit qilinadi. Commit xabari Conventional Commits uslubida, inglizcha.
- Push bosqich oxirida qilinadi: `make lint` va `make test` o'tgandan keyin, hisobotdan oldin.

## Ish tartibi

- Ish `docs/SPEC.md` dagi 10-bo'lim bosqichlari bo'yicha bajariladi.
- Har bosqich oxirida build va testlar tekshiriladi va hisobot beriladi. Hisobotda har funksiya uchun RED → GREEN ko'rsatiladi.
- Keyingi bosqichga faqat foydalanuvchi tasdig'idan keyin o'tiladi.
- Spec'dan chetga chiqish kerak bo'lsa yoki biror narsa noaniq bo'lsa, taxmin qilinmaydi, foydalanuvchidan so'raladi.

## Stack

- **Backend** (`backend/`):
  - Go 1.27, `chi`, `pgx/v5`, `sqlc`, `goose`, `go-telegram/bot`, `golang-jwt/jwt/v5`, `log/slog`.
  - Bitta jarayonda ishlaydi: HTTP API va ikkala bot.
  - Qatlamlar: handler → service → sqlc. Biznes logika faqat service'da yoziladi.
- **DB:** PostgreSQL. Lokalda Homebrew `postgresql@17`, `docker-compose.yml` (postgres:16) ixtiyoriy.
- **Frontend:**
  - `apps/admin` (:3001): admin panel, Telegram Mini App sifatida ham ochiladi.
  - `apps/web` (:3000): user app.
  - Next.js 16 (App Router, TS), Tailwind v4, shadcn/ui, TanStack Query, react-hook-form + zod.
  - Auth guard `proxy.ts` da (Next 16 `middleware.ts` ni shu nomga o'zgartirgan).
- **API kontrakt:**
  - Asosiy manba: `backend/openapi.yaml`.
  - `packages/api-client` undan generatsiya qilinadi (`openapi-typescript` + `openapi-fetch`).
  - Frontend Go API'ga Next `rewrites` orqali murojaat qiladi: `/api/*` → `${API_URL}/*`, bitta origin'da.
- **Monorepo:** pnpm workspaces.

## Buyruqlar

```bash
make dev          # = ./start.sh: Postgres va DB tekshiruvi, migratsiya, API (air) + admin + web
make test         # go test ./... + pnpm -r test
make migrate      # goose up (backend/migrations)
make sqlc         # sqlc generate → backend/internal/db/gen
make lint         # go vet + golangci-lint + pnpm lint + pnpm typecheck
make db           # hisob24 roli va DB'ni idempotent yaratadi
make tools        # goose, sqlc, golangci-lint → backend/bin (pin qilingan versiyalar)
make api-client   # openapi.yaml → packages/api-client
make otp          # lokal: owner admin uchun login kodi (3-bosqichdan)
```

## Lokal muhit

- `.env` root'da turadi va `.env.example` dan olinadi. `start.sh` va `Makefile` uni o'qiydi.
- DB: `postgres://hisob24:hisob24@localhost:5432/hisob24`.
- `TEST_DATABASE_URL` serverning `postgres` DB'siga ulanadi. Testlar faqat `hisob24_it_*` nomli DB'larni yaratadi va o'chiradi.
- Lokal serverdagi `app`, `hisob24db` va `hisob24_test` DB'lari boshqa loyihalarniki, ularga tegilmaydi.
- Portlar: API 8080, admin 3001, web 3000.
- `start.sh` http://localhost uchun `COOKIE_SECURE=false` qiladi.
- Bot token bo'sh bo'lsa, o'sha bot ishga tushmaydi (log'da ogohlantirish chiqadi), API esa ishlayveradi.

## Qoidalar

- Bu spetsifikatsiyada yozilmagan funksiyani qo'shma. Kerak deb hisoblasang, avval so'ra.
- Bazaga yozuvchi har bir ko'p qadamli amal transaction ichida bajariladi.
- Bazada OTP kodlari, SMS kodlari va refresh token'lar faqat hash ko'rinishida saqlanadi. Kodlarni log'ga yozish faqat `SMS_DRIVER=log` rejimida ruxsat etiladi.
- Kodda secret qiymatlar bo'lmasin. Hamma sozlamalar env orqali o'qiladi va `.env.example` faylida ro'yxat bo'ladi.
- Admin va user token'lari bir-birining o'rnida ishlamasligi kerak: admin sessiya cookie bilan ishlaydi, user JWT esa `aud = "app"` bilan imzolanadi.
- `db/gen/` papkasi va generatsiya qilingan TS client qo'lda tahrirlanmaydi.
- Testlar:
  - Har bir service uchun unit testlar bo'lsin.
  - Auth oqimlari uchun haqiqiy Postgres bilan integration testlar yozilsin (testcontainers yoki docker-compose). Bu loyihada lokal Postgres + `pgtest` ishlatiladi.
  - `initData` tekshiruvi Telegram hujjatidagi namuna bilan test qilinsin.
- `go vet`, `golangci-lint`, `pnpm lint` va `pnpm typecheck` toza o'tishi kerak.

## Manbalar

- `docs/SPEC.md`: spetsifikatsiya, asosiy manba.
- `docs/superpowers/specs/2026-10-02-hisob24-design.md`: kelishilgan qarorlar va spec'dan tasdiqlangan chetlanishlar.
