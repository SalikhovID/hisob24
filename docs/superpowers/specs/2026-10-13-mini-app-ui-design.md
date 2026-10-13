# User app'ning Telegram Wallet (iOS guruhli ro'yxat) uslubidagi UI'si — dizayn va reja

Sana: 2026-10-13. Holat: foydalanuvchi reja sifatida tasdiqlagan (reja savollari bilan); amalga oshirilmoqda. Har bosqichga alohida reja: `docs/superpowers/plans/2026-10-13-mini-app-ui-stage<N>-*.md`.

## Kontekst

Foydalanuvchining so'zlari: "shu sahifani analiz qil va loyihani shunday UI ga o'tkazib ber" — sahifa: `https://claude.ai/artifact/6634ff38-6626-42c0-8dea-2bdd4b68122e`, «Hisob24 · Telegram Mini App prototipi» (bitta HTML, 2559 qator, sof CSS + JS; `docs/design/README.md` dagi 2026-10-08 holati asosida chizilgan).

Prototip user app'ning Telegram Wallet uslubidagi qayta loyihasi:

- iOS guruhli ro'yxatlar: `.group` 22px radius, `.row` 56px (media · nom + badge, ikkinchi qator · o'ngda qiymat va ikkinchi qator · chevron), 0.5px ichki ajratgich (68px ikonkali, 60px plitkali, 16px oddiy); `kv` nom — qiymat qatorlari; `.sh` bo'lim sarlavhasi (17px/600, o'ngda amal yoki `hint`); `.foot` izoh (13px).
- Katta sarlavha `.ltitle` (30px/700 + izoh + o'ngda dumaloq `+` 44px); yozuv sahifasida `.dhead` (88px avatar, 26px nom, izoh, badgelar) va `.tiles` tezkor amallar.
- Suzuvchi «liquid glass» tab-bar (64px, 32px radius, `backdrop-filter`, faol tugma ostida linza): Bosh sahifa + 4 bo'lim; qolganlari profil sahifasida. Ichki sahifada panel yashirinadi.
- Pastdan chiqadigan varaq (`.sheet`, 36px radius, tutqich, chapda yopish, o'rtada sarlavha) ichida formalar: `.frow` (112px yorliq + maydon bir qatorda), `.opts` chip-variantlar, iOS `.sw` kalit, `.ferr` xato; asosiy tugma `.mainbar` ichida `.mainbtn` (52px, 14px radius).
- Tanlovlar varaqda (`picker`: bitta / ko'p, qidiruv, «Tanlanmagan»), kalendar varag'i (`datePicker`), summa klaviaturasi (`keypad`), action sheet (`asheet`), shisha menyu (`.menu`), alert (`.alert`), toast (`.toast`), bo'sh holat (`.empty`), skeleton, splash.
- Bosh sahifa: `me` tugmasi (avatar, kompaniya, ism · rol) va lokatsiya pill, hero summa (`.hero`, `.amount`), tezkor plitkalar, «Bosh ekranga qo'shish» banneri, «Umumiy holat» kartalari (bosqichlar ustunlari, sparkline), «Yaqin muddatlar», havolalar, obuna izohi.
- Kanban: snap ustunlar (84%), karta uzun bosib sudraladi, `⋯` → action sheet, yakuniy ustun yig'ilgan (vertikal). Vazifa sahifasi: bosqich treki, muddat kartasi.
- Ekran o'tishlari: push (o'ngdan 100% → 0, eski −28%), pop teskari; chapdan surib qaytish.
- Mavzular: light (`#EDEEF2` fon, `#fff` yacheyka, `#117A68` urg'u), dark (`#000` / `#1C1C1E` / `#3CC5AE`), tg (Telegram ko'ki `#1C74BD`), tgnight. Shrift: SF Pro → Geist, 17px asos, 1.3 qator.

Hozirgi `apps/web`: shadcn/ui + Tailwind v4, indigo tokenlar (`2026-10-04-crud-ui-refresh-design.md`), desktopda sidebar + jadval (`DataList`), telefonda topbar + pastki tab-bar («Yana» varag'i bilan, `2026-10-06-roles-bottom-nav-design.md`), dialoglar (Base UI), `PageHeader`, `SectionTabs`, to'liq ekranli Mini App (`2026-10-07-telegram-fullscreen-design.md`). Prototip chizilganidan keyin loyihaga Sotuv, Moliya, ombor hujjatlari (ko'chirish, inventarizatsiya, boshlang'ich qoldiq), valyuta kurslari va moliya kategoriyalari qo'shilgan (`2026-10-11-ledger-design.md`); ular prototipda yo'q.

Bu `docs/SPEC.md` da yo'q ish, foydalanuvchi so'rovi bilan. SPEC 7-bo'limdagi «dizayn toza, shadcn standart uslubida» talabidan ataylab chetlaniladi: foydalanuvchi prototipni tanladi.

## Foydalanuvchi qarorlari (2026-10-13)

| # | Savol | Qaror |
|---|---|---|
| 1 | Desktop (768px dan keng) | **Desktopda ham shu UI, faqat sidebar bilan.** Jadval yo'q: guruhli ro'yxatlar, varaqlar, katta sarlavhalar hamma enda; navigatsiya sidebar'da (yig'iladigan), telefonda suzuvchi tab-bar. Mazmun to'liq enda (2026-10-04 qarori). |
| 2 | Telegram'da orqaga | **To'liq ekran qoladi** (2026-10-07). Ichki sahifalarda ilovaning o'z «‹ Orqaga» tugmasi (iOS uslubi, urg'u rangida), Telegram ichida qo'shimcha `WebApp.BackButton` ham. 2026-10-07 hujjatining 6-qarori («BackButton ishlatilmaydi») bekor. |
| 3 | Yangi funksiyalar | **Hammasi kiradi:** bosh sahifa dashboard'i (yangi `GET /app/dashboard`), «Bosh ekranga qo'shish» banneri (`addToHomeScreen`, Bot API 8.0+), «Qo'ng'iroq» tugmalari (`tel:`), sahifa o'tish animatsiyalari (React `ViewTransition`). |
| 4 | Qamrov | **Faqat user app (`apps/web`).** Admin panel o'zgarmaydi. |

## Reja bilan tasdiqlangan qarorlar

1. **Prototipda yo'q bo'limlar** (Sotuv, Moliya, ombor hujjatlari, valyuta kurslari, moliya kategoriyalari) xuddi shu naqshlar bilan o'tkaziladi: ro'yxat → guruhli qatorlar, yozuv → `DetailHead` + plitkalar + `KeyValue`, kichik forma → varaq, ko'p qatorli hujjat → forma sahifasi.
2. **Jadval ustunlarini yashirish** («Ustunlar» menyusi, `useHiddenColumns`) va `DataList` jadval modeli olib tashlanadi: qator nom · ikkinchi qator · o'ng qiymatni ko'rsatadi, maydon javoblari yozuv sahifasida (prototipdagidek). Ularning testlari funksiya bilan birga ketadi.
3. **Ombor bo'limi** 5 ta sahifali, segmented control'ga sig'maydi: `/warehouse` hub sahifasi (plitka ikonkali qatorlar: Xaridlar, Ta'minotchilar, Ko'chirishlar, Inventarizatsiya, Boshlang'ich qoldiq; ruxsat bo'yicha). Mahsulotlar (2 ta) va Moliya (3 ta) segmented control bilan.
4. **Tezkor plitkalar** bosh sahifada: [Vazifa, Mijoz, Sotuv, Xarid, To'lov] ichidan ruxsatli birinchi 4 tasi (prototipda Sotuv yo'q edi).
5. **Matn o'lchamlari** hamma ekranda prototipniki (17 / 15 / 14 / 13px), desktopda ham.
6. **Pager** qoladi (API sahifalab beradi), `Foot` ichida ixcham; bitta sahifada «Jami: N».
7. **Imo-ishoralar:** prototipning chapdan surib qaytishi va tab-bar linzasini sudrash qilinmaydi: brauzer va Telegram'ning o'z orqaga imo-ishorasi, BackButton; linza faqat animatsiya bilan ko'chadi.
8. **Sozlamalar** tablar o'rniga hub sahifa va ichki sahifalar (`/settings/customer-types`, `/settings/task-types`, `/settings/stages`, `/settings/dropdowns`, `/settings/currencies`, `/settings/finance-categories`, `/settings/roles`); `/settings?tab=x` `/settings/x` ga yo'naltiriladi, `settingsHref` yangi manzilni beradi.
9. **Profil sahifasi** (`/profile`) profil menyusi o'rnida; menyu tartibi sahifa (`/profile/menu`) dialog o'rnida; «Yana» varag'i yo'q: panelga sig'magan bo'limlar profil sahifasida.
10. **Dialog = varaq.** `components/ui/dialog.tsx` ning `DialogContent` i pastdan chiqadigan varaq bo'ladi (Base UI `Dialog`, `role="dialog"` saqlanadi), desktopda ham pastdan, 480px enda o'rtada. Yon `Sheet` (`ui/sheet.tsx`) o'chiriladi.

### Rad etilgan variantlar

- Desktopda jadval qoldirib faqat tokenlarni almashtirish: foydalanuvchi «desktopda ham shunday UI» dedi.
- Desktopda telefon enidagi o'rta ustun (Telegram Web uslubi): to'liq en 2026-10-04 da tanlangan.
- To'liq ekrandan voz kechib Telegram sarlavhasi va uning Back tugmasiga tayanish: to'liq ekran 2026-10-07 da tanlangan, o'z tugmasi brauzerda baribir kerak.
- Dashboard'ni mavjud ro'yxat endpoint'laridan client'da yig'ish: oylik yig'indi va ta'minotchilar qarzi yig'indisi uchun endpoint yo'q, 5–6 ta so'rov o'rniga bitta.
- Prototipning o'z SVG belgilari o'rniga faqat lucide: tab-bar to'ldirilgan ikonkalar talab qiladi, lucide konturli; tab-bar uchun prototip belgilari, qolgan joyda lucide.

## Spec'dan chetlanishlar

| # | Spec / avvalgi qaror | Yangi | Sabab |
|---|---|---|---|
| 1 | SPEC 7: «shadcn standart uslubida» | Telegram Wallet / iOS guruhli ro'yxat uslubi | foydalanuvchi prototipi |
| 2 | 2026-10-04: jadval (md+) / kartochka (telefon), `DataList`, «Ustunlar» | hamma enda guruhli qatorlar | 1-qaror |
| 3 | 2026-10-06: tab-bar 5 yoki 4 + «Yana», «Menyuni sozlash» dialogi, topbar | suzuvchi tab-bar home + 4, qolgani profil sahifasida; menyu tartibi sahifasi; topbar yo'q | prototip |
| 4 | 2026-10-07, 6-qaror: BackButton ishlatilmaydi | ishlatiladi (ichki sahifalarda), o'z «Orqaga» tugmasi bilan birga | 2-qaror |
| 5 | SPEC 6 / openapi: API ro'yxati | + `GET /app/dashboard` | 3-qaror |
| 6 | 2026-10-06 selects: `SelectBox` / `MultiSelectBox` shadcn Select ustida, `/settings` tablari, `Pager` | tanlovlar varaqda (`PickerSheet`), sozlamalar hub, `Pager` `Foot` ichida | prototip |

## Dizayn

### Tokenlar (`apps/web/app/globals.css`)

Prototip o'zgaruvchilari shadcn nomlariga ulanadi (mavjud `bg-card`, `text-muted-foreground`, `border` classlar ishlayveradi), yetishmaganlari yangi token.

| shadcn / yangi | Light | Dark | Telegram (`html[data-telegram]`) |
|---|---|---|---|
| `--background` | `#EDEEF2` | `#000` | `--tg-theme-secondary-bg-color` |
| `--card`, `--popover` | `#fff` | `#1C1C1E` | `--tg-theme-section-bg-color` (fallback bg) |
| `--foreground` | `#000` | `#fff` | `--tg-theme-text-color` |
| `--muted-foreground` (hint) | `#636368` | `#98989F` | `--tg-theme-hint-color` |
| `--muted`, `--secondary`, `--accent` (fill) | `rgba(118,118,128,.12)` | `rgba(118,118,128,.24)` | hint'dan `color-mix` 12% |
| `--border` (sep) | `rgba(60,60,67,.17)` | `rgba(84,84,88,.6)` | `--tg-theme-section-separator-color` |
| `--primary` / `--primary-foreground` | `#117A68` / `#fff` | `#3CC5AE` / `#00261F` | `--tg-theme-button-color` / `--tg-theme-button-text-color` |
| `--destructive` (red) | `#D92D20` | `#FF6961` | `--tg-theme-destructive-text-color` |
| yangi `--press` | `#E2E3E8` | `#2C2C2E` | bg va text `color-mix` |
| yangi `--heading` (sh) | `#3A3A3F` | `#D1D1D6` | text 85% |
| yangi `--accent-soft`, `--red-soft`, `--green`, `--green-soft`, `--warn`, `--warn-soft` | prototip | prototip | primary / hint'dan `color-mix` |
| yangi `--glass`, `--glass-edge`, `--menu`, `--sheet-bg`, `--sheet-cell`, `--scrim`, `--shadow`, `--skel`, `--mix` | prototip | prototip | bg'dan `color-mix` |
| `--brand`, `--brand-panel` | o'zgarmaydi | o'zgarmaydi | o'zgarmaydi |

- Radiuslar `@theme` da nomlangan: `--radius-group: 22px`, `--radius-tile: 18px`, `--radius-sheet: 36px`, `--radius-main: 14px`, `--radius-badge: 7px`; shadcn `--radius` 14px.
- Shrift: `-apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", var(--font-geist), system-ui, "Segoe UI", sans-serif` (Geist `next/font` orqali qoladi); `body` 17px / 1.3, `-webkit-font-smoothing: antialiased`; raqamlar `tabular-nums`.
- Harakat: `--ease: cubic-bezier(.23,1,.32,1)`, `--drawer: cubic-bezier(.32,.72,0,1)`, `--spring: cubic-bezier(.34,1.4,.52,1)`; `prefers-reduced-motion` hozirgi qoida.
- `pb-safe`, `pt-safe`, `--safe-top`, Telegram qobiq balandligi, `scrollbar-hide` saqlanadi; yangi `pb-bar` (suzuvchi tab-bar uchun pastki joy: 128px + xavfsiz zona).

### Komponent to'plami (`apps/web/components/kit/` yangi; `components/ui/*` qayta uslublanadi)

Har biri Vitest bilan (RED → GREEN), `data-slot` belgilari bilan. Nimani almashtirishi qavsda.

| Fayl | Nima |
|---|---|
| `kit/group.tsx` | `Group` (`inset: "icon" \| "tile" \| "none"`: ajratgich 68 / 60 / 16px dan), `Row` (media · body: title + badge, sub · end: val, sub2 · chevron; `Link` / `button` / `div`; `variant: link \| danger \| accent`; `compact`; bosilganda `--press`), `KeyValue`, `SectionHeading` (sarlavha + o'ngda amal yoki `hint`), `Foot` (`center`). (`DataList`, `Identity`, `Fact`, `settings/section.tsx`, `setting-row.tsx` o'rniga) |
| `kit/page-title.tsx` | `PageTitle` (h1 30px + izoh + o'ngda dumaloq `+` yoki boshqa amal), `BackLink` («‹ Ota sahifa», urg'u rangida, 44px nishon, `transitionTypes={["nav-back"]}`). (`page-header.tsx` o'rniga) |
| `kit/detail-head.tsx` | `DetailHead` (avatar 88px yoki `pic`, h1 26px, p, badgelar), `Tiles` + `Tile` (dumaloq ikonka + nom; button yoki `href`, `danger`) |
| `kit/avatar.tsx` | gradientlar g0–g4 (seed hash), `square`, `size: md \| lg`, `letter` (mahsulot harfi) (`avatar.tsx` o'rniga) |
| `kit/tile-icon.tsx` | `TileIcon` (32px kvadrat, rang + lucide ikonka), bo'lim ranglari `sectionColors` |
| `ui/badge.tsx` | 22px, 7px radius, `variant: neutral \| red \| green \| accent \| warn`, `dot`; `tasks/stage-badge.tsx` `color-mix` bilan |
| `kit/chips.tsx` | `Chips` (gorizontal scroll tasma) + `Chip` (36px, `on`, ixtiyoriy son va chevron) (filtr tablari o'rniga) |
| `kit/segmented.tsx` | `Segmented` (`role="tablist"`, animatsiyali thumb) (`Tabs` tasmalari, ko'rinish radiolari, `section-tabs.tsx` o'rniga) |
| `kit/search-box.tsx` | 44px pill, ikonka, tozalash (`customers/search-input.tsx` o'rniga; debounce mantig'i ko'chadi) |
| `kit/main-button.tsx` | `MainButton` (52px, 14px radius; `variant: accent \| ghost \| red`; `pending` → spinner + `aria-busy`, fokus saqlanadi) va `MainBar` (pastki gradientli panel, `pb-safe`). (`PendingButton` shunga qaytadi; `ui/button.tsx` qoladi: `plus`, `mini`, `icon` variantlari) |
| `ui/dialog.tsx` | `DialogContent` = varaq: tutqich, bosh (chapda yopish, o'rtada sarlavha + `small`, o'ngda slot), scroll body, `DialogFooter` = `MainBar`; `tall`; desktopda 480px o'rtada. `ui/sheet.tsx` o'chiriladi |
| `ui/alert-dialog.tsx` | shisha, 32px radius, ikki tugma (`fill` / `red` yoki `acc`) |
| `kit/action-sheet.tsx` | `ActionSheet` (sarlavha, elementlar: nuqta / belgi / `danger`, «Bekor qilish») |
| `ui/dropdown-menu.tsx` | shisha menyu (blur, 24px radius), desktopda kerak joyda |
| `ui/switch.tsx` (yangi, Base UI Switch) | iOS 51×31 kalit (`checkbox-field.tsx` o'rniga) |
| `kit/form-row.tsx` | `FormRow` (112px yorliq + boshqaruv; `stack`; xato), `TextRow`, `PhoneRow` (+998 niqob), `AmountRow` (so'm, guruhlash), `PickRow` (qiymat + chevron, varaq ochadi), `OptionChips` (radio / checkbox), `SwitchRow`, `DateTimeRow` (kun → `DateSheet`, vaqt → `type=time`); react-hook-form `Controller` bilan (`text-field.tsx`, `phone-field.tsx`, `select-field.tsx`, `currency-field.tsx`, `ui/field.tsx` o'rniga) |
| `kit/picker-sheet.tsx` | `PickerSheet` (bitta / ko'p, ixtiyoriy qidiruv, `none`, media, badge, `disabled`), `SearchPickerSheet` (serverdan: mijoz, mahsulot, ta'minotchi; mavjud hooklar qoladi) (`select-field.tsx`, `picker.tsx`, `warehouse/pickers.tsx`, `sales/customer-picker.tsx`, `tasks/customer-picker.tsx` o'rniga) |
| `kit/date-sheet.tsx` | kalendar varag'i: chiplar (Bugun, Ertaga, 3 kun, 1 hafta), oy navigatsiyasi, 42px kunlar, «Tanlash» |
| `kit/amount-sheet.tsx` | `AmountSheet` + `Keypad`: to'lov summasi, qarz / avans izohi, «To'liq» |
| `states.tsx` | `EmptyState` (ikonka + h3 + p + ixtiyoriy `MainButton`), `NotFound`, `Failed`, `Loading`, `ListLoading` (guruh qatorlari), `Splash`, `StateScreen` (ikonka, h1 26px, p, `MainBar`) |
| `ui/sonner.tsx` | shisha pill, yashil / qizil ikonka, tepada o'rtada, `--safe-top` |
| `refusal.tsx` | qizil yumshoq karta, ikonka, amallar |
| `history-list.tsx` | amal · kim · qachon, «eski → yangi» |
| `kit/stat-card.tsx` | `StatCard` (192px), `Bars`, `Sparkline` (SVG) |
| `kit/hero.tsx` | `Hero` + `Amount` (56 / 40 / 32px, enga sig'adi), badgelar |
| `kit/banner.tsx` | `HomeBanner` («Bosh ekranga qo'shing», SVG art, yopish) |
| `tasks/task-board.tsx`, `task-card.tsx` | prototip kanban: snap ustunlar (84vw telefonda, 288px desktopda), karta, bo'sh ustun, «Jami», yakuniy ustun vertikal; `⋯` → `ActionSheet`; dnd-kit qoladi (TouchSensor delay 330ms) |
| `tasks/stage-track.tsx`, `tasks/deadline-card.tsx` | vazifa sahifasi: bosqich treki (radiogroup), muddat kartasi |
| `kit/tab-icons.tsx` | to'ldirilgan tab ikonkalari (prototip `t-*`: home «24», mijozlar, vazifalar, mahsulotlar, ombor, xodimlar, sozlamalar; shu uslubda sotuv (sumka) va moliya (hamyon)) |
| `sortable-list.tsx` | «Tartiblash» rejimi: tutqich faqat rejimda; dnd-kit sortable qoladi |

### Qobiq va navigatsiya

- `shell/app-shell.tsx`: telefonda topbar yo'q; `<main>` 16px yon, pastda `pb-bar`; desktopda chapda `Sidebar`, o'ngda `<main>` (24px). `Topbar`, `MoreSheet`, `NavOrderDialog`, `ThemeToggle` o'chiriladi.
- `shell/tab-bar.tsx`: suzuvchi shisha panel (64px, 32px radius, `bottom: 22px + xavfsiz zona`), linza faol tugma ostida (`--spring`), 10.5px nomlar, to'ldirilgan ikonkalar. Bosh sahifa + a'zo tartibidagi birinchi 4 bo'lim (`lib/nav.ts` `barItems` → `{ shown, more }`); `more` profil sahifasida. Ichki sahifada panel yashirinadi.
- `shell/sidebar.tsx`: `--background` fon, bo'limlar qator uslubida (joriyda `accent-soft` plashka), tepada logo + kompaniya, pastda profil qatori (avatar + ism · rol → `/profile`), lokatsiya pill, mavzu tugmasi (brauzerda). Yig'ilish saqlanadi.
- `/profile` (`components/profile/profile-page.tsx`): `DetailHead` (ism, telefon); «Bosh ekranga» kartasi (Telegram); «Kompaniya» (nom + rol badge; «Lokatsiya» → `ActionSheet`; «Kompaniyani almashtirish»); «Bo'limlar» (panelga sig'maganlar); «Ilova» («Pastki menyu» → `/profile/menu`; «Mavzu» → action sheet: Tizim / Yorug' / Qorong'i, brauzerda); `Foot`; «Chiqish» (danger, brauzerda).
- `/profile/menu` (`components/profile/menu-order-page.tsx`): qulflangan «Hisob24», sudraladigan bo'limlar, «Profil sahifasida» ajratgichi 4-dan keyin, «Menyuda» badge, «Standart holat», `MainBar` «Saqlash» (`useSetNavOrder`).
- Bosh sahifa `topbar` (telefonda): `me` tugmasi → `/profile`; lokatsiya pill → `ActionSheet` (`shell/location-switcher.tsx`). Ichki ro'yxat sahifalari izohida lokatsiya nomi.
- Orqaga: `BackLink` har ichki sahifada. Telegram'da `telegram-sync.tsx`: `BackButton.show()` / `hide()` yo'l ildiz emasligiga qarab, `onClick` → `router.back()`; `types/telegram.d.ts`: `BackButton`, `addToHomeScreen`, `checkHomeScreenStatus`.
- Sahifa o'tishlari: React `ViewTransition` har `app/**/page.tsx` da (`enter` / `exit` `nav-forward` / `nav-back`, `default: "none"`), ichki havolalar `transitionTypes={["nav-forward"]}`, `BackLink` `nav-back`; CSS: yangi sahifa o'ngdan 100% → 0 (`--drawer`), eski −28% parallaks; `::view-transition { pointer-events: none }`; reduced motion → 0s. Hujjat: `node_modules/next/dist/docs/01-app/02-guides/view-transitions.md` (layout'da emas, `page.tsx` da).

### Sahifa naqshlari

- **Ro'yxat:** `PageTitle` (nom, «Kompaniyangiz mijozlari · N ta», `+` tugma `aria-label` to'liq matn, masalan «Mijoz qo'shish») → `Segmented` → `SearchBox` → `Chips` (tur; Faol / Nofaol sonlari bilan; «Mas'ul», «Bosqich» chip'i → `PickerSheet`) → `Group inset="icon"` qatorlari (avatar / `TileIcon`; nom + badge; ikkinchi qator; o'ngda summa / sana / holat) → `Foot` «Jami: N» yoki `Pager`. Hujjat ro'yxatlari kun bo'yicha (`SectionHeading` «Bugun», «Kecha», «8-oktabr, payshanba» + kun yig'indisi). Bo'sh: `EmptyState` ikonka bilan va `MainButton`; sozlama yo'q: egasiga «Sozlamalarni ochish»; lokatsiya yo'q: `EmptyState` pin.
- **Yozuv:** `BackLink` → `DetailHead` (hujjatda `Hero` summa) → `Tiles` (Tahrirlash, Vazifa / Xarid / To'lov, Qo'ng'iroq `tel:`, Nofaol qilish, O'chirish) → `SectionHeading` + `Group` bo'limlari («Ma'lumot» `KeyValue`; bog'liq ro'yxatlar; `Segmented`) → «Tarix» → pastda danger qator (→ `AlertDialog`).
- **Kichik forma (varaq):** izoh, `Refusal`, `Segmented` (tur), `Group` ichida `FormRow`lar, `Foot`, `MainBar` «Qo'shish» / «Saqlash»; fokus birinchi maydonga. Mavjud ~30 dialog faylining tarkibi o'zgaradi, `useForm` + `zodResolver` + mutation mantig'i qoladi.
- **Hujjat formasi (sahifa):** `PageTitle`, `Group` (`PickRow` ta'minotchi / mijoz, `DateTimeRow`, valyuta + kurs), «Mahsulotlar» + `LineCard` (mahsulot `PickRow`, miqdor / narx grid, summa, olib tashlash) + «Qator qo'shish», jami, `Group` (to'lovlar, izoh), `Foot`, `MainBar` «Saqlash».
- **Sozlamalar hub** (8-qaror): `/settings` plitka ikonkali qatorlar; ro'yxat sahifalari `SectionHeading` «N ta tur» + «Tartiblash» rejimi; variant / maydon qatorlari → `ActionSheet` yoki varaq.
- **Ombor hub** (3-qaror): `/warehouse`; `lib/nav.ts` `warehouse.href = "/warehouse"`, `tabs` `isCurrentItem` uchun qoladi.
- **Kirish va holatlar:** `LoginFrame` brend paneli qoladi, maydon va tugma yangi uslubda; `TelegramLogin` holatlari `Splash` / `StateScreen`; `/select-company` prototip `companies` ekrani; `/expired` `StateScreen`.

### Bosh sahifa va `GET /app/dashboard`

Ekran: `topbar` (me + lokatsiya) → `Hero` (`purchases.view` → «Ta'minotchilarga qarz» UZS qatori + boshqa valyutalar badge, «N ta ta'minotchi» / «Qarz yo'q», avans; aks holda `tasks.view` → «Faol vazifalar» + kechikkanlar; aks holda «Mijozlar» soni) → `Tiles` (4-qaror; «To'lov» → ta'minotchi `SearchPickerSheet` → `AmountSheet`) → `HomeBanner` (Telegram, `isVersionAtLeast("8.0")`, `checkHomeScreenStatus` ≠ `added` / `unsupported`, yopilgani `localStorage` da) → «Umumiy holat» kartalari: Vazifalar (faol, kechikkan, bosqichlar `Bars`), Xaridlar (oy yig'indisi, soni, kun bo'yicha `Sparkline`) yoki Mijozlar (soni, «+N oktabr», `Sparkline`), `sales.view` bo'lsa Sotuv → «Yaqin muddatlar» (5 ta faol vazifa qatori + «Barcha vazifalar») → havolalar `Group inset="tile"` (Ta'minotchilar soni; panelga sig'magan Xodimlar, Sozlamalar) → `Foot` «Obuna dd.mm.yyyy gacha faol» (`company.end_date`). Desktopda plitkalar va kartalar 4 ustun.

API: `GET /app/dashboard?location_id=` (`requireCompany`; har blok o'z `*.view` ruxsati bilan, ruxsatsiz blok `null`; `location_id` a'zoga ruxsatli bo'lishi shart (aks holda 404), vazifalar / xaridlar / sotuv shu lokatsiyaniki, lokatsiyasiz a'zoda ular `null`). Javob `Dashboard`:

```
suppliers: { debt: BalanceLine[], debtors: int, advance: BalanceLine[] } | null   // purchases.view
customers: { total: int, added_this_month: int, by_day: int[] } | null             // customers.view
tasks: { active: int, late: int, by_stage: [{ stage_id, count }], upcoming: Task[] (5, muddat bo'yicha) } | null  // tasks.view
purchases: { month_total: BalanceLine[], month_count: int, by_day: string[] } | null  // purchases.view
sales: { month_total: BalanceLine[], month_count: int, by_day: string[] } | null      // sales.view
```

`by_day` oyning 1-kunidan bugungacha (baza sanasi, Toshkent) yig'ilgan (kumulyativ). Backend: `backend/internal/dashboard/` (servis), `internal/app/dashboard.go` (handler, marshrut), `internal/db/queries/dashboard.sql` (yig'ma so'rovlar; `ListPartyBalanceByCurrency`, `CountTasks` / `ListTasks`, `CountCustomers` naqshlari), `openapi.yaml` + `make api-client`, contract testi. Web: `mocks/dashboard.ts`, `lib/queries.ts` `useDashboard(companyId, locationId)`, `components/home/*`.

### Testlar va talab o'zgarishlari

- Yangi primitivlar: har biriga Vitest (RED → GREEN). Sahifa testlari: `getByRole("table")` → `getByRole("list")`; `role="dialog"` saqlanadi; `Segmented` `role="tablist"` / `tab`; select testlari (`test/select.ts` `choose`) → `test/pick.ts` (`PickerSheet` ichidan variant); `PageHeader` amallari → plitka tugmalari (nomlar o'sha: «Tahrirlash», «O'chirish»). O'chiriladigan testlar faqat olib tashlanadigan funksiyalar uchun (`data-list`, `columns-menu`, `use-hidden-columns`, `more-sheet`, `topbar`, `nav-order-dialog`, `section-tabs`, `theme-toggle`, `identity`, `page-header`, `select-field`, `picker`) — hisobotda sababi bilan; qolganlari talab o'zgargani uchun yangilanadi.
- e2e (`apps/web/e2e/helpers.ts`): `sections()` tab-bar / sidebar; `openSection()` panelga sig'magan bo'lim profil sahifasi orqali; `list()` har doim `getByRole("list")`; `choose()` → picker varag'i; `shell.spec.ts` yangi qobiq; `miniapp.spec.ts` BackButton (soxta obyekt), `addToHomeScreen`; boshqa spec'lar sahifa o'zgarishlariga mos.
- Backend: dashboard uchun db (`pgtest`), servis (table-driven), handler, contract testlari; mutatsiya: ruxsatsiz blok `null` bo'lmasa, begona lokatsiya rad etilmasa yiqilsin.
- Har bosqich oxirida `make lint`, `make test`, `make e2e`; skrinshotlar vaqtinchalik Playwright spec bilan (375px @2x va 1280px, MSW), keyin o'chiriladi. Oxirida lokal haqiqiy stack smoke.

## Bosqichlar

Har bosqich: TDD (RED → GREEN → commit), oxirida `make lint && make test && make e2e` → `git push` → hisobot (har funksiya RED → GREEN) → tasdiq. Admin app'ga tegilmaydi: umumiy nusxa fayllar (`avatar`, `identity`, `page-header`, `states`, `pending-button`, `refusal`) faqat `apps/web` da o'zgaradi.

0. **Hujjat:** shu spec, `CLAUDE.md` manbalar qatori, `docs/design/README.md` va 2026-10-07 hujjatiga izoh.
1. **Poydevor:** tokenlar, shrift, `components/kit/*` va qayta uslublangan `ui/*` (jadval). Mavjud sahifalar eski komponentlar bilan ishlayveradi (yangi ranglarda).
2. **Qobiq, profil, kirish ekranlari:** `AppShell`, suzuvchi `TabBar`, `Sidebar`, `/profile`, `/profile/menu`, `/warehouse` hub, lokatsiya action sheet, `BackLink` + BackButton, `HomeBanner` + `addToHomeScreen`, bosh sahifaning statik qismi, kirish va holat ekranlari.
3. **Dashboard:** API (backend) va bosh sahifa vidjetlari.
4. **Mijozlar va Vazifalar.**
5. **Mahsulotlar va Ombor** (xaridlar, ta'minotchilar, to'lov klaviaturasi, ko'chirish, inventarizatsiya, boshlang'ich qoldiq).
6. **Sotuv va Moliya.**
7. **Xodimlar va Sozlamalar** (hub va ichki sahifalar, rol sahifasi kalitlar bilan).
8. **O'tish animatsiyalari, yakuniy tekshiruv, hujjatlar** (README, `docs/design`, skrinshotlar, haqiqiy stack smoke, mutatsiya tekshiruvi).

## Chegara

- Admin panel; backend'ning dashboard'dan boshqa o'zgarishlari; yangi biznes qoidalar.
- Foydalanish shartlari / Maxfiylik siyosati sahifalari (prototipda havola bor, loyihada hujjat yo'q).
- Tab-bar linzasini sudrash, chapdan surib qaytish imo-ishorasi.
- Production deploy alohida so'raladi.

## Amalga oshirishda belgilangan qarorlar

### 2-bosqich (qobiq, profil, kirish ekranlari)

1. **Bosh sahifa doim birinchi** va qulflangan: `navFor` uni boshiga qo'yadi, `nav_order` dagi `home` o'rni e'tiborga olinmaydi. Tab-bar: bosh sahifa + a'zoning birinchi 4 bo'limi (`barItems` → `{ shown, more }`), qolganlari profil sahifasida va telefonda bosh sahifada qator-qator; «Yana» yo'q. Tab yorlig'i «Bosh sahifa» (prototipda «Hisob24»), belgisi «24».
2. **Ildiz sahifalar** (`rootPaths`, `isRootPath`): `/`, har bo'lim manzili, segmentli bo'limlarning tablari, ombor hub'i. Tab-bar faqat ildizda ko'rinadi (yashirilganda `aria-hidden` + `inert`), ichki sahifada sahifaning `BackLink` i va Telegram BackButton.
3. **Telegram BackButton** (`TelegramSync`): ildiz va qobiqsiz sahifalarda (`/login`, `/select-company`, `/expired`) yashirin; bosilganda orqada sahifa bo'lsa `router.back()`, bo'lmasa bo'lim ildiziga. «Orqada sahifa bormi» — Navigation API `canGoBack` (bor joyda), aks holda `history.length > 1`: birinchi sahifaga qaytilgandan keyin tarix uzun qoladi, tugma o'lik bo'lmasin.
4. **Lokatsiya tanlovi** bosh sahifa boshida (pill + action sheet), keng ekranda sidebar pastida va profil sahifasida («Lokatsiya» qatori). Ro'yxat sahifalarida tanlov yo'q (prototipdagidek); telefonda boshqa lokatsiyaga o'tish bosh sahifa orqali.
5. **Profil sahifasi** (`/profile`): `DetailHead`, Telegram'da «Bosh ekran» kartasi («Qo'shish» / «Yashirish»), «Kompaniya» (nom + rol, lokatsiya, kompaniyani almashtirish), «Bo'limlar» (bar'ga sig'maganlar), «Ilova» («Pastki menyu», brauzerda «Mavzu»: Tizim / Yorug' / Qorong'i), `Foot`, brauzerda «Chiqish». `Topbar`, `MoreSheet`, `NavOrderDialog`, `ThemeToggle` o'chirildi (testlari bilan: funksiyalari profil va `/profile/menu` ga ko'chdi).
6. **Bosh sahifaning `h1`** «Salom, {ism}» ko'zga ko'rinmas (`sr-only`), ko'zga prototipdagi profil tugmasi (kompaniya, «Ali V. · Egasi»: `shortName`). Bosh sahifadagi «Bo'limlar» qatorlari faqat telefonda (`md:hidden`): keng ekranda hammasi sidebar'da.
7. **Bosh ekranga qo'shish** (`useHomeScreenOffer`): Telegram 8.0+, `addToHomeScreen` va `checkHomeScreenStatus` bor, holat `missed` yoki `unknown`; `homeScreenAdded` hodisasidan keyin yoki «Yopish» / «Yashirish» bosilsa yo'qoladi (`home_screen_offer_hidden` brauzerda).
8. **Kompaniya tanlash** (`/select-company`): kvadrat avatarli qatorlar, nofaollari xira + sabab badge'i, ulardan biri bo'lsa `Foot` «Muddati o'tgan yoki bloklangan kompaniyani tanlab bo'lmaydi.»; ilovadan kelinganda (sessiyada kompaniya bor) joriysi «Joriy» va «‹ Profil» havolasi.
9. **Holat ekranlari** (`ShellLess` + `StateScreen` / `Splash`): to'liq ekranda Telegram sarlavhasi yo'q, shuning uchun tepada kichik Hisob24 logotipi qoladi; splash'da logotip o'rnida «H24» belgisi (`role="img"`, nomi «Hisob24»). Raqamni yuborishni rad etgandan keyin «Raqamni yuborish» qoladi, ostida «Botga qaytish».
10. **Kirish (brauzer):** raqam `PhoneRow` qatorida, «Kodni olish» `MainButton`, kod qadamida ghost tugmalar, Telegram'dan qaytish sababi `Refusal` kartasi. `LoginFrame` brend paneli o'zgarmadi.
11. **Forma qatori**dagi input 44px (barmoq nishoni), qator balandligi prototipdagidek 52px (`py-1`).
12. **Tab kengligi** `min(72px, (100vw − 24px) / 5)`: 360px va 320px telefonda ham bar ekranga sig'adi.
13. **Sidebar** yig'ilganda 64px (avvalgidek), pastida lokatsiya pill'i va profil qatori (avatar, ism, rol); yig'ilganda avatar «Profil: {ism}».
14. **e2e:** Playwright serveri Next dev indikatorini yashiradi (`HIDE_DEV_INDICATOR=1`): burchakdagi indikator suzuvchi bar'ning birinchi tabini to'sardi. Yordamchilar: `goHome`, `openSection` (bar'dan tashqaridagi bo'lim bosh sahifa ro'yxati orqali), `openProfile`, `signOut`, `homeHead`, `locationSwitch`, `chooseLocation` (telefonda bosh sahifaga borib qaytadi).

### 3-bosqich (dashboard API va bosh sahifa vidjetlari)

1. **Pul so'mda**, har hujjat o'z kurs qatori bilan (`logic/currencies.md`, 4-bo'lim; ta'minotchilar ro'yxatidagi `balance` formulasi): yuqoridagi qoralamadagi `BalanceLine[]` o'rniga bitta summa. `suppliers { debt, debtors, advance }`, `purchases` / `sales` `{ month_total, month_count, by_day }`.
2. **Begona lokatsiya 403 `forbidden`** (ro'yxatlar qoidasi, `logic/locations.md`; client shundan `/app/me` ni qayta so'raydi), son emas 400 «Lokatsiya noto'g'ri»; qoralamadagi 404 o'rniga. `location_id` berilmasa a'zoga ruxsatli hamma lokatsiya.
3. **Kunlar a'zoning vaqt zonasida** (`users.timezone`, standart Asia/Tashkent; kassa ro'yxatidagi `memberZone` kabi): bugun, oy boshi, hujjat va mijoz kuni. Bugun Go'dan uzatiladi (testlarda qat'iy sana).
4. **Bloklar ruxsat bo'yicha**: `suppliers` va `purchases` — `purchases.view`, `customers` — `customers.view`, `tasks` — `tasks.view`, `sales` — `sales.view`. Ta'minotchi va mijoz bloklari kompaniyaniki (cheklangan xodim ham butun balansni ko'radi), vazifa, xarid va sotuv lokatsiyaniki. `tasks.upcoming` — `task.Service.Upcoming` (ro'yxatdagi `Task`).
5. **Yangilik:** dashboard har bosh sahifa ochilishida qayta so'raladi (so'rovlar darhol eskiradi), bosh sahifadagi dialog (vazifa, mijoz, to'lov) yopilganda ham — mutatsiyalarning har biriga eskirtirish qo'shilmadi.
6. **Tezkor plitkalar:** Vazifa (`tasks.create` + `customers.view` + lokatsiya), Mijoz (`customers.create`), Sotuv (`sales.create` + lokatsiya, `/sales/new`), Xarid (`purchases.create` + `suppliers.view` + lokatsiya, `/purchases/new`), To'lov (`purchases.create` + `suppliers.view`: faol ta'minotchilar varag'i, keyin to'lov dialogi); birinchi 4 tasi. Sozlamasi yo'q kompaniyada (vazifa turi / bosqich, mijoz turi yo'q) plitka bo'limga olib boradi, u yerda nima sozlash kerakligi aytiladi. `PaymentDialog` va `AddCustomerDialog` tashqaridan ham ochiladi (`open` / `onOpenChange`, tugmasiz); akkauntlar keyin kelsa, yangi to'lov birinchisini oladi.
7. **Kartalar:** Vazifalar (bosqichlar `Bars`, bosqich rangi `colorValues`), Xaridlar yoki Mijozlar, Sotuv; ixcham summa `compactAmount` («4,6 mln»). `StatCard` raqami va birligi orasida matnli bo'sh joy (ekran o'quvchi «4 ta faol» deb o'qiydi).
8. **Qobiq tuzatishi:** `main` ning bevosita bolalari `shrink-0`: aks holda uzun sahifada `overflow-hidden` guruh ro'yxati ekranga sig'ish uchun qisqarib, oxirgi qatorlari kesilardi (telefonda «Yaqin muddatlar» qatorlari bosilmasdi).
9. Test yordamchisi `renderWithProviders` ning `rerender` i o'sha provider'lar ichida chizadi.

### 4-bosqich (mijozlar va vazifalar)

1. **Ro'yxatlar hamma enda qatorlar** (`Group` / `Row`), jadval yo'q: mijoz qatori — avatar, nom (nomsiz mijoz telefon bilan), «telefon · tur», o'ngda qarz / avans; vazifa qatori (`TaskRow`) — sarlavha, «bosqich · mijoz · lokatsiya (2+) · mas'ul», o'ngda `dd.mm` va qolgan / o'tgan kun (kechikkani qizil). Maydon javoblari yozuv sahifasida. «Ustunlar» menyusi (`ColumnsMenu`, `useHiddenColumns`, `fieldColumns`) testlari bilan o'chirildi: jadval yo'q, yashiradigan ustun yo'q (talab o'zgarishi).
2. **Filtrlar:** mijoz turi `ChoiceChips` («Mijoz turi»: Barchasi + turlar), vazifalarda tur chiplari, «Mas'ul» chip'i (Barcha mas'ullar / Men / qisqa ism, varaqda «Men» birinchi) va ro'yxat ko'rinishida «Bosqich» chip'i — tanlov `PickerSheet` da. Ko'rinish (Kanban / Ro'yxat) `Segmented` (`tablist`), tanlangani avvalgidek saqlanadi. Sarlavha izohi: lokatsiya (2+ bo'lsa) · «N ta».
3. **Vazifalar ro'yxati muddat bo'yicha guruhlar** (`deadlineBucket`): Kechikkan, Bugun, Shu hafta (7 kungacha), Keyinroq, Bajarilgan; guruh sarlavhasida soni. API tartibi (muddat) o'zgarmadi.
4. **Kanban:** ustun telefonda ekranning 84% i (snap), keng ekranda 288px; karta — sarlavha, mijoz, «dd.mm · qolgan kun» (bajarilganda «bajarildi»), mas'ul avatari va qisqa ismi, hamma tur ko'rinsa tur badge'i; `⋯` → `ActionSheet` ««{sarlavha}» bosqichi»; bo'sh ustunda «Kartani shu yerga suring» (ko'chira oladiganga) yoki «Bo'sh»; yakuniy ustun yig'ilgan holda 58px, nomi tik; pastida «Jami: N». Barmoq bilan sudrash 330ms bosib turishdan keyin (avvalgidek).
5. **Yozuv sahifalari:** mijoz — `DetailHead`, plitkalar Tahrirlash, **Vazifa** (`tasks.create` va joriy lokatsiya bo'lsa: vazifa varag'i shu mijoz bog'langan holda ochiladi), Qo'ng'iroq (`tel:+998…`); balans, «Ma'lumot», hisob harakati, vazifalari (2+ lokatsiyada har biri o'z lokatsiyasi bilan), tarix, pastda «Mijozni o'chirish». Vazifa — bosqich rangidagi belgi, **bosqich treki** (`radiogroup` «Bosqich», bosqich shu yerda almashadi, `tasks.edit` siz o'chiq), muddat kartasi, plitkalar Tahrirlash / Mijoz / Qo'ng'iroq, mijoz qatori, «Ma'lumot», tarix, pastda «Vazifani o'chirish».
6. **Varaqlar** (`SheetForm`: forma varaq tanasini to'ldiradi, `MainButton` pastda): mijoz — tur chiplari, `PhoneRow`, maydonlar `FieldAnswer` orqali (matn `TextRow` «Majburiy» / «ixtiyoriy» placeholder bilan, dropdown — varaqli `SelectRow`, ixtiyoriysida «Tanlanmagan», bir nechta — «Tayyor» li varaq, radio / checkbox — `OptionChips`, variantsiz tanlovda «Faol variant yo'q…» izohi). Vazifa — tur chiplari (2+ tur bo'lsa), «Mijoz» va «Vazifa» qismlari (`fieldset` + `legend`).
7. **Vazifa varag'ida mijoz:** telefon qatori (`combobox`) va takliflar o'sha guruhda qator-qator (avatar, nom, «telefon · tur», «Tanlash»), klaviatura bilan ham; ostida izoh (3 ta raqam / ruxsat yo'q / mijoz turi yo'q). Tanlangan mavjud mijoz faqat **«Mavjud mijoz» kartasi** (avatar, nom, «tur · telefon», «Mijozni ochish», «Boshqa mijoz»): telefoni, turi va javoblari endi so'ralmaydi (avval qulflangan maydonlar ko'rinardi — talab o'zgarishi). Raqami band bo'lsa rad etish kartasida «Shu mijozni biriktirish» va «Mijozni ochish».
8. **Muddat** telefonning o'z sana tanlovi (`input type=date`, qator ichida), `DateSheet` emas: telefonda tizim kalendari qulay, sana formati brauzerniki.
9. **Vazifa varag'ining yuklovchisi** `NewTask` (`components/tasks/new-task.tsx`): bosh sahifa plitkasi va mijoz sahifasi uchun bitta; sozlamasi yo'q kompaniyada vazifalar sahifasiga olib boradi.
10. **Tuzatish:** tur chip'i tanlangan holda «Mijoz qo'shish» varag'i birinchi turni olardi — endi tanlangan turni oladi.
11. **O'chirildi:** `ColumnsMenu`, `useHiddenColumns`, `fieldColumns`, `Deadline` (o'rniga karta va qatordagi muddat, `DeadlineCard`), ishlatilmay qolgan `ui/sheet.tsx` va `ui/radio-group.tsx`. `DataList`, `Identity`, `Facts` hali sotuv, ombor, katalog, xodimlarda: 5–7-bosqichda.
12. **e2e:** `list()` yordamchisi «Mijozlar» va «Vazifalar» ni hamma enda ro'yxat sifatida o'qiydi (qolganlari o'z bosqichigacha keng ekranda jadval); qatorlar nomining boshi bilan topiladi (`/^Sarlavha/`).

### 5-bosqich (mahsulotlar va ombor)

1. **Katalog ro'yxati:** mahsulot qatori — harf plitkasi, nom, «birlik · artikul · qoldiq N» (joriy lokatsiya), o'ngda narx va «so'm / kg»; xizmat qatori — izoh yoki «Qo'shilgan sana», o'ngda narx. Holat `ChoiceChips` «Holat» (Faol N / Nofaol M): sonlar uchun ikki yengil so'rov (filtr va qidiruvsiz). «Mahsulotlar / Xizmatlar» — `SectionTabs` prototip segmented ko'rinishida, lekin havolalar bo'lib qoladi (marshrutlar). Xizmat qatori bosilganda `ActionSheet` («nom · narx»: Tahrirlash, Nofaol qilish / Faollashtirish, O'chirish); ruxsati yo'qqa qator bosilmaydi.
2. **Mahsulot sahifasi:** harf plitkasi, «Sotuv narxi» katta raqam (`Hero`), plitkalar Tahrirlash / **Xarid** (faol mahsulot, `purchases.create` + `suppliers.view` + lokatsiya → `/purchases/new?product=ID`) / Nofaol qilish; «Qoldiq» — har lokatsiya kartasi (`dl`), joriysi «Joriy» badge'i bilan. **Sparkline yo'q:** API qoldiq tarixini bermaydi, backend bu ishga kirmaydi. Keyin «Ma'lumot», xaridlar va harakatlar qatorlarda, pastda «Mahsulotni o'chirish».
3. **Varaqlar sahifadan ochiladi** (mahsulot, xizmat, ta'minotchi, to'lov, boshlang'ich qarz): har ochilishda qayta mount, o'z trigger tugmasi yo'q.
4. **Ta'minotchi:** ro'yxatda kvadrat avatar, telefon, o'ngda qarz / avans (`purchases.view` bilan); sahifada balans figurasi («Qarz» qizil, «Avans» yashil, «Qarz yo'q»; boshqa valyutalar «shu jumladan …»; «Jami xaridlar» / «Jami to'lovlar» chiplari), plitkalar **To'lov / Xarid** (`?supplier=ID`) / Qo'ng'iroq / Tahrirlash, statement, «Ma'lumot», pastda urg'u qatori «Nofaol qilish» va xavfli qator «Ta'minotchini o'chirish».
5. **Statement qatorlari** (ta'minotchi va mijoz sahifasi): yumshoq belgi (hujjat, to'lov yashil, boshlang'ich sariq), «Xarid № N» / «To'lov · Sotuv № N» / «Boshlang'ich qarz», ostida vaqt · akkaunt (so'mdan boshqa valyutada summa ham), o'ngda so'mdagi o'zgarish (+ qizil, − yashil) va «balans N». Hujjat va u bilan kiritilgan to'lov hujjatga olib boradi; alohida to'lov va boshlang'ich qoldiq `ActionSheet`da (Tahrirlash / O'chirish). Prototip «Xaridlar / To'lovlar» segmentlari o'rniga bitta statement qoldi: unda boshlang'ich qoldiq va yurib boruvchi balans bor.
6. **To'lov qo'shish sahifa plitkasiga ko'chdi** (prototipdagidek): statement sarlavhasida faqat «Boshlang'ich». Mijoz sahifasiga ham «To'lov» plitkasi qo'shildi (`sales.create`), aks holda mijozdan to'lov olish yo'qolardi.
7. **To'lov varag'i** — `AmountSheet`: summa klaviaturada, akkaunt valyutasida; qarz ma'lum va akkaunt so'mda bo'lsa «Qarz: X so'm · To'liq» (tahrirdagi to'lov qayta qarzga qo'shib hisoblanadi); qatorlar Akkaunt, Vaqt (`datetime-local`), kurs, Izoh. Varaq hisoblardan oldin ochilsa, birinchi akkauntni ular kelganda oladi. Boshlang'ich qarz varag'i: tur `OptionChips` (tahrirda o'chiq), Valyuta, Summa (valyuta belgisi bilan), kurs, Vaqt, Izoh.
8. **O'chirish:** mahsulot — xavfli qator va xizmat varag'i uchun `DeleteProductDialog`; xarid, ko'chirish, inventarizatsiya, boshlang'ich qoldiq — xavfli plitka «O'chirish»; to'lov va boshlang'ich qarz — statement varag'idan `DeletePaymentDialog` / `DeleteOpeningDialog`.
9. **Hujjat ro'yxatlari** (xaridlar, ko'chirishlar, inventarizatsiya, boshlang'ich qoldiq) — `DayGroups`: «Bugun», «Kecha», «8-oktabr, payshanba» (`dayTitle`, `dayOf`); xaridlarda kun yig'indisi so'mda; xarid qatori o'ngida jami va «To'langan» / «To'lanmagan» / «X to'langan», ko'chirishda «Chiqim» / «Kirim».
10. **Hujjat sahifalari:** xarid va boshlang'ich qoldiq — `Hero heading` (h1 = «Xarid № N», jami; badge «Qoldi X» / «To'langan»), ko'chirish va inventarizatsiya — katta yumshoq belgili `DetailHead`; plitkalar Tahrirlash / (Ta'minotchi) / O'chirish, qatorlar mahsulot qatorlari (inventarizatsiyada «tizim · sanalgan», o'ngda farq), «Ma'lumot».
11. **Hujjat formalari:** qatorlar guruhi (ta'minotchi tanlovi, Vaqt, Valyuta, kurs), qator kartalari (mahsulot qatori + 2+ qatorda «x», Miqdor / Narx yonma-yon birligi bilan, Summa), «Qator qo'shish» qatori, Jami kartasi, to'lov kartalari (akkaunt, Summa + «To'liq», «x»), «Qolgan: X», Izoh, xaridda prototipning pastki izohi, `MainBar` + `MainButton`. **Boshqa qatordagi mahsulot «qo'shilgan» deb belgilanadi va tanlanmaydi, yagona qator olib tashlanmaydi** (prototip): schema tekshiruvlari himoya sifatida qoldi, bu holatlarni UI'da keltirib chiqargan testlar o'zgardi (talab o'zgarishi).
12. **Tanlovchilar:** ta'minotchi va mahsulot — qator + `SearchPickerSheet`; varaq birinchi faol yozuvlar bilan ochiladi (taklif so'rovlari bo'sh qidiruvda ham, faqat varaq ochiq bo'lsa), har ochilishda qidiruv tozalanadi. Sotuvdagi mijoz tanlovchisi 6-bosqichgacha eski combobox.
13. **Xarid oldindan to'ldirilishi:** `/purchases/new?supplier=ID` yoki `?product=ID` (plitkalardan): mahsulot oxirgi narxi bilan (so'mda bo'lsa).
14. **Kit va yordamchilar:** `SoftIcon`, `DayGroups`, `decimalToTyped`, `Hero heading`, `BalanceCard` / `BalanceChip`, `lib/format` da `dayTitle`, `dayOf`, `MONTHS`; testlar uchun `test/pick.ts`, `test/keypad.ts`; e2e `pick` (varaq) va `press` (klaviatura).
15. **A11y tuzatishlari:** `Hero` yorlig'i va summasi, varaq variantining nomi va pastki satri orasida matnli bo'sh joy.
16. **O'chirildi:** `customers/search-input`; katalogdagi `iconAction` ishlatilishi (`nounOf` `lib/catalog`ga ko'chdi). `Picker`, `CurrencyField`, `DataList` va boshqalar sotuv, moliya, xodimlar va sozlamalar uchun 6–7-bosqichgacha qoladi.

### 6-bosqich (sotuv va moliya)

1. **Sotuv ro'yxati:** `DayGroups`, kun yig'indisi so'mda; qator «№ N · mijoz» (mijozsiz «Chakana»), ostida «N ta mahsulot · qisqa ism», o'ngda jami va «To'langan» / «To'lanmagan» / «X to'langan» (`PaidStatus`, xaridlar bilan umumiy).
2. **Sotuv sahifasi:** `Hero heading` (h1 = «Sotuv № N», jami; badge «Qoldi X» / «To'langan», «mijoz · vaqt»); plitkalar Tahrirlash / Mijoz / O'chirish (xavfli); «Mahsulotlar» qatorlari (mahsulot sahifasiga), «Jami», «To'lovlar», «Ma'lumot».
3. **Sotuv formasi:** xarid formasi naqshi. Mijoz — qator + `SearchPickerSheet`, bo'sh qidiruvda birinchi variant «Chakana» («Mijozsiz sotuv»); mijozsiz bo'lsa «Chakana sotuv: to'liq to'langan bo'lishi shart»; qatorlarda mahsulot va xizmat (sotuv narxi bilan); pastki izoh «Saqlangach mahsulotlar «X» qoldig'idan chiqadi, to'lanmagan qismi mijoz qarziga yoziladi.». Eski combobox (`components/picker.tsx`) o'chirildi.
4. **Kassa:** akkaunt qatori — hamyon plitkasi (moliya rangi, nofaol kulrang), nom + «Nofaol» badge, ostida valyuta kodi, o'ngda qoldiq (manfiy qizil, haqiqiy minus bilan).
5. **Akkaunt sahifasi:** `Hero heading` (h1 = akkaunt nomi, qoldiq, valyuta kodi, «Nofaol»); manfiy qoldiq katta raqamda ham «−» bilan (`splitAmount`). Plitkalar Xarajat / Kirim / O'tkazma / **Yana** (`ActionSheet`: Konvertatsiya, Boshlang'ich qoldiq): beshta plitka telefonga sig'maydi. **Nofaol akkauntda plitkalar yo'q:** formalar uni taklif qilmaydi, server «Akkaunt nofaol» bilan rad etadi (avval sarlavhadagi tugmalar baribir ko'rinardi).
6. **Akkaunt hisob harakati:** `DayGroups`; qator — yumshoq belgi (xarajat qizil, kirim yashil, boshlang'ich sariq, o'tkazma / konvertatsiya / to'lov urg'u rangida), sarlavha («Konvertatsiya № 1», «To'lov · Xarid № 1», kassaning o'z hisobida «Kassa»siz «Boshlang'ich qoldiq»), ostida vaqt · qarshi tomon, o'ngda o'zgarish (+ yashil, − qizil) va «qoldiq N». Kassa hujjati `ActionSheet`da: boshlang'ich qoldiq — Tahrirlash / O'chirish, qolganlari — O'chirish (tahrir o'z ro'yxatida: statement qatorida kategoriya va maqsad yo'q). Hujjat bilan kiritilgan to'lov o'sha hujjatga olib boradi; faqat ko'rish huquqida qatorlar bosilmaydi. Ko'rinadigan «Hisob harakati» sarlavhasi yo'q (kun sarlavhalari bilan ikki qavat bo'lmasin), region nomi qoldi.
7. **Xarajatlar:** `Segmented` Xarajat / Kirim (manzilda `kind`); chiplar Akkaunt va Kategoriya (`PickerSheet`, «Hamma akkauntlar» / «Hamma kategoriyalar»), Sanadan va Sanagacha (`DateSheet`: o'tmish presetlari «Bugun», «Kecha», «7 kun oldin», «30 kun oldin»; «Hamma kunlar» chegarani olib tashlaydi; tanlangan chip «03.10.2026 dan» / «… gacha»). `DayGroups` (kun yig'indisi yo'q: akkauntlar valyutasi har xil); qator «№ N · kategoriya», ostida «vaqt · akkaunt · qisqa ism», o'ngda summa; qator → `ActionSheet` (Tahrirlash / O'chirish); `+` joriy turdagi varaqni ochadi. Teskari oraliq — «Sana noto'g'ri» (`Failed`).
8. **O'tkazmalar:** akkaunt chipi; `DayGroups`; qator «O'tkazma № N» / «Konvertatsiya № N», ostida «vaqt · Naqd → Karta · qisqa ism», o'ngda chiqqan summa, konvertatsiyada ostida «→ 10 $»; qator varag'ining sarlavhasida ikkala summa va kurs; `+` («O'tkazma qo'shish») → `ActionSheet` (O'tkazma / Konvertatsiya).
9. **Moliya varaqlari** (xarajat / kirim, o'tkazma, konvertatsiya, kassa boshlang'ich qoldig'i): qatorlar — `SelectRow` (Akkaunt, Kategoriya, Qayerdan, Qayerga), `AmountRow` akkaunt valyutasi belgisi bilan (konvertatsiyada «Chiqdi» / «Kirdi», ostida kurs), Vaqt, Izoh «ixtiyoriy»; `MainButton`. Faqat tashqaridan ochiladi (`open` / `onOpenChange`, har ochilishda qayta mount): o'z trigger tugmalari va qatordagi ikonka tugmalari (`iconOnly`) o'chirildi; o'chirish savoli `DeleteCashDocumentDialog`.
10. **Katta summa sig'dirish xatosi tuzatildi** (`Amount`, hamma `Hero`larda): joy ota-elementning `clientWidth`idan (padding bilan) hisoblanardi va ResizeObserver balandlik o'zgarishida ham qayta o'lchardi. Natijada siqilishi kerak bo'lgan har summa (telefonda «1 000 000 so'm») `--k`ni har kadrda 1 ↔ 0,95 orasida tebratardi: sahifa tinchimasdi (Playwright «element is not stable»), siqilgan raqam ham 16px sig'masdi. Endi kontent kengligi (padding'siz) olinadi va faqat kenglik o'zgarganda qayta sig'diriladi.
11. **Kit va yordamchilar:** `formatTime` (kun guruhidagi qator uchun «soat:daqiqa»; `formatDateTime` shundan foydalanadi), `DateSheet` `presets="past"` va `none`; e2e `list()` endi faqat qolgan jadvallarni («Xodimlar», «Kurslar tarixi») nomlaydi, `days()` — kun guruhli ro'yxatlar.
12. **O'chirildi:** `components/picker.tsx`, `currency-field.tsx`, `facts.tsx`, `catalog/icon-action.ts`. `DataList`, `Identity`, `PageHeader` va boshqalar faqat xodimlar va sozlamalarda qoldi (7-bosqich).
13. **Keyinga qoldi (8-bosqich):** telefondagi varaqda `datetime-local` «Vaqt» qatori kesiladi («13/10/2026, 23:1…»): bu hamma hujjat formasi va varaqlarida bir xil (`TextRow type="datetime-local"`), shuning uchun hammasi birga `DateTimeRow`ga (kun varaqda + vaqt) o'tkaziladi. Ta'minotchi / mijoz statement'i qatorlarida to'liq sana — telefonda akkaunt nomi qisqarishi mumkin; kun guruhlariga o'tkazish ham shu yerda ko'riladi.

## Tekshiruv

- `make lint`, `make test`, `make e2e` toza (admin e2e ham: admin'ga tegilmagan).
- Vizual: 375px @2x va 1280px skrinshotlar: bosh sahifa (egasi, rolli xodim), mijozlar, vazifa kanban / ro'yxat / sahifa, mahsulot, xarid formasi, ta'minotchi, xodimlar, sozlamalar hub, profil, varaq, action sheet, alert, toast, bo'sh holat, dark, Mini App (soxta Telegram: to'liq ekran chetlari, BackButton); yon scroll yo'q 320 / 360 / 375 / 768 / 1280px.
- Lokal haqiqiy stack: kirish, dashboard, mijoz / vazifa / xarid / to'lov / sotuv / xarajat oqimlari. Telegram'da haqiqiy qurilma tekshiruvi foydalanuvchiniki (lokal bot tokeni yo'q).
