# 7-bosqich: User app — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `apps/web` (spec 7-bo'lim):
- `/login`: 2 qadam. Telefon `+998 __ ___ __ __` niqobi bilan; keyin InputOTP, qayta yuborish tugmasi va 60 soniyalik taymer.
- `/select-company`, `/expired`, bo'sh dashboard `/` (ism, company, logout).
- Access token faqat xotirada, refresh cookie orqali. 401 kelsa client avtomatik refresh qiladi va so'rovni qaytaradi.

Hammasi Vitest + RTL va Playwright + MSW bilan, telefon 375px va desktop'da.

**Architecture:**
- `lib/session.ts`: access token xotirada.
- `lib/api.ts`: openapi-fetch client'iga o'ralgan `fetch`.
  - Har so'rovga `Authorization: Bearer` qo'shiladi.
  - `/app/auth/*` dan boshqa yo'lda 401 kelsa, bitta umumiy refresh (single-flight) bajariladi va so'rov bir marta qaytariladi.
  - Refresh ham yiqilsa → `/login`. Sahifa qayta yuklanganda token yo'q, shuning uchun birinchi 401 shu yo'l bilan refresh qiladi.
- Sahifalar `/app/me` ga qarab yo'naltiradi:
  - 402 → `/expired`;
  - `company: null` → `/select-company`;
  - aks holda dashboard.
- `proxy.ts`: `refresh_token` cookie bo'lmasa himoyalangan sahifa `/login` ga yuboriladi (admin'dagidek).

**Tech Stack:**
- Next 16.3, React 19.2, shadcn base-nova, @tanstack/react-query 5, react-hook-form + zod.
- MSW 3 (Vitest va `@msw/playwright`), Playwright 1.63.
- Backend'da Go o'zgarishi (switch-company'da `null`).

## Foydalanuvchi qarori (2026-10-02)

**Almashtirish imkoniyati.**
- `POST /app/auth/switch-company {company_id: null}` tanlovni bekor qiladi: refresh token almashadi, company'siz token beriladi.
- `/expired` da "Boshqa kompaniyani tanlash" tugmasi: `null` → `/select-company`.
- Dashboard'da "Kompaniyani almashtirish" havolasi, faqat user bir nechta company'da bo'lsa.
- `/select-company` da muddati o'tgan yoki bloklangan company badge bilan ko'rinadi, lekin tanlanmaydi. Faol company bo'lmasa, xabar va "Chiqish" ko'rsatiladi.

## Belgilangan tafsilotlar

- **Telefon maydoni:**
  - `+998 ` prefiksi doim turadi, ko'pi bilan 9 raqam;
  - ko'rinishi `+998 90 123 45 67`;
  - yuborilganda `998901234567`;
  - 9 raqamdan kam bo'lsa "Telefon raqamini to'liq kiriting".
- **Kod qadami:**
  - 6-raqamda kod avtomatik yuboriladi; xato bo'lsa kataklar tozalanadi va API xabari chiqadi;
  - "Kodni qayta yuborish" tugmasi `retry_after` (60) soniyagacha o'chiq va qolgan soniyani ko'rsatadi;
  - "Raqamni o'zgartirish" 1-qadamga qaytaradi;
  - 429 bo'lsa API xabari chiqadi.
- **Dashboard:**
  - sarlavhada "Hisob24", mavzu tugmasi va "Chiqish";
  - kartochkada "Salom, {ism}" (ism bo'lmasa telefon), company nomi va rol nomi (Egasi, Menejer, Xodim);
  - faqat bir nechta company bo'lsa "Kompaniyani almashtirish".
- **`/expired`:** "Obuna muddati tugagan", "Kompaniya obunasini uzaytirish uchun administrator bilan bog'laning.", "Boshqa kompaniyani tanlash" va "Chiqish".
- **e2e:** alohida dev server (3102-port, `.next-e2e`). `make e2e` ikkala ilovani ishga tushiradi.

## Fayl tuzilmasi

| Fayl | Mas'uliyat |
|---|---|
| `backend/internal/auth/user_auth.go` (+test) | `SwitchCompany(…, companyID *int64)`: `nil` → company'siz |
| `backend/internal/app/handler.go` (+test) | body `company_id` nullable |
| `backend/openapi.yaml`, `packages/api-client` | `company_id: integer\|null` |
| `apps/web/lib/phone.ts` (+test) | `formatPhoneInput`, `phoneDigits` |
| `apps/web/lib/session.ts` (+test) | access token xotirada |
| `apps/web/lib/api.ts` (+test) | client, `ApiError`, `call`, auth fetch (401 → refresh → retry) |
| `apps/web/lib/query-client.ts` (+test) | 4xx qayta urinilmaydi |
| `apps/web/lib/queries.ts` | `useMe`, `useSwitchCompany`, `useLogout` |
| `apps/web/proxy.ts` (+test) | `refresh_token` cookie guard |
| `apps/web/components/login/*` (+test) | `PhoneStep`, `CodeStep`, `LoginScreen` |
| `apps/web/components/select-company.tsx` (+test) | ro'yxat, tanlash, faol yo'q holati |
| `apps/web/components/expired.tsx` (+test) | xabar, boshqa company, chiqish |
| `apps/web/components/dashboard.tsx` (+test) | ism, company, rol, almashtirish, chiqish |
| `apps/web/app/*` | sahifalar |
| `apps/web/mocks`, `test`, `e2e` | MSW, render helperlari, Playwright |

---

### Task 0: Backend — `switch-company` ga `null`

- [ ] **S1 RED (auth):** `SwitchCompany(…, nil)`:
  - token company'siz;
  - eski refresh bekor;
  - yangi refresh company'siz (keyingi `Refresh` ham company'siz).
- [ ] **S2 RED (HTTP):** muddati o'tgan company tanlangan user `{"company_id": null}` yuboradi → 200 `company_id: null` → `/app/me` 200 va ro'yxat.
- [ ] `openapi.yaml`: `company_id` `[integer, "null"]`, tavsif. `make api-client`.

### Task 1: Web sozlash (konfiguratsiya, testsiz)

- [ ] Paketlar: `@tanstack/react-query react-hook-form zod @hookform/resolvers next-themes sonner @hisob24/api-client` va dev uchun `msw @msw/playwright @playwright/test @testing-library/user-event`.
- [ ] shadcn: `input-otp input label card badge sonner skeleton field`.
- [ ] Test infratuzilmasi (admin'dagidek):
  - `vitest.setup.ts` (MSW, `matchMedia`, `elementFromPoint`, navigation mock, TZ);
  - `test/{navigation,render,server}`;
  - `mocks/{data,handlers}` (`/app` API: kod `123456`, 60 soniya, 402, `switch-company`, `null`);
  - `playwright.config.ts` (3102, mobile 375 va desktop), `e2e/fixtures.ts`.
- [ ] `next.config.ts` `distDir` (`NEXT_DIST_DIR`), eslint/tsconfig ignore'lari, `test:e2e` skripti. `make e2e` ikkala ilova uchun.

### Task 2: lib (Vitest TDD)

- [ ] **P1 `formatPhoneInput`:**

  | Kirish | Natija |
  |---|---|
  | `""` | `"+998 "` |
  | `"90"` | `"+998 90"` |
  | `"901234567"` | `"+998 90 123 45 67"` |
  | `"+998 90 123 45 67 8"` | 9 raqam bilan kesiladi |
  | `"+998901"` | 998 prefiksi takrorlanmaydi |
  | harflar | tashlanadi |

- [ ] **P2 `phoneDigits`:** `"+998 90 123 45 67"` → `"998901234567"`; to'liq bo'lmasa → `null`.
- [ ] **K1 session:** `setAccessToken`, `accessToken`, `clearSession`.
- [ ] **A1 `call()`/`ApiError`:** admin'dagidek: data, API xatosi, tarmoq xatosi.
- [ ] **A2 auth fetch:** saqlangan token `Authorization: Bearer` sifatida yuboriladi.
- [ ] **A3:** 401 → refresh (cookie) → yangi token saqlanadi → so'rov qaytariladi va muvaffaqiyatli.
- [ ] **A4:** bir vaqtda kelgan ikkita 401 bitta refresh qiladi (single-flight).
- [ ] **A5:** refresh ham rad etilsa → sessiya tozalanadi va asl 401 (`unauthorized`) qaytadi, `/login` ga esa query client olib boradi. Refresh faqat `unauthorized` kodli 401 da qilinadi (xato SMS kodi `invalid_code` refresh qilmaydi). *(Tuzatish: avval "`/app/auth/*` refresh qilinmaydi" deb yozilgan edi, lekin switch-company ham `/app/auth/` ostida va eskirgan Bearer'da refresh kerak.)*
- [ ] **Q1 `makeQueryClient`:** 4xx qayta urinilmaydi, 5xx 2 marta.

### Task 3: proxy.ts

- [ ] **G1:** cookie'siz `/`, `/select-company`, `/expired` → `/login`; `refresh_token` bo'lsa o'tadi.
- [ ] **G2:** matcher `/login`, `/api`, `_next` va favicon'ni o'tkazib yuboradi.

### Task 4: Login

- [ ] **L1 PhoneStep:**
  - maydon niqob bilan to'ladi;
  - to'liq raqam → `POST /app/auth/sms/send {phone:"998…"}` → `onSent(phone, retryAfter)`;
  - to'liq bo'lmasa xato matni chiqadi va so'rov ketmaydi;
  - 429 bo'lsa API xabari.
- [ ] **L2 CodeStep:**
  - 6-raqam → verify → token saqlanadi;
  - `company_id` bor → `router.replace("/")`, `null` → `/select-company`;
  - xato kod → kataklar tozalanadi va xabar chiqadi.
- [ ] **L3 qayta yuborish:**
  - fake timers: tugma o'chiq va matni "Kodni qayta yuborish (60)" → 60 soniya o'tgach yoqiladi;
  - bosilsa `send` qaytadan ketadi va taymer yangidan boshlanadi.
- [ ] **L4:** "Raqamni o'zgartirish" 1-qadamga raqam bilan qaytadi. `LoginScreen` ikki qadamni bog'laydi.

### Task 5: `/select-company`

- [ ] **C1:** `/app/me` company'lari: nom, rol, holat. Faollari tugma, muddati o'tgan va bloklanganlari o'chiq va badge bilan.
- [ ] **C2:** bosish → `switch-company {company_id}` → token → `router.replace("/")`.
- [ ] **C3:** faol company yo'q → "Faol kompaniya yo'q" xabari va "Chiqish".

### Task 6: `/expired`

- [ ] **E1:** xabar matni.
- [ ] **E2:** "Boshqa kompaniyani tanlash" → `switch-company {company_id:null}` → `/select-company`.
- [ ] **E3:** "Chiqish" → logout → sessiya tozalanadi → `/login`.

### Task 7: Dashboard `/`

- [ ] **D1:** "Salom, Ali Valiyev", company nomi, rol nomi.
- [ ] **D2:** `/app/me` 402 → `/expired`; `company: null` → `/select-company`.
- [ ] **D3:** "Kompaniyani almashtirish" faqat 2 va undan ko'p company bo'lsa, `/select-company` ga havola.
- [ ] **D4:** "Chiqish" → logout → `/login`. Mavzu tugmasi ishlaydi.

### Task 8: Playwright (mobile 375 va desktop)

- [ ] **W1:** `/` → `/login` → telefon → kod → dashboard (bitta company).
- [ ] **W2:** bir nechta company → `/select-company` → tanlash → dashboard → "Kompaniyani almashtirish".
- [ ] **W3:** muddati o'tgan company → `/expired` → "Boshqa kompaniyani tanlash" → faolini tanlash → dashboard.
- [ ] **W4:** qayta yuborish taymeri (`page.clock`) va xato kod.
- [ ] **W5:**
  - sahifa qayta yuklanganda refresh orqali sessiya tiklanadi;
  - 375px'da gorizontal scroll yo'q;
  - screenshot'lar ko'rib chiqiladi.

### Task 9: Hujjatlar va tekshiruv

- [ ] `CLAUDE.md`: `make e2e` ikkala ilova uchun. Dizayn hujjatiga "7-bosqich qarorlari" yoziladi.
- [ ] Tekshiruvlar:
  - `make lint`, `make test`, `make e2e`, keshsiz `go test`;
  - `start.sh` bilan haqiqiy stack (Playwright skripti, 375px): admin API orqali user va company'lar → SMS kodi log'dan → login → select → dashboard → expired → almashtirish → reload → logout.
- [ ] `git push origin main`, hisobot.
