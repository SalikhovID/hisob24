# 6-bosqich: User auth va bot — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Spec 5.5, 5.6 va 6-bo'lim:
- SMS servis (log va Eskiz);
- `/app/auth/{sms/send, sms/verify, refresh, logout, switch-company}` va `GET /app/me`;
- access JWT (`aud=app`, 15 daqiqa) va refresh token rotation (30 kun, httpOnly cookie);
- 402 `subscription_expired` middleware;
- user bot (`/start` va kontakt).

Hammasi haqiqiy Postgres va fake'lar bilan testlanadi.

**Architecture:**
- **Biznes logika** `internal/auth` dagi `UserAuth` servisida: kod berish, tekshirish, token chiqarish, rotation, company almashtirish.
- **JWT** `internal/auth/jwt.go` da (golang-jwt v5, HS256).
- **SMS** `internal/sms` da: `Sender` interfeysi, `LogSender` va `EskizSender`.
- **HTTP** `/app` uchun `internal/user` paketida (`internal/admin` ning juftligi). Bu yerda Bearer middleware, 402 middleware va refresh cookie bor.
- **User bot** `internal/bot/userbot` da. U `user.Contacts` servisi orqali `telegram_contacts` ga yozadi.

**Tech Stack:** Go 1.27, chi, pgx v5, sqlc, goose, golang-jwt/jwt/v5 v5.3.1, go-telegram/bot, testify, httptest, pgtest.

## Foydalanuvchi qarorlari (2026-10-02)

1. **SMS 429 hamma raqamga bir xil.** Bazada yo'q raqam uchun ham kod yoziladi (`sms_codes` da FK yo'q), faqat SMS yuborilmaydi. 60 soniya ichidagi ikkinchi so'rov har qanday raqamga 429 qaytaradi. Yo'q raqamning kodi hech qachon to'g'ri chiqmaydi.
2. **Refresh token company'ni eslaydi.**
   - Migratsiya `00002` `refresh_tokens.company_id BIGINT NULL REFERENCES companies(id) ON DELETE SET NULL` ni qo'shadi.
   - Verify, refresh va switch-company yangi refresh token'ga company'ni yozadi.
   - Refresh vaqtida a'zolik qayta tekshiriladi: a'zolik yo'qolgan bo'lsa token company'siz chiqadi.
3. **IP limiti.** `sms/send` va `sms/verify` alohida limiterlar bilan, IP bo'yicha daqiqasiga 5 ta, oshsa 429 (`httpx.RateLimit`).
4. **SMS matni:** `Hisob24 kirish kodi: 123456`.

## Spec'da aniq aytilmagan, shu rejada belgilangan tafsilotlar

- **JWT:** HS256 (`JWT_SECRET`).
  - Claim'lar: `sub` = telefon, `aud` = `["app"]`, `iat`, `exp` (15 daqiqa), `company_id` va `role` (company tanlanmagan bo'lsa yo'q).
  - Parse'da faqat HS256 qabul qilinadi, `aud=app` va `exp` majburiy.
- **Refresh token:** tasodifiy 32 bayt (base64url), bazada SHA-256 hex.
  - Cookie: `refresh_token`, `Path=/`, `HttpOnly`, `Secure` (`COOKIE_SECURE`), `SameSite=Lax`, `Max-Age` 30 kun.
- **Javoblar:**
  - `sms/send` → 200 `{"retry_after":60}` (frontend taymeri uchun).
  - verify, refresh va switch → 200 `{"access_token","expires_in":900,"company_id"?}` va refresh cookie.
  - logout → 204.
  - `/app/me` → `{user:{phone,full_name}, company:{id,name,role,end_date,is_active}|null, companies:[…]}`.
- **Xatolar:**

  | Status | Kod |
  |---|---|
  | 400 | `validation_error` (telefon noto'g'ri) |
  | 401 | `invalid_code` |
  | 401 | `invalid_refresh_token` (cookie tozalanadi) |
  | 401 | `unauthorized` (Bearer yo'q yoki yaroqsiz) |
  | 403 | `not_member` (switch-company) |
  | 402 | `subscription_expired` |
  | 429 | `too_many_requests` |

- **402 middleware** faqat company'li token'da ishlaydi va `/app/auth/*` ga qo'llanmaydi, shunda muddati o'tgan company'dan boshqasiga o'tish mumkin.
- **switch-company:** Bearer bilan identifikatsiya qilinadi, joriy refresh cookie'ni almashtiradi (rotation), cookie bo'lmasa 401.
- **SMS yuborib bo'lmasa** (Eskiz xatosi): kod o'chiriladi va 500 qaytadi, shunda qayta urinish 60 soniya kutmaydi.
- **User bot:**
  - `/start` va kontakt bo'lmagan har qanday xabarga raqam so'raladi va `request_contact` klaviaturasi chiqadi.
  - Begona kontakt yuborilsa: "Iltimos, o'z raqamingizni yuboring" (klaviatura qoladi).
  - Natija xabari bilan klaviatura olib tashlanadi.
- **Eskiz:** login → token xotirada saqlanadi. 401 kelsa bir marta qayta login qilinib so'rov takrorlanadi. Base URL ichki parametr (testda httptest).

## Fayl tuzilmasi

| Fayl | Mas'uliyat |
|---|---|
| `backend/migrations/00002_refresh_token_company.sql` | `company_id` ustuni |
| `backend/internal/db/queries/refresh_tokens.sql` (+test) | company bilan create va revoke |
| `backend/internal/config/config.go` (+test) | `SMS_DRIVER=eskiz` email va parol talab qiladi |
| `backend/internal/sms/{sms,log,eskiz}.go` (+test) | `Sender`, `Text`, `LogSender`, `EskizSender`, `New` |
| `backend/internal/auth/jwt.go` (+test) | `IssueAccessToken`, `ParseAccessToken` |
| `backend/internal/auth/user_auth.go` (+test) | `UserAuth`: `SendCode`, `Verify`, `Refresh`, `SwitchCompany`, `Logout` |
| `backend/internal/user/contacts.go` (+test) | `Contacts.Save`: normalizatsiya, upsert, mavjudligi |
| `backend/internal/user/{handler,session}.go` (+test) | `/app` route'lari, Bearer va 402 middleware, cookie |
| `backend/internal/bot/userbot/{handler,setup}.go` (+test) | `/start`, kontakt, javoblar, klaviatura |
| `backend/cmd/api/main.go` | SMS sender, `UserAuth`, `/app`, user bot |
| `backend/openapi.yaml`, `packages/api-client` | `/app/*`, `appBearer` |

---

### Task 1: Migratsiya va so'rovlar

- [ ] **Q1 RED:** `TestRefreshTokenRemembersTheCompany`. `CreateRefreshToken(phone, hash, exp, company_id)` → `RevokeRefreshToken(hash)` `(user_phone, company_id)` ni qaytaradi; company'siz token → `nil`. Migratsiya bo'lmagani uchun kompilyatsiya xatosi chiqmasligi kerak: avval migratsiya va so'rov stub'i, testda mantiqiy xato.
  - Migratsiya:
    ```sql
    -- +goose Up
    ALTER TABLE refresh_tokens ADD COLUMN company_id BIGINT REFERENCES companies(id) ON DELETE SET NULL;
    -- +goose Down
    ALTER TABLE refresh_tokens DROP COLUMN company_id;
    ```
  - Mavjud `refresh_tokens` testlari yangi imzoga moslanadi (xatti-harakat o'sha).
- [ ] **Q2:** company o'chirilsa `company_id` NULL bo'ladi (company o'chirish endpoint'i yo'q, lekin FK qoidasi tekshiriladi).

### Task 2: Config

- [ ] **K1:** `SMS_DRIVER=eskiz` bo'lsa `ESKIZ_EMAIL` va `ESKIZ_PASSWORD` majburiy (`log` da emas).

### Task 3: SMS (`internal/sms`)

- [ ] **M1** `Text("123456")` = `"Hisob24 kirish kodi: 123456"`.
- [ ] **M2** `LogSender.Send` slog'ga telefon va matnni yozadi (`SMS_DRIVER=log` ning yagona joyi).
- [ ] **M3** `EskizSender`:
  - birinchi `Send` login qiladi (email, parol) va yuboradi (`Bearer`, `mobile_phone`, `message`, `from`);
  - ikkinchi `Send` token'ni qayta ishlatadi.
- [ ] **M4** Eskiz 401 qaytarsa bir marta qayta login qilinadi va so'rov takrorlanadi; ikkinchi 401 xato bo'ladi.
- [ ] **M5** Eskiz 4xx yoki 5xx qaytarsa xato (status va qisqa body bilan).
- [ ] **M6** `New(cfg)`: `log` → `LogSender`, `eskiz` → `EskizSender`.

### Task 4: JWT (`internal/auth/jwt.go`)

- [ ] **J1** Round trip: telefon, `company_id`, rol, 15 daqiqa.
- [ ] **J2** Company'siz token (`company_id` va `role` yo'q).
- [ ] **J3** Rad etishlar:
  - boshqa secret;
  - muddati o'tgan;
  - `aud` ≠ `app`;
  - `alg=none`;
  - `exp` yo'q.

### Task 5: `UserAuth` (`internal/auth/user_auth.go`, real Postgres, fake sender)

- [ ] **U1** `SendCode`:
  - user'ga SMS (`Text(code)`);
  - bazada faqat hash, muddat 2 daqiqa.
- [ ] **U2** Bazada yo'q raqamga SMS ketmaydi, lekin kod yoziladi.
- [ ] **U3** 60 soniya ichidagi ikkinchi `SendCode` → `ErrTooSoon` (bor va yo'q raqamga bir xil).
- [ ] **U4** Noto'g'ri telefon → `apperr` Invalid. Sender xatosi → kod o'chiriladi va xato qaytadi.
- [ ] **U5** `Verify`, bitta company:
  - token'da `company_id` va rol;
  - refresh token bazada hash ko'rinishida, company bilan;
  - kod bir martalik.
- [ ] **U6** `Verify`, bir nechta company → company'siz token; company yo'q bo'lsa ham shunday.
- [ ] **U7** `Verify` xatolari:
  - noto'g'ri kod → `ErrInvalidCode` va `attempts++`;
  - 5-xatodan keyin kod o'chadi, keyin to'g'ri kod ham ishlamaydi;
  - muddati o'tgan kod;
  - yo'q raqam.
- [ ] **U8** `Refresh`:
  - eski token bekor bo'ladi, yangisi beriladi;
  - company saqlanadi;
  - eski token bilan ikkinchi refresh → `ErrInvalidRefresh`.
- [ ] **U9** `Refresh` a'zolik yo'qolgan bo'lsa company'siz token beradi; rol yangilangan bo'lsa yangi rol.
- [ ] **U10** `SwitchCompany`:
  - a'zo → yangi access va refresh (company bilan), eski refresh bekor;
  - a'zo emas → `ErrNotMember`;
  - begona yoki bekor refresh → `ErrInvalidRefresh`.
- [ ] **U11** `Logout` refresh token'ni bekor qiladi; noma'lum token → `nil`.
- [ ] **U12** Atomarlik (mutatsiya bilan):
  - `Verify` kodni iste'mol qilish va token yaratishni bitta tranzaksiyada qiladi;
  - `Refresh` revoke va create'ni bitta tranzaksiyada qiladi (`FailInserts` refresh_tokens).

### Task 6: `user.Contacts`

- [ ] **T1** `Save(chatID, rawPhone, username, firstName)`:
  - telefon normallashtiriladi (`+998…`);
  - `chat_id` bo'yicha upsert;
  - natija `(isUser bool)`.
- [ ] **T2** Noto'g'ri telefon → xato, hech narsa yozilmaydi.

### Task 7: `/app` HTTP (`internal/user`, httptest va real Postgres, fake sender)

- [ ] **H1** `POST /app/auth/sms/send`:
  - 200 `{"retry_after":60}`;
  - yo'q raqamga ham 200;
  - 60 soniyada ikkinchisi 429;
  - noto'g'ri telefon 400.
- [ ] **H2** IP limiti: `sms/send` 6-so'rovi 429, `sms/verify` alohida hisoblanadi.
- [ ] **H3** `POST /app/auth/sms/verify`:
  - 200 `{access_token, expires_in:900, company_id}`;
  - `refresh_token` cookie (atributlari bilan);
  - noto'g'ri kod 401 `invalid_code`.
- [ ] **H4** `POST /app/auth/refresh`:
  - cookie → yangi access va yangi cookie;
  - eski cookie bilan 401 `invalid_refresh_token` va cookie tozalanadi;
  - cookie yo'q → 401.
- [ ] **H5** `POST /app/auth/logout`: 204, cookie tozalanadi, keyingi refresh 401.
- [ ] **H6** `GET /app/me`:
  - Bearer bilan `user`, `company` va `companies`;
  - Bearer yo'q, noto'g'ri yoki muddati o'tgan → 401;
  - admin cookie → 401;
  - user JWT `/admin/me` da → 401 (token'lar almashmaydi).
- [ ] **H7** 402:
  - company muddati o'tgan yoki bloklangan → `GET /app/me` 402 `{"error":"subscription_expired",…}`;
  - company'siz token'da 402 yo'q;
  - `/app/auth/switch-company` 402 dan ozod.
- [ ] **H8** `POST /app/auth/switch-company`:
  - a'zo → 200, yangi token va cookie;
  - a'zo emas → 403 `not_member`;
  - Bearer yo'q → 401.

### Task 8: User bot (`internal/bot/userbot`, fake API va fake Contacts)

- [ ] **B1** `/start`: raqam so'raydigan matn va `request_contact` tugmali `ReplyKeyboardMarkup` (resize, one-time).
- [ ] **B2** O'z kontakti: `Contacts.Save` → mavjud user bo'lsa "✅ Akkauntingiz ulandi", bo'lmasa "Raqamingiz saqlandi"; ikkalasida `ReplyKeyboardRemove`.
- [ ] **B3** Begona kontakt (`contact.user_id ≠ from.id`) → "Iltimos, o'z raqamingizni yuboring", `Save` chaqirilmaydi.
- [ ] **B4** Boshqa matn → `/start` javobi. Xabarsiz update e'tiborsiz qoldiriladi. `Save` xatosi → "Xatolik yuz berdi…".
- [ ] **B5** Integratsiya: bot kontakti real bazada `telegram_contacts` ga yoziladi.
- [ ] `setup.go`: `WebhookPath = "/webhooks/user-bot"`, `RegisterWebhook`.

### Task 9: Wiring, openapi, hujjatlar, tekshiruv

- [ ] `cmd/api`:
  - `sms.New(cfg)`, `auth.NewUserAuth(pool, OTPHMACSecret, JWTSecret, sender)`;
  - `user.NewHandler`, `/app` routes;
  - `startUserBot` (polling/webhook, `TelegramSecret`).
- [ ] `openapi.yaml`:
  - `appBearer` (http bearer JWT), `refreshCookie`;
  - `/app/*` path'lari, 402/403/429 javoblari;
  - `make api-client`, test va typecheck.
- [ ] Dizayn hujjatiga "6-bosqich qarorlari" yoziladi.
- [ ] Tekshiruv:
  - `make lint`, `make test`, `make e2e`, keshsiz `go test`, race;
  - `start.sh` + curl (`SMS_DRIVER=log`):
    1. user yaratish (admin API orqali company);
    2. `sms/send` → log'dan kod → verify → `/app/me`;
    3. refresh rotation;
    4. switch-company;
    5. muddati o'tgan company → 402;
    6. logout.
- [ ] `git push origin main`, hisobot.
