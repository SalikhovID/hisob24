# Mini App UI, 2-bosqich: qobiq, profil, kirish ekranlari — reja

> Spec: `docs/superpowers/specs/2026-10-13-mini-app-ui-design.md`. Har vazifa TDD: test (RED, to'g'ri sabab bilan) → kod (GREEN) → commit. Bosqich oxirida `make lint`, `make test`, `make e2e`, push, hisobot.

**Maqsad:** prototipning qobig'i: suzuvchi shisha tab-bar, prototip uslubidagi sidebar, topbar o'rnida bosh sahifadagi profil tugmasi va lokatsiya pill'i, profil va menyu tartibi sahifalari, ombor hub'i, ichki sahifalarda «‹ Orqaga» va Telegram BackButton, bosh ekranga qo'shish banneri, kirish va holat ekranlari.

## Qarorlar (amalga oshirishda belgilangan)

1. **Bosh sahifa doim birinchi.** Prototipda «Hisob24» tabi qulflangan, qolgan bo'limlar a'zo tartibida. `navFor` bosh sahifani doim boshiga qo'yadi (`nav_order` dagi `home` o'rni e'tiborga olinmaydi). Sidebar ham shunday. Talab o'zgardi: `nav.test`, `tab-bar.test`, `sidebar.test` dagi «o'z tartibi» testlari bosh sahifani birinchi kutadi.
2. **Tab-bar: bosh sahifa + birinchi 4 bo'lim**, qolganlari profil sahifasidagi «Bo'limlar» guruhida («Yana» yo'q). `barItems` → `{ shown, more }`, `shown` = bosh sahifa + 4.
3. **Tab yorlig'i «Bosh sahifa»** (prototipda «Hisob24»): sidebar va ekran o'quvchi uni shunday ataydi, «24» belgisi brendni aytadi.
4. **Ildiz sahifalar** (`rootPaths`): `/`, har bo'limning manzili, segmentli bo'limlarning tablari (`/products`, `/services`; `/accounts`, `/expenses`, `/money-transfers`), ombor hub'i `/warehouse`. Tab-bar faqat ildiz sahifada ko'rinadi (prototipda ichki ekranda yashirinadi); ichki sahifada (yozuv, forma, `/profile`, ombor hujjatlari) Telegram BackButton ko'rinadi. Profil sahifasidagi bo'limlar (Xodimlar, Sozlamalar) ham ildiz: bar ko'rinadi, joriy tab belgilanmaydi (o'lik nuqta bo'lmasin).
5. **Ombor hub'i** `/warehouse`: `NavItem.hub`; ombor menyuda shu manzilga ochiladi, tablari `isCurrentItem` uchun qoladi. Ombor sahifalaridagi `SectionTabs` o'rnida «‹ Ombor» orqaga havolasi.
6. **`PageHeader`** API'si o'zgarmaydi, ko'rinishi prototipniki (`BackLink`, 30px sarlavha): eski sahifalar shu bosqichdayoq yangi uslubda.
7. **Bosh sahifaning `h1`** — «Salom, {ism}» qoladi, lekin ko'zga ko'rinmas (`sr-only`): ekran o'quvchi uchun sahifa sarlavhasi; ko'zga prototipdagi profil tugmasi («Olma Savdo», «Ali V. · Egasi»). E2E'dagi 51 ta «Salom, …» kutishi o'zgarmaydi.
8. **Tezkor plitkalar va hero** 3-bosqichga (dashboard bilan birga): «To'lov» summa varag'i va ta'minotchi tanlovini talab qiladi.
9. **Mavzu tanlovi** profil sahifasida (Tizim / Yorug' / Qorong'i, action sheet), Telegram'da yo'q. `ThemeToggle` o'chiriladi.
10. **Telegram BackButton:** `TelegramSync` yo'l ildiz emasligida `BackButton.show()`, aks holda `hide()`; bosilganda tarix bo'lsa `router.back()`, bo'lmasa bo'lim ildiziga.
11. **Bosh ekranga qo'shish:** Bot API 8.0+ va `checkHomeScreenStatus` ≠ `added`/`unsupported` bo'lsa bosh sahifada banner va profilda karta; yopilgani brauzerda (`home_banner_hidden`).

## Vazifalar

1. `lib/nav.ts`: `hub`, `rootPaths`, `isRootPath`, `sectionRootOf`; bosh sahifa birinchi; `barItems` (bosh + 4). Testlar: `nav.test.ts`.
2. `components/shell/tab-bar.tsx` qayta yoziladi: suzuvchi shisha panel, linza, to'ldirilgan ikonkalar, ildizda ko'rinadi. Testlar: `tab-bar.test.tsx`.
3. `components/shell/location-switcher.tsx`: pill + `ActionSheet`. Testlar: `location-switcher.test.tsx` (topbar o'rniga o'zi).
4. `components/shell/sidebar.tsx`: prototip qatorlari, pastda profil qatori va lokatsiya. Testlar: `sidebar.test.tsx`.
5. `components/shell/app-shell.tsx`: topbar'siz, `pb-bar`, `Topbar`/`MoreSheet`/`NavOrderDialog`/`ThemeToggle` o'chiriladi (testlari bilan). Testlar: `app-shell.test.tsx`.
6. `components/profile/profile-page.tsx` + `app/(app)/profile/page.tsx`. Testlar: `profile-page.test.tsx`.
7. `components/profile/menu-order-page.tsx` + `app/(app)/profile/menu/page.tsx`. Testlar: `menu-order-page.test.tsx`.
8. `components/warehouse/warehouse-hub.tsx` + `app/(app)/warehouse/page.tsx`; ombor sahifalarida `BackLink`. Testlar: `warehouse-hub.test.tsx`, ombor sahifa testlari.
9. `components/page-header.tsx`: prototip ko'rinishi. Testlar: `page-header.test.tsx` (o'zgarmaydi).
10. `components/telegram-sync.tsx`, `types/telegram.d.ts`: BackButton. Testlar: `telegram-sync.test.tsx`.
11. `components/dashboard.tsx`: profil tugmasi, lokatsiya pill'i, banner, «Bo'limlar» havolalari, obuna izohi. `lib/home-screen.ts` (banner holati). Testlar: `dashboard.test.tsx`, `home-screen.test.ts`.
12. Kirish: `login/*` (MainButton, StateScreen, Splash), `select-company.tsx`, `expired.tsx`. Testlar: mavjudlari.
13. E2E: `helpers.ts` (`openSection` profil orqali), `shell.spec.ts`, `miniapp.spec.ts`, `login.spec.ts` va «Salom» kutgan spec'lar.
14. Hujjatlar: `logic/roles.md` 8-bo'lim (menyu: bosh sahifa qulflangan, bar = bosh + 4, qolgani profilda, tartib sahifasi), spec'ga 2-bosqich qarorlari.
