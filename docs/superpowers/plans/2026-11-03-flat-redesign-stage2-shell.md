# Tekis qayta dizayn, 2-bosqich: qobiq, «Sozlama», profil, kirish — reja

> **Bajaruvchiga:** superpowers:executing-plans bilan, shu sessiyada. Qadamlar `- [ ]` bilan.

**Maqsad:** user app'ning qobig'i prototipniki bo'ladi: webda chap chetga yopishgan 224px sidebar (brend, kompaniya bloki, bo'limlar va ichki bandlar, pastda obuna va «Chiqish»), 52px tepa panel («Orqaga», lokatsiya menyusi, qo'ng'iroqcha), 1080px kontent; telefonda hamma sahifada suzuvchi tab-bar («Sozlama» tishli g'ildirak bilan); «Sozlama» sahifasi, profil va kirish sahifasi prototipdagidek.

**Arxitektura:** `shell/*` komponentlari qayta yoziladi, `AppShell` ning tuzilishi o'zgaradi (sidebar | tepa panel + main). Belgilar lucide (`lib/nav.ts` dagi `icon` va sahifalar uchun yangi xarita). Lokatsiya va qo'ng'iroqcha Base UI `Menu`. Mavzu tanlovi va chiqish profil/sidebar'ga ko'chadi.

Spec: `docs/superpowers/specs/2026-11-03-flat-redesign-design.md` (5-bo'lim).

## Vazifalar

- [x] 1. Sahifa belgilari lucide: `kit/tab-icons.tsx` `pageIcons` (HouseIcon, ContactIcon, ListTodoIcon, PackageIcon, WrenchIcon, ShoppingCartIcon, WarehouseIcon, PackagePlusIcon, TruckIcon, ArrowLeftRightIcon, ClipboardCheckIcon, PackageOpenIcon, WalletIcon, ArrowDownLeftIcon, Repeat2Icon, UsersIcon, SettingsIcon).
- [x] 2. `shell/sidebar.tsx`: 224px, `bg-sidebar`, o'ng chiziq; brend (`BrandMark` teal + «Hisob24»), yig'ish; kompaniya bloki → `/profile` (avatar, kompaniya, «Ism · Rol»); bo'limlar 32px (joriysi oq, halqali, belgisi urg'u), joriy tabli bo'limning ichki bandlari; pastda «Obuna D-oy gacha faol» va «Chiqish» (so'raydi).
- [x] 3. `shell/top-bar.tsx`: 52px statik panel, ostida chiziq; «← Orqaga»; o'ngda `LocationMenu` (pill, menyu, `menuitemradio`) va qo'ng'iroqcha (`Menu`: «Bildirishnomalar hozircha yo'q»). Mavzu va chiqish tugmalari olib tashlanadi.
- [x] 4. `shell/app-shell.tsx`: webda sidebar | (tepa panel + main `px-6 pt-5 pb-10`, ustun 1080px); telefonda main `px-4 pt-safe-2 pb-bar` (har doim).
- [x] 5. `shell/tab-bar.tsx`: hamma sahifada; prototip o'lchamlari; 5-tugma «Sozlama» (`SettingsIcon`).
- [x] 6. `/settings` («Sozlama» / «Sozlamalar»): telefonda kompaniya qatori, «Bo'limlar» (panelda yo'qlari), «Sozlamalar» (+ «Pastki panel»); webda faqat sozlamalar ro'yxati va izoh.
- [x] 7. `/profile`: avatar, ism, «telefon · rol»; «Kompaniya» (nom, obuna, almashtirish); «Lokatsiya» (radio); «Mavzu» (Tizim / Yorug' / Qorong'i, brauzerda); «Chiqish» yoki Telegram izohi.
- [x] 8. `/login`: `LoginFrame` prototipdagi karta (webda 820px ikki ustun, telefonda bitta); kod maydoni.
- [x] 9. e2e yordamchilari va spec'lar yangi qobiqqa (lokatsiya menyusi tepa panelda, «Sozlama», chiqish sidebar'da).
- [ ] 10. Skrinshot tekshiruvi, `make lint`, `make test`, `make e2e`, push.
