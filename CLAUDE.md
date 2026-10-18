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
- Push bosqich oxirida qilinadi: `make lint`, `make test` va `make e2e` o'tgandan keyin, hisobotdan oldin.

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
make e2e          # Playwright: admin (3101) va user app (3102), 375px telefon + desktop, API MSW bilan
make migrate      # goose up (backend/migrations)
make sqlc         # sqlc generate → backend/internal/db/gen
make lint         # go vet + golangci-lint + pnpm lint + pnpm typecheck
make db           # hisob24 roli va DB'ni idempotent yaratadi
make tools        # goose, sqlc, golangci-lint → backend/bin (pin qilingan versiyalar)
make api-client   # openapi.yaml → packages/api-client
make otp [ID=…]   # lokal: admin login kodi (faqat SMS_DRIVER=log; ID bo'lmasa birinchi faol admin)
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
- `README.md`: lokal ishga tushirish, env, BotFather sozlamalari va production'da webhook.
- `docs/superpowers/specs/2026-10-02-hisob24-design.md`: kelishilgan qarorlar va spec'dan tasdiqlangan chetlanishlar.
- `logic/user.md`, `logic/roles.md`: user, multi-user, xodimlar, rollar (`owner` / `user`), kompaniya rollari va ruxsatlar qoidalari. Shu sohadagi kod shu hujjatlarga mos yoziladi.
- `logic/customers.md`: mijozlar, mijoz turlari, maydonlar va dropdownlar qoidalari (kim nima qila oladi, qiymat tekshiruvi, o'chirish, tarix). Shu sohadagi kod shu hujjatga mos yoziladi.
- `docs/superpowers/specs/2026-10-04-customers-design.md`: mijozlar bo'limi dizayni (jadvallar, API, sahifalar, bosqichlar, qarorlar).
- `logic/orders.md`: buyurtmalar (2026-10-18 gacha «vazifalar»; kodda `order`), bosqichlar (kanban), buyurtma turlari va maydonlari, mas'ul qoidalari (kim nima qila oladi, tekshiruv, ro'yxat va kanban, tarix, o'chirish). Shu sohadagi kod shu hujjatga mos yoziladi.
- `docs/superpowers/specs/2026-10-06-tasks-design.md`: buyurtmalar bo'limining (o'shanda «vazifalar», `task`) dizayni (jadvallar, API, sahifalar, bosqichlar, qarorlar).
- `docs/superpowers/specs/2026-10-18-orders-rename-design.md`: «Vazifa» → «Buyurtma» (UI, API, kod, baza, URL): nomlash qoidalari (`task` → `order`, tartiblash fe'li `reorder`), migratsiyalar 00018–00020, eski manzillar redirect'i. Buyurtmalarga tegadigan yangi kod shu nomlarda yoziladi.
- `logic/locations.md`: lokatsiyalar (filiallar): tayyor lokatsiya, admin paneldagi amallar, joriy lokatsiya va topbar'dagi tanlovchi, xodimning lokatsiya cheklovi (faqat egasi), buyurtmalar bilan bog'liqlik (yaratish, mas'ul, ro'yxat, mijoz sahifasi, 404). Shu sohadagi kod shu hujjatga mos yoziladi.
- `docs/superpowers/specs/2026-10-07-locations-design.md`: lokatsiyalar dizayni (jadvallar, API, sahifalar, bosqichlar, qarorlar).
- `logic/products.md`: mahsulotlar va xizmatlar (maydonlar, birliklar, nofaol holat, ro'yxat, mahsulot sahifasi, qoldiq va oxirgi xarid narxi ko'rinishi, o'chirish). Shu sohadagi kod shu hujjatga mos yoziladi.
- `logic/warehouse.md`: ombor (hujjatlar va jurnal: `transactions`, `transaction_items`, `stock_moves`; ta'minotchilar, xaridlar va raqami, qoldiq jurnal yig'indisi, ko'chirish, inventarizatsiya, boshlang'ich qoldiq, to'lovlar akkaunt orqali, balans va hisob harakati, lokatsiya bilan bog'liqlik, o'chirish). Shu sohadagi kod shu hujjatga mos yoziladi.
- `logic/sales.md`: sotuv (mijozga yoki chakana, qoldiqdan chiqim, xizmat qatori), mijoz to'lovlari, boshlang'ich qarz / avans, mijoz balansi va hisob harakati. Shu sohadagi kod shu hujjatga mos yoziladi.
- `logic/currencies.md`: valyutalar (admin kompaniyada yoqadi, UZS doim), kurslar (sozlamalarda standart qator, hujjat sanasidagi kurs, hujjatning o'z kursi), hujjatda valyuta, konvertatsiya va ko'rinish. Shu sohadagi kod shu hujjatga mos yoziladi.
- `logic/finance.md`: moliya (akkauntlar / kassa: admin qo'shadi, «Naqd» UZS standart; akkaunt qoldig'i va hisob harakati; kassa boshlang'ich qoldig'i, xarajat va kirim kategoriyalar bilan, o'tkazma, konvertatsiya). Shu sohadagi kod shu hujjatga mos yoziladi.
- `docs/superpowers/specs/2026-10-07-inventory-design.md`: ombor dizayni (jadvallar, API, sahifalar, menyu tartibi va «Yana», bosqichlar, qarorlar).
- `docs/superpowers/specs/2026-10-11-ledger-design.md`: jurnal (transaction uslubi, tw-dobroe namunasi), ombor hujjatlari, sotuv, valyutalar va kurslar, kassa va moliya dizayni (jadvallar, API, sahifalar, bosqichlar, qarorlar).
- `docs/superpowers/specs/2026-10-03-employees-roles-sidebar-design.md`: xodimlar, rollar va user app sidebar dizayni (user app qobig'i 2026-10-14 dan `2026-10-13-mini-app-ui-design.md` bo'yicha).
- `docs/superpowers/specs/2026-10-04-crud-ui-refresh-design.md`: CRUD sahifalar ko'rinishi (tokenlar, `DataList`, `Identity`, `PageHeader` va boshqa umumiy bo'laklar qoidalari, kechiktirilgan tavsiyalar). Admin panelning yangi ro'yxat yoki forma sahifasi shu qoidalarga mos yoziladi; user app'da 2026-10-14 dan `2026-10-13-mini-app-ui-design.md` amal qiladi.
- `docs/superpowers/specs/2026-10-04-logo-design.md`: logotip (`Logo`, `LogoMark`, admin'da `Brand`), `--brand` tokeni, tab ikonlari va ularni qayta yasash buyruqlari. Logotip kerak bo'lgan yangi joy shu qoidalarga mos yoziladi.
- `docs/superpowers/specs/2026-10-04-login-design.md`: login sahifalari (`LoginFrame`, `CodeField`, `Logo24`, `--brand-panel` tokenlari, o'lchamlar va matnlar). Kirishga oid yangi ekran shu qoidalarga mos yoziladi.
- `docs/superpowers/specs/2026-10-06-selects-settings-tabs-pager-design.md`: select'lar (`SelectBox`, `SelectField`, `MultiSelectBox` shadcn Select ustida), `/settings` tablari (`useSettingsTab`, `settingsHref`) va raqamli `Pager` (`pageNumbers`, matnlari). Admin paneldagi yangi select yoki sahifalangan ro'yxat shu qoidalarga mos yoziladi; user app'da tanlovlar varaqda (`PickerSheet`), sozlamalar hub va ichki sahifalarda (`settingsHref`), `Pager` qoldi (`2026-10-13-mini-app-ui-design.md`).
- `docs/superpowers/specs/2026-10-06-roles-bottom-nav-design.md`: kompaniya rollari (ruxsat katalogi `bo'lim.amal`, `internal/access`, `requirePermission` va 403 `forbidden`, rollar API va sahifalari, xodimga rol biriktirish) va tor ekrandagi pastki tab-bar (`TabBar`, Telegram balandligi va xavfsiz zona) dizayni. Ruxsatga oid yangi kod shu hujjatga mos yoziladi; user app qobig'i (suzuvchi tab-bar, profil sahifasi) 2026-10-14 dan `2026-10-13-mini-app-ui-design.md` bo'yicha.
- `docs/superpowers/specs/2026-10-07-telegram-fullscreen-design.md`: Telegram Mini App'ning to'liq ekran rejimi (`requestFullscreen` faqat telefon client'larida va Bot API 8.0+ da, `--safe-top`, `pt-safe` / `pt-safe-*` utility'lari, qaysi ekranlar chetlanadi). Mini App qobig'iga tegadigan yangi kod shu hujjatga mos yoziladi.
- `docs/superpowers/specs/2026-10-11-telegram-login-code-design.md`: kirish kodi Telegram orqali (raqam botga ulangan bo'lsa kod SMS o'rniga user bot chatiga ketadi, Telegram yetmasa SMS, a'zo bo'lmagan raqamga hech narsa; `userbot.Codes`, `auth.TelegramCodes`; bot va login matnlari). Kirish kodini yetkazishga tegadigan yangi kod shu hujjatga mos yoziladi.
- `docs/superpowers/specs/2026-10-13-mini-app-ui-design.md`: user app'ning Telegram Wallet (iOS guruhli ro'yxat) uslubidagi UI'si: tokenlar, `components/kit` to'plami (`Group` / `Row`, `PageTitle` / `BackLink`, `DetailHead` / `Tiles`, varaq-dialog, `PickerSheet`, `FormRow` oilasi, `MainButton`), suzuvchi tab-bar + profil sahifasi, sozlamalar va ombor hub sahifalari, `GET /app/dashboard`, BackButton, o'tish animatsiyalari (`PageTransition`, `lib/moves.ts`), bosqichlar. User app'ning har yangi ekrani shu hujjatga mos yoziladi (ranglari, yuzalari va to'liq ekrandagi tepasi 2026-10-16 dan `2026-10-16-liquid-glass-design.md` bo'yicha); admin panel bunga kirmaydi.
- `docs/superpowers/specs/2026-10-15-tab-bar-menu-design.md`: user app'ning pastki paneli: a'zo tanlagan 4 tagacha sahifa (bo'lim yoki ichki sahifa; `tab_bar`, `PUT /app/me/tab-bar`) va doim oxirida «Sozlama» varag'i (hamma sahifa plitkalarda, qidiruv, «Pastki panelni sozlash»); sidebar standart tartibda, `/profile/menu` yo'q. Panel va menyuga tegadigan yangi kod shu hujjatga mos yoziladi; «Sozlama» varag'i, «Pastki panel» varag'i va 0–4 qoidasi 2026-10-16 dan `2026-10-16-glass-v2-design.md` bo'yicha («Sozlamalar» va «Pastki panel» sahifalari, panel doim to'la).
- `docs/superpowers/specs/2026-10-16-liquid-glass-design.md`: user app'ning «liquid glass» ko'rinishi (prototipning 2026-10-16 versiyasi): «Yorug' shisha» / «Tungi shisha» tokenlari, ambient fon (`main` chizadi, sahifa varag'i faqat surilishda noshaffof), `surface` / `glossy` / `glossy-red` / `glass-chip` / `bg-ambient` utility'lari, kulrang avatarlar, tiniq shisha tab-bar, Telegram'da ilovaning o'z palitrasi va Telegram sarlavha ranglari, to'liq ekranda kontent tugmalar ostida + tepadagi fade, varaq chegarasi, kirish panelining yangi palitrasi. User app'ning yangi yuzasi, rangi yoki tugmasi shu hujjatga mos yoziladi; tungi palitra, tab-bar, plitka-ikonkalar, kirish paneli va desktop qobig'i 2026-10-16 (ikkinchi versiya) dan `2026-10-16-glass-v2-design.md` bo'yicha.
- `docs/superpowers/specs/2026-10-16-glass-v2-design.md`: prototipning `1792163353` versiyasi: «Qorong'i shisha» tokenlari, konturli belgilar (`tab-icons`, fonsiz `TileIcon`), `BrandMark` va sarlavha, hero karta va `plain` varianti, tab-bar v2 (muzlagan pill, oq kapsula linza), «Sozlamalar» sahifasi va «Pastki panel» sahifasi (`/settings/tab-bar`, panel doim to'la), desktop qobig'i (suzuvchi sidebar, tepa panel: «Orqaga», mavzu, chiqish; 1120px ustun; o'rtadagi varaq), modal ortidagi muzlagan fon (2026-10-18 dan: `scrim` utility, `blur(12px)`, har modal o'z fonini chizadi, varaq ustidagi varaq ham). User app'ning yangi ekrani, rangi yoki navigatsiyasi shu hujjatga mos yoziladi.
- `docs/superpowers/specs/2026-10-18-order-money-design.md`: buyurtmada narx (valyuta, kurs), avans va keyingi to'lovlar (`POST /app/orders/{id}/payments`), tovar qatorlari (qoldiqdan chiqim, narxga ta'sirsiz), jurnalda `order` hujjati (`transactions.order_id`), mijoz balansi va hisob harakatida buyurtma, FIFO tan narxi (`internal/costing`) va foyda buyurtma sahifasida, bosh sahifada «Buyurtmalar» kartasi. Buyurtma puliga, tovariga yoki tan narxiga tegadigan yangi kod shu hujjatga mos yoziladi.
