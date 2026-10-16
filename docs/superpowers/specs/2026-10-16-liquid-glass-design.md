# User app'ning «liquid glass» ko'rinishi — dizayn

Sana: 2026-10-16. Holat: foydalanuvchi reja sifatida tasdiqlagan (savol-javob bilan), amalga oshirilmoqda. Reja: `docs/superpowers/plans/2026-10-16-liquid-glass.md`. User app (`apps/web`) uchun; admin panel o'zgarmaydi.

## Kontekst

Foydalanuvchining so'zlari: "dizayn yana o'zgardi: https://claude.ai/artifact/Dd1uTB3kPpSzCbvux94ZHw shunga moslab ber".

Havola 2026-10-13 dagi prototipning o'zi (`6634ff38-6626-42c0-8dea-2bdd4b68122e`), yangi versiyasi `1792150007` (2026-10-16, 2807 qator). User app `1791836050` versiyasi (2026-10-13, 2559 qator) bo'yicha qurilgan: `2026-10-13-mini-app-ui-design.md`. Ikki versiya farqi +263 / −15 qator:

1. **«Liquid glass» qatlami (CSS).** Shaffof oq kartalar (sheen, ichki oq hoshiya, yumshoq soya, blur) «ambient» gradient fon ustida. Radiuslar kattaroq: guruh 26, plitka 22, varaq 40, badge pill. Tugmalar yaltiroq gradient va nur bilan, asosiy tugma 54px kapsula.
2. **Yangi palitralar.** «Yorug' shisha»: `#F1F2F4` fon, oq kartalar, qora urg'u `#111214`, qora gradient tugma. «Tungi shisha»: `#15121E` fon va pastel nurlar, lavanda urg'u `#B0A4FF`. «Telegram» va «Telegram tun» variantlari ham bor.
3. **Avatarlar** oddiy kulrang doira, initsiallar to'q rangda.
4. **Telegram to'liq ekrani.** Kontent Telegram tugmalari ostidan o'tadi, scroll bo'lganda tepada yumshoq fade + blur chiqadi, varaqlar tugmalar ostidan boshlanadi.
5. **Brend.** Logotip yorug' rejimda qora, splash belgisi yorug'da qora, tungida lavanda; bosh sahifa banneri oq yoki lavanda gradient, uchqunlari oltin.
6. **Tab-bar mantig'i:** Bosh sahifa doim birinchi, 3 bo'lim, oxirida «Sozlamalar».

Prototip tavsifi: «Telegram'da to'liq ekran rejimida ochiladi. iOS «liquid glass» uslubi: oq-kulrang fon, oq kartalar, qora urg'u».

Bu `docs/SPEC.md` da yo'q ish, foydalanuvchi so'rovi bilan. Xatti-harakat o'zgarmaydi, pastda sanalganlar bundan mustasno; backend va API o'zgarmaydi.

## Foydalanuvchi qarorlari (2026-10-16)

| # | Savol | Qaror |
|---|---|---|
| 1 | Pastki panel | **2026-10-15 modeli qoladi** (`2026-10-15-tab-bar-menu-design.md`): 4 ta tanlanadigan sahifa + «Sozlama» varag'i. Faqat ko'rinish yangilanadi. |
| 2 | Telegram ichida ranglar | **Ilovaning o'z palitrasi.** Telegram faqat yorug' yoki tungi rejimni beradi; `html[data-telegram]` dagi `--tg-theme-*` rang xaritasi olib tashlanadi. Telegram sarlavhasi, foni va pastki paneli ilova rangiga bo'yaladi. |
| 3 | Kirish sahifasining brend paneli | **Yangi palitrada:** yorug'da qora gradient, tungida lavanda gradient. Ikonkalar (favicon, apple-icon) yashilligicha qoladi. |

### Rad etilgan variantlar

- Prototipning tab-bar mantig'i (Bosh sahifa qulflangan + 3 + «Sozlamalar»): u 2026-10-15 da rad etilgan variant, foydalanuvchi o'z modelini qoldirdi.
- Telegram ichida Telegram ranglari + shisha (prototipdagi «Telegram» / «Telegram tun»): foydalanuvchi ilovaning o'z palitrasini tanladi.
- Kirish panelini yashil qoldirish: foydalanuvchi yangi palitrani tanladi.
- Ambient fonni `background-attachment: fixed` bilan chizish: iOS WebView uni bilmaydi, Android'da esa scroll'ni sekinlashtiradi.
- Sahifa varag'ini doim noshaffof ambient bilan qoldirish: `main` ning padding chetlarida va scroll'da fon choklari ko'rinadi.

## Spec'dan chetlanishlar

| # | Avvalgi qaror | Yangi | Sabab |
|---|---|---|---|
| 1 | 2026-10-13: tokenlar (light `#EDEEF2` / `#117A68`, dark `#000` / `#3CC5AE`), Telegram'da `--tg-theme-*` | «Yorug' shisha» / «Tungi shisha»; Telegram'da ilovaning o'z palitrasi | prototip, 2-qaror |
| 2 | 2026-10-04 login: `--brand-panel` `#174449` | qora / lavanda gradient (`--brand-fill`) | 3-qaror |
| 3 | 2026-10-04 logo: `--brand` yorug'da `#174449` | `#0E0F12` | prototip |
| 4 | 2026-10-13: avatar gradientlari (g0–g4) | kulrang doira, to'q initsiallar | prototip |
| 5 | 2026-10-07: qobiq `pt-safe`, kontent Telegram tugmalari ostiga kirmaydi | kontent tugmalar ostidan scroll bo'ladi, tepada fade; varaq tugmalar ostidan boshlanadi | prototip |
| 6 | 2026-10-13, 8-bosqich 3-qaror: sahifa varag'i doim noshaffof | faqat surilish paytida noshaffof; tinch holatda `main` ning ambient foni ko'rinadi | ambient fon |

## Dizayn

### Tokenlar (`apps/web/app/globals.css`)

`:root` → «Yorug' shisha», `.dark` → «Tungi shisha». Qiymatlar prototipdan aynan: yorug' uchun `.app` + `.app[data-theme=light]`, tungi uchun `.app[data-theme=dark]`.

| shadcn / yangi | Yorug' | Tungi |
|---|---|---|
| `--background` | `#F1F2F4` | `#15121E` |
| `--card` | `rgba(255,255,255,.86)` | `rgba(255,255,255,.075)` |
| `--foreground` | `#0E0F12` | `#F5F2FF` |
| `--heading` | `#2A2C31` | `#DAD5EE` |
| `--muted-foreground` | `#6B6E76` | `#A7A1C0` |
| `--muted` / `--secondary` / `--accent` (fill) | `rgba(0,0,0,.05)` | `rgba(255,255,255,.08)` |
| `--border` | `rgba(0,0,0,.08)` | `rgba(255,255,255,.1)` |
| `--primary` / `--primary-foreground` / `--primary-soft` | `#111214` / `#fff` / `rgba(17,18,20,.07)` | `#B0A4FF` / `#1A1433` / `rgba(176,164,255,.18)` |
| `--destructive`, `--positive`, `--warning` (+ `-soft`) | `#CF3F37`, `#23804E`, `#A0620A` | `#FF7A70`, `#5CD68C`, `#FFC061` |
| `--menu`, `--sheet`, `--sheet-cell`, `--scrim`, `--shadow`, `--skel`, `--press`, `--glass-edge` | prototipniki | prototipniki |
| `--brand` | `#0E0F12` | `#fff` |

Yangi tokenlar (qiymatlari prototipdan):

- **Fon:** `--ambient` (gradient qatlamlari), `--ambient-base`, `--fade`, `--head` (sidebar).
- **Shisha:** `--chip`, `--col` (kanban ustuni), `--rim` (prototipdagi `--ring`; shadcn'ning focus `--ring` bilan to'qnashmasin deb boshqa nom), `--lift`, `--sheen`, `--lifted`.
- **Tugmalar:** `--btn`, `--btn-glow`.
- **Segmented va qidiruv:** `--seg-thumb`, `--seg-on` (yorug'da qora thumb ustida oq matn), `--seg-shadow`, `--search`, `--search-rim`, `--switch-off`.
- **Bosh sahifa va brend:** `--gold` (summa birligi), `--ban`, `--ban-ink`, `--ban-sub`, `--ban-x`, `--av-bg`, `--av-ink`, `--brand-fill` (splash belgisi va kirish paneli gradienti), `--mark-shadow`.
- **Tab-bar:** `--tb-bg`, `--tb-rim`, `--tb-spec`, `--tb-glow`, `--tb-line`, `--tb-halo`, `--lens-bg`.
- **Brend paneli:** `--brand-panel` — gradient ostidagi qattiq rang: yorug' `#0E0F11`, tungi `#6453D3`.

Radiuslar: `--radius-group: 26px`, `--radius-tile: 22px`, `--radius-sheet: 40px`, `--radius-badge: 999px`. `--radius-main` 14px qoladi.

Nomlangan utility'lar:

- `surface` — muzlagan karta: `background-color: var(--card)`, `background-image: var(--sheen)`, `box-shadow: var(--rim), var(--lift)`, `backdrop-filter: blur(18px) saturate(1.6)`. Varaq ichida `--card` = `--sheet-cell`, avvalgidek.
- `glossy` — `--btn` + `--btn-glow`, matn `--primary-foreground`.
- `glossy-red` — qizil gradient `#F2847A → #CF3F37` va uning nuri.
- `glass-chip` — `--chip` + `--rim` (chip, mini tugma, varaqni yopish tugmasi, alert'ning bekor qilish tugmasi).
- `bg-ambient` — `--ambient-base` + `--ambient`.

`html[data-telegram]` faqat qobiq balandligi va `overscroll` qoidalarini saqlaydi (2-qaror).

### Ambient fon

Prototipda har ekran viewport kattaligida va o'z ambient foni bilan suriladi; bizda `main` scroll bo'ladi.

- `main` `bg-ambient` ni o'zi chizadi: scroll konteynerning o'z foni joyida turadi, kontent uning ustidan o'tadi (prototipdagidek).
- `body` ham `bg-ambient`: qobiqsiz sahifalar va sidebar orqasi uchun.
- Sahifa varag'i (`data-slot="page"`, `PageTransition`) tinch holatda shaffof.
- Faqat surilish paytida (`:root[data-move]`) varaq noshaffof `--ambient` oladi; uning joyi `main` ning padding'i qadar siljitiladi (`--page-top`, yonida `-1rem`, md da `-1.5rem`), shunda tepada turgan sahifa surilish tugaganda sakramaydi.
- Ma'lum cheklov: scroll qilingan sahifaga orqaga qaytilganda uning foni 340ms davomida biroz siljigan bo'ladi.

### Komponentlar (prototip classi qavsda)

| Joy | O'zgarish |
|---|---|
| `kit/group.tsx` `Group` (`.group`) | `bg-card` → `surface` |
| boshqa `rounded-group bg-card` / `bg-sheet-cell` kartalar | `surface`: `ordered-rows`, `history-list`, `states.tsx` (`EmptyState`, `NotFound`, `Failed`, `ListLoading`), `picker-sheet` ro'yxati, `date-sheet` kalendari, `catalog/product-stock`, `warehouse/balance-card` chiplari, `lines-field` jami, `task-form` mavjud mijoz kartasi, `shell/tab-bar-sheet` guruhlari, `shell/menu-sheet` plitkalari |
| `kit/detail-head.tsx` `Tile` (`.tile`) | `surface`, ikonka doirasi `glossy` (xavflisi `glossy-red`) |
| `kit/stat-card.tsx` (`.ccard`, `.cc-h .mi`, `.bars`) | `surface`; mini ikonkaga yaltiroq qatlam; ustunchalar `8/5px` radius va oq yaltiroq gradient |
| `kit/main-button.tsx` (`.mainbtn`, `.mainbar`) | `h-[54px] rounded-full`; accent `glossy`, red `glossy-red`; `MainBar` fade `--fade` 55% |
| `kit/page-title.tsx` | `PlusButton` `glossy`; h1 32px, `-0.03em` |
| `ui/badge.tsx` | pill: `rounded-badge` (999px), `px-[9px]`; `Hero` badgelari 26px, `px-[11px]` |
| `kit/chips.tsx` (`.chip`) | `glass-chip`; yoqilgani `bg-primary-soft` + ichki urg'u hoshiyasi (22%) |
| `kit/form-row.tsx` `OptionChips` (`.opt.on`) | tanlangani `glossy` |
| `kit/search-box.tsx` (`.search`) | `--search` + `--search-rim` + `blur(16px) saturate(1.5)` |
| `kit/segmented.tsx`, `section-tabs.tsx` (`.seg`) | track ichki soyasi; thumb `--seg-thumb` + `--seg-shadow`, faol matn `--seg-on`; `dark:bg-[#636366]` olib tashlanadi |
| `ui/switch.tsx` (`.sw`) | yoqilgani `bg-(image:--btn)`; o'chig'i `--switch-off` (yorug', prototipdagi qiymat), tungida `--muted`; thumb soyasi prototipniki |
| `kit/tile-icon.tsx` (`.tile-ic`, `.tk-ic`) | `TileIcon`: radius 10px, ichki oq hoshiya, soya, yaltiroq qatlam; `SoftIcon`: ichki oq hoshiya |
| `kit/avatar.tsx` (`.av`) | `data-tone` va gradientlar yo'q: `bg-(--av-bg) text-(--av-ink) font-bold`; muted avvalgidek. `lib/initials.ts` `tone` qoladi: eski `components/avatar.tsx` uni ishlatadi |
| `kit/amount.tsx` (`.amount .ac`) | birlik `text-(--gold)` |
| `kit/banner.tsx` (`.banner`) | `--ban` foni, `--ban-ink` matni, `--ban-sub` (600) izohi, `--ban-x` yopish tugmasi; art: plitka `#A99CF8 → #5E4DCC`, soyasi `#3B2E7A` .22, uchqunlar `#D4A541` |
| `states.tsx` `Splash` (`.markt`) | `bg-(image:--brand-fill)` + `--mark-shadow`; `EmptyState` ikonkasiga ichki hoshiya, tugmasi 46px kapsula |
| `login/login-frame.tsx` | panel `bg-brand-panel bg-(image:--brand-fill)`; `main` `bg-ambient` (3-qaror) |
| `refusal.tsx` | radius 20px |
| `kit/amount-sheet.tsx` (`.keypad`) | raqamlar `rounded-[18px] surface`, fn tugmalar fonsiz |
| `kit/date-sheet.tsx` (`.cal-g .on`) | tanlangan kun `glossy` |
| `ui/dialog.tsx` (`.sheet`, `.gbtn`) | radius 40, `backdrop-blur-[40px] saturate-[1.8]`, prototip soyasi + ichki `--glass-edge`; yopish tugmasi `glass-chip` |
| `ui/alert-dialog.tsx` (`.alert`) | radius 34, ichki `--glass-edge` hoshiyasi |
| `ui/button.tsx` | `default` → `glossy`, `secondary` / `outline` / `mini` → `glass-chip`, `destructive` → `glossy-red`; alert tugmalari shu orqali |
| `kit/action-sheet.tsx` (`.menu`) | radius 26, `--shadow` + ichki `--glass-edge` (1px va tepada 1px) |
| `tasks/task-board.tsx`, `task-card.tsx` (`.kcol`, `.kcard`, `.ghost`) | ustun `rounded-[28px] bg-(--col) shadow-(--rim)`; karta `rounded-[20px] surface`; sudralayotgan nusxa `bg-sheet-cell` + blur + prototip soyasi |
| `tasks/stage-track.tsx`, `deadline-card.tsx` | `rounded-[22px] surface`; trek tugmalari 18px |
| `warehouse/lines-field.tsx`, `inventory-form.tsx`, `payments-field.tsx` (`.pline`) | `rounded-[24px] surface` |
| `shell/location-switcher.tsx` (`.pill`) | `surface` |
| `sortable-list.tsx` (`.sortable .lift`) | `rounded-[18px] bg-(--lifted)` + prototip soyasi |
| `shell/sidebar.tsx` | `bg-(--head)` + `backdrop-blur-[22px] saturate-[1.8]`, hairline qoladi |
| `customers-page.tsx`, `tasks-page.tsx` «Sozlamalarni ochish» havolalari | `rounded-full glossy` |

Prototipdan ataylab chetlanishlar:

- **Sudralayotgan qator qora emas.** Prototipda `.sortable .lift` `--seg-thumb` ni oladi: yorug' rejimda u qora, ustidagi matn ham qora, o'qib bo'lmaydi. Bizda `--lifted`: yorug'da oq, tungida `rgba(255,255,255,.18)`.
- **Linzani sudrash va chapdan surib qaytish yo'q** (2026-10-13 dagidek).
- **Prototipdagi Telegram mavzulari ishlatilmaydi** (2-qaror).

### Tab-bar (`shell/tab-bar.tsx` + `globals.css`)

Tuzilishi va mantig'i o'zgarmaydi (1-qaror). Ko'rinishi «tiniq liquid glass»:

- Panelning o'z foni va blur'i olib tashlanadi; tashqi soya `0 12px 32px …, 0 2px 4px …, 0 0 0 .5px var(--tb-line)`.
- `::before` — yupqa muz qatlam: `--tb-bg`, `blur(2.5px) saturate(1.7) brightness(1.07)`, specular ichki soyalar.
- `::after` — 9px sinadigan chet: `blur(9px) saturate(2) brightness(1.15)`, `mask` bilan.
- Tugma matni va ikonkalari `--tb-halo` bilan yorug'lanadi.
- Linza: `--lens-bg`, `blur(1px)`, specular hoshiya.

### Telegram to'liq ekrani (prototipdagi `.tg-head`, `.layer`)

- **Qobiq.** `AppShell` dan `pt-safe` olinadi; `main` `pt-safe-2 md:pt-safe-6`, `Sidebar` `pt-safe`. Kontent Telegram tugmalari ostidan scroll bo'ladi, sahifa boshi esa avvalgidek ular ostidan boshlanadi. Ambient siljishi (`--page-top`) `--safe-top` ni ham hisobga oladi.
- **Tepadagi fade** (`data-slot="top-fade"`): `fixed`, `pointer-events-none`; balandligi `calc(var(--safe-top) + min(var(--safe-top), 18px))` — brauzerda va desktop Telegram'da 0, JS holat qo'shilmaydi (2026-10-07 qarori); `linear-gradient(to bottom, var(--fade) 40%, transparent)` + `blur(12px) saturate(1.6)` + mask; `main.scrollTop > 4` bo'lganda `data-on` → `opacity: 1` (250ms).
- **Varaqlar.** `DialogContent` balandligi `calc(100dvh - 18px - var(--safe-top))` gacha: varaq Telegram tugmalari ostidan boshlanadi, yopish tugmasi ularning tagida qolmaydi.

### Telegram ranglari (`components/telegram-sync.tsx`, 2-qaror)

Ochilishda va `themeChanged` da `setTheme(colorScheme)` dan keyin `setHeaderColor` (6.9+), `setBackgroundColor` (6.1+) va `setBottomBarColor` (7.10+) chaqiriladi, har biri `isVersionAtLeast` bilan. Ranglar: yorug' `#F7F8F9` / `#F1F2F4` / `#E5E7EB` (ambient'ning tepasi, asosi, pasti), tungi uchala o'rinda `#15121E`; `lib/telegram.ts` da.

## Bosqichlar

Ish `dev` branch'ida. Har bosqich: TDD (RED → GREEN → commit), oxirida `make lint && make test && make e2e` → `git push origin dev` → hisobot (har xatti-harakat RED → GREEN) → tasdiq.

1. **Hujjat, tokenlar, ambient fon, Telegram ranglari, avatarlar.**
2. **Yuzalar va boshqaruvlar:** komponentlar jadvali, brend (kirish paneli, logotip rangi, splash, banner).
3. **Tab-bar shishasi va to'liq ekran:** tab-bar, kontent tugmalar ostida, tepadagi fade, varaq chegarasi.
4. **Yakuniy tekshiruv va hujjatlar:** skrinshotlar (`docs/design/screens-v2/` yangilanadi), `docs/design/README.md`, README, mutatsiya tekshiruvi, haqiqiy stack smoke.

## Testlar

- `app/globals.test.ts`: tokenlar (yorug', tungi), Telegram blokida rang yo'q, radiuslar, utility'lar, surilayotgan varaq qoidasi, tab-bar qatlamlari, fade.
- Kit va sahifa komponentlari: o'z testlarida nomlangan utility yoki asosiy class (`surface`, `glossy`, `rounded-full`, `h-[54px]`…).
- `telegram-sync.test.tsx`: Telegram sarlavhasi, foni va pastki paneli sxemaga ko'ra; eski client'da chaqirilmaydi. `app-shell.test.tsx`: `main` ambient, padding, fade.
- e2e (talab o'zgarishi, sababi bilan): `transitions.spec.ts` (varaq faqat surilishda noshaffof), `miniapp.spec.ts` (ilova ranglari, padding, fade, varaq chegarasi), `logo.spec.ts` va `login.spec.ts` (panel va logotip rangi).

## Chegara

- Admin panel, backend, API.
- Ikonkalar (favicon, apple-icon, bot avatari).
- Prototipdagi Telegram mavzulari, linzani sudrash, chapdan surib qaytish.
- Test va production deploy alohida so'raladi.

## Tekshiruv

- `make lint`, `make test`, `make e2e` toza (admin e2e ham).
- Vizual: 375px @2x va 1280px skrinshotlar prototip bilan yonma-yon (yorug', tungi, soxta Telegram to'liq ekran); 320 / 360 / 375 / 768 / 1280px enlarda yon scroll yo'q.
- Lokal haqiqiy stack: kirish, bosh sahifa, mijoz / vazifa / xarid varaqlari, kanban, tungi rejim. Telegram'da haqiqiy qurilma tekshiruvi foydalanuvchiniki.
