# User Mini App — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `@hisob24bot` Mini App'i (`app.hisob24.uz`) Telegram ichida login'siz kiritadi. Ruxsati yo'q yoki raqami ulanmagan foydalanuvchiga sababini aytadi. Raqamni Mini App'ning o'zidan yuborish mumkin (`requestContact`). Dizayn: `docs/superpowers/specs/2026-10-03-user-mini-app-design.md`.

**Architecture:**
- **Backend:** `POST /app/auth/telegram {initData}`. `initData` user bot tokeni bilan tekshiriladi, keyin `telegram_contacts` → `users` → token. `refresh_tokens.source` ('sms'|'telegram') cookie turini belgilaydi (`telegram` + secure → `SameSite=None; Secure; Partitioned`). User bot menu tugmasi va CSRF ishonchli origin'i `WEB_APP_URL` dan olinadi.
- **Frontend:** admin'dagi Telegram qatlami (`waitForWebApp`, `useMiniApp`, `TelegramSync`, `--tg-theme-*`) nusxa qilinadi. LoginScreen'ga Telegram holatlari qo'shiladi. Mini App ichida logout va mavzu tugmasi yashiriladi.

**Tech Stack:** Go 1.27 (pgx, sqlc, goose, go-telegram/bot), Next 16, Vitest + RTL + MSW, Playwright.

---

## Fayl tuzilmasi

| Fayl | Mas'uliyat |
|---|---|
| `backend/migrations/00003_refresh_token_source.sql` | `refresh_tokens.source` |
| `backend/internal/db/queries/{refresh_tokens,telegram_contacts}.sql` | `source` maydoni; `GetTelegramContactPhone` |
| `backend/internal/user/phone.go` (+test) | `FormatPhone` (`+998 90 123 45 67`) |
| `backend/internal/auth/user_auth.go` (+test) | `NewUserAuth(…, userBotToken, …)`, `LoginWithTelegram`, `Tokens.Source`, source'ni saqlash |
| `backend/internal/app/{handler,session}.go` (+test) | `POST /app/auth/telegram`, cookie variantlari |
| `backend/internal/config/config.go` (+test) | `WEB_APP_URL` |
| `backend/internal/bot/userbot/setup.go` (+test) | `SetMenuButton` |
| `backend/cmd/api/main.go` | `NewUserAuth` argumenti, menu tugmasi, `CrossOriginGuard(AdminPanelURL, WebAppURL)` |
| `backend/openapi.yaml`, `packages/api-client` | yangi endpoint |
| `apps/web/types/telegram.d.ts` | WebApp turlari (`requestContact` bilan) |
| `apps/web/lib/telegram.ts` (+test) | `waitForWebApp`, `setMiniApp`, `useMiniApp` |
| `apps/web/components/telegram-sync.tsx` (+test) | Mini App moslashuvi |
| `apps/web/components/login/telegram-login.tsx` (+test) | Telegram holatlari va `requestContact` |
| `apps/web/components/login/login-screen.tsx` (+test) | Telegram'ni kutish, keyin SMS forma |
| `apps/web/components/{dashboard,select-company,expired}.tsx` (+test) | Mini App'da logout yo'q |
| `apps/web/mocks/{data,handlers}.ts`, `test/telegram.ts`, `e2e/*` | mock va testlar |

---

### Task 0: `NewUserAuth` ga user bot tokeni (refactor)

- [ ] Imzo: `NewUserAuth(pool, otpSecret, jwtSecret, userBotToken string, sender sms.Sender)`. Hozircha faqat maydon saqlanadi.
- [ ] Chaqiruvlar yangilanadi: `main.go` (`cfg.UserBotToken`), `auth/user_auth_test.go`, `app/handler_test.go`, `app/cross_test.go` (test konstantasi `testUserBotToken`).
- [ ] `go test ./...` yashil → commit `refactor(auth): user bot token for the user app's sign-in`.

### Task 1: `user.FormatPhone`

- [ ] RED (table): `998901234567` → `+998 90 123 45 67`; `79001234567` → `+79001234567` (O'zbek bo'lmasa `+` va raqamlar).
- [ ] GREEN: 12 xonali va `998` bilan boshlansa guruhlanadi, aks holda `"+" + phone`.

### Task 2: `LoginWithTelegram` (auth, integration, pgtest)

Imzo:
```go
// ErrPhoneNotShared: the Telegram user never shared a phone with the user bot.
var ErrPhoneNotShared = errors.New("phone not shared with the bot")
// NoAccessError: the shared phone is not a user's.
type NoAccessError struct{ Phone string }
func (a *UserAuth) LoginWithTelegram(ctx context.Context, initData string) (Tokens, error)
```
- [ ] **T1:** `telegramtest.SignInitData(testUserBotToken, tgID, now)`, kontakt (`chat_id = tgID`) va bitta company'li user → `Tokens{CompanyID: &c, Role: "owner", Source: "telegram"}`.
  - GREEN uchun kerak:
    - so'rov `GetTelegramContactPhone :one SELECT phone FROM telegram_contacts WHERE chat_id = $1`;
    - migratsiya 00003: `ALTER TABLE refresh_tokens ADD COLUMN source TEXT NOT NULL DEFAULT 'sms' CHECK (source IN ('sms','telegram'))`;
    - `CreateRefreshToken` ga `source`, `RevokeRefreshToken` `RETURNING … source`, `make sqlc`;
    - `issue(…, source)`;
    - `Tokens.Source`;
    - butun jarayon bitta transaction ichida.
- [ ] **T2:** bir nechta company → `CompanyID == nil`.
- [ ] **T3:** kontakt yo'q → `ErrPhoneNotShared`.
- [ ] **T4:** kontakt bor, `users` da yo'q → `NoAccessError{Phone: "998905556677"}`.
- [ ] **T5:** boshqa bot tokeni bilan imzo yoki 24 soatdan eski → `ErrInvalidInitData` (mavjud xato). Bo'sh `userBotToken` → `ErrInvalidInitData`.
- [ ] **T6:** `Verify` → `Source == "sms"`; telegram token'ni `Refresh` va `SwitchCompany` → `Source == "telegram"` (manba ko'chadi).

### Task 3: `POST /app/auth/telegram` va cookie variantlari (app, httptest)

- [ ] **H1:** to'g'ri `initData` → 200 Tokens. `Set-Cookie` tartibi: avval `refresh_token=; Max-Age=0; SameSite=Lax` (eski variant o'chadi), keyin `refresh_token=…; Secure; HttpOnly; SameSite=None; Partitioned`.
  - Tartib muhim: CHIPS'ni bilmaydigan brauzerda ikkala qator bitta cookie, shuning uchun oxirgisi qoladi.
- [ ] **H2 (table):**

  | Holat | Javob |
  |---|---|
  | `ErrInvalidInitData` | 401 `invalid_init_data` "Telegram ma'lumoti yaroqsiz. Mini App'ni qaytadan oching" |
  | `ErrPhoneNotShared` | 403 `phone_not_shared` "Telefon raqamingiz botga ulanmagan" |
  | `NoAccessError` | 403 `no_access` "Hisob24'ga kirish huquqingiz yo'q. Raqamingiz: +998 90 555 66 77. Kompaniyangiz administratoriga murojaat qiling." |
- [ ] **H3:** telegram token'ni refresh qilish → yana `None`+`Partitioned`, Lax o'chiriladi. SMS verify/refresh → Lax qo'yiladi va `None`+`Partitioned` o'chiriladi (yana avval o'chirish, keyin qo'yish).
- [ ] **H4:** logout ikkala variantni o'chiradi. `cookieSecure=false` bo'lsa, faqat Lax (bitta `Set-Cookie`).
- [ ] `openapi.yaml`: `/app/auth/telegram` (`TelegramLogin {initData}`, 200 `SignedIn`, 401, 403). `make api-client`. Contract testi yashil.

### Task 4: `WEB_APP_URL`, user bot menu tugmasi, CSRF

- [ ] **C1** (config table testi): `WEB_APP_URL` o'qiladi, ixtiyoriy, default bo'sh.
- [ ] **U1** (`userbot`): `SetMenuButton(ctx, api, url)`:
  - `MenuButtonWebApp{Text: "Hisob24", WebApp: {URL: url}}`;
  - bo'sh url → hech narsa qilinmaydi;
  - `API` interfeysiga `SetChatMenuButton` qo'shiladi (fakeAPI ham).
- [ ] `main.go`:
  - `startUserBot` ichida `SetMenuButton(cfg.WebAppURL)`, xato bo'lsa `slog.Warn`;
  - `httpx.CrossOriginGuard(cfg.AdminPanelURL, cfg.WebAppURL)`.
- [ ] `.env.example`: `WEB_APP_URL=` va izoh.

### Task 5: Web — Telegram qatlami

- [ ] `types/telegram.d.ts`: admin'dagi turlar va `requestContact?: (callback: (shared: boolean) => void) => void`.
- [ ] **TG1:** `lib/telegram.ts` testlari (admin'dan): `waitForWebApp` `initData` bor bo'lsa uni qaytaradi, yo'q bo'lsa urinishlardan keyin `null`; `useMiniApp`.
- [ ] **TG2:** `TelegramSync` testlari (admin'dan):
  - Mini App'da `ready()`, `expand()`, `data-telegram`;
  - `colorScheme` mavzuni belgilaydi va `themeChanged` ga ergashadi;
  - brauzerda hech narsa qilmaydi.
- [ ] `test/telegram.ts` (`fakeWebApp`, `requestContact` bilan). `Providers` ga `TelegramSync`. `layout.tsx` ga `telegram-web-app.js` (`beforeInteractive`). `globals.css` ga `html[data-telegram]` bloki (admin'dagidek). Bular kompozitsiya va CSS, e2e tekshiradi.

### Task 6: Web — Mini App login (`TelegramLogin` + `LoginScreen`)

Mock (`mocks/data.ts`):
- `db.contacts: Record<number, string>`:
  - `1001 → ALI`;
  - `1002 → VALI`;
  - `1003 → "998905556677"` (users'da yo'q);
  - `1004` ulanmagan.
- `telegramInitData(id)` yordamchisi.

Handler `*/api/app/auth/telegram`:
- `initData` ichidagi `user.id` → kontakt → `users`. Javoblar backend'dagidek.
- `hash=bad` → 401.

Holatlar:
- [ ] **M1:** Mini App, ALI → "Telegram orqali kirilmoqda…" → token, cookie tekshiruvi (`refresh`) → `router.replace("/")`.
- [ ] **M2:** VALI → `/select-company`.
- [ ] **M3:** 1003 → `no_access`: sarlavha "Kirish huquqi yo'q", API matni (raqam bilan), "Yopish" → `webApp.close()`.
- [ ] **M4:** 1004 → `phone_not_shared`: "Telefon raqamingiz ulanmagan", "Raqamni yuborish". `requestContact` → `callback(true)` va mock kontaktni bog'laydi → 1 soniyadan keyin qayta urinish → kiradi (fake timers).
- [ ] **M5:** `requestContact` → `callback(false)` → "Botga qaytib /start yozing va raqamingizni yuboring." ko'rsatmasi.
- [ ] **M6:** `requestContact` yo'q → tugma o'rniga ko'rsatma.
- [ ] **M7:** ulashildi, lekin 1, 2 va 3 soniyadagi urinishlarda ham ulanmagan → "Raqam hali yetib kelmadi" va "Qayta urinish".
- [ ] **M8:** `invalid_init_data` yoki tarmoq xatosi → SMS formasi, tepasida xabar.
- [ ] **M9:** login'dan keyin `refresh` 401 → "Kirib bo'lmadi" (`no_cookie`) va "Yopish".
- [ ] Brauzerda SMS oqimi o'zgarmaydi (mavjud testlar yashil qoladi).

### Task 7: Web — Mini App'da logout yo'q

- [ ] **N1:** Dashboard: `setMiniApp(fakeWebApp())` bo'lsa "Chiqish" va "Mavzuni almashtirish" yo'q. Brauzerda ikkalasi bor (mavjud testlar).
- [ ] **N2:** `/select-company`: Mini App'da "Chiqish" yo'q.
- [ ] **N3:** `/expired`: Mini App'da "Chiqish" yo'q, "Boshqa kompaniyani tanlash" qoladi.

### Task 8: Playwright (soxta Telegram, 375px va desktop)

- [ ] `e2e/fixtures.ts`: admin'dagidek `telegramScript` opsiyasi va `telegram.org` skriptini almashtirish.
- [ ] `e2e/miniapp.spec.ts`:
  - avto-kirish (1001) → dashboard, `body` foni Telegram `bg_color`, "Chiqish" yo'q;
  - ruxsat yo'q (1003);
  - raqam yo'q (1004) → "Raqamni yuborish" → soxta `requestContact` mock endpoint'iga `POST /api/__mock/contacts` yuboradi → kiradi.

### Task 9: Hujjatlar, tekshiruv, deploy

- [ ] README: Mini App bo'limi va `WEB_APP_URL`. Dizayn hujjatiga qarorlar.
- [ ] `make lint`, `make test`, `make e2e`, keshsiz `go test`. Push.
- [ ] Prod:
  - `.env` ga `WEB_APP_URL=https://app.hisob24.uz`;
  - `deploy/ship.sh` (migratsiya 00003);
  - foydalanuvchining eski chat tugmasi `setChatMenuButton {chat_id, type: default}`;
  - tekshiruv: default menu "Hisob24" → `https://app.hisob24.uz`, webhook'lar joyida.
- [ ] Hisobot (RED → GREEN) va foydalanuvchi Telegram'da sinaydi.
