# User app'ning tekis qayta dizayni: web va Telegram mini app — dizayn

Sana: 2026-11-03. Holat: foydalanuvchi tasdiqlagan (sakkiz savol-javob, keyin `/goal barchasini ketma-ket bajar`). Har bosqichga alohida reja: `docs/superpowers/plans/2026-11-03-flat-redesign-stage<N>-*.md`. Faqat user app (`apps/web`) va uning API'si; admin panel o'zgarmaydi.

> Bu hujjat `2026-10-13-mini-app-ui-design.md`, `2026-10-16-liquid-glass-design.md` va `2026-10-16-glass-v2-design.md` dagi ko'rinish qoidalarining o'rnini bosadi: shisha yuzalar, ambient fon, glossy tugmalar, muzlagan skrim, konturli tab belgilari va desktopdagi «telefon UI'si sidebar bilan» endi yo'q. O'sha hujjatlardagi xatti-harakat qoidalari (pastki panel mantig'i, BackButton, to'liq ekran, sahifa o'tishlari, `/settings` hammaga) shu hujjatda alohida aytilmagan bo'lsa amalda qoladi.

## Kontekst

Foydalanuvchining so'zlari: "UI ni redizayn qilib ber: https://claude.ai/artifact/5GQJ3Uwvfhmhhev95GbVUi".

Havola yangi artifakt: `228b1108-166d-4b79-9c9a-52c5906c7d77`, «Hisob24 — to'liq prototip (web + Telegram mini app)», versiya `1793705201`. U Vite + React ilovasi (bitta HTML, 397 qator, 602K belgi; lucide belgilari, `stageshow` ramkasi) va mock ma'lumotlar bilan butun user app'ni chizadi: bosh sahifa, mijozlar, buyurtmalar (kanban va ro'yxat), mahsulotlar va xizmatlar, sotuv, ombor (qoldiq, xaridlar, ko'chirishlar, inventarizatsiya, boshlang'ich qoldiq, ta'minotchilar), moliya (kassa, xarajatlar, o'tkazmalar), xodimlar, sozlamalar (mijoz va buyurtma turlari, bosqichlar, dropdownlar, valyuta kurslari, moliya kategoriyalari, rollar, pastki panel), profil, kirish. Ko'rinish ikkita, prototip tepasidagi tugma bilan almashadi:

1. **Web** (`#web`, `app.hisob24.uz` brauzer oynasi ichida): klassik SaaS. 13px asos, 224px sidebar (`#f4f5f8`) bo'limlar va faol bo'limning ichki bandlari bilan, tepa panel («Orqaga», lokatsiya menyusi, qo'ng'iroqcha), oq kontent 1080px gacha, ro'yxatlar jadval, kartalar ingichka halqali, dialoglar o'rtada (480px), forma maydonlari yorliq ostida.
2. **Telegram mini app** (`#tg`, iPhone ramkasida): iOS guruhli ro'yxatlar. 17px qatorlar, 32px katta sarlavha, `#f2f2f7` fon, oq guruhlar, suzuvchi tab-bar (4 ta sahifa va «Sozlama»), pastdan chiqadigan varaqlar, katta to'liq tugmalar.

Rang teal: yorug'da `#17595f`, qorong'ida `#5cc4bc`. Shisha yo'q: tekis yuzalar, ingichka chiziqlar, mayda soyalar; faqat tab-bar muzlagan.

Bu `docs/SPEC.md` da yo'q ish, foydalanuvchi so'rovi bilan. SPEC 7-bo'limdagi «shadcn standart uslubida» talabidan avvalgidek ataylab chetlaniladi.

## Foydalanuvchi qarorlari (2026-11-03)

| # | Savol | Qaror |
|---|---|---|
| 1 | Prototipda ko'rinmagan hozirgi funksiyalar (mijoz sahifasidagi «To'lov», «Buyurtma», «Qo'ng'iroq»; «Tizim» mavzusi; sidebar'ni yig'ish va boshqalar) | **Saqlanadi**, prototip uslubida joylanadi. |
| 2 | Bosh sahifa | **Prototip bloklari, chegara 3.** «Kassadagi pul», «Faol buyurtmalar», «Mijozlar qarzi», oylik sotuvlar, «Kam qolgan tovarlar» (joriy lokatsiyada qoldig'i ≤ 3), 5 ta tezkor tugma; `GET /app/dashboard` kengayadi. Mahsulotga alohida chegara yo'q. |
| 3 | Telegram rejimi | **To'liq ekran qoladi** (2026-10-07). Telegram ichida sahifadagi «‹ …» havolasi yashiriladi, `BackButton` qoladi. |
| 4 | Bildirishnoma qo'ng'irog'i | **Faqat belgi:** tepa panelda qo'ng'iroqcha, bosilganda «Bildirishnomalar hozircha yo'q» menyusi. |
| 5 | Tab-bar ichki sahifalarda | **Doim ko'rinadi** (prototipdagidek). |
| 6 | «Pastki panel» sozlamasi | **Hozirgi mantiq, yangi ko'rinish** (doim to'la, tartib a'zoniki, ichki sahifalar ham; 10-16 dagi 8-qaror). |
| 7 | Telefondagi buyurtmalar | **Bosqich chiplari + tik ro'yxat**, kartadagi «⋯» (bosqich tanlash) saqlanadi; telefonda sudrash yo'q, desktopda kanban sudrash bilan. |
| 8 | Ombordagi «Qoldiq» tabi | **Qo'shiladi, qiymati bilan:** yangi `GET /app/stock/summary`. |

Yondashuv (taklif qilingan uchtadan tavsiya etilgani): **joriy kit'ni joyida qayta uslublash va bo'limma-bo'lim ko'chirish.** Tokenlar va `components/kit` prototipga moslanadi, `md:` variantlari web ko'rinishini beradi, yangi umumiy bo'laklar (jadval, stat kartalar, tablar, split, «Jami» paneli) qo'shiladi, sahifalar bosqichma-bosqich ko'chadi.

### Rad etilgan variantlar

- Parallel yangi kit va sahifalarni birma-bir almashtirish: ikki kit bir necha bosqich yonma-yon yashaydi, diff va testlar ikki baravar.
- Prototip CSS klasslarini (`.pg`, `.grp`, `.tbl`…) `globals.css` ga ko'chirish: Tailwind va kit konvensiyasi buziladi, custom klass va Tailwind klass tartibi ziddiyati (shisha ishidagi tajriba).
- Prototipdagidek oddiy (to'liq ekransiz) Telegram rejimi; ishlamaydigan qo'ng'iroqchani umuman qo'shmaslik; tab-bar'ni ichki sahifada yashirish; «Pastki panel» kalitlari (0–4, menyu tartibi); telefonda gorizontal kanban; «Qoldiq» tabisiz ombor yoki qiymatsiz qoldiq.

## Avvalgi qarorlardan chetlanishlar

| # | Avvalgi qaror | Yangi | Sabab |
|---|---|---|---|
| 1 | 2026-10-13, 1-qaror: desktopda ham telefon UI'si, jadval yo'q | 768px dan web ko'rinishi: jadvallar, zich qatorlar, o'rtadagi dialoglar | prototip |
| 2 | 2026-10-13, 5-qaror: matn 17/15/14/13px hamma enda | telefonda 17px asos, 768px dan 13px asos | prototip |
| 3 | 2026-10-16 (liquid glass, glass v2): shisha yuzalar, ambient fon, glossy tugmalar, konturli tab belgilari, oq/qora urg'u | tekis yuzalar, teal urg'u, lucide belgilari | prototip |
| 4 | 2026-10-18: modal ortida muzlagan skrim (`blur(12px)`) | oddiy xira skrim, blur'siz | prototip |
| 5 | 2026-10-16, 3-qaror: lokatsiya tanlovi sidebar'da; mavzu va chiqish tepa panelda | lokatsiya tepa panelda (menyu); mavzu profilda; «Chiqish» sidebar pastida | prototip |
| 6 | 2026-10-13: tab-bar ichki sahifada yashirinadi | doim ko'rinadi | 5-qaror |
| 7 | 2026-10-13, 3-qaror: ombor hub sahifasi | Ombor tablari, birinchisi yangi «Qoldiq» (`/warehouse`) | prototip, 8-qaror |
| 8 | 2026-10-13: telefonda kanban ustunlari va sudrash | bosqich chiplari, tik ro'yxat, «⋯» | 7-qaror |
| 9 | 2026-10-16: tab-bar'ning 5-tugmasi «Sozlamalar» (slayder belgisi) | «Sozlama» (tishli g'ildirak), sahifa sarlavhasi telefonda «Sozlama» | prototip |
| 10 | 2026-10-13: forma qatori «yorliq chapda, maydon o'ngda» (`FormRow`), summa klaviaturasi (`AmountSheet`), kun bo'yicha guruhlangan hujjatlar, sudrab tartiblash | yorliq maydon ustida; summa oddiy maydonda (`inputMode="decimal"`); hujjat ro'yxati kun guruhisiz (sana qatorda); tartib ↑ / ↓ tugmalari | prototip |
| 11 | 2026-10-13: sozlamalar ro'yxati → alohida sahifa → varaq | turlar, dropdownlar, rollar: ro'yxat va tafsilot bitta sahifada (desktopda yonma-yon); bosqichlar joyida tahrirlanadi | prototip |
| 12 | Dashboard: `suppliers`, `customers`, `purchases`, `orders_money` bloklari | `cash`, `debtors`, `low_stock`; eski to'rtta blok olib tashlanadi | 2-qaror |
| 13 | 2026-10-04 (logo): qora `--brand` | teal `#174449` belgisi | prototip |

### Prototipdan ataylab chetlanishlar

- 1-qaror bo'yicha saqlanadi: mijoz sahifasidagi «To'lov», «Buyurtma», «Qo'ng'iroq» (`tel:`) amallari; «Tizim» mavzusi; sidebar'ni yig'ish; sahifa o'tishlari (`PageTransition`); «Bosh ekranga qo'shish» banneri; `Pager` (API sahifalaydi); buyurtma tovarlarining foydasi; xodim nomini o'zgartirish, rol va lokatsiyalar; turlarni qayta nomlash; kassa boshlang'ich qoldig'i; buyurtma va mijoz filtrlari; telefondagi bosh sahifada lokatsiyani tez almashtirish (sarlavha ostidagi «… · Asosiy ▾»).
- «Bosh sahifa» nomi (10-16, 4-qaror) va «H24» belgisi qoladi.
- Prototip Telegram sarlavhasini («Hisob24 · mini ilova») chizadi: ilova uni chizmaydi, to'liq ekranda Telegram'ning suzuvchi tugmalari turadi (3-qaror).
- Telefon brauzerida (Telegram'dan tashqari) sahifadagi «‹ …» havolasi qoladi: u yerda Telegram tugmasi yo'q.
- Qo'ng'iroqcha faqat belgi (4-qaror).
- «Kam qolgan tovarlar»: faqat joriy lokatsiyada kamida bitta harakati bo'lgan faol mahsulotlar sanaladi (prototip hamma mahsulotni sanaydi; boshqa lokatsiyada saqlanadigan mahsulot bu yerda «kam» bo'lib chiqmasin). Qoida `logic/warehouse.md` ga yoziladi.

## Dizayn

### 1. Ikki ko'rinish

- **Telefon** (`< 768px`, Telegram mini app ham): prototipning `#tg` ko'rinishi.
- **Web** (`≥ 768px`): prototipning `#web` ko'rinishi. Telegram Desktop'ning keng oynasi ham shu.
- Almashish faqat CSS'da (`md:` va `@media (min-width: 768px)`): JS'da en o'lchanmaydi, server va client bir xil HTML beradi. Tuzilishi farq qiladigan joyda (jadval / qatorlar, kanban / chiplar) ikkalasi chiziladi, biri yashiriladi (`hidden md:block` / `md:hidden`).
- Tokenlar va o'lchamlar CSS o'zgaruvchilari: telefon qiymati asosiy, `768px` dan web qiymati.

### 2. Tokenlar (`apps/web/app/globals.css`)

shadcn nomlari saqlanadi (mavjud `bg-card`, `text-muted-foreground` klasslari ishlayveradi), qiymatlar prototipniki.

| Token | Telefon, yorug' | Web, yorug' | Telefon, qorong'i | Web, qorong'i |
|---|---|---|---|---|
| `--background` (sahifa) | `#f2f2f7` | `#ffffff` | `#000000` | `#1a1a1d` |
| `--sidebar` (sidebar, kanban foni) | — | `#f4f5f8` | — | `#111113` |
| `--card` (guruh, karta) | `#ffffff` | `#ffffff` | `#1c1c1e` | `#1a1a1d` |
| `--popover`, `--raised` (menyu, dialog) | `#ffffff` | `#ffffff` | `#1c1c1e` | `#26262a` |
| `--field` (maydon) | `#ffffff` | `#ffffff` | `#2c2c2e` | `#26262a` |
| `--sheet` (telefon varag'i foni) | `#f2f2f7` | — | `#000000` | — |
| `--foreground` | `#17181b` | `#17181b` | `#ececee` | `#ececee` |
| `--muted-foreground` | `#6b6e76` | `#6b6e76` | `#9d9da1` | `#9d9da1` |
| `--faint` | `#9a9da4` | `#9a9da4` | `#6c6c70` | `#6c6c70` |
| `--icon` / `--icon-faint` | `#6b6e76` / `#c4c4c7` | o'sha | `#9a9aa0` / `#4a4a50` | o'sha |
| `--primary` (urg'u) | `#17595f` | `#17595f` | `#5cc4bc` | `#5cc4bc` |
| `--primary-foreground` | `#ffffff` | `#ffffff` | `#062a2c` | `#062a2c` |
| `--primary-soft` | `rgba(23,89,95,.1)` | o'sha | `rgba(92,196,188,.16)` | o'sha |
| `--accent-text` (havola, faol band) | `color-mix(#17595f 82%, #000)` | o'sha | `color-mix(#5cc4bc 70%, #fff)` | o'sha |
| `--border` (`--line`) / `--line-faint` | `rgba(0,0,0,.06)` / `.04` | o'sha | `rgba(255,255,255,.08)` / `.05` | o'sha |
| `--ink-1` … `--ink-5` (bosilish, trek, halqa) | `rgba(0,0,0,.04/.06/.08/.1/.15)` | o'sha | `rgba(255,255,255,.05/.07/.1/.13/.2)` | o'sha |
| `--separator` (telefon qatorlari) | `rgba(60,60,67,.18)` | — | `rgba(84,84,88,.6)` | — |
| `--positive` / `--positive-soft` | `#1d6e43` / `rgba(35,128,78,.12)` | o'sha | `#4cc583` / `rgba(34,197,94,.16)` | o'sha |
| `--destructive` / `--destructive-soft` | `#b42a22` / `rgba(239,68,68,.1)` | o'sha | `#f87171` / `rgba(239,68,68,.16)` | o'sha |
| `--warning` / `--warning-soft` | `#b45309` / `rgba(245,158,11,.14)` | o'sha | `#fbbf24` / `rgba(245,158,11,.18)` | o'sha |
| `--scrim` | `rgba(10,12,16,.24)` | o'sha | `rgba(0,0,0,.5)` | o'sha |
| `--switch-on` | `#34c759` | `#17595f` | `#30d158` | `#5cc4bc` |
| `--brand` (logo kvadrati) | `#174449` | o'sha | `#174449` | o'sha |

- Soyalar: `--shadow-card: 0 1px 2px rgba(0,0,0,.04)` (qorong'ida `0 0 0 1px rgba(255,255,255,.05)`); `--shadow-float: 0 0 0 1px rgba(0,0,0,.08), 0 4px 16px rgba(0,0,0,.12), 0 12px 32px rgba(0,0,0,.08)` (menyu, dialog, «Jami» paneli; qorong'ida prototipniki); `--shadow-lift` (kanban kartasi ustida); tab-bar: `0 8px 28px rgba(0,0,0,.12), 0 0 0 .5px rgba(0,0,0,.08)`.
- Radiuslar: web `6 / 8 / 10 / 12px` (`sm` tugma ichidagi, `md` maydon va tugma, `lg` karta, guruh, jadval, `window` dialog); telefon guruh va karta `12px`, maydon `10px`, to'liq tugma `12px`, varaq tepasi `38px`, tab-bar `30px`.
- Shrift: `-apple-system, BlinkMacSystemFont, "SF Pro Text", "Inter", system-ui, "Segoe UI", sans-serif` (Inter `next/font` orqali, Geist o'rniga); raqamlar `tabular-nums`.
- Olib tashlanadi: ambient fon (`bg-ambient`, `--ambient*`), `surface`, `glossy`, `glossy-red`, `glass-chip`, `--sheen`, `--rim`, `--lift`, `--btn*`, `--chip`, `--col`, `--tb-frost` va linza tokenlari, `--art*`, `--ban*`, `--av-*`, `--seg-*`, `--search*`, `--fade`, muzlagan `scrim` utility'si. `lib/telegram.ts` `chromeColors`: Telegram sarlavha va fon rangi yangi `--background` (yorug' `#f2f2f7`, qorong'i `#000`).

### 3. O'lchamlar

| Element | Telefon | Web |
|---|---|---|
| Asos matn | 17px, 1.3 | 13px, 1.4 |
| Sahifa sarlavhasi / izohi | 32px/700, −.01em / 15px | 20px/600 / 13px |
| Guruh sarlavhasi | 13px, `muted`, chapdan 16px | 12px/500, `muted` |
| Qator (sarlavha / izoh) | min 52px, `10px 16px`; 17px/400 / 15px | min 48px, `8px 12px`, radius 8; 13px/500 / 12px |
| Qator ajratgichi | chapdan 16px ichkarida, `--separator` | to'liq, `--line-faint` |
| Kalit — qiymat | 17px, kalit `foreground`, qiymat `muted`, `11px 0` | 13px, kalit `muted`, qiymat `foreground`, `9px 0` |
| Tugma | to'liq 50px, radius 12, 17px/600; oddiy 36px dumaloq belgi | 32px, radius 8, 13px/500; to'liq 40px; kichik 28px |
| Maydon | 44px, radius 10, 17px, `inset 0 0 0 1px --ink-5` (2026-11-11 gacha halqasiz edi); fokus `inset 0 0 0 1.5px` urg'u | 34px, radius 8, 13px, `inset 0 0 0 1px --ink-4`; fokus urg'u + `0 0 0 3px --primary-soft` |
| Yorliq | 13px `muted`, chapdan 4px | 12.5px/500 |
| Chip | 32px, `0 14px`, 15px, halqasiz; tanlangani urg'u fonda oq | 28px, `0 12px`, 12.5px/500, `--ink-4` halqa; tanlangani `foreground` fonda |
| Segmentli tanlov / tablar | trek `rgba(118,118,128,.12)` radius 9; tugma 30–32px, 13px, radius 7 | trek `--ink-2` radius 8; tugma 28px, 12.5px/500, radius 6 |
| Belgi (badge) | 24px, `0 10px`, 13px | 20px, `0 8px`, 11.5px/500; rang nuqtasi 6px |
| Jadval | — | sarlavha 36px, 12px/500 `--faint`; katak 48px, `0 12px` |
| Hero summa / birlik | 34px / 18px `--faint` | 32px/600 / 18px |
| Stat karta qiymati | 17px | 18px/600 |
| Kalit (switch) | 51×31, yashil | 32×18, urg'u |
| Belgilash katagi | dumaloq 22px | kvadrat 16px, radius 4 |
| Toast | pastda, tab-bar ustida (108px), 15px, kapsula | pastda (24px), 13px, radius 10 |
| Tab-bar | 4px ichki, radius 30, belgi 24px, nom 10px/500 | yo'q |

### 4. Komponentlar

Har biri Vitest bilan (RED → GREEN), `data-slot` belgisi bilan; API iloji boricha saqlanadi, ichi o'zgaradi.

| Fayl | Nima |
|---|---|
| `kit/group.tsx` | `Group` (telefonda oq radius 12 halqasiz, webda radius 10 `--line` halqa; `flush`), `Row` (2-jadval o'lchamlari; `lead` / `title` / `sub` / `end` / `endSub` / chevron; `Link` / `button` / `div`; `danger`), `KeyValue`, `SectionHeading` (sarlavha + o'ngda amal yoki havola), `Foot` |
| `kit/page-title.tsx` | `PageTitle` (sarlavha, izoh, o'ngda amallar; telefonda dumaloq urg'u «+» 36px, webda urg'u tugma belgi va matn bilan, masalan «+ Mijoz qo'shish»); `BackLink` (telefon brauzerida «‹ …», Telegram'da va webda yashirin). `BrandMark` sarlavhadan olib tashlanadi |
| `kit/page-actions.tsx` (yangi) | yozuv sahifasining amallari: webda `secondary` tugmalar (belgi + matn) va belgi tugmalari, telefonda dumaloq 36px belgi tugmalari (`aria-label` to'liq matn) |
| `kit/data-table.tsx` (yangi) | `DataTable`: webda `<table>` (ustunlar: `label`, `align`, `width`, `render`; qator bosilsa havola), telefonda `Group` qatorlari (`mobileRow` → `lead`, `title`, `sub`, `end`); `empty` |
| `kit/stat-cards.tsx` (yangi) | `StatCards` (webda 4 yoki 3 ustun, telefonda 2 / 3) va `StatCard` (yorliq, qiymat, izoh, ixtiyoriy bola: bosqich chizig'i; havola) |
| `kit/page-tabs.tsx` (yangi) | `PageTabs`: bo'lim tablari (havolalar: Mahsulotlar/Xizmatlar, Ombor 6 ta, Moliya 3 ta; `role="tablist"`), `InPageTabs`: sahifa ichidagi tablar (holat bilan: mijoz, buyurtma) |
| `kit/toolbar.tsx` (yangi) | qidiruv chapda, chiplar yoki kalit o'ngda; telefonda ustma-ust |
| `kit/split.tsx` (yangi) | webda `280px 1fr`, telefonda ustma-ust (sozlamalar) |
| `kit/sum-bar.tsx` (yangi) | forma pastidagi yopishqoq «Jami N · Saqlash» paneli (`--shadow-float`) |
| `kit/hero.tsx` | yorliq (belgi + matn) va o'ngda havola, summa (birlik `--faint`), izoh; kartada |
| `kit/detail-head.tsx` | `Tiles` bosh sahifaning tezkor tugmalari: webda 44px qator-plitkalar (urg'u belgi + nom), telefonda 36px dumaloq urg'u belgi ostida nom; `DetailHead` olib tashlanadi (yozuv sahifasi `PageTitle` + `PageActions`) |
| `kit/chips.tsx`, `kit/segmented.tsx`, `kit/search-box.tsx` | 3-jadval o'lchamlari |
| `kit/form-row.tsx` | `FormRow` oilasi `Field` ko'rinishiga o'tadi: yorliq ustida, maydon ostida, xato yoki izoh pastda; `TextRow`, `PhoneRow` (+998), `AmountRow` (so'm / $ qo'shimchasi), `PickRow` (`.sel` ko'rinishli tanlov, varaq ochadi), `OptionChips`, `SwitchRow`, `DateTimeRow`; react-hook-form ulanishi o'zgarmaydi |
| `kit/main-button.tsx` | `MainButton` (urg'u / `ghost` / `danger`; telefonda 50px, webda 40px) va `MainBar` (varaq pastki paneli) |
| `ui/dialog.tsx` | telefonda pastdan varaq (tepa radius 38, tutqich, sarlavha 17px/600 chapda, o'ngda «×»), webda o'rtada 480px (radius 12, sarlavha 15px/600, pastki panel chiziq bilan); `wide` 760px; skrim `--scrim`, blur'siz |
| `ui/alert-dialog.tsx` | xuddi shu varaq / dialog: matn, «Bekor qilish» (`ghost`) va qizil tugma |
| `kit/action-sheet.tsx`, `kit/picker-sheet.tsx`, `kit/date-sheet.tsx` | tekis uslubda; webda `PickerSheet` o'rtadagi dialog |
| `kit/amount-sheet.tsx` | klaviatura olib tashlanadi; to'lov dialoglari `AmountRow` bilan |
| `kit/day-groups.tsx` | olib tashlanadi (hujjat ro'yxatlari `DataTable`) |
| `kit/ordered-rows.tsx`, `sortable-list.tsx` | ↑ / ↓ tugmalari bilan tartib; sudrash olib tashlanadi |
| `kit/tab-icons.tsx`, `kit/tile-icon.tsx` | lucide belgilari (`lib/nav.ts` dagidek); `TileIcon` telefonda 30px urg'u kvadrat oq belgi, webda 28px `--ink-2` kvadrat |
| `avatar.tsx`, `kit/avatar.tsx` | rangli: nom xeshi bo'yicha `#c98f6e #6f9b7d #7b86c7 #c47a9e #8c9ab0 #c2a35a`, oq bitta bosh harf, 600 |
| `ui/badge.tsx` | 3-jadval; `tone`: `neutral` / `success` / `warning` / `danger` / `accent`; `dot` rangi (bosqich) |
| `ui/switch.tsx` | 3-jadval; checkbox va radio shu uslubda |
| `ui/sonner.tsx` | pastda, `foreground` fonda `background` matn |
| `states.tsx`, `refusal.tsx`, `history-list.tsx`, `kit/banner.tsx` | tekis uslub: bo'sh holat halqali karta ichida markazda, rad javobi `--destructive-soft` |
| `orders/*` kanban | webda `repeat(n, minmax(210px,1fr))` ustunlar (`--ink-1` fon, radius 10, sarlavhada nuqta, nom, son, yakuniyda «Yakuniy»), kartalar (`№ 126 · Tur`, sana, mijoz, mas'ul, «To'langan» yoki qoldiq); dnd-kit qoladi. Telefonda bosqich chiplari va tanlangan bosqich kartalari |

### 5. Qobiq

- **Web sidebar** (`shell/sidebar.tsx`, 224px, `--sidebar` fon, o'ngda chiziq):
  - tepada «H24» belgisi (teal) va «Hisob24», yonida yig'ish tugmasi; yig'ilgani 64px, faqat belgilar;
  - kompaniya bloki: avatar (a'zo), kompaniya nomi (600), «Ism · Rol» → `/profile`;
  - bo'limlar 32px (belgi 16px, 1.75): joriysi oq yuza, `--shadow-card` va halqa, belgisi urg'u; tabli bo'lim joriy bo'lsa ostida ichki bandlar (28px, 12.5px, joriysi `--primary-soft` fon, `--accent-text`);
  - pastda «Obuna D-oy gacha faol» (`company.end_date`) va «Chiqish» (so'raydi, avvalgidek).
- **Web tepa panel** (`shell/top-bar.tsx`, 52px, ostida chiziq): chapda «← Orqaga» (sahifa aytsa); o'ngda lokatsiya menyusi (pin belgisi, nom, chevron; ruxsatli lokatsiyalar, joriysi urg'uda; bitta bo'lsa tugma emas) va qo'ng'iroqcha (bosilsa menyuda «Bildirishnomalar hozircha yo'q»). Mavzu va chiqish tugmalari olib tashlanadi.
- **Kontent** (web): `--background` (oq), `20px 24px 40px`, ustun 1080px gacha, o'rtada.
- **Telefon tab-bar** (`shell/tab-bar.tsx`): hamma sahifada; `left/right 16px`, `bottom 28px` + xavfsiz zona; `--card` 80% + `blur(24px) saturate(1.8)`; tugmalar `flex:1`, 24px belgi (joriysi 2, qolgani 1.6), 10px/500 nom; joriysi `--accent-text` va `rgba(118,118,128,.12)` kapsula. 4 ta sahifa (`barPages`, hozirgi mantiq) va «Sozlama» (`/settings`, `SettingsIcon`). Sahifa pastida joy (`pb-bar`), formaning «Jami» paneli tab-bar ustida.
- **Telegram:** to'liq ekran avvalgidek; kontent Telegram tugmalari ostidan (`pt-safe`); `BackLink` Telegram ichida yashirin (`html[data-telegram]`), `BackButton` avvalgidek. Tepadagi fade (`top-fade`) qoladi, rangi yangi fon.
- **«Sozlama» sahifasi** (`/settings`):
  - telefonda: kompaniya qatori (avatar, kompaniya, «Ism · Rol» → `/profile`); «Bo'limlar» — panelda yo'q ochiq sahifalar (`TileIcon` bilan); «Sozlamalar» — `settings.view` bo'lsa sozlama sahifalari, hammaga «Pastki panel»;
  - webda: sarlavha «Sozlamalar», izoh «Faqat egasi va sozlash ruxsatli xodimlar uchun», sozlamalar ro'yxati (chevron bilan), «Pastki panel» ham.
- **Profil** (`/profile`): markazda avatar (56px), ism, «telefon · rol»; «Kompaniya» (nom, obuna, «Kompaniyani almashtirish»); «Lokatsiya» (radio ro'yxat, pin belgisi; bitta bo'lsa ko'rsatilmaydi); «Mavzu» (brauzerda segmentli: Tizim / Yorug' / Qorong'i); brauzerda «Chiqish» (qizil qator), Telegram'da izoh «Mini App'da chiqish yo'q: Telegram akkauntingiz bilan avtomatik kirasiz.»; «Bosh ekranga qo'shish» kartasi (Telegram) avvalgidek.
- **Kirish** (`/login`): `--sidebar` fonda o'rtada 820px karta, ikki ustun (telefonda bitta): chapda `foreground` fonli brend paneli (pastda «H24» va «Hisob24», «Kichik biznes uchun hisob: mijozlar, buyurtmalar, ombor va kassa — bitta joyda.»), o'ngda forma («Kirish», izoh, «Telefon», «Kod olish»; kod qadamida «Kodni kiriting», qayerga yuborilgani, «Kod», «Tasdiqlash», «Raqamni o'zgartirish»). Kod maydoni bitta maydon ko'rinishida, 6 raqamda o'zi yuboriladi (hozirgi xatti-harakat). `/select-company`, `/expired`, Telegram holat ekranlari shu uslubda.

### 6. Sahifalar

Hamma ro'yxat sahifasi: `PageTitle` (nom, «N ta …», qo'shish) → (`PageTabs`) → `Toolbar` (qidiruv, chiplar) → `DataTable` → `Pager` yoki «1–N / N». Hamma yozuv sahifasi: `PageTitle` (nom, izoh, `PageActions`) → `StatCards` (bo'lsa) → `InPageTabs` yoki bo'limlar → «Tarix». Kichik forma — dialog / varaq (`Field`lar, pastda to'liq «Saqlash»). Ko'p qatorli hujjat — forma sahifasi (`Group`lar, qatorlar kartasi, `SumBar`).

- **Bosh sahifa** (`/`):
  - sarlavha: webda «Salom, Ism» / «Kompaniya · Lokatsiya»; telefonda kompaniya nomi / «Ism · Rol · Lokatsiya ▾» (lokatsiya qismi bosilsa `ActionSheet`);
  - hero «Kassadagi pul» (`finance.view`): UZS akkauntlar yig'indisi katta, izohda boshqa valyutalar («+ $1,550») va «N ta akkaunt», o'ngda «Kassa →»;
  - tezkor tugmalar (ruxsatlilari): Buyurtma (`orders.create` → buyurtma dialogi), Sotuv (`sales.create` → `/sales/new`), Xarid (`purchases.create` → `/purchases/new`), Xarajat (`finance.create` → `/expenses` xarajat dialogi), Mijoz (`customers.create` → mijoz dialogi);
  - kartalar (ruxsatlilari): «Faol buyurtmalar» (son, yakuniy bo'lmagan bosqichlar chizig'i va izohi → `/orders`), «Mijozlar qarzi» (UZS yig'indisi, boshqa valyutalar, «N ta mijozda» → `/customers`), «<Oy> sotuvlari» (UZS, boshqa valyutalar, «N ta sotuv» → `/sales`), «Kam qolgan tovarlar» (son, birinchi ikki nom yoki «Hammasi yetarli» → `/warehouse`);
  - «Yaqin muddatlar» (5 ta faol buyurtma: avatar, mijoz, «№ N · muddat · qoldiq», bosqich belgisi; «Hammasi» → `/orders`);
  - «Bosh ekranga qo'shish» banneri (Telegram) va «Obuna … gacha faol».
- **Mijozlar:** jadval «Mijoz» (avatar, nom, telefon), «Turi», «Qarz» (qizil qarz / yashil «Avans N» / «—»), «Qo'shgan», «Qo'shilgan»; chiplar: Barchasi va turlar; telefonda qator (telefon · tur, o'ngda qarz). Mijoz sahifasi: sarlavha nom, izoh telefon · tur; amallar Tahrirlash, To'lov, Buyurtma, Qo'ng'iroq (telefonda), O'chirish (ruxsat bo'yicha); kartalar Balans (qarz / avans / 0), Buyurtmalar, Sotuvlar; tablar Ma'lumot (`KeyValue`), Buyurtmalar (jadval), Hisob harakati (jadval: vaqt, hujjat, qarz o'zgarishi), Tarix.
- **Buyurtmalar:** web: `Segmented` «Kanban» / «Ro'yxat» va qo'shish; kanban (sudrash), ro'yxat jadvali (№, Mijoz, Turi, Bosqich, Muddat, Mas'ul, Narx, Qoldiq); telefon: bosqich chiplari («nuqta Nom son», tanlangani `foreground` fonda), tanlangan bosqich kartalari, kartada «⋯»; filtrlari (mas'ul va boshqalar) saqlanadi. Buyurtma sahifasi: sarlavha «Buyurtma № N», izoh bosqich belgisi · tur · muddat; amallar; bosqich tanlovi (rang nuqtali segmentli); kartalar Narx / To'langan / Qoldiq; qoldiq bo'lsa to'liq tugma «N so'm qabul qilish» (to'lov dialogi); tablar Ma'lumot (mijoz qatori, maydonlar, mas'ul, muddat, lokatsiya, qo'shgan), Tovarlar (qatorlar, foyda; «O'zgartirish»), To'lovlar, Tarix.
- **Mahsulotlar:** `PageTabs` Mahsulotlar / Xizmatlar; toolbar qidiruv va «Nofaollar ham» kaliti; jadval Nomi (artikul), Qoldiq · lokatsiya, Oxirgi xarid narxi, Sotuv narxi, Holat (xizmatda: Nomi, Sotuv narxi, Holat, qator amallari). Mahsulot sahifasi: sarlavha, izoh birlik · artikul; amallar Tahrirlash, Nofaol qilish, O'chirish; `KeyValue`; «Qoldiq lokatsiyalar bo'yicha» (jami bilan); «Harakatlar» jadvali; «Xaridlar» (ruxsat bo'lsa).
- **Ombor** (`PageTabs`, ruxsatlilari): Qoldiq (`/warehouse`, yangi; jadval Mahsulot, har ruxsatli lokatsiya ustuni (joriysi qalin), «Qiymati (tan narxda)»; telefonda qator: nom, izohda lokatsiyalar, o'ngda joriy lokatsiya qoldig'i), Xaridlar, Ko'chirishlar, Inventarizatsiya, Boshlang'ich qoldiq, Ta'minotchilar (jadval Nomi, Telefon, Xaridlar, Balans). Hujjat sahifasi: sarlavha «Xarid № N», izoh vaqt · kim; amallar; `KeyValue` (ta'minotchi havola, lokatsiya, valyuta); «Qatorlar» jadvali; jami / to'langan / qarz; to'lovlar. Forma sahifasi: `Group` (ta'minotchi, valyuta, kurs), «Mahsulotlar» qatorlar kartalari (mahsulot tanlovi, miqdor, narx, summa, o'chirish; «+ Qator qo'shish»), «Ta'minotchiga to'lov», `SumBar`. Ta'minotchi sahifasi: amallar («To'lov berish» va boshqalar), kartalar Balans / Xaridlar / Holat, «Hisob harakati», «Xaridlar».
- **Sotuv:** jadval №, Vaqt, Mijoz (yoki «Chakana»), Kim, Jami, Qoldiq («To'langan» yashil); sahifa va forma xaridnikidek («Tovar va xizmatlar», «To'lov»: summa, akkaunt, «To'liq: N»).
- **Moliya** (`PageTabs`): Kassa (karta «Jami, so'mda (kurs N so'm)» — akkauntlar qoldig'i `/app/me` dagi joriy kurslar bilan so'mga; kursi yo'q valyuta alohida qo'shiladi; akkaunt kartalari: belgi, «Nomi · Valyuta», qoldiq → akkaunt sahifasi; «Boshlang'ich qoldiq» amali avvalgidek), Xarajatlar (chiplar Barchasi / Xarajatlar / Kirimlar, «Xarajat / kirim»; jadval Vaqt, Kategoriya, Akkaunt, Izoh, Kim, Summa, o'chirish), O'tkazmalar (jadval Turi, Vaqt, Yo'nalish, Summa; dialog «O'tkazma» / «Konvertatsiya»). Akkaunt sahifasi: «Qoldiq: N», «Hisob harakati» jadvali (Vaqt, Hujjat, Summa ±, Qoldiq).
- **Xodimlar:** jadval Xodim (avatar, ism, telefon), Rol (belgi), Lokatsiyalar; qator bosilsa bitta varaq: Ism + «Saqlash», «Rol» radio ro'yxati, «Lokatsiyalar» (kalit «Hamma lokatsiyada ishlaydi» va katakchalar), «Kompaniyadan chiqarish» (ruxsat bo'yicha); izoh qatori avvalgidek.
- **Sozlamalar:** Mijoz turlari va Buyurtma turlari (`Split`: turlar ro'yxati — tanlangani belgilangan, ↑ / ↓, nomi bosilsa qayta nomlash, pastda «Yangi tur nomi» + «+»; o'ngda «“Tur” maydonlari» va «+ Maydon»: maydon qatorlari nom, tur izohi, «Majburiy», «Takrorlanmas» katakchalari, ↑, o'chirish; «Turni o'chirish»), Bosqichlar (qatorlar: rang tanlovi, nom maydoni, «Yakuniy», ↑ / ↓; pastda yangi bosqich), Dropdownlar (`Split`: dropdownlar va variantlar, variant kaliti Faol / Nofaol, yangi variant), Valyuta kurslari («Yangi kurs»: yoqilgan valyutalar maydonlari, «Saqlash»; «Tarix» jadvali), Moliya kategoriyalari (chiplar Xarajat / Kirim; kategoriya kaliti, yangi kategoriya), Rollar (ro'yxat «N ta ruxsat · N xodim», tanlangan rolning ruxsatlar matritsasi: bo'lim × Ko'rish / Qo'shish / Tahrirlash / O'chirish / Tarix; yangi rol), Pastki panel (hozirgi mantiq, prototip ko'rinishi: belgi, nom, «Panelda» / «Panelda emas · Sozlama sahifasida»). Manzillar o'zgarmaydi (`/settings/customer-types/[id]` tanlangan tur bilan ochiladi).

### 7. Backend va API

- **`GET /app/dashboard?location_id=`** (javob `Dashboard`):
  - `cash: { total: BalanceLine[], accounts: int } | null` — `finance.view`; jonli akkauntlar qoldiqlari valyuta bo'yicha yig'indisi (`listAccountBalances` qoidasi), akkauntlar soni;
  - `debtors: { debt: BalanceLine[], count: int } | null` — `customers.view`; mijozlarning musbat (qarz) balanslari valyuta bo'yicha yig'indisi va qarzdor mijozlar soni (ta'minotchilarnikidek `ListPartyBalanceByCurrency` naqshi);
  - `low_stock: { count: int, names: string[] } | null` — `stock.view` va lokatsiya; joriy lokatsiyada kamida bitta harakati bor jonli faol mahsulotlar (xizmat emas) ichida qoldig'i ≤ 3 lari, nom bo'yicha; `names` birinchi 5 tasi;
  - `orders` va `sales` avvalgidek; `suppliers`, `customers`, `purchases`, `orders_money` olib tashlanadi (web bosh sahifasi ularni ishlatmaydi).
- **`GET /app/stock/summary?q=&page=`** (`stock.view`, yangi): jonli mahsulotlar (xizmat emas), nom yoki artikul bo'yicha qidiruv, nom bo'yicha, 20 tadan; har biri `product` (id, nom, artikul, birlik, faol), `locations: [{ location_id, qty }]` (a'zoga ruxsatli lokatsiyalar, lokatsiyalar tartibida), `total`, `last_price: { amount, currency_id } | null` (oxirgi xarid narxi, `logic/products.md`), `value: string | null` (`total × last_price`, o'sha valyutada). Lokatsiyasiz a'zo: bo'sh sahifa.
- `openapi.yaml` → `make api-client`; `logic/warehouse.md` (qoldiq jadvali, kam qolgan qoidasi) va dashboard izohi avval yoziladi; sqlc so'rovlari `internal/db/queries/`, servis `internal/dashboard/` va `internal/stock/` (yoki mavjud ombor servisi), handler `internal/app/`.

### 7a. Testlar

- Har yangi yoki o'zgargan komponent: Vitest (RED → GREEN): tuzilish va semantika (rollar, nomlar, `data-slot`), ranglar emas. Ko'rinish vaqtinchalik Playwright skrinshot spec'i bilan tekshiriladi (telefon 375px @2x va 1280px, yorug' va qorong'i), commit'dan oldin o'chiriladi.
- `DataTable`: webda `getByRole("table")`, telefonda `getByRole("list")`; e2e'da `.filter({ visible: true })`.
- Olib tashlanadigan funksiya testlari (klaviatura, kun guruhlari, sudrab tartiblash, ombor hub, `DetailHead`, `BrandMark` sarlavhada) funksiya bilan birga ketadi; qolganlari talab o'zgargani uchun yangilanadi. Hisobotda har biri sababi bilan.
- Backend: dashboard bloklari va qoldiq jadvali uchun db (`pgtest`), servis (table-driven), handler, contract testlari; ruxsatsiz blok `null`, begona lokatsiya rad etiladi.
- Har bosqich oxirida `make lint`, `make test`, `make e2e`, keyin `git push origin dev`.

## Bosqichlar

0. **Hujjat:** shu spec, `CLAUDE.md` manbalar qatori, `docs/design/README.md` izohi.
1. **Poydevor:** tokenlar (yorug', qorong'i, telefon, web), shrift, o'lchamlar; `ui/*` va `kit/*` qayta uslublanadi; yangi `DataTable`, `StatCards`, `PageTabs` / `InPageTabs`, `Toolbar`, `Split`, `SumBar`, `PageActions`; avatar ranglari; shisha utility'lari olib tashlanadi. Sahifalar eski tuzilishda, yangi ranglarda ishlayveradi.
2. **Qobiq:** sidebar, tepa panel (lokatsiya, qo'ng'iroqcha), tab-bar (doim), `BackLink` Telegram'da yashirin, «Sozlama» sahifasi, profil, kirish va holat ekranlari.
3. **Dashboard:** API (`cash`, `debtors`, `low_stock`; eski bloklar olib tashlanadi) va bosh sahifa.
4. **Mijozlar va Buyurtmalar.**
5. **Mahsulotlar va Ombor** (`GET /app/stock/summary`, ombor tablari, hujjat sahifalari va formalari, ta'minotchilar).
6. **Sotuv va Moliya.**
7. **Xodimlar va Sozlamalar.**
8. **Yakun:** ishlatilmay qolgan kod va tokenlar, `docs/design/README.md` va skrinshotlar (`screens-v3/`), haqiqiy stack smoke.

## Chegara

- Admin panel; haqiqiy bildirishnomalar; mahsulotga alohida chegara; til tanlovi; production deploy (alohida so'raladi).

## Amalga oshirishda belgilangan qarorlar

### 1-bosqich (poydevor)

- **Brend tokeni ikkiga bo'lindi:** `--brand` — logotip so'zi sahifada (yorug'da siyoh `#17181b`, qorong'ida `#ececee`), `--brand-mark` — H24 kvadrati, ikkala mavzuda teal `#174449` (splash belgisi, banner rasmi). Prototipda so'z oddiy matn rangida, kvadrat teal.
- **Bo'lim tablari = mavjud `SectionTabs`** (`<nav aria-label="… bo'limi">`, havolalar, `aria-current="page"`), yangi `PageTabs` emas. Sahifa ichidagi tablar (`InPageTabs`) 4-bosqichda `Segmented` asosida.
- **Toast'lar pastda** (prototipdagidek). e2e `settle` yordamchisi sonner ro'yxatiga `pointerup` + `mouseout` yuboradi: emulyatsiya qilingan telefonda tap'dan keyin ro'yxat «bosilgan» bo'lib qolardi va toast ketmasdi.
- **Prototipdan kichik chetlanishlar:** telefonning qorong'i `--muted` iOS'niki `rgba(118,118,128,.24)` (prototipniki `.12`, qorada ko'rinmaydi); telefondagi qator ajratgichi 0.5px (iOS hairline; prototipda 1px); tasdiq varag'ining tugmalari telefonda 44px (prototipda 32px, barmoq uchun kichik); webdagi ikkilamchi matn bitta 12px (prototipda 12 / 12.5 aralash).
- `FormRow` oilasi yorliq ustida, maydon qutida; forma maydonlari orasida chiziq yo'q (prototipdagi `.fld`). Guruh ichidagi maydon telefonda ham halqali (2026-11-11 dan; oldin prototipdagidek chegarasiz oq-oq edi, yorug' rejimda `--field` va `--card` ikkalasi `#ffffff` bo'lgani uchun maydon ko'rinmasdi).
- Eski shisha tokenlari (`--rim`, `--seg-*`, `--search*`, `--fade`, `--tb-shadow`, `--lifted`, `--col`…) hali qolgan komponentlar ko'chguncha tekis qiymatlarda turadi; 8-bosqichda ishlatilmaganlari olib tashlanadi. Ishlatilmayotgan `components/avatar.tsx` ham 8-bosqichda.

### 2-bosqich (qobiq, «Sozlama», profil, kirish)

- **Belgilar lucide** (`kit/tab-icons.tsx`: `tabIcons`, `pageIcons`), 1.75 chiziq; joriy tab belgisi qalinroq (2 / 1.6).
- **Tab-bar hamma sahifada** (yozuv, forma, profil, «Pastki panel» ham); kapsula yozuvda u tegishli sahifa ostida, panelda yo'q sahifada «Sozlama» ostida. Nomlar 10px, tor panelda birga kichrayadi (8.5px gacha), chetidan 4px bo'sh joy qoidasi avvalgidek. **360px dan tor telefonda panel chetdan 6px** (16px da 320px telefonning tugmasi 56px, «Buyurtmalar» 8.5px da ham chetga 2px qolmaydi) — prototipdan chetlanish.
- **«Sozlama» / «Sozlamalar»:** tab-bar tugmasi, telefondagi sahifa sarlavhasi va «Pastki panel» muharriri «Sozlama»; webdagi sahifa va sidebar bandi «Sozlamalar». Telefondagi «Bo'limlar» ro'yxatida faqat panelda yo'q bo'limlar (ichki sahifalar bo'lim tablarida); «Pastki panel» webda ham ko'rinadi.
- **Lokatsiya menyusi** (tepa panel) Base UI `Menu` radio bandlari: tanlansa menyu yopiladi (`closeOnClick`; standartda ochiq qolib, inert foni sahifani bosib bo'lmas qilardi). Telefonda lokatsiya bosh sahifa boshidagi varaqda (3-bosqich).
- **Chiqish:** sidebar pastida, so'raydi («Tizimdan chiqasizmi?»); profilda karta-qator (belgi plitkasi, oddiy matn — prototip CSS'idagi `danger` rangi sarlavha va belgiga yetmaydi, ko'rinishi shunday), so'ramaydi. Telegram'da ikkalasi yo'q.
- **Holat ekranlari** (`ShellLess`: kompaniya tanlash, obuna tugagan, Mini App kirishi): telefonda to'liq ekran ustun, webda kirishdagidek kulrang sahifa o'rtasida karta; boshida `BrandLockup` (H24 kvadrati + «Hisob24»), kompaniya tanlashda chapda, «‹ Profil» ostida.
- **Kirish:** `LoginFrame` karta (`data-slot="login-card"`), brend paneli `--brand-panel` (yorug'da siyoh, qorong'ida oq), unda H24 kvadrati + «Hisob24» va prototip matni; panel orqasidagi «24» bezagi olib tashlandi. Telefon qadamida maydon guruh kartasisiz. To'liq ekranda sahifaning tepa chekkasi Telegram tugmalari ostidan.
- **Web Mini App** (Telegram desktop / keng oyna): xavfsiz zona tepa panelga qo'shiladi (`md:pt-safe`), kontent undan 20px pastda.

### 3-bosqich (bosh sahifa)

- **`GET /app/dashboard`:** `cash` (`totals: CurrencyAmount[]`, `accounts`), `debtors` (`debt`, `count`), `orders`, `sales`, `low_stock` (`count`, `names`). `suppliers`, `customers`, `purchases`, `orders_money` olib tashlandi.
- **«Mijozlar qarzi» so'mda, bitta son** (spec'dagi valyuta qatorlari o'rniga): mijoz balansi `logic/sales.md` 5-bo'limda so'mda (har hujjat o'z kursi bilan) belgilangan, ro'yxatdagi «Qarz» ham shunday. Ruxsati `customers.view` va `sales.view` (ro'yxatdagi «Qarz» ustuni kabi).
- **«Kassadagi pul»** valyuta bo'yicha, aylantirilmaydi: so'm katta, boshqalari izohda («+ 80 $ · 4 ta akkaunt»), nofaol akkauntlar ham sanaladi.
- **«<Oy> sotuvlari»** so'mda (avvalgi `sales` bloki), boshqa valyutalar alohida emas.
- **Kam qolgan tovar:** lokatsiyada harakati bor jonli faol mahsulot, qoldig'i ≤ 3 (0 va manfiy ham), nom bo'yicha birinchi 5 nomi; chegara backend konstantasi (`lowStockAtMost`).
- **Tezkor tugmalar** prototipnikidek: Buyurtma, Sotuv, Xarid, Xarajat (bosh sahifada `ExpenseDialog`), Mijoz. Ta'minotchiga «To'lov» tugmasi bosh sahifadan ketdi (ta'minotchi sahifasida qoladi).
- **Sarlavha:** «Salom, Ism» — to'liq ism (prototipdagi birinchi ism emas; `full_name` bo'lmasa telefon). Telefonda h1 faqat ekran o'quvchisiga, ko'rinadigani kompaniya nomi; «Ism · Rol · Lokatsiya ▾», lokatsiya 2+ bo'lsa varaq tugmasi. Bosh sahifadan profilga havola yo'q: telefonda «Sozlama» sahifasining kompaniya qatori, webda sidebar.
- «Yaqin muddatlar» qatori: avatar, mijoz, «№ N · muddat (o'tgan bo'lsa qizil «Muddati o'tgan · …») · qoldiq», bosqich belgisi; «Hammasi» → `/orders`.

### 4-bosqich (mijozlar va buyurtmalar)

- **`PageActions`** webda sarlavha o'ngida tugmalar, telefonda sarlavha ostida plitkalar qatori (prototipning Telegram yozuv sahifalari: belgi teal doirada, ostida nom; xavfli amal qizil doira). Guruh nomi «Amallar». Qo'ng'iroq oddiy `tel:` havola.
- **`InPageTabs`** (`kit/in-page-tabs.tsx`): `Segmented` ko'rinishidagi tablar, tanlangani manzilda (`?tab=`), birinchisi manzilsiz; faqat kerakli tablar chiziladi (ruxsat, buyurtmada tovar / to'lov bo'lsa).
- **Mijozlar:** webda jadval (Mijoz, Turi, Qarz — `sales.view` bo'lsa, Qo'shgan, Qo'shilgan; qarz qizil summa, avans yashil «Avans N so'm», teng «—»), telefonda guruhli qatorlar avvalgidek; qidiruv va tur chiplari `Toolbar` da.
- **Mijoz sahifasi:** izoh «telefon · tur»; amallar Tahrirlash, To'lov, Buyurtma, Qo'ng'iroq; **o'chirish sahifa oxirida qizil qator bo'lib qoldi** (prototipda axlat qutisi amallarda); kartalar Balans (`BalanceStat`), Buyurtmalar (`GET /app/orders?customer_id=` soni), Sotuvlar (`GET /app/sales?customer_id=` soni); tablar Ma'lumot, Buyurtmalar, Hisob harakati, Tarix.
- **Buyurtmalar:** webdagi «Ro'yxat» jadval (№, Mijoz, Turi, Bosqich, Muddat — o'tgani qizil, Mas'ul, Narx, Qoldiq); telefondagi ro'yxat muddat guruhlari bilan qoldi (`DataTable` ning `phone` prop'i). Telefondagi «Kanban» — bosqich chiplari (nuqta, nom, son; tanlangani siyoh rangda) va tanlangan bosqich kartalari, kartada «⋯», ostida «Buyurtma qo'shish» shu bosqichga (webdagi ustun «+» i o'rniga). Webdagi kanban va sudrash o'zgarmadi.
- **Buyurtma sahifasi:** izoh «Tur · Mijoz» qoldi (bosqich tanlovi va muddat kartasi sarlavha ostida); amallar Tahrirlash, To'lov, Mijoz, Qo'ng'iroq; pul — kartalar Narx / To'langan / Qoldiq (yoki Avans), qoldiq bo'lsa «N qabul qilish» (`orders.edit`); tablar Ma'lumot (mijoz qatori va maydonlar), Tovarlar, To'lovlar, Tarix.

### 5-bosqich (mahsulotlar va ombor)

- **`GET /app/stock/summary?search=&page=`** (`stock.view`): jonli mahsulotlar (xizmat emas, nofaollari ham) nom bo'yicha, 20 tadan; har birida ruxsatli lokatsiyalar bo'yicha qoldiq (0 ham), jami, oxirgi xarid narxi va qiymati (`total × last_price`, Go'da `big.Rat`). Lokatsiyasiz a'zoga bo'sh sahifa. Qoida `logic/warehouse.md` 5-bo'limda.
- **«Qoldiq» `/warehouse` hub sahifasida:** navigatsiya o'zgarmadi (hub `/warehouse`, tablari Xaridlar … Ta'minotchilar). `stock.view` bo'lsa sahifaning asosiy mazmuni «Qoldiq» jadvali (webda Mahsulot, har lokatsiya ustuni — joriysi qalin, Jami, Qiymati; telefonda qator: nom, izohda lokatsiyalar bo'yicha qoldiq, o'ngda joriy lokatsiyaniki); bo'limlar ro'yxati telefonda qoladi (webda sidebar bandlari). `stock.view` siz sahifa avvalgidek bo'limlar ro'yxati. Spec'dagi «birinchi tab» o'rniga shu (navigatsiya qoidalari va tab-bar kalitlari o'zgarmasligi uchun).
- **Ro'yxatlar webda jadval:** Mahsulotlar (Nomi + artikul, Qoldiq, Oxirgi xarid narxi, Sotuv narxi, Holat), Xizmatlar (Nomi, Sotuv narxi, Holat; qator bosilsa amallar varag'i), Xaridlar (№, Vaqt, Ta'minotchi, Mahsulotlar, Kim, Jami, To'lov), Ta'minotchilar (Nomi, Telefon, Balans — `purchases.view` bo'lsa). Telefonda avvalgi qatorlar / kun guruhlari (`DataTable` ning `phone` prop'i). Qidiruv va chiplar `Toolbar` da.
- **Kun guruhlarida qolganlar:** ko'chirishlar, inventarizatsiyalar, boshlang'ich qoldiqlar, hisob harakatlari — ikkinchi darajali ro'yxatlar, jadvalga o'tkazilmadi.
- Yozuv sahifalari (mahsulot, xarid, ta'minotchi, hujjatlar) kit darajasidagi tekis ko'rinishda (`DetailHead`, `Tiles` 1-bosqichda qayta uslublangan) qoldi; ularni `PageTitle` + `PageActions` ga ko'chirish 8-bosqichda ko'rib chiqiladi.
- e2e: `list()` yordamchisi ko'rinib turgan jadval yoki ro'yxatni oladi (`table.or(list)`); ombor qismlari webda sidebar bandlari.

### 6–7-bosqichlar (sotuv, moliya, xodimlar, sozlamalar)

- **Webda jadval:** Sotuvlar (№, Vaqt, Mijoz yoki «Chakana», Kim, Jami, To'lov), Xarajatlar / Kirimlar (№, Vaqt, Kategoriya, Akkaunt, Kim, Summa; qator bosilsa amallar varag'i), Xodimlar (Xodim — avatar, ism, «Siz», telefon; Rol; Lokatsiyalar — ikki va undan ko'p bo'lsa; qator bosilsa xodim varag'i). Telefonda kun guruhlari va qatorlar avvalgidek.
- **Kassa:** «Jami, so'mda» kartasi — akkauntlar qoldig'i `/app/me` dagi joriy kurslar bilan so'mga; izohda ishlatilgan kurslar («1 $ = 12 800 so'm»), kursi yo'q valyuta alohida («+ 50 €»). Backend o'zgarmadi.
- **Sozlamalar** ro'yxat + alohida sahifalar ko'rinishida qoldi (kit darajasidagi tekis ko'rinish bilan); prototipdagi `Split` master-detail (turlar ro'yxati va maydonlar yonma-yon, bosqichlar ichida tahrirlash, rollar matritsasi bir sahifada) amalga oshirilmadi — mavjud funksiyalar va testlar saqlanishi uchun, keyingi ish sifatida.
- **6 va 7-bosqichlar bitta gate bilan tekshirildi** (har biri yuklama ostida ~15 daqiqa); gate'ning e2e'sida bitta beqaror test (xodim chiqarilgandan keyingi reload) yiqildi, test tuzatildi, push esa 8-bosqichning yakuniy gate'i bilan birga qilindi (6–8 bitta push).
- e2e: `docRow` (hujjat qatori: telefonda kun guruhida, webda jadvalda), `memberRow` (xodim qatori).

### 8-bosqich (yakun)

- **Yozuv sahifalari prototip sarlavhasiga o'tdi** (5-bosqichda qoldirilgan edi): mahsulot, ta'minotchi, akkaunt va hujjatlar (xarid, sotuv, ko'chirish, inventarizatsiya, boshlang'ich qoldiq) — `PageTitle` + `PageActions`. Hujjatda sarlavha «Xarid № N», izoh prototipdagidek «vaqt · kim» (+ xarid / sotuvda «Qoldi N» yoki «To'langan» belgisi); avvalgi izohdagi ta'minotchi / mijoz / lokatsiya / yo'nalish faktlarda qoladi. O'chirish hujjatlarda amallar ichida xavfli amal (webda faqat axlat qutisi belgisi, telefonda qizil doirali plitka); mahsulot, ta'minotchi va mijozda sahifa oxiridagi qizil qator bo'lib qoldi. Sarlavha ostidagi katta raqam (`Hero`) yozuv sahifalaridan ketdi: jami qatorlar ostida va faktlarda, akkaunt qoldig'i izohda («Qoldiq: N», prototipdagidek), valyuta kodi ko'rsatilmaydi.
- **Hujjat qatorlari webda prototip jadvali** («Mahsulotlar»: Mahsulot / Nomi, Miqdor, Narx, Summa; inventarizatsiyada Tizimda, Sanalgan, Farq; ko'chirishda Mahsulot, Miqdor), telefonda qatorlar avvalgidek.
- **Ta'minotchi balansi** mijoznikidek kartalar qatori: Balans (Qarz / Avans / Qarz yo'q, valyutalar so'z bilan), Jami xaridlar, Jami to'lovlar (spec'dagi «Xaridlar / Holat» o'rniga: summalar mavjud ma'lumot, holat sarlavhadagi «Nofaol» belgisida). `BalanceCard` va `BalanceChip` olib tashlandi.
- **Qolganlar:** `DetailHead` faqat xodim varag'ining boshida (dialog, sahifa emas), `Tiles` bosh sahifaning tezkor tugmalarida.
- **`SumBar` qo'llanmadi:** formalar (xarid, sotuv, boshlang'ich qoldiq, ko'chirish, inventarizatsiya) «Jami» kartasi va oxiridagi to'liq «Saqlash» bilan qoldi — telefonda doim ko'rinadigan tab-bar ustida yopishqoq panel alohida ish talab qiladi; ishlatilmagan `SumBar` (va `Split`) olib tashlandi, kerak bo'lsa git tarixidan (`0a19f7b^`) tiklanadi. Prototipdagi «Qarzga: N» ham shu bilan ochiq qoldi.
- **Ishlatilmay qolgan kod va tokenlar:** eski `components/avatar.tsx`, `isMenuPath` (tab-bar hamma sahifada), shisha davrining hech kim o'qimaydigan tokenlari (`--chip`, `--switch-*`, `--ban-*`, `--art*`, `--av-*`, `--mark-shadow`, `--tb-shadow`, `--seg-on`, `--sheen`, `--btn-glow`, `--glass-edge`, `--menu`). Komponentlar o'qiydigan eski nomlar tekis qiymatlarda qoldi.
- **Obuna sanasi** (sidebar, profil) boshqa yilda tugasa yili bilan: «2027-yil 31-dekabr» (`formatUntil`); bir yil ichida «31-dekabr». Haqiqiy stack smoke'da topildi.
- **Haqiqiy stack smoke:** vaqtinchalik baza (`goose up`), API va `next dev` boshqa portlarda; API orqali kompaniya va hujjatlar, `GET /app/dashboard` (kassa, qarzdorlar, kam qolgan) va `GET /app/stock/summary` qiymatlari tekshirildi; 20 sahifa ikkala ko'rinishda ochildi (h1, xato holati, page error va 5xx yo'q). Baza o'chirildi.

### Keyingi o'zgarishlar

- **2026-11-11: buyurtma qo'shish telefonda to'liq ekran** (foydalanuvchi so'rovi: pastdan chiqadigan varaq emas). «Dialog = varaq» qoidasidan (2026-10-13, 10-qaror) chetlanish: `AddOrderDialog` — `DialogContent tall full`. Telefonda (768px dan tor) u butun ekranni egallaydi: tutqich yo'q, burchaklar to'g'ri, o'ngdan suzib kiradi (sahifa o'tishidagidek), sarlavha va yopish tugmasi `--safe-top` ostidan boshlanadi (Telegram to'liq ekranda boshqaruvlar tepada); keng ekranda avvalgidek o'rtadagi dialog. Hamma ochuvchilar (buyurtmalar sahifasi va kanban ustuni, bosh sahifa, mijoz sahifasi) bitta `AddOrderDialog` orqali ochadi, shuning uchun hammasi shunday. Tahrirlash va boshqa varaqlar pastdan chiqadigan varaq bo'lib qoldi; xohlasa, `full` belgisi bilan shunday qilinadi.
- **2026-11-11: varaq tanasi faqat tepa-pastga siljiydi.** Tik skroll qiladigan tananing ikkinchi o'qi ham `auto` bo'lib qolardi va barmoq formani yonga tortardi (iOS'da elastik qaytish bilan). Endi tana yon tomonga qulflangan: `overflow-x-hidden`, `overscroll-x-none`, `touch-pan-y` (tik `overscroll` oldingidek `contain`). Tana ichidagi o'z gorizontal lentalari (chip qatorlari) avvalgidek surila oladi.
- **2026-11-11: telefonda maydon chegarasi** (foydalanuvchi so'rovi, Mini App skrinshoti bilan: «inputlarga border qo'yish kerak, ular input ekanligi bilinmayapti»). Prototipdan chetlanish: telefondagi maydon qutisi (`boxClass`, `PickRow` ham) endi `inset 0 0 0 1px var(--ink-5)` halqali (web'dagi `--ink-4` halqasi avvalgidek; yorug' rejimda `--ink-5` — 15% qora, qorong'ida 20% oq; fokus va xato halqalari uni almashtiradi). Shu bilan birga chegarasiz qolgan input'lar ham xuddi shunday qutiga o'tdi: `CustomerPicker`ning «Telefon raqami» qatori (yorliq chapda qoladi, `+998` va raqam qutida), `LineInput` (Miqdor, Narx, to'lov Summasi: yorliq tepada, qutida, birlik qutining ichida; ikki ustunli qatorda narx ustuni kengroq `1fr / 1.3fr` va ular orasida faqat birinchi katakning 16px bo'shlig'i, to'qqiz xonali narx 375px da to'liq sig'adi; «To'liq» tugmasi qutiga tekis) va `AddOptionForm` («Yangi variant»). Quti torayadigan bo'ldi (`min-w-0`): tor katak uni qo'shnisi ustiga surib yubormaydi. Qidiruv maydoni (`SearchBox`, kulrang tabletka) va OTP katakchalari (o'z chegarasi bor) tegilmadi.
