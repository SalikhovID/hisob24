# User app'ni prototipning yangi «liquid glass» ko'rinishiga o'tkazish — reja

Sana: 2026-10-16. Spec: `docs/superpowers/specs/2026-10-16-liquid-glass-design.md`. Foydalanuvchi tasdiqlagan.

## Kontekst

Foydalanuvchi: "dizayn yana o'zgardi: https://claude.ai/artifact/Dd1uTB3kPpSzCbvux94ZHw shunga moslab ber".

Havola o'sha prototip (`6634ff38…`), yangi versiyasi `1792150007` (2026-10-16). Hozirgi UI `1791836050` (2026-10-13, 2559 qator) asosida qurilgan. Ikkalasi lokalda saqlangan, diff: +263 / −15 qator:

1. **«Liquid glass» qatlami (CSS).** Shaffof oq kartalar (sheen + ichki oq hoshiya + yumshoq soya + blur) «ambient» gradient fon ustida. Radiuslar kattaroq: guruh 26, plitka 22, varaq 40, badge pill. Tugmalar yaltiroq gradient va nur bilan; asosiy tugma 54px kapsula.
2. **Yangi palitralar.**
   - «Yorug' shisha»: `#F1F2F4` fon, oq kartalar, qora urg'u `#111214`, qora gradient tugma.
   - «Tungi shisha»: `#15121E` fon va pastel nurlar, lavanda urg'u `#B0A4FF`.
   - Telegram variantlari ham bor (ishlatilmaydi, 2-qaror).
3. **Avatarlar** oddiy kulrang doira, initsiallar to'q rangda.
4. **Telegram to'liq ekrani.** Kontent Telegram tugmalari ostidan o'tadi. Scroll bo'lganda tepada yumshoq fade + blur chiqadi. Varaqlar tugmalar ostidan boshlanadi.
5. **Brend.** Logotip yorug' rejimda qora. Splash belgisi yorug'da qora, tungida lavanda. Bosh sahifa banneri oq yoki lavanda gradient, uchqunlari oltin rangda.
6. **Tab-bar mantig'i** (Bosh sahifa + 3 + Sozlamalar): qabul qilinmaydi (1-qaror).

Natija: faqat `apps/web` qayta uslublanadi. Xatti-harakat o'zgarmaydi, pastdagi sanalganlar bundan mustasno. Admin panel, backend va API o'zgarmaydi.

## Foydalanuvchi qarorlari (2026-10-16)

| # | Savol | Qaror |
|---|---|---|
| 1 | Pastki panel | **15-oktabr modeli qoladi**: 4 ta tanlanadigan sahifa + «Sozlama» varag'i. Faqat ko'rinish yangilanadi. |
| 2 | Telegram ichida ranglar | **Ilovaning o'z palitrasi.** Telegram faqat yorug' yoki tungi rejimni beradi. `html[data-telegram]` dagi `--tg-theme-*` rang xaritasi olib tashlanadi. Telegram sarlavhasi, foni va pastki paneli ilova rangiga bo'yaladi. |
| 3 | Kirish sahifasining brend paneli | **Yangi palitrada**: yorug'da qora gradient, tungida lavanda gradient. Ikonkalar (favicon, apple-icon) yashilligicha qoladi. |

## Dizayn

### Tokenlar (`apps/web/app/globals.css`)

`:root` → «Yorug' shisha», `.dark` → «Tungi shisha». Qiymatlar prototipdan aynan olinadi: yorug' uchun `.app` + `.app[data-theme=light]`, tungi uchun `.app[data-theme=dark]`.

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

Yangi tokenlar, qiymatlari prototipdan:

- **Fon:** `--ambient` (gradient qatlamlari), `--ambient-base`, `--fade`, `--head` (sidebar).
- **Shisha:** `--chip`, `--col` (kanban ustuni), `--rim` (prototipdagi `--ring`; shadcn'ning focus `--ring` bilan to'qnashmasin deb boshqa nom), `--lift`, `--sheen`, `--lifted`.
- **Tugmalar:** `--btn`, `--btn-glow`.
- **Segmented va qidiruv:** `--seg-thumb`, `--seg-on` (yorug'da qora thumb ustida oq matn), `--seg-shadow`, `--search`, `--search-rim`, `--switch-off`.
- **Bosh sahifa va brend:** `--gold` (summa birligi), `--ban`, `--ban-ink`, `--ban-sub`, `--ban-x`, `--av-bg`, `--av-ink`, `--brand-fill` (splash belgisi va kirish paneli gradienti), `--mark-shadow`.
- **Tab-bar:** `--tb-bg`, `--tb-rim`, `--tb-spec`, `--tb-glow`, `--tb-line`, `--tb-halo`, `--lens-bg`.
- **Brend paneli:** `--brand-panel` qattiq zaxira rang: yorug' `#0E0F11`, tungi `#6453D3`.

Radiuslar: `--radius-group: 26px`, `--radius-tile: 22px`, `--radius-sheet: 40px`, `--radius-badge: 999px`. `--radius-main` 14px qoladi: keypad va boshqalar o'z qiymatini oladi.

Nomlangan utility'lar (testlarda ham shu nomlar):

- `surface`: muzlagan karta. `background-color: var(--card)`, `background-image: var(--sheen)`, `box-shadow: var(--rim), var(--lift)`, `backdrop-filter: blur(18px) saturate(1.6)`. Varaq ichida `--card` = `--sheet-cell`, avvalgidek.
- `glossy`: `--btn` + `--btn-glow`, matn `--primary-foreground`.
- `glossy-red`: qizil gradient `#F2847A → #CF3F37` va uning nuri.
- `glass-chip`: `--chip` + `--rim` (chip, mini tugma, varaqni yopish tugmasi, alert'ning bekor qilish tugmasi).
- `bg-ambient`: `--ambient-base` + `--ambient`, `no-repeat`.

`html[data-telegram]` faqat qobiq balandligi va `overscroll` qoidalarini saqlaydi (2-qaror).

### Ambient fon (qaror)

Prototipda har ekran viewport kattaligida va o'z ambient foni bilan suriladi. Bizda `main` scroll bo'ladi. Shuning uchun:

- `main` `bg-ambient` ni o'zi chizadi. Scroll konteynerning o'z foni joyida turadi, kontent uning ustidan o'tadi (prototipdagidek).
- `body` ham `bg-ambient` (`100% 100vh`). Bu qobiqsiz sahifalar va sidebar orqasi uchun.
- Sahifa varag'i (`data-slot="page"`, `PageTransition`) tinch holatda shaffof.
- Faqat surilish paytida (`:root[data-move]`) varaq noshaffof `--ambient` oladi. Uning joyi `main` ning padding'i qadar siljitiladi (`--page-top`, `-1rem`; md da `-1.5rem`), shunda tepada turgan sahifa surilish tugaganda sakramaydi.
- Ma'lum cheklov: scroll qilingan sahifaga orqaga qaytilganda fon 340ms davomida biroz siljiydi.
- `background-attachment: fixed` ishlatilmaydi: iOS WebView uni bilmaydi, Android'da esa scroll'ni sekinlashtiradi.

### Komponentlar (prototip classi qavsda)

| Joy | O'zgarish |
|---|---|
| `kit/group.tsx` `Group` (`.group`) | `bg-card` → `surface` |
| boshqa `rounded-group bg-card` / `bg-sheet-cell` kartalar | `surface`: `ordered-rows`, `history-list`, `states.tsx` (`EmptyState`, `NotFound`, `Failed`, `ListLoading`), `picker-sheet` ro'yxati, `date-sheet` kalendari, `catalog/product-stock`, `warehouse/balance-card` chiplari, `lines-field` jami, `task-form` mavjud mijoz kartasi, `shell/tab-bar-sheet` guruhlari, `shell/menu-sheet` plitkalari |
| `kit/detail-head.tsx` `Tile` (`.tile`) | `surface`, ikonka doirasi `glossy` (xavflisi `glossy-red`) |
| `kit/stat-card.tsx` (`.ccard`, `.cc-h .mi`, `.bars`) | `surface`; mini ikonkaga yaltiroq qatlam; ustunchalar `8/5px` radius va oq yaltiroq gradient |
| `kit/main-button.tsx` (`.mainbtn`, `.mainbar`) | `h-[54px] rounded-full`; accent `glossy`, red `glossy-red`; `MainBar` fade `--fade` 55% |
| `kit/page-title.tsx` | `PlusButton` `glossy`; h1 32px, `-0.03em` |
| `ui/badge.tsx` | pill: `rounded-badge` (999px) va `px-[9px]`; `Hero` badgelari 26px, `px-[11px]` |
| `kit/chips.tsx` (`.chip`) | `glass-chip`; yoqilgani `bg-primary-soft` + ichki urg'u hoshiyasi (22%) |
| `kit/form-row.tsx` `OptionChips` (`.opt.on`) | tanlangani `glossy` |
| `kit/search-box.tsx` (`.search`) | `--search` + `--search-rim` + `blur(16px) saturate(1.5)` |
| `kit/segmented.tsx`, `section-tabs.tsx` (`.seg`) | track ichki soyasi; thumb `--seg-thumb` + `--seg-shadow`, faol matn `--seg-on`; `dark:bg-[#636366]` olib tashlanadi |
| `ui/switch.tsx` (`.sw`) | yoqilgan holat `bg-(image:--btn)`; o'chiq holat `--switch-off` (yorug', prototipdagi qiymat), tungida `--muted`; thumb soyasi prototipniki |
| `kit/tile-icon.tsx` (`.tile-ic`, `.tk-ic`) | `TileIcon`: radius 10px, ichki oq hoshiya, soya, `after:` yaltiroq qatlam. `SoftIcon`: ichki oq hoshiya |
| `kit/avatar.tsx` (`.av`) | `data-tone` va gradientlar yo'q: `bg-(--av-bg) text-(--av-ink) font-bold`; muted avvalgidek. `globals.css` dagi tone qoidalari o'chadi. `lib/initials.ts` `tone` qoladi: eski `components/avatar.tsx` uni ishlatadi |
| `kit/amount.tsx` (`.amount .ac`) | birlik `text-(--gold)` |
| `kit/banner.tsx` (`.banner`) | `--ban` foni, `--ban-ink` matni, `--ban-sub` (600) izohi, `--ban-x` yopish tugmasi; art: plitka `#A99CF8 → #5E4DCC`, soyasi `#3B2E7A` .22, uchqunlar `#D4A541` |
| `states.tsx` `Splash` (`.markt`) | `bg-(image:--brand-fill)` + `--mark-shadow`; `EmptyState` ikonkasiga ichki hoshiya, tugmasi 46px kapsula |
| `login/login-frame.tsx` | panel `bg-brand-panel bg-(image:--brand-fill)`; `main` `bg-ambient` (3-qaror) |
| `refusal.tsx` | radius 20px |
| `kit/amount-sheet.tsx` (`.keypad`) | raqamlar `rounded-[18px] surface`, fn tugmalar fonsiz |
| `kit/date-sheet.tsx` (`.cal-g .on`) | tanlangan kun `glossy` |
| `ui/dialog.tsx` (`.sheet`, `.gbtn`) | radius 40, `backdrop-blur-[40px] saturate-[1.8]`, prototip soyasi + ichki `--glass-edge`; yopish tugmasi `glass-chip` |
| `ui/alert-dialog.tsx` (`.alert`) | radius 34, ichki `--glass-edge` hoshiyasi |
| `ui/button.tsx` | `default` → `glossy`, `secondary` / `outline` / `mini` → `glass-chip`, `destructive` → `glossy-red`. Alert tugmalari shu orqali |
| `kit/action-sheet.tsx` (`.menu`) | radius 26, `--shadow` + ichki `--glass-edge` (1px va tepada 1px) |
| `tasks/task-board.tsx`, `task-card.tsx` (`.kcol`, `.kcard`, `.ghost`) | ustun `rounded-[28px] bg-(--col) shadow-(--rim)`; karta `rounded-[20px] surface`; sudralayotgan nusxa `bg-sheet-cell` + blur + prototip soyasi |
| `tasks/stage-track.tsx`, `deadline-card.tsx` | `rounded-[22px] surface`; trek tugmalari 18px |
| `warehouse/lines-field.tsx`, `inventory-form.tsx`, `payments-field.tsx` (`.pline`) | `rounded-[24px] surface` |
| `shell/location-switcher.tsx` (`.pill`) | `surface` |
| `sortable-list.tsx` (`.sortable .lift`) | `rounded-[18px] bg-(--lifted)` + prototip soyasi |
| `shell/sidebar.tsx` | `bg-(--head)` + `backdrop-blur-[22px] saturate-[1.8]`, hairline qoladi |
| `customers-page.tsx`, `tasks-page.tsx` «Sozlamalarni ochish» havolalari | `rounded-full glossy` |

Prototipdan ataylab chetlanishlar:

- **Sudralayotgan qator qora emas.** Prototipda `.sortable .lift` `--seg-thumb` ni oladi. Yorug' rejimda bu qora rang, ustidagi matn ham qora bo'lib, o'qib bo'lmaydi. Bizda `--lifted` ishlatiladi: yorug'da oq, tungida `rgba(255,255,255,.18)`.
- **Linzani sudrash va chapdan surib qaytish yo'q** (avvalgidek).
- **Prototipdagi Telegram mavzulari ishlatilmaydi** (2-qaror).

### Tab-bar (`shell/tab-bar.tsx` + `globals.css`)

Tuzilishi va mantig'i o'zgarmaydi (1-qaror). Ko'rinishi «tiniq liquid glass»:

- Panelning o'z foni va blur'i olib tashlanadi. Tashqi soya: `0 12px 32px …, 0 2px 4px …, 0 0 0 .5px var(--tb-line)`.
- `::before`: yupqa muz qatlam (`--tb-bg`, `blur(2.5px) saturate(1.7) brightness(1.07)`, specular ichki soyalar).
- `::after`: 9px sinadigan chet (`blur(9px) saturate(2) brightness(1.15)`, `mask` bilan).
- Tugma matni va ikonkalari `--tb-halo` bilan yorug'lanadi.
- Linza: `--lens-bg`, `blur(1px)`, specular hoshiya.

Pseudo-elementlar `[data-slot="tab-bar"]` qoidalari sifatida `globals.css` da yoziladi.

### Telegram to'liq ekrani (prototipdagi `.tg-head`, `.layer`)

- **Qobiq.** `AppShell` dan `pt-safe` olinadi. `main` `pt-safe-2 md:pt-safe-6` oladi, `Sidebar` `pt-safe`. Kontent Telegram tugmalari ostidan scroll bo'ladi, sahifa boshi esa avvalgidek ular ostidan boshlanadi. Ambient siljishi (`--page-top`) `--safe-top` ni ham hisobga oladi.
- **Tepadagi fade.** `AppShell` ichida `data-slot="top-fade"` elementi:
  - `fixed` holatda yuqorida turadi, `pointer-events-none`.
  - Balandligi `calc(var(--safe-top) + min(var(--safe-top), 18px))`: brauzerda va desktop Telegram'da 0. JS holat qo'shilmaydi, bu 2026-10-07 qaroriga mos.
  - Ko'rinishi: `linear-gradient(to bottom, var(--fade) 40%, transparent)` + `blur(12px) saturate(1.6)` + mask.
  - `main.scrollTop > 4` bo'lganda `data-on` → 250ms ichida `opacity: 1`.
- **Varaqlar.** `DialogContent` balandligi `max-h` / `h-[calc(100dvh-18px-var(--safe-top))]`: varaq Telegram tugmalari ostidan boshlanadi, yopish tugmasi ularning tagida qolib ketmaydi.

### Telegram ranglari (`components/telegram-sync.tsx`, 2-qaror)

`themeChanged` (va ochilish) paytida `setTheme(colorScheme)` dan keyin:

- `setHeaderColor` (6.9+), `setBackgroundColor` (6.1+) va `setBottomBarColor` (7.10+) chaqiriladi. Har biri `isVersionAtLeast` bilan tekshiriladi va ixtiyoriy chaqiruv (`?.()`) qilinadi.
- Ranglar: yorug' `#F7F8F9` / `#F1F2F4` / `#E5E7EB`, tungi uchala o'rinda `#15121E`. Ular `lib/telegram.ts` dagi konstantada turadi.
- `types/telegram.d.ts` ga uchala metod qo'shiladi.

## Bosqichlar

Ish `dev` branch'ida (foydalanuvchi qarori, memory). Har bosqichda:

- TDD: RED → GREEN → commit (Conventional Commits, inglizcha, attribution qatorlari bilan).
- Oxirida `make lint && make test && make e2e` (`set -o pipefail`), so'ng `git push origin dev`.
- Hisobot: har xatti-harakat uchun RED → GREEN.
- Keyingi bosqichga faqat foydalanuvchi tasdig'idan keyin o'tiladi.
- Prettier ishlatilmaydi.

### 1. Hujjat, tokenlar, ambient fon, Telegram ranglari, avatarlar

1. **Hujjatlar.**
   - Yangi spec: `docs/superpowers/specs/2026-10-16-liquid-glass-design.md` (shu reja mazmuni: qarorlar, tokenlar, chetlanishlar).
   - Shu reja: `docs/superpowers/plans/2026-10-16-liquid-glass.md`.
   - `CLAUDE.md` «Manbalar» ga qator.
   - Eski hujjatlarga izoh: `2026-10-13` (Tokenlar va Telegram ustuni almashtirildi), `2026-10-04-login-design.md` va `logo-design.md` (user app'da panel va logotip rangi), `2026-10-07-telegram-fullscreen-design.md` (kontent tugmalar ostida, fade, varaq chegarasi).
2. **`app/globals.test.ts`.** Yorug' va tungi token qiymatlari; Telegram blokida `--tg-theme` ranglari yo'q; radiuslar 26 / 22 / 40 / 999px; `@utility surface|glossy|glossy-red|glass-chip|bg-ambient` bor; surilayotgan varaq qoidasi (`:root[data-move] [data-slot="page"]`). RED → GREEN.
3. **Ambient.**
   - `app-shell.test.tsx`: `main` da `bg-ambient` bor.
   - `page-transition.test.tsx`: varaqda `bg-background` yo'q.
   - `e2e/transitions.spec.ts`: tinch varaq shaffof, `main` gradient chizadi, `data-move` paytida varaq noshaffof. Bu talab o'zgarishi: avval varaq doim noshaffof edi, endi faqat surilish paytida.
4. **Telegram ranglari.**
   - `telegram-sync.test.tsx`: yorug' va tungi sxemada uchala metod to'g'ri rang bilan chaqiriladi; eski client'da chaqirilmaydi.
   - `e2e/miniapp.spec.ts`: `body` foni Telegram'niki emas, ilovaning tungi rangi; tab-bar rangi tekshiruvi yangilanadi; soxta Telegram'ga `setHeaderColor` va boshqa metodlar qo'shiladi. Talab o'zgarishi, 2-qaror.
5. **Avatar.** `kit/avatar.test.tsx`: `data-tone` yo'q, oddiy kulrang. Talab o'zgarishi.

### 2. Yuzalar va boshqaruvlar

Komponentlar jadvalidagi har qator alohida sikl. Tegishli test fayliga nomlangan utility yoki asosiy class'ni tekshiradigan assertion qo'shiladi (masalan `expect(group).toHaveClass("surface")`, `MainButton` `glossy` + `rounded-full` + `h-[54px]`), RED ko'riladi, keyin class almashtiriladi va GREEN.

Brend qismi:

- `e2e/logo.spec.ts` va `e2e/login.spec.ts`: panel foni `--brand-panel` va gradient, yorug'da logotip `rgb(14, 15, 18)`. Talab o'zgarishi, 3-qaror.
- `banner.test.tsx`: art ranglari.
- `states.test.tsx`: splash belgisi `--brand-fill`.

### 3. Tab-bar shishasi va to'liq ekran

1. **Tab-bar.** `globals.test.ts` (pseudo-qatlam qoidalari) va `tab-bar.test.tsx` (panelda eski `bg-glass` yo'q, yangi soya bor).
2. **Qobiq.**
   - `app-shell.test.tsx`: qobiqda `pt-safe` yo'q, `main` da `pt-safe-2`, sidebar'da `pt-safe`.
   - `e2e/miniapp.spec.ts`: to'liq ekranda qobiq `padding-top` 0, `main` 101px, bosh sahifa boshi `y ≥ 93`; desktop client'da `main` 8px.
3. **Fade.**
   - Unit: scroll > 4 bo'lsa `data-on`, tepaga qaytilsa yo'qoladi.
   - e2e: to'liq ekranda balandlik 111px, desktop client'da 0.
4. **Varaq chegarasi.** e2e: to'liq ekranda «Sozlama» varag'ining tepasi `y ≥ 93`; hozir ~10px.

### 4. Yakuniy tekshiruv va hujjatlar

- **Skrinshotlar** vaqtinchalik Playwright spec bilan (MSW). Spec commit'dan va `make e2e` dan oldin o'chiriladi.
  - Telefon 375px @2x va desktop 1280px.
  - Yorug', tungi va soxta Telegram to'liq ekran.
  - Ekranlar: bosh sahifa, ro'yxat, kanban, yozuv, forma, varaq, action sheet, alert, toast, bo'sh holat, kirish.
  - Natija `docs/design/screens-v2/` ni yangilaydi (nomlar o'sha), sanasi bilan.
- **Hujjatlar:**
  - `docs/design/README.md`: «Hozirgi ko'rinish (2026-10-16)».
  - README: «User app ko'rinishi».
  - Spec'ga «Amalga oshirishda belgilangan qarorlar» bo'limi.
- **Mutatsiya tekshiruvi** (fade chegarasi, Telegram ranglari, varaq chegarasi): fayl backup nusxadan tiklanadi, `git checkout` dan emas.
- **Haqiqiy stack smoke** (`make dev`, Chrome, `localhost`): yorug' va tungi rejim, ro'yxat, varaq, kanban.
- Haqiqiy Telegram qurilmasida tekshirish foydalanuvchiniki. Test yoki production deploy alohida so'raladi.

## Asosiy fayllar

- `apps/web/app/globals.css`, `app/globals.test.ts`
- `components/kit/*` (group, main-button, page-title, detail-head, chips, segmented, search-box, form-row, tile-icon, avatar, amount, banner, stat-card, amount-sheet, date-sheet, picker-sheet, ordered-rows, action-sheet, page-transition)
- `components/ui/*` (dialog, alert-dialog, badge, button, switch)
- `components/shell/*` (app-shell, tab-bar, sidebar, location-switcher, menu-sheet, tab-bar-sheet)
- `components/telegram-sync.tsx`, `lib/telegram.ts`, `types/telegram.d.ts`
- `components/states.tsx`, `refusal.tsx`, `history-list.tsx`, `sortable-list.tsx`, `section-tabs.tsx`, `login/login-frame.tsx`
- `components/tasks/*` (task-board, task-card, stage-track, deadline-card, task-form), `warehouse/*` (lines-field, inventory-form, payments-field, balance-card), `catalog/product-stock.tsx`, `customers/customers-page.tsx`, `tasks/tasks-page.tsx`
- e2e: `transitions.spec.ts`, `miniapp.spec.ts`, `logo.spec.ts`, `login.spec.ts`

## Tekshiruv

- Har bosqich: `make lint` (go vet, golangci-lint, pnpm lint, typecheck), `make test` (Go'da 53300 xatosi chiqsa `-p 4`), `make e2e` (admin ham: unga tegilmagan).
- Vizual: skrinshotlarni prototip bilan yonma-yon solishtirish (yorug' / tungi, 375 / 1280). 320 / 360 / 375 / 768 / 1280px enlarda yon scroll yo'qligi.
- Lokal haqiqiy stack: kirish, bosh sahifa, mijoz / vazifa / xarid varaqlari, kanban sudrash, tungi rejim.
