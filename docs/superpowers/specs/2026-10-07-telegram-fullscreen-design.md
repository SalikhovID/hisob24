# Telegram Mini App to'liq ekranda — dizayn

Sana: 2026-10-07. Holat: foydalanuvchi suhbatda tasdiqlagan ("boshla"); amalga oshirilgan va 2026-10-07 da production'ga chiqarilgan (pastda "Qarorlar" va "Production'ga deploy"). Reja: `docs/superpowers/plans/2026-10-07-telegram-fullscreen.md`.

## Kontekst

Foydalanuvchining so'zi: "telegram mini app to'liq full ekran qilib ochadigan qilib qo'ysak bo'ladimi?"

Hozir user app Mini App sifatida `expand()` bilan Telegram sarlavhasi ostida to'liq balandlikda ochiladi (2026-10-06 tab-bar ishi: `--tg-viewport-stable-height`, `pb-safe`, `disableVerticalSwipes`; `docs/superpowers/specs/2026-10-06-roles-bottom-nav-design.md`). Bot API 8.0 (2024-noyabr) `WebApp.requestFullscreen()` beradi: Telegram sarlavhasi yo'qoladi, app butun ekranni, status bar ostini ham, egallaydi; Telegram o'z boshqaruv tugmalarini (yopish, "⋯") yuqori o'ngda suzuvchi panel qilib ko'rsatadi.

`telegram-web-app.js` (2026-10-07 da o'qildi):

- `requestFullscreen` client 8.0 dan past bo'lsa `console.error` + `throw Error("WebAppMethodUnsupported")`; `disableVerticalSwipes` esa shunchaki bayroq qo'yadi. Shuning uchun versiya tekshiruvi shart.
- Skript `--tg-safe-area-inset-{top,bottom,left,right}` (qurilma: status bar, notch, home indicator) va `--tg-content-safe-area-inset-*` (Telegram'ning o'z elementlari: full ekrandagi tugmalar paneli) o'zgaruvchilarini `<html>` ga o'zi yozadi va `safeAreaChanged` / `contentSafeAreaChanged` da yangilaydi. Oddiy rejimda yuqoridagilar 0: status bar ham, sarlavha ham webview'dan tashqarida. Full ekrandan chiqilsa yana 0.
- `isFullscreen`, `fullscreenChanged`, `fullscreenFailed` (`UNSUPPORTED`, `ALREADY_FULLSCREEN`) bor; full ekran holati `sessionStorage` da saqlanadi (reload'da qoladi).

## Qarorlar

| # | Savol | Qaror |
|---|---|---|
| 1 | Qayerda so'raladi | Faqat telefon client'larida: `platform` `ios` yoki `android` bilan boshlanadi. Desktop va web Telegram'da full ekran butun oyna yoki monitor bo'ladi, so'ralmaydi |
| 2 | Qaysi app | Faqat user app (`apps/web`). Admin Mini App o'zgarmaydi |
| 3 | Eski client | `isVersionAtLeast("8.0")` yolg'on bo'lsa so'ralmaydi (aks holda `throw`); hozirgidek sarlavha ostida ochiladi |
| 4 | Yuqori chetlar | Faqat CSS, JS tinglovchisiz: `--safe-top` = `max(env(safe-area-inset-top), --tg-safe-area-inset-top + --tg-content-safe-area-inset-top)`; `pt-safe` (faqat chet) va `pt-safe-*` (chet + spacing) utility'lari, `pb-safe` yonida |
| 5 | Qayerga padding | App qobig'i (`AppShell`: topbar chet ostidan boshlanadi), `LoginFrame` paneli, `Centered` (Telegram login ekranlari), `SelectCompany`, `Expired` va toastlar (`Toaster` `offset`/`mobileOffset` ga `--safe-top` qo'shiladi) |
| 6 | Telegram `BackButton` | Ishlatilmaydi: sahifalarda o'z "orqaga" havolalari bor, Telegram'ning "⋯" menyusida yopish va full ekrandan chiqish bor |
| 7 | Qayta so'rash | Faqat ochilganda bir marta; foydalanuvchi "⋯" dan chiqsa, qayta so'ralmaydi, chetlar 0 ga tushadi va app sarlavha ostida ishlayveradi |
| 8 | `fullscreenFailed` | Alohida ishlov yo'q: so'rov rad etilsa o'zgaruvchilar 0 ligicha qoladi, app hozirgidek |

### Rad etilgan variantlar

- Hamma platformada full ekran: desktopda butun oyna yoki ekran, noqulay.
- `fullscreenChanged` / `safeAreaChanged` ni JS'da tinglab `<html data-fullscreen>` qo'yish: CSS o'zgaruvchilar yetarli, qo'shimcha holat kerak emas.
- Chetni faqat Telegram'da hisoblash: `env(safe-area-inset-top)` brauzer tab'ida 0, `max()` bilan qo'shib olish zarar qilmaydi va `pb-safe` bilan bir xil ko'rinishda.
- `lockOrientation()`: so'ralmagan, landshaftda chap/o'ng chetlar ham 0 emas, lekin tab-bar va qobiq to'liq enda, hozircha muammo ko'rinmadi.

## O'zgarishlar

| Fayl | O'zgarish |
|---|---|
| `types/telegram.d.ts` | `isVersionAtLeast?`, `requestFullscreen?`, `exitFullscreen?`, `isFullscreen?` |
| `components/telegram-sync.tsx` | `expand()` dan keyin: telefon va 8.0+ bo'lsa `requestFullscreen()` |
| `app/globals.css` | `:root { --safe-top }`, `@utility pt-safe`, `@utility pt-safe-*` |
| `components/shell/app-shell.tsx` | qobiqqa `pt-safe` |
| `components/login/login-frame.tsx` | panel `pt-10` → `pt-safe-10` |
| `components/login/telegram-login.tsx` | `Centered` `p-4` → `px-4 pb-4 pt-safe-4` |
| `components/expired.tsx`, `components/select-company.tsx` | `p-4` / `p-4 pt-10` → `px-4 pb-4 pt-safe-4` / `pt-safe-10` |
| `components/providers.tsx` | `Toaster offset={{ top: "calc(24px + var(--safe-top))" }} mobileOffset={{ top: "calc(16px + var(--safe-top))" }}` |
| `e2e/miniapp.spec.ts` | soxta Telegram: `isVersionAtLeast`, `requestFullscreen` (chetlarni 47px va 46px qilib yozadi, `fullscreenChanged` beradi), `platform` parametri; full ekran va desktop client ssenariylari |
| `README.md` | Mini App bandiga full ekran qatori |

## Testlar

- Vitest `components/telegram-sync.test.tsx`: telefon + 8.0 → `requestFullscreen` chaqiriladi; `tdesktop` → chaqirilmaydi; eski client (`isVersionAtLeast` yolg'on) → chaqirilmaydi.
- e2e `miniapp.spec.ts` (375 va 1280, soxta Telegram): full ekranda topbar status bar va Telegram tugmalari ostidan boshlanadi (y ≥ 93); login fallback paneli ham; `tdesktop` client'da so'ralmaydi va topbar yuqorida.
- Haqiqiy qurilmada tekshiruv foydalanuvchiniki: lokalda bot tokeni yo'q.

## Deploy

Frontend-only, `deploy/ship.sh`, oldingi tartib (pre-deploy dump, probe oldin/keyin). Yangi probe: qobiq chunk'larida `requestFullscreen` bor (eski build'da yo'q).

## Qarorlar (2026-10-07)

Bajarildi: `types/telegram.d.ts`, `components/telegram-sync.tsx` (`onPhone`, `isVersionAtLeast("8.0")`), `app/globals.css` (`--safe-top`, `pt-safe`, `pt-safe-*`), `AppShell` (`pt-safe`), `LoginFrame` (`pt-safe-10`, `lg:pt-safe-12`), `Centered`, `Expired`, `SelectCompany`, `components/ui/sonner.tsx` (`offset`, `mobileOffset`), e2e `miniapp.spec.ts`, README. Commitlar `5361082` … `40bb737`, test tuzatishi `ed8005d`.

Amalga oshirishda belgilangan tafsilotlar:

- **`pt-safe-*`** Tailwind v4 funksional utility: `padding-top: calc(--spacing(--value(integer)) + var(--safe-top))`; `lg:pt-safe-12` kabi variantlar bilan ishlaydi. `LoginFrame` panelida `lg:p-12` dan keyin `lg:pt-safe-12` turadi: katta ekranda ham (planshetdagi Telegram) chet hisobga olinadi.
- **Toast offset'i** `Toaster` wrapper'ida (`components/ui/sonner.tsx`), `Providers` da emas: test render helper'i ham shu wrapper'ni ishlatadi. sonner `ol[data-sonner-toaster]` ni faqat toast bo'lganda chizadi, test avval `toast()` chaqiradi; offsetlar inline `--offset-top` / `--mobile-offset-top` da.
- **Soxta Telegram** (`e2e/miniapp.spec.ts`): `requestFullscreen` chetlarni 47px + 46px qilib yozadi, `window.__fullscreen` belgisini qo'yadi; `fakeTelegram(id, platform)` bilan desktop client ssenariysi. Tekshiruvlar hisoblangan `padding-top` (93, 109, 133/141 px) va topbar'ning `y` koordinatasi bilan.
- Full ekran holati JS'da saqlanmaydi, `fullscreenChanged` va `fullscreenFailed` tinglanmaydi (4 va 8-qarorlar); eski client va desktop testlari `requestFullscreen` chaqirilmasligini tekshiradi.
- **Yo'l-yo'lakay tuzatilgan test** (`tasks-page.test.tsx`): bajarilgan vazifaning muddati `getByText(sana)` bilan topilardi; 2026-10-07 da `today − 5` = 02.10.2026 fixture'dagi "Qo'shilgan" 02.10.2026 bilan ustma-ust tushdi ("Found multiple elements"). Endi `[data-slot=deadline]` bilan topiladi; kod o'zgarmadi.
- **Tekshiruv:** `make lint` 0 issues; `make test`: Go 19 paket, api-client 1, admin 228, web 579 (4 yangi: 3 `telegram-sync`, 1 `sonner`); `make e2e`: admin 40, web 94 (yangi desktop Telegram ssenariysi ikki project'da, 3 mavjud Mini App testi chet tekshiruvlari bilan).
- Haqiqiy qurilmada tekshirilmadi (lokal bot tokeni yo'q): foydalanuvchi production'da sinaydi.

## Production'ga deploy (2026-10-07)

`deploy/ship.sh` bilan `9b4df34` yuborildi (01:40–01:42 Toshkent, exit 0): `next` image qayta build (api image qatlamlari keshdan, konteyner qayta ko'tarildi), migratsiya yo'q (goose 9), api/admin/web `--wait` bilan healthy. Oldingi daraxt: `/var/www/hisob24-v2.prev`. Pre-deploy dump: `/var/backups/hisob24-v2/hisob24-pre-fullscreen-20261006-2239.sql.gz` (25 jadval, gzip tekshirilgan).

Tekshiruvlar (sessiyasiz, hech narsa yozilmadi, SMS yuborilmadi):

- Lokal pre-flight: daraxt toza va push qilingan; toza `git archive HEAD` nusxasidan `go build`, `go vet` va ikkala Next build (exit 0). Yangi env kaliti yo'q.
- Server pre-flight (read-only): konteynerlar healthy, deploy jarayoni yo'q, goose 9, satrlar: companies 1, users 2, user_companies 2, customers 2, customer_types 3, customer_dropdowns 1, tasks 1, task_stages 5, task_types 2, refresh_tokens 46, roles 0; API log ERROR/WARN 0.
- Probe (30 ta): oldin 29/30, keyin 30/30. Yangi tekshiruv: qobiq chunk'larida `requestFullscreen` bor, eski build'da yo'q edi — yangi build jonli ekanining isboti. Qolganlari rollar deploy'idagi 29 ta: sahifalar placeholder cookie bilan 200, API route'lar 401, noma'lum 404, chunk matnlari, webhook'lar sekretsiz 401, ikonlar.
- Serverda: goose 9, satrlar o'zgarmagan; `.env` `.prev` bilan bir xil; restart 0; API log ERROR/WARN 0, web/admin log xatosi 0; dangling image 0; server daraxtining sha256 si (`.env` dan tashqari, 686 fayl) `git archive HEAD` bilan bir xil (`076ef157…`).
- Haqiqiy telefonda tekshirilmadi: foydalanuvchi Telegram'da (iOS yoki Android, Bot API 8.0+) Mini App'ni ochib sinaydi: sarlavha yo'q, topbar status bar va "⋯" tugmalari ostidan boshlanadi; login va boshqa ekranlarda ham.
