# Loyiha: Multi-tenant SaaS (Go + Next.js + Telegram)

Sen shu loyihani noldan quradigan dasturchisan. Quyidagi spetsifikatsiyaga aniq amal qil. Spetsifikatsiyadan chetga chiqish kerak bo'lsa yoki biror narsa noaniq bo'lsa, taxmin qilma, mendan so'ra. Ishni pastdagi **bosqichlar** bo'yicha bajar: har bir bosqich oxirida build va testlar o'tishini tekshir, qisqa hisobot ber va keyingi bosqichga o'tishdan oldin mening tasdig'imni kut.

Birinchi qadam sifatida shu faylni `docs/SPEC.md` ga saqla va loyiha ildiziga qisqa `CLAUDE.md` yoz. Unda stack, buyruqlar (`make dev`, `make test`, `make migrate`, `make sqlc`) va pastdagi "Qoidalar" bo'limi bo'lsin. TDD qoidasi `CLAUDE.md` ning eng boshida, alohida bo'lim sifatida yozilsin, chunki u har bir sessiyada birinchi o'qilishi kerak.

---

## 1. Umumiy ko'rinish

Tizim to'rt qismdan iborat:

1. **Admin panel**: platforma adminlari company yaratadi, company'larga billing qo'shadi va adminlarni boshqaradi.
2. **User app**: company userlari ishlaydigan asosiy tizim.
3. **Admin Telegram bot**: adminlarga login uchun OTP kod beradi. Shu bot ichida admin panel Mini App sifatida ham ochiladi.
4. **User Telegram bot**: userning telefon raqamini qabul qilib, uni `chat_id` bilan bog'laydi.

## 2. Stack

- **Backend:** Go (eng so'nggi stabil versiya), `chi` router, `pgx/v5`, `sqlc`, `goose` migratsiyalari, `go-telegram/bot`, `golang-jwt/jwt/v5`, `log/slog`.
- **DB:** PostgreSQL 16.
- **Frontend:** Next.js (App Router, TypeScript), Tailwind, shadcn/ui, TanStack Query.
- **API kontrakt:** `backend/openapi.yaml` asosiy manba hisoblanadi. Frontend uchun TS client undan generatsiya qilinadi (`openapi-typescript` + `openapi-fetch`).
- **Monorepo:** pnpm workspaces.
- **SMS:** Eskiz.uz. Dev rejimida SMS yuborilmaydi, kod faqat log'ga yoziladi (`SMS_DRIVER=log|eskiz`).
- **Local muhit:** `docker-compose.yml` (postgres) va `Makefile`.

## 3. Repo tuzilmasi

```
.
├── backend/
│   ├── cmd/api/main.go            # HTTP API + ikkala bot shu jarayonda ishlaydi
│   ├── internal/
│   │   ├── config/
│   │   ├── db/queries/*.sql       # sqlc so'rovlari
│   │   ├── db/gen/                # sqlc generatsiya qilgan kod (qo'lda tahrirlanmaydi)
│   │   ├── httpx/                 # router, middleware, JSON va xato yordamchilari
│   │   ├── auth/                  # admin_otp, admin_session, sms_otp, jwt, initdata
│   │   ├── admin/                 # /admin/* handlerlar
│   │   ├── company/               # servis: company + owner yaratish, muddatni uzaytirish
│   │   ├── billing/
│   │   ├── user/
│   │   ├── sms/                   # Sender interfeysi: LogSender, EskizSender
│   │   └── bot/{adminbot,userbot}/
│   ├── migrations/
│   ├── sqlc.yaml
│   └── openapi.yaml
├── apps/
│   ├── admin/                     # Next.js + shadcn, Telegram Mini App sifatida ham ishlaydi
│   └── web/                       # Next.js + shadcn, user app
├── packages/api-client/           # openapi.yaml'dan generatsiya qilingan TS client
├── docker-compose.yml
├── Makefile
├── .env.example
└── pnpm-workspace.yaml
```

Kod tashkiloti: handler → service → sqlc query. Biznes logika faqat service qatlamida yoziladi. Handlerlar faqat so'rovni parse qiladi va javob qaytaradi.

## 4. Baza sxemasi

Birinchi migratsiya aynan shu sxemani yaratsin:

```sql
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE admins (
    telegram_id BIGINT PRIMARY KEY,
    full_name   TEXT,
    is_active   BOOLEAN NOT NULL DEFAULT true,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
INSERT INTO admins (telegram_id, full_name) VALUES (461603558, 'Owner');

CREATE TABLE admin_login_codes (
    id          BIGSERIAL PRIMARY KEY,
    admin_id    BIGINT NOT NULL REFERENCES admins(telegram_id) ON DELETE CASCADE,
    code_hash   TEXT NOT NULL,
    expires_at  TIMESTAMPTZ NOT NULL,
    used_at     TIMESTAMPTZ
);
CREATE UNIQUE INDEX admin_login_codes_active ON admin_login_codes(code_hash) WHERE used_at IS NULL;

CREATE TABLE admin_sessions (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_id    BIGINT NOT NULL REFERENCES admins(telegram_id) ON DELETE CASCADE,
    source      TEXT NOT NULL CHECK (source IN ('otp','miniapp')),
    expires_at  TIMESTAMPTZ NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE companies (
    id          BIGSERIAL PRIMARY KEY,
    name        TEXT NOT NULL,
    end_date    DATE NOT NULL,
    is_active   BOOLEAN NOT NULL DEFAULT true,
    created_by  BIGINT REFERENCES admins(telegram_id),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE users (
    phone       TEXT PRIMARY KEY CHECK (phone ~ '^[0-9]{9,15}$'),
    full_name   TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE user_companies (
    user_phone  TEXT   NOT NULL REFERENCES users(phone) ON UPDATE CASCADE ON DELETE CASCADE,
    company_id  BIGINT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    role        TEXT   NOT NULL DEFAULT 'owner' CHECK (role IN ('owner','manager','staff')),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_phone, company_id)
);

CREATE TABLE billings (
    id             BIGSERIAL PRIMARY KEY,
    company_id     BIGINT NOT NULL REFERENCES companies(id),
    days           INT NOT NULL CHECK (days > 0),
    amount         NUMERIC(14,2),
    prev_end_date  DATE NOT NULL,
    new_end_date   DATE NOT NULL,
    note           TEXT,
    created_by     BIGINT REFERENCES admins(telegram_id),
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE sms_codes (
    phone       TEXT PRIMARY KEY,
    code_hash   TEXT NOT NULL,
    expires_at  TIMESTAMPTZ NOT NULL,
    attempts    INT NOT NULL DEFAULT 0,
    sent_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE refresh_tokens (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_phone  TEXT NOT NULL REFERENCES users(phone) ON UPDATE CASCADE ON DELETE CASCADE,
    token_hash  TEXT NOT NULL,
    expires_at  TIMESTAMPTZ NOT NULL,
    revoked_at  TIMESTAMPTZ
);

-- users jadvaliga FK ataylab qo'yilmagan: tizimda yo'q raqamlar ham shu yerda saqlanishi kerak
CREATE TABLE telegram_contacts (
    chat_id     BIGINT PRIMARY KEY,
    phone       TEXT NOT NULL,
    username    TEXT,
    first_name  TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX telegram_contacts_phone ON telegram_contacts(phone);
```

**Telefon raqami formati:** faqat raqamlar, `998901234567` ko'rinishida. Kirishda `+`, probel, `-` va qavslar olib tashlanadi. Raqam 9 xonali bo'lsa, boshiga `998` qo'shiladi. Normalizatsiya bitta funksiyada (`user.NormalizePhone`) yoziladi va unit testlar bilan qoplanadi.

## 5. Funksional talablar

### 5.1 Admin login (OTP orqali)

1. Admin admin botga `/login` yozadi.
2. Bot `from.id`'ni `admins` jadvalidan qidiradi (`is_active = true`). Topilmasa, "Sizda ruxsat yo'q" deb javob beradi.
3. Shu adminning eski ishlatilmagan kodlari va barcha muddati o'tgan kodlar o'chiriladi.
4. `crypto/rand` bilan 6 xonali kod yaratiladi (`000000`–`999999`). Bazaga ochiq kod emas, `HMAC-SHA256(code, OTP_HMAC_SECRET)` saqlanadi. Muddat: **60 soniya**. Unique index xato bersa, yangi kod yaratiladi (ko'pi bilan 5 urinish).
5. Bot adminga `Kod: 123456` (1 daqiqa amal qiladi) xabarini yuboradi. Kod bosganda nusxalanadigan `<code>` formatda bo'lsin.
6. Admin panelda faqat 6 ta katakli input bor (shadcn `InputOTP`). 6-raqam kiritilganda forma avtomatik yuboriladi: `POST /admin/auth/otp {code}`.
7. Backend kodning HMAC'ini hisoblab, `used_at IS NULL AND expires_at > now()` shartiga mos yozuvni qidiradi. Topilsa, `used_at` belgilanadi va `admin_sessions` jadvaliga yangi sessiya yoziladi (muddati 12 soat). Javobda httpOnly, Secure, SameSite=Lax cookie (`admin_session`) qaytariladi.
8. Rate limit: bitta IP'dan daqiqasiga 5 ta urinish. Oshib ketsa, `429` qaytariladi.

### 5.2 Admin Mini App

- Admin botning menu tugmasi `ADMIN_PANEL_URL` manziliga ulanadi (bot ishga tushganda `setChatMenuButton` orqali o'rnatiladi).
- Admin panel Telegram ichida ochilganda `window.Telegram.WebApp.initData` mavjud bo'ladi. Bu holatda panel `POST /admin/auth/telegram {initData}` yuboradi.
- Backend `initData`'ni **ADMIN_BOT_TOKEN** bilan tekshiradi: Telegram'ning rasmiy HMAC algoritmi qo'llaniladi va `auth_date` 24 soatdan eski bo'lmasligi kerak. Keyin `user.id` `admins` jadvalidan topiladi va sessiya ochiladi (`source = 'miniapp'`). Admin OTP kiritmaydi, tizim to'g'ridan-to'g'ri ochiladi.
- Telegram WebView'da cookie muammosi bo'lmasligi uchun frontend API'ga Next.js `rewrites` orqali murojaat qiladi: `/api/*` → Go API. Shunda frontend va API bitta origin'da bo'ladi.
- Admin panelning barcha sahifalari **mobile-first** bo'lishi kerak:
  - Sidebar mobile'da shadcn `Sheet` ko'rinishida ochiladi.
  - Jadvallar mobile'da kartochkalar ro'yxatiga aylanadi.
  - Mini App ichida Telegram mavzusi ranglari hisobga olinadi (`themeParams`).

### 5.3 Company yaratish

`POST /admin/companies {name, end_date, owner_phone, owner_full_name}` bitta transaction ichida bajariladi:
1. `companies` jadvaliga yozuv qo'shiladi.
2. `users` jadvaliga upsert qilinadi: `ON CONFLICT (phone) DO NOTHING`. Raqam allaqachon bo'lsa, mavjud user ishlatiladi.
3. `user_companies` jadvaliga `role = 'owner'` bilan yozuv qo'shiladi.

Shuningdek `POST /admin/companies/{id}/users {phone, full_name, role}` endpoint'i bo'lsin. U company'ga qo'shimcha user qo'shish uchun ishlatiladi.

### 5.4 Billing

`POST /admin/companies/{id}/billings {days, amount?, note?}` bitta transaction ichida bajariladi:
1. `SELECT end_date ... FOR UPDATE` bilan company qatori bloklanadi.
2. Yangi sana hisoblanadi: `new_end = GREATEST(end_date, CURRENT_DATE) + days`.
3. `companies.end_date` yangilanadi va `billings` jadvaliga `prev_end_date` va `new_end_date` bilan yozuv qo'shiladi.

`GET /admin/companies/{id}/billings` billing tarixini qaytaradi.

### 5.5 User app login (SMS orqali)

1. `POST /app/auth/sms/send {phone}`:
   - Raqam normallashtiriladi.
   - Raqam `users` jadvalida bo'lmasa, SMS **yuborilmaydi**, lekin javob baribir `200` bo'ladi. Shunda kim tizimda borligini tashqaridan aniqlab bo'lmaydi.
   - Bitta raqamga 60 soniyada ko'pi bilan 1 ta SMS yuboriladi, aks holda `429`.
   - Kod 6 xonali, muddati 2 daqiqa, bazada HMAC ko'rinishida saqlanadi.
2. `POST /app/auth/sms/verify {phone, code}`:
   - Har bir xato urinishda `attempts` oshiriladi. 5 ta xatodan keyin kod o'chiriladi.
   - Kod to'g'ri bo'lsa, access JWT (15 daqiqa) va refresh token (30 kun, httpOnly cookie `refresh_token`) beriladi. Refresh token bazada hash ko'rinishida saqlanadi.
   - Access JWT claim'lari: `sub = phone`, `company_id`, `role`, `aud = "app"`.
3. User bitta company'da bo'lsa, o'sha company avtomatik tanlanadi. Bir nechtasida bo'lsa, `company_id` bo'sh qoladi va frontend `/select-company` sahifasiga yo'naltiradi. Company tanlanganda `POST /app/auth/switch-company {company_id}` yangi token qaytaradi.
4. `POST /app/auth/refresh` refresh token'ni yangilaydi (rotation): eski token bekor qilinadi va yangisi beriladi.
5. `POST /app/auth/logout` refresh token'ni bekor qiladi.
6. User middleware har bir so'rovda company holatini tekshiradi. `companies.end_date < CURRENT_DATE` yoki `is_active = false` bo'lsa, `402` va `{"error":"subscription_expired"}` qaytariladi.

### 5.6 User bot

1. `/start` buyrug'iga bot raqam so'raydi va `request_contact` tugmali reply keyboard ko'rsatadi.
2. Kontakt kelganda `contact.user_id == message.from.id` tekshiriladi. Mos kelmasa, "Iltimos, o'z raqamingizni yuboring" deb javob beradi.
3. Raqam normallashtiriladi va `telegram_contacts` jadvaliga `chat_id` bo'yicha upsert qilinadi.
4. Raqam `users` jadvalida bo'lsa, "✅ Akkauntingiz ulandi" deb javob beriladi. Bo'lmasa, "Raqamingiz saqlandi" deb javob beriladi.
5. Javobdan keyin reply keyboard olib tashlanadi.

### 5.7 Adminlarni boshqarish

- `GET /admin/admins` adminlar ro'yxatini qaytaradi.
- `POST /admin/admins {telegram_id, full_name}` yangi admin qo'shadi.
- `DELETE /admin/admins/{telegram_id}` adminni o'chirmaydi, faqat `is_active = false` qiladi va uning barcha sessiyalarini o'chiradi.
- Admin o'zini o'chira olmaydi, va kamida bitta faol admin har doim qolishi kerak.

## 6. API ro'yxati

```
POST   /admin/auth/otp
POST   /admin/auth/telegram
POST   /admin/auth/logout
GET    /admin/me
GET    /admin/companies               ?search=&status=active|expired&page=
POST   /admin/companies
GET    /admin/companies/{id}          # company + userlari
PATCH  /admin/companies/{id}          # name, is_active
POST   /admin/companies/{id}/users
GET    /admin/companies/{id}/billings
POST   /admin/companies/{id}/billings
GET    /admin/admins
POST   /admin/admins
DELETE /admin/admins/{telegram_id}

POST   /app/auth/sms/send
POST   /app/auth/sms/verify
POST   /app/auth/refresh
POST   /app/auth/logout
POST   /app/auth/switch-company
GET    /app/me                        # user + company'lari ro'yxati

POST   /webhooks/admin-bot
POST   /webhooks/user-bot
GET    /healthz
```

**Xato formati:** `{"error": "<snake_case_kod>", "message": "<o'zbekcha matn>"}`.

**Botlar:**
- `BOT_MODE=polling` (dev) yoki `BOT_MODE=webhook` (prod) bilan ishlaydi.
- Webhook rejimida `X-Telegram-Bot-Api-Secret-Token` header'i tekshiriladi.

## 7. Frontend

### apps/admin

- `/login`: `InputOTP`, 6 ta katak. 6-raqam kiritilganda avtomatik yuboriladi. Xato bo'lsa, katakchalar tozalanadi va xato xabari ko'rsatiladi. Sahifada "Kodni olish uchun botga `/login` yozing" degan matn va bot havolasi bo'lsin.
- `TelegramAutoLogin` komponenti: `initData` mavjud bo'lsa, foydalanuvchini avtomatik login qiladi va dashboard'ga yo'naltiradi.
- `/companies`:
  - Qidiruv va filtr (faol / muddati o'tgan).
  - Har bir company uchun status badge: qolgan kunlar soni, muddati o'tganlar qizil rangda.
- `/companies/new`: forma (react-hook-form + zod).
- `/companies/[id]`:
  - Company ma'lumoti.
  - Userlar ro'yxati va "User qo'shish" dialogi.
  - "Billing qo'shish" dialogi. Unda yangi `end_date` oldindan hisoblab ko'rsatiladi.
  - Billing tarixi.
- `/admins`: adminlar ro'yxati, qo'shish va o'chirish.
- `middleware.ts`: `admin_session` cookie bo'lmasa, `/login`'ga yo'naltiradi.

### apps/web

- `/login`:
  - 1-qadam: telefon raqami. Input `+998 __ ___ __ __` niqobi bilan.
  - 2-qadam: `InputOTP`, qayta yuborish tugmasi va 60 soniyalik taymer.
- `/select-company`: user bir nechta company'da bo'lsa ko'rsatiladi.
- `/expired`: obuna muddati tugaganda ko'rsatiladi.
- `/(app)`: hozircha bo'sh dashboard. Unda userning ismi, tanlangan company va logout tugmasi bo'lsin.
- Access token xotirada saqlanadi, refresh esa cookie orqali ishlaydi. `401` kelganda client avtomatik refresh qilib, so'rovni qayta yuboradi.

**Umumiy talablar:** interfeys tili o'zbekcha (lotin). Dizayn toza, shadcn standart uslubida, light va dark mavzular qo'llab-quvvatlanadi, mobile-first.

## 8. Qoidalar

### TDD: avval test, keyin kod (MAJBURIY)

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
- **Botlar:** handler logikasi Telegram API'dan interfeys orqali ajratiladi, testlarda fake client ishlatiladi.
- **Frontend:** komponent va hook'lar uchun Vitest + React Testing Library. Asosiy oqimlar (admin OTP login, user SMS login) uchun Playwright e2e testlar, API esa MSW orqali mock qilinadi.

Faqat 1-bosqichdagi skelet sozlamalari (konfiguratsiya fayllari, Docker, Makefile) testlarsiz yozilishi mumkin.

### Umumiy qoidalar

- Bu spetsifikatsiyada yozilmagan funksiyani qo'shma. Kerak deb hisoblasang, avval so'ra.
- Bazaga yozuvchi har bir ko'p qadamli amal transaction ichida bajariladi.
- Bazada OTP kodlari, SMS kodlari va refresh token'lar faqat hash ko'rinishida saqlanadi. Kodlarni log'ga yozish faqat `SMS_DRIVER=log` rejimida ruxsat etiladi.
- Kodda secret qiymatlar bo'lmasin. Hamma sozlamalar env orqali o'qiladi va `.env.example` faylida ro'yxat bo'ladi.
- Admin va user token'lari bir-birining o'rnida ishlamasligi kerak: admin sessiya cookie bilan ishlaydi, user JWT esa `aud = "app"` bilan imzolanadi.
- `db/gen/` papkasi va generatsiya qilingan TS client qo'lda tahrirlanmaydi.
- Testlar:
  - Har bir service uchun unit testlar bo'lsin.
  - Auth oqimlari uchun haqiqiy Postgres bilan integration testlar yozilsin (testcontainers yoki docker-compose).
  - `initData` tekshiruvi Telegram hujjatidagi namuna bilan test qilinsin.
- `go vet`, `golangci-lint`, `pnpm lint` va `pnpm typecheck` toza o'tishi kerak.

## 9. Env (`.env.example`)

```
DATABASE_URL=postgres://app:app@localhost:5432/app?sslmode=disable
HTTP_ADDR=:8080
ADMIN_BOT_TOKEN=
USER_BOT_TOKEN=
BOT_MODE=polling
TELEGRAM_WEBHOOK_SECRET=
PUBLIC_API_URL=
ADMIN_PANEL_URL=
OTP_HMAC_SECRET=
JWT_SECRET=
SMS_DRIVER=log
ESKIZ_EMAIL=
ESKIZ_PASSWORD=
ESKIZ_FROM=4546
```

## 10. Bosqichlar

Har bir bosqichdan keyin to'xta, nima qilinganini va qanday tekshirilganini ayt. 2-bosqichdan boshlab har bir bosqich TDD sikllaridan iborat (8-bo'lim). Hisobotda har bir funksiya uchun RED → GREEN qadamlarini ko'rsat: qaysi test yozildi, u qanday yiqildi va qaysi kod bilan o'tdi.

1. **Skelet.** Monorepo, `docker-compose`, `Makefile`, `.env.example`, Go modul, `chi` server va `/healthz`, ikkala Next.js ilova shadcn bilan, pnpm workspaces, `CLAUDE.md`.
   - Tekshiruv: `make dev` postgres, API va ikkala frontendni ishga tushiradi.
2. **Baza.** goose migratsiyasi, `sqlc` sozlamasi, barcha so'rovlar, `NormalizePhone` va uning testlari.
   - Tekshiruv: `make migrate` va `make sqlc` ishlaydi, admin 461603558 bazada mavjud.
3. **Admin auth.** Admin bot (`/login`), OTP servis, sessiyalar, `initData` tekshiruvi, admin middleware, rate limit va integration testlar.
4. **Admin API.** Company'lar, userlar, billing va adminlar endpoint'lari, `openapi.yaml` va testlar. Billing sanasini hisoblash uchun alohida testlar yozilsin: muddati o'tgan va o'tmagan holatlar.
5. **Admin panel.** Login sahifasi, Mini App avtomatik login va barcha sahifalar. Mobile ko'rinish 375px kenglikda tekshirilsin.
6. **User auth va bot.** SMS servis (log va Eskiz), `/app/auth/*`, JWT va refresh rotation, user bot (`/start` va kontakt) va testlar.
7. **User app.** Login (2 qadam), company tanlash, `/expired` sahifasi va bo'sh dashboard.
8. **Yakuniy tekshiruv.** Barcha testlar va linterlar. README: loyihani local'da ishga tushirish, botlarni BotFather'da sozlash (menu button, Mini App URL) va productionda webhook o'rnatish.
