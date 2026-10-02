# 5-bosqich: Admin panel — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `apps/admin` ni to'liq admin panelga aylantirish (spec 5.1, 5.2 va 7-bo'lim):
- OTP login sahifasi;
- Mini App orqali avtomatik login;
- `/companies`, `/companies/new`, `/companies/[id]`, `/admins` sahifalari;
- `proxy.ts` guard;
- mobile-first layout (Sheet, kartochkalar, Telegram `themeParams`).

Hammasi Vitest + RTL va Playwright + MSW bilan tekshiriladi, mobil ko'rinish 375px kenglikda.

**Architecture:**
- Ma'lumotlar mijoz tomonida olinadi: TanStack Query va `@hisob24/api-client` (openapi-fetch) orqali `/api/*` ga, u esa Next rewrite orqali Go'ga boradi. Formalar react-hook-form + zod bilan, UI shadcn (base-nova, Base UI) bilan.
- Sahifa guard'i `proxy.ts` da: cookie bo'lmasa `/login` ga yuboriladi. API'dan kelgan 401 ham `/login` ga olib boradi.
- Mini App: telegram-web-app.js `beforeInteractive` yuklanadi. `initData` bo'lsa, panel Telegram ichida ekanini biladi:
  - `html[data-telegram]` ko'rinishida Telegram `--tg-theme-*` ranglari shadcn tokenlariga ulanadi;
  - mavzu `colorScheme` ga ergashadi;
  - logout va mavzu tugmasi yashiriladi.

**Tech Stack:**
- Next 16.3, React 19.2, Tailwind v4, shadcn 4.21 (base-nova).
- @tanstack/react-query 5, react-hook-form 7, zod 4, @hookform/resolvers 5, next-themes, sonner, input-otp.
- Vitest 5 + RTL, MSW 3 (`msw/node` + `@msw/playwright`), @playwright/test 1.63.

---

## Qaror: Mini App sessiyasi va Telegram Web

Foydalanuvchi qarori: "chat_id bazada topilsa, tasdiqlashlarsiz initData bilan ishlab ketishi kerak". Bu Telegram Web'ga ham tegishli.

Muammo: Telegram Web Mini App'ni iframe ichida ochadi, `SameSite=Lax` cookie esa u yerda saqlanmaydi. Yechim:
- **`POST /admin/auth/telegram`** cookie'ni `SameSite=None; Secure; Partitioned` (CHIPS) bilan qo'yadi. Cookie Telegram Web bo'limida saqlanadi va iframe ichidagi har bir so'rovga, jumladan proxy'ga ketadigan navigatsiyalarga ham qo'shiladi. Native Telegram WebView'da u oddiy first-party cookie kabi ishlaydi.
- **`COOKIE_SECURE=false` (lokal http):** `None` cookie Secure'siz qabul qilinmaydi, shuning uchun bu holatda `Lax` qoladi. Telegram baribir faqat https Mini App URL'ni ochadi.
- **OTP login** spec bo'yicha `SameSite=Lax` bo'lib qoladi.
- **CSRF:** `SameSite=None` bo'lgani uchun Go'ning `http.CrossOriginProtection` butun API'ga qo'yiladi. Boshqa saytdan kelgan POST/PATCH/DELETE 403 `{"error":"forbidden"}` oladi. `ADMIN_PANEL_URL` origin'i ishonchli ro'yxatga qo'shiladi (`Sec-Fetch-Site` yo'q eski brauzerlar uchun). Telegram webhook'ida bu header'lar yo'q, shuning uchun u o'tadi.
- **Logout** ikkala cookie variantini ham tozalaydi.
- **Cookie saqlanmasa** (CHIPS'siz eski brauzer): auto-login 200 olgach `/admin/me` ni tekshiradi. 401 kelsa, redirect sikliga tushmasdan xabar ko'rsatiladi.

## Spec'da aniq aytilmagan, shu rejada belgilangan UI tafsilotlari

- **Bosh sahifa:** "dashboard" sifatida `/companies` ishlatiladi, `/` unga redirect qiladi.
- **Login sahifasi:** spec 5.1.6 bo'yicha faqat 6 katakli input, matn va bot havolasi bor, "Kirish" tugmasi yo'q. Bot havolasi `ADMIN_BOT_USERNAME` dan olinadi, u runtime'da `connection()` dan keyin o'qiladi.
- **Badge:**

  | Holat | Matn | Rang |
  |---|---|---|
  | `!is_active` | "Bloklangan" | qizil |
  | `days_left < 0` | "Muddati o'tgan" | qizil |
  | `0` | "Bugun tugaydi" | sariq |
  | `1–7` | "N kun qoldi" | sariq |
  | `> 7` | "N kun qoldi" | yashil |

- **Kompaniya sahifasi:** spec'dagi `PATCH (name, is_active)` uchun "Nomini o'zgartirish" dialogi va "Bloklash/Faollashtirish" tugmasi (tasdiqlash dialogi bilan).
- **Ro'yxat parametrlari:** qidiruv, filtr va sahifa URL'da saqlanadi (`?search=&status=&page=`). Orqaga qaytilganda holat yo'qolmaydi.
- **Sana formati:** `dd.mm.yyyy`.
- **Telefon formati:** `+998 90 123 45 67`.
- **Summa formati:** `150 000,50`, valyuta yozilmaydi.
- **Rollar:** Egasi, Menejer, Xodim.

## Fayl tuzilmasi

| Fayl | Mas'uliyat |
|---|---|
| `backend/internal/admin/session.go` | cookie variantlari (OTP: Lax, Mini App: None+Partitioned) |
| `backend/internal/httpx/crossorigin.go` | `CrossOriginGuard(trusted...)` middleware |
| `backend/cmd/api/main.go` | guard'ni butun router'ga ulash |
| `apps/admin/proxy.ts` (+test) | cookie'siz sahifa → `/login` |
| `apps/admin/lib/api.ts` (+test) | client, `ApiError`, `call()` |
| `apps/admin/lib/format.ts` (+test) | sana, telefon, summa |
| `apps/admin/lib/billing.ts` (+test) | `previewEndDate` (Go `NewEndDate` ning ko'zgusi) |
| `apps/admin/lib/schemas.ts` (+test) | zod: telefon, kompaniya, user, billing, admin |
| `apps/admin/lib/telegram.ts` (+test) | `waitForWebApp` |
| `apps/admin/lib/queries.ts` | query key'lar va hook'lar (useMe, useCompanies, …) |
| `apps/admin/components/providers.tsx` | QueryClient (401 → /login), ThemeProvider, Toaster, TelegramSync |
| `apps/admin/components/telegram-sync.tsx` (+test) | `data-telegram`, `ready`/`expand`, `colorScheme` |
| `apps/admin/components/login/*` (+test) | `OtpLogin`, `TelegramAutoLogin`, `LoginScreen` |
| `apps/admin/components/shell/*` (+test) | `AppShell`, `NavLinks`, `Topbar`, mobil `Sheet` |
| `apps/admin/components/company-status-badge.tsx` (+test) | badge |
| `apps/admin/components/companies/*` (+test) | ro'yxat, filtr, sahifalash, forma, dialoglar, tarix |
| `apps/admin/components/admins/*` (+test) | ro'yxat, qo'shish, o'chirish |
| `apps/admin/app/login/page.tsx` | server: bot username → `LoginScreen` |
| `apps/admin/app/(panel)/layout.tsx` + sahifalar | `AppShell` ichidagi sahifalar |
| `apps/admin/mocks/*` | MSW handler'lar va xotiradagi fixture (Vitest + Playwright) |
| `apps/admin/test/*` | render helper, navigation mock |
| `apps/admin/e2e/*`, `playwright.config.ts` | e2e: OTP login, kompaniya oqimi, adminlar, Mini App, 375px |

---

### Task 0: Sozlash (konfiguratsiya, testsiz)

- [ ] Paketlar:
  - `pnpm --filter @hisob24/admin add @tanstack/react-query react-hook-form zod @hookform/resolvers @hisob24/api-client@workspace:*`
  - `pnpm --filter @hisob24/admin add -D msw @msw/playwright @playwright/test`
- [ ] Komponentlar: `pnpm exec shadcn add input-otp input label card badge table dialog sheet alert-dialog select sonner skeleton field separator textarea tabs` (input-otp, sonner va next-themes'ni o'zi qo'shadi).
- [ ] `types/telegram.d.ts`: WebApp turi.
  - Maydonlar: `initData`, `initDataUnsafe.user`, `colorScheme`, `themeParams`, `platform`.
  - Metodlar: `ready`, `expand`, `close`, `onEvent`, `offEvent`.
- [ ] `vitest.setup.ts`:
  - MSW `setupServer(...handlers)`: `listen({onUnhandledRequest:"error"})`, `resetHandlers`, `close`;
  - fixture'ni har testdan keyin tiklash;
  - `process.env.TZ = "Asia/Tashkent"` (vitest config `env` orqali).
- [ ] `playwright.config.ts`:
  - `webServer: pnpm exec next dev -p 3101`, `baseURL http://localhost:3101`;
  - loyihalar: `mobile` (375×812, isMobile, hasTouch) va `desktop` (1280×800);
  - faqat chromium.
- [ ] `e2e/fixtures.ts`: `@msw/playwright` `defineNetworkFixture` (auto) va telegram-web-app.js'ni bo'sh skript bilan almashtiruvchi route.
- [ ] Skriptlar: `"test:e2e": "playwright test"`. Root `Makefile` ga `e2e` target qo'shiladi (`pnpm --filter @hisob24/admin test:e2e`).
- [ ] `.gitignore`: `test-results/`, `playwright-report/`.
- [ ] Commit: `chore(admin): panel dependencies, shadcn components, test setup`.

### Task 1: Backend — Mini App cookie va CSRF guard (Go TDD)

- [ ] **S1 RED:** `TestLoginWithInitDataSetsAPartitionedCookie`, `cookieSecure=true`.
  - Kutiladi: `SameSite=None`, `Secure`, `Partitioned`, `HttpOnly`, `Path=/`.
  - Hozir `Lax` qaytadi.
  - GREEN: `setSessionCookie(w, s, miniApp bool)`, Mini App uchun `SameSite: http.SameSiteNoneMode, Partitioned: true`.
- [ ] **S2 RED:** `cookieSecure=false` bo'lsa Mini App cookie'si `Lax` va Partitioned'siz bo'ladi (S1'dan keyin `None` chiqadi). GREEN: shart qo'shiladi.
- [ ] **S3 RED:** logout ikki `Set-Cookie` qaytaradi: oddiy va Partitioned, ikkalasi `Max-Age=0`. Hozir bitta qaytadi.
- [ ] **S4 RED:** `httpx.CrossOriginGuard` (stub hech narsa qilmaydi). Table-driven holatlar:
  - `POST` + `Sec-Fetch-Site: cross-site` → 403 `{"error":"forbidden","message":"Boshqa saytdan kelgan so'rov rad etildi"}`;
  - `same-origin` → o'tadi;
  - `GET` + `cross-site` → o'tadi;
  - `Origin: https://admin.example.com` (ishonchli) + header yo'q → o'tadi;
  - `Origin: https://evil.example` + header yo'q → 403;
  - header'siz (curl, Telegram) → o'tadi.

  GREEN: `http.NewCrossOriginProtection()` + `AddTrustedOrigin` + `SetDenyHandler`.
- [ ] `cmd/api`: `guard(httpx.NewRouter(mounts...))`, trusted = `cfg.AdminPanelURL` (bo'sh bo'lsa ro'yxat bo'sh).
- [ ] `openapi.yaml`: `/admin/auth/telegram` tavsifi (cookie atributlari) va umumiy 403 `forbidden` eslatmasi.
- [ ] Har GREEN'dan keyin commit.

### Task 2: lib — sof funksiyalar (Vitest TDD)

- [ ] **F1 `previewEndDate(endDate, daysLeft, days)`.** Go testlarining ko'zgusi. Bugun = `end_date − days_left`.

  | `endDate` | `daysLeft` | `days` | natija |
  |---|---|---|---|
  | `2026-10-20` | 18 | 30 | `2026-11-19` |
  | `2026-10-02` | 0 | 1 | `2026-10-03` |
  | `2026-09-01` | −31 | 30 | `2026-11-01` |

  UTC hisob (`Date.UTC`), oy va yil chegaralari bilan. Ikki sikl: o'tmagan, o'tgan.
- [ ] **F2 `formatDate`:**
  - `"2026-10-07"` → `"07.10.2026"`;
  - ISO timestamp → mahalliy sana (`Asia/Tashkent`).
- [ ] **F3 `formatPhone`:**
  - `"998901234567"` → `"+998 90 123 45 67"`;
  - boshqa uzunlik → `"+" + raqamlar`.
- [ ] **F4 `formatAmount`:**
  - `"150000.50"` → `"150 000,50"` (nbsp);
  - `"100.00"` → `"100,00"`;
  - `null` → `"—"`.
- [ ] **F5 `call()` / `ApiError`:**
  - 2xx → `data`;
  - xato body → `ApiError(status, error, message)`;
  - tarmoq xatosi → `ApiError(0, "network_error", "Tarmoq xatosi. Internetni tekshirib, qayta urinib ko'ring")`.
- [ ] **F6 zod sxemalar:**
  - telefon (`+ - ( )` va bo'shliqlarni olib tashlab 9–15 raqam, Go `NormalizePhone` bilan bir xil);
  - kompaniya, user, billing (`days` 1–3650, summa regex), admin (Telegram ID musbat butun son).
  - Xato matnlari backend bilan bir xil.
- [ ] **F7 `waitForWebApp({tries:10, step:100})`** (fake timers):
  - darhol topiladi;
  - 300 ms'dan keyin topiladi;
  - `initData` bo'sh bo'lsa `null`;
  - hech qachon kelmasa 1 s'dan keyin `null`.

### Task 3: proxy.ts (Vitest, node muhiti)

- [ ] **P1:** cookie'siz `/companies` → `getRedirectUrl` = `/login`.
- [ ] **P2:** `admin_session` cookie bor → redirect yo'q.
- [ ] **P3:** `unstable_doesMiddlewareMatch` bilan `config.matcher` tekshiriladi:
  - `/api/admin/me`, `/_next/static/x.js`, `/favicon.ico` → `false`;
  - `/`, `/companies/5`, `/admins` → `true`;
  - `/login` → `false`, chunki login ochiq.

### Task 4: Providers va Telegram

- [ ] **T1 `TelegramSync`:** stub WebApp (`initData`, `colorScheme:"dark"`, `themeParams`) bo'lsa:
  - `ready()` va `expand()` chaqiriladi;
  - `html` da `data-telegram` va `dark` class paydo bo'ladi;
  - `themeChanged` hodisasida yangi `colorScheme` olinadi.

  WebApp bo'lmasa hech narsa o'zgarmaydi.
- [ ] **T2 `useIsMiniApp()`:** stub bilan `true`, stub'siz `false`.
- [ ] **T3 401 → `/login`:** global `QueryCache`/`MutationCache` `onError` 401 olganda `window.location.replace("/login")` qiladi (sinovda spy bilan).
- [ ] `globals.css`: `html[data-telegram]` ichida shadcn tokenlari `--tg-theme-*` ga bog'lanadi. Buni Playwright tekshiradi.

### Task 5: Login

- [ ] **L1:** matn "Kodni olish uchun botga /login yozing" va `@bot` havolasi (`https://t.me/<username>`); username yo'q bo'lsa havolasiz matn.
- [ ] **L2:** 6 ta raqam yozilganda `POST /api/admin/auth/otp {code}` ketadi (MSW body'ni tekshiradi), 200 → `router.replace("/companies")`.
- [ ] **L3:** 401 → kataklar tozalanadi va API `message` ko'rsatiladi; 429 → API `message`.
- [ ] **L4:** xatodan keyin yangi raqam yozilsa, xato yo'qoladi.
- [ ] **L5 `TelegramAutoLogin`** (stub WebApp):
  - **holatlar:**
    - "Telegram orqali kirilmoqda…" → 200 va `/admin/me` 200 → `router.replace("/companies")`;
    - 403 → "Sizda ruxsat yo'q", "Telegram ID: 42" va "Yopish" tugmasi (`close()` chaqiriladi);
    - 401 yoki 500 → xato matni va OTP forma qaytadi;
    - login 200, `/admin/me` 401 → "Brauzer kirish ma'lumotini saqlamadi…" xabari (redirect yo'q).
  - WebApp yo'q bo'lsa OTP forma darhol ko'rinadi.
- [ ] `app/login/page.tsx`: `await connection()`, `process.env.ADMIN_BOT_USERNAME`, `<LoginScreen botUsername>`.

### Task 6: Shell

- [ ] **A1:** "Kompaniyalar" va "Adminlar" havolalari, joriy yo'l bo'yicha `aria-current="page"`.
- [ ] **A2:** Topbar `/admin/me` dagi ismni ko'rsatadi. "Chiqish" → `POST logout` → `/login`.
- [ ] **A3:** Mini App'da "Chiqish" va mavzu tugmasi yo'q.
- [ ] **A4:** "Menyu" tugmasi Sheet'ni ochadi, ichida havolalar bor; havola bosilganda Sheet yopiladi.
- [ ] **A5:** mavzu tugmasi `light` ↔ `dark` qiladi.
- [ ] `app/(panel)/layout.tsx` → `AppShell`. `app/(panel)/page.tsx` → `redirect("/companies")`.

### Task 7: `/companies`

- [ ] **B1 `CompanyStatusBadge`:** 5 holat (matn va `data-tone`).
- [ ] **C1:** ro'yxat: nom, `dd.mm.yyyy`, badge. Desktop jadval va mobil kartochkalar ikkalasi DOM'da, ko'rinishini CSS boshqaradi (Playwright tekshiradi).
- [ ] **C2:** qidiruv (300 ms debounce) → `?search=olma`, `page=1` ga qaytadi, so'rov `search=olma` bilan ketadi.
- [ ] **C3:** "Faol" / "Muddati o'tgan" tablari → `status`.
- [ ] **C4:** sahifalash: "1–20 / 45"; 1-sahifada "Oldingi" o'chiq, "Keyingi" → `page=2`, oxirgi sahifada "Keyingi" o'chiq.
- [ ] **C5:** bo'sh holat "Kompaniyalar topilmadi"; yuklanishda skeleton; xatoda matn va "Qayta urinish".
- [ ] **C6:** har qator yoki kartochka `/companies/{id}` ga havola.

### Task 8: `/companies/new`

- [ ] **N1:** bo'sh forma yuborilsa 4 ta zod xatosi chiqadi.
- [ ] **N2:** to'g'ri forma → POST body → toast "Kompaniya yaratildi" → `router.push("/companies/{id}")`.
- [ ] **N3:** API 400 → API `message` forma ustida ko'rsatiladi.

### Task 9: `/companies/[id]`

- [ ] **D1:**
  - ma'lumot: nom, tugash sanasi, badge, yaratilgan sana;
  - userlar: telefon `+998 …`, ism, rol nomi.
- [ ] **D2:** 404 → "Kompaniya topilmadi" va ro'yxatga havola.
- [ ] **D3:** "User qo'shish" dialogi:
  - validatsiya → POST → ro'yxat yangilanadi va toast chiqadi;
  - API xatosi dialog ichida ko'rsatiladi.
- [ ] **D4:** "Billing qo'shish" dialogi:
  - kunlar yozilishi bilan "Yangi tugash sanasi: dd.mm.yyyy" yangilanadi;
  - validatsiya;
  - POST → kompaniya va tarix yangilanadi.
- [ ] **D5:** billing tarixi:
  - qatorda sana, "+30 kun", summa yoki "—", `prev → new`, izoh;
  - bo'sh bo'lsa "Hali to'lovlar yo'q".
- [ ] **D6:** "Bloklash" → tasdiqlash dialogi → `PATCH {is_active:false}` → badge "Bloklangan". "Faollashtirish" → `PATCH {is_active:true}`.
- [ ] **D7:** "Nomini o'zgartirish" dialogi → `PATCH {name}`.

### Task 10: `/admins`

- [ ] **M1:** ro'yxat: ism, "ID: …", "Faol"/"Nofaol", joriy admin uchun "Siz" belgisi.
- [ ] **M2:** "Admin qo'shish" dialogi:
  - validatsiya → POST → ro'yxat yangilanadi;
  - 409 bo'lsa "Bu admin allaqachon faol" dialog ichida ko'rsatiladi.
- [ ] **M3:** "O'chirish" (o'zida yo'q, nofaol adminda yo'q) → tasdiqlash → DELETE → ro'yxat yangilanadi; 409 → API `message` toast'da.

### Task 11: Playwright + MSW (mobile va desktop)

- [ ] **E1:**
  - `/companies` → `/login` → kod → `/companies` (mock login `Set-Cookie` qaytaradi);
  - noto'g'ri kod → xato chiqadi va kataklar tozalanadi.
- [ ] **E2:** yangi kompaniya → tafsilot → user qo'shish → billing (preview) → tarix.
- [ ] **E3:** admin qo'shish va o'chirish.
- [ ] **E4:** Mini App: soxta telegram-web-app.js (`initData`, `themeParams`, `--tg-theme-*`):
  - avtomatik kirish → `/companies`;
  - "Chiqish" yo'q;
  - `body` foni `--tg-theme-bg-color` ga teng.
- [ ] **E5:** 375px'da har sahifada gorizontal scroll yo'q (`scrollWidth <= clientWidth`), jadval yashirin, kartochkalar ko'rinadi, Sheet menyusi ishlaydi. Screenshot'lar ko'rib chiqiladi.

### Task 12: Hujjatlar va tekshiruv

- [ ] `CLAUDE.md` ga `make e2e` qo'shiladi. Dizayn hujjatiga "5-bosqich qarorlari" bo'limi yoziladi.
- [ ] Tekshiruvlar:
  - `make lint`, `make test`, `make e2e`;
  - keshsiz `go test`;
  - `start.sh` bilan haqiqiy stack (Playwright skripti, 375px): `make otp` → login → kompaniya → user → billing → admin;
  - `curl` orqali: Next orqali boshqa saytdan kelgan POST 403 olishi.
- [ ] `git push origin main`, hisobot va tasdiq kutish.
