# User app: «Qorong'i shisha», konturli belgilar, «Sozlamalar» sahifasi va web ko'rinishi — dizayn

Sana: 2026-10-16. Holat: foydalanuvchi reja sifatida tasdiqlagan (ikki savol-javob bilan). Reja: `docs/superpowers/plans/2026-10-16-glass-v2.md`. Faqat user app (`apps/web`); admin panel, backend va API o'zgarmaydi.

## Kontekst

Foydalanuvchining so'zlari: "https://claude.ai/artifact/Dd1uTB3kPpSzCbvux94ZHw dizaynni to'liq shunday qilib ber".

Havola o'sha prototip (`6634ff38-6626-42c0-8dea-2bdd4b68122e`), yangi versiyasi `1792163353` (2026-10-16, 3000 qator). User app `1792150007` versiyasi (2807 qator) bo'yicha qurilgan: `2026-10-16-liquid-glass-design.md`. Ikki versiya farqi +226 / −33 qator:

1. **Qorong'i shisha.** Tungi rejim lavanda o'rniga qora: `#0F1013` fon, `#1D1F23 → #0E0F12 → #15171B` gradient (tepada oq nur), `rgba(255,255,255,.045)` shisha kartalar, oq urg'u `#F2F3F5`, oq yaltiroq tugma, kulrang banner. Prototip mavzulari endi ikkita: «Yorug' shisha» va «Qorong'i shisha».
2. **Reference patternlar.** Har sarlavha yonida yaltiroq brend kvadrati (`.bmark`), sarlavha 28px, «+» 56×42 kapsula. Hero muzlagan shisha karta, chapga tekislangan, birlik kulrang. `.sh` 16px/500 kulrang. Rangli iOS plitka-ikonkalar (`.tile-ic`) o'rniga oddiy konturli belgilar, `.tk-ic` va stat-karta belgisi neytral fonda.
3. **Tab-bar v2.** Muzlagan pill (oq halqasiz), konturli belgilar, kulrang nomlar, faoli qora (tungida oq), faol tugma ostida ko'rinadigan oq shisha kapsula.
4. **«Sozlamalar» sahifasi.** Panelda a'zo tanlagan 4 tugma va doim oxirida «Sozlamalar». «Sozlamalar» sahifasida «Bo'limlar» ro'yxati («Panelda» belgisi bilan), «Pastki panelni sozlash» kartasi, keyin sozlamalar. «Pastki panel» sahifasida panel ko'rinishi, ✓/+ tugmalari, «Standart holat».
5. **Web ko'rinishi.** Suzuvchi shisha sidebar (brend, bo'limlar, pastda profil kartasi), tepa panel («Orqaga», til, mavzu, chiqish), 1120px kontent ustuni, o'rtadagi dialoglar, o'ngdagi asosiy tugma.

Bu `docs/SPEC.md` da yo'q ish, foydalanuvchi so'rovi bilan qilinadi. Backend, API va DB o'zgarmaydi.

## Foydalanuvchi qarorlari (2026-10-16)

| # | Savol | Qaror |
|---|---|---|
| 1 | «Sozlama» varag'i yoki sahifa | **Prototipdagi sahifalar.** 5-tugma «Sozlamalar» `/settings` ni ochadi, «Pastki panel» uning ichki sahifasi (`/settings/tab-bar`). Ichki sahifalar (Xaridlar, Kassa…) ro'yxatda va panelda qoladi (10-15 dagi 4-qaror). 5-tugma hammada bor: `settings.view` bo'lmasa sahifada faqat sahifalar ro'yxati va panel sozlamasi turadi. Ikkala varaq olib tashlanadi. |
| 2 | Web kontent eni | **Prototipdagidek 1120px**, o'rtada. |
| 3 | Web qobig'i | **Prototip va hozirgi imkoniyatlar.** Tepa panelda «Orqaga» (desktopda sahifadagi «‹ …» o'rnida), mavzu va chiqish bor. Til tugmasi qo'shilmaydi, ilova faqat o'zbekcha. Sidebar yig'iladi, lokatsiya tanlovi sidebar'da qoladi. |
| 4 | Bosh sahifa nomi | **«Bosh sahifa» qoladi.** Prototipdagi «Asosiy» kompaniyaning tayyor lokatsiyasi nomi bilan to'qnashadi. |
| 5 | Brend kvadrati | **«H24» belgisi** (`LogoMark`, 2026-10-04 logo qoidasi), «H» harfi emas. |
| 6 | Tungi rejimdagi kirish paneli | **Oq yaltiroq, qora matn.** Tungi urg'u va splash belgisi bilan bir xil, yorug' rejimning teskarisi. |
| 7 | «Sozlamalar»dagi qidiruv | **Yo'q**, prototipdagidek. Ro'yxat 16 sahifadan oshmaydi va guruhlarga bo'lingan. |
| 8 | Panel to'laligi | **Doim to'la.** Panelda 4 ta sahifa turadi, ochiq sahifa kamroq bo'lsa shuncha. API o'zgarmaydi. |

### Rad etilgan variantlar

- «Sozlama» va «Pastki panel» varaqlarini 10-15 dagidek qoldirib, faqat ko'rinishini yangilash.
- Kontentni butun enda qoldirish (2026-10-04 qarori): foydalanuvchi prototipning 1120px ustunini tanladi.
- Tepa panelsiz web, yoki prototipdagidek yig'ilmaydigan va lokatsiyasiz sidebar.
- «Asosiy» nomi, «H» harfi, to'q kulrang tungi kirish paneli, «Sozlamalar»dagi qidiruv, panelda 0–4 sahifa.
- Til tugmasi: ilovada boshqa til yo'q, tugma hech narsa qilmas edi.

## Spec'dan chetlanishlar

| # | Avvalgi qaror | Yangi | Sabab |
|---|---|---|---|
| 1 | 10-15 (2-qaror), 10-16 (1-qaror): «Sozlama» va «Pastki panel» varaqlari | `/settings` sahifasi va `/settings/tab-bar` sahifasi | 1-qaror |
| 2 | 10-15 (3-qaror): «Sozlama» ⚙ | «Sozlamalar», prototipning slayder belgisi | prototip, 1-qaror |
| 3 | 10-15: panelda 0–4 sahifa | doim `min(4, ochiq sahifalar)`; saqlangan qisqa panel standart tartibdan to'ldiriladi | 8-qaror |
| 4 | `logic/roles.md` §8: `/settings` faqat `settings.view` ga | `/settings` hammaga; sozlamalar guruhlari faqat `settings.view` bilan; ichki sahifalar avvalgidek gated | 1-qaror |
| 5 | 2026-10-04: kontent butun enda | user app desktopda 1120px ustun, o'rtada | 2-qaror |
| 6 | 2026-10-13, §8: topbar yo'q, «‹ …» havolasi hamma enda | 768px dan tepa panel: «Orqaga», mavzu, chiqish; `BackLink` `md:hidden` | 3-qaror |
| 7 | 2026-10-13 (10-qaror): desktopda varaq pastdan, 480px | 768px dan o'rtada, tepadan 40px, 540px, radius 32, tutqichsiz | prototip |
| 8 | 2026-10-16: «Tungi shisha» (lavanda), kirish paneli tungida lavanda | «Qorong'i shisha»; panel oq yaltiroq | prototip, 6-qaror |
| 9 | 2026-10-16: tiniq tab-bar (sinadigan chet, halo); 2026-10-13: to'ldirilgan tab belgilari | muzlagan pill, konturli belgilar, oq kapsula linza | prototip |
| 10 | 2026-10-13 / 10-16: `TileIcon` rangli kvadrat (gloss) | rangsiz konturli belgi, `--heading` rangida | prototip |

### Prototipdan ataylab chetlanishlar

- «Bosh sahifa» nomi (4-qaror) va «H24» belgisi (5-qaror).
- Til tugmasi yo'q. Sidebar yig'iladi, unda lokatsiya tanlovi va brend ostida kompaniya nomi bor (3-qaror).
- Profil sahifasi 10-15 dagidek: prototipdagi «Bo'limlar» va «Pastki menyu» qatorlari yo'q (ular 10-15 da rad etilgan).
- Sudralayotgan qator `--lifted`: prototipdagi `--seg-thumb` tungida oq, ustidagi matnni yashiradi.
- Linzani sudrash va chapdan surib qaytish avvalgidek yo'q.

## Dizayn

### 1. Tokenlar (`apps/web/app/globals.css`)

`.dark` = «Qorong'i shisha», qiymatlar `.app[data-theme=dark]` dan aynan:

| shadcn / yangi | Qorong'i shisha |
|---|---|
| `--background` | `#0F1013` |
| `--foreground` (va `*-foreground` matnlari) | `#F2F3F5` |
| `--card` | `rgba(255,255,255,.045)` |
| `--primary` / `--primary-foreground` / `--primary-soft` | `#F2F3F5` / `#0E0F12` / `rgba(255,255,255,.1)` |
| `--muted` / `--secondary` / `--accent` (fill) | `rgba(255,255,255,.07)` |
| `--muted-foreground` / `--heading` | `#8E9198` / `#D5D7DC` |
| `--border` / `--input` / `--press` | `rgba(255,255,255,.08)` / `.08` / `.06` |
| `--menu` / `--sheet-cell` / `--scrim` / `--shadow` / `--skel` | `rgba(30,32,36,.9)` / `rgba(255,255,255,.05)` / `rgba(0,0,0,.55)` / `0 18px 44px rgba(0,0,0,.55)` / `rgba(255,255,255,.07)` |
| `--sheet` | noshaffof ekvivalent: `rgba(22,23,27,.92)` skrim ustida (10-16 dagi 1-qaror usuli) |
| `--sheen` / `--rim` / `--lift` | 160deg oq 5% / `inset 0 0 0 1px rgba(255,255,255,.09), inset 0 1px 0 rgba(255,255,255,.1)` / `0 14px 34px rgba(0,0,0,.35)` |
| `--btn` / `--btn-glow` | `linear-gradient(180deg,#FFFFFF,#E2E3E6)` / `0 8px 22px rgba(0,0,0,.45), inset 0 -1px 0 rgba(0,0,0,.08)` |
| `--chip` / `--col` | `rgba(255,255,255,.06)` / `.025` |
| `--ambient` / `--ambient-base` / `--fade` | tepa-chapda oq nur + `160deg #1D1F23 → #0E0F12 46% → #15171B` / `#15171B` / `rgba(14,15,18,.94)` |
| `--search` / `--search-rim` | `rgba(255,255,255,.05)` / `inset 0 0 0 1px rgba(255,255,255,.09)` |
| `--seg-thumb` / `--seg-on` / `--seg-shadow` | `#F2F3F5` / `#0E0F12` / `0 4px 14px rgba(0,0,0,.4)` |
| `--ban` / `--ban-ink` / `--ban-sub` | `135deg #26282D → #16181B` / `#F2F3F5` / `#A9ACB3` |
| `--av-bg` / `--av-ink` | `rgba(255,255,255,.1)` / `#F2F3F5` |
| `--brand-fill` / `--brand-panel` / `--brand-panel-foreground` | oq `--btn` / `#E2E3E6` / `#0E0F12` (6-qaror) |

Yangi tokenlar (yorug' / qorong'i):

- `--tb-frost`: tab-bar muzi, `rgba(247,248,250,.74)` / `rgba(24,26,30,.72)`.
- `--tb-shadow`: tab-bar soyasi. `--lens-fill` va `--lens-shadow`: faol tugma ostidagi oq kapsula, prototipdagi `.lens` (v2).
- `--switch-knob`: kalit tugmachasi, `#fff` / `#0E0F12` (qorong'ida yoqilgan kalit oq, tugmachasi qora).
- `--brand-ink`: brend to'ldirishi ustidagi siyoh (splash belgisi), `#fff` / `#0E0F12`.
- `--art1`, `--art2`, `--art-ink`, `--art-spark`: banner rasmi. Yorug'da qora plitka `#3A3B40 → #0E0F11`, oq «24», uchqunlar `#9A9DA4`. Qorong'ida oq plitka `#FFFFFF → #C9CBD0`, qora «24», uchqunlar `#8E9198`.

Olib tashlanadi (ishlatilmay qolgani tekshirilib): eski tab-bar tokenlari (`--tb-bg`, `--tb-rim`, `--tb-spec`, `--tb-glow`, `--tb-line`, `--tb-halo`, `--lens-bg`), `--gold` (summa birligi `text-muted-foreground`), `--head` (sidebar endi `surface`).

`lib/telegram.ts` `chromeColors.dark`: qorong'i ambient'ning tepasi, asosi va pasti (chizilgan holatidan o'lchanadi). Yorug'i o'zgarmaydi.

### 2. Belgilar va sahifa naqshlari

- **`kit/tab-icons.tsx`** konturli: 24×24, `fill="none"`, `stroke="currentColor"`, `strokeWidth 1.8`, yumaloq uchlar. Prototipning yo'llari aynan: `o-home`, `o-cust`, `o-task`, `o-box`, `o-wh`, `o-emp`, `o-set` (slayder), Sotuv `i-bag`, Moliya va Kassa `i-wallet`, Xaridlar `i-receipt`, Ta'minotchilar `i-truck`. Qolganlari shu uslubda, hozirgi metaforasi bilan: Xizmatlar kalit, Ko'chirishlar ikki strelka, Inventarizatsiya belgili planshet, Boshlang'ich qoldiq «+» qutisi, Xarajatlar va O'tkazmalar tanga.
- **`TileIcon`** fonsiz: `w-7 h-8`, `text-heading`, belgi 22px `stroke 1.8`. `Group inset="tile"` ajratgichi 56px.
- **`SoftIcon`** (`.tk-ic`): `bg-muted`, ichki hoshiyasiz, belgi rangi saqlanadi.
- **Stat-karta belgisi** (`.cc-h .mi`): `bg-muted text-foreground`, gloss yo'q. **`Tile`** ikonkasi (`.tile .ti`): glossy to'ldirish, nursiz.
- **`BrandMark`** (`kit/brand-mark.tsx`): 40px, radius 12, glossy, ichida `LogoMark` urg'u siyohida; bezak (`aria-hidden`).
- **`PageTitle`**: chapda `BrandMark` (768px dan yashirin), h1 28px `-0.025em` (768px dan 30px). **`PlusButton`** 56×42, radius 21.
- **`Hero`**: muzlagan karta (`surface`, radius 30, `22px` yon, `24px` tepa), chapga tekislangan; yorliq 16px/500 kulrang (qarz qizil, avans yashil qoladi); badge'lar chapda; 768px dan summa 72/48px. `plain` varianti markazda va kartasiz: mahsulot narxi, ta'minotchi va mijoz balansi, kassa balansi (prototipdagi `.center` bloklar).
- **`Amount`** birligi 26px × k, 500, `text-muted-foreground`.
- **`SectionHeading`** 16px, 500, `text-muted-foreground`.

### 3. Tab-bar, «Sozlamalar», «Pastki panel»

- **Tab-bar** (`shell/tab-bar.tsx`): tugmalar `text-muted-foreground`, 11px/500, `gap-1`; joriysi `text-foreground` 600, belgisi `stroke 2.2`. 5-tugma `/settings` havolasi «Sozlamalar»; sahifa panelda bo'lmasa joriy u (`currentPin` qoidasi). `globals.css`: `::before` muzi (`--tb-frost`, `blur(18px) saturate(1.8) brightness(1.04)`), `::after` va halo yo'q, soya `--tb-shadow`, linza `--lens-fill` + `blur(8px) saturate(1.8)` + `--lens-shadow`.
- **`lib/nav.ts`**: `barOrder(permissions, tabBar)` — a'zo ocha oladigan sahifalar panel tartibida: saqlanganlari, keyin qolganlari `DEFAULT_BAR` va menyu tartibida. `barPages` = uning birinchi 4 tasi (8-qaror). `/settings/tab-bar` menyu sahifasi emas: unda panel yashirinadi.
- **«Sozlamalar»** (`/settings`, kompaniyasi bor har a'zo uchun):
  - `PageTitle` «Sozlamalar» / «Barcha bo'limlar va sozlamalar».
  - `pageGroups` bo'yicha sarlavha va qatorlar: «Bo'limlar», «Mahsulotlar», «Ombor», «Moliya». Qatorda konturli belgi, nom, telefonda paneldagisida «Panelda» belgisi.
  - Telefonda «Pastki panelni sozlash» kartasi: 42px glossy slayder kvadrati, nom, ostida panel sahifalari « · » bilan, chevron.
  - `settings.view` bo'lsa: «Mijozlar va vazifalar», «Valyuta va moliya» guruhlari, egasiga «Rollar» va izohi. Eski `?tab=` manzili faqat shunda yo'naltiriladi.
- **«Pastki panel»** (`/settings/tab-bar`, har a'zo uchun):
  - «‹ Sozlamalar», «Pastki panel» / «4 ta tugmani o'zingizga moslang. Sozlamalar doim oxirida.»
  - Panel ko'rinishi: tanlangan sahifalar va xira, qulflangan «Sozlamalar».
  - «Paneldagi tugmalar · n / 4».
  - Hamma ochiq sahifa bitta tartiblanadigan ro'yxatda, 4-sidan keyin «Panelda emas · Sozlamalar sahifasida» ajratgichi. Qatorda tutqich, belgi, nom va ✓/+ tugmasi. ✓ («Paneldan olib tashlash: …») sahifani birinchi tashqi sahifa bilan almashtiradi, + («Panelga qo'shish: …») oxirgi panel sahifasi bilan. Almashadigani yo'q bo'lsa toast: «Almashtirish uchun boshqa sahifa yo'q».
  - «Sozlamalar · Doim oxirida 🔒» qatori, «Standart holat» tugmasi, izoh.
  - «Saqlash» → «Pastki panel saqlandi» va «Sozlamalar» ga qaytadi. Standart tanlanib o'zgartirilmasa `null` yuboriladi, xato `Refusal` bilan ko'rsatiladi.
- `shell/menu-sheet.tsx` va `shell/tab-bar-sheet.tsx` o'chiriladi.

### 4. Web ko'rinishi (768px dan)

- **Qobiq:** suzuvchi sidebar va o'ng ustun. Ustunda `TopBar` va scroll bo'ladigan `main` (`px: max(32px, (100% − 1120px) / 2)`, tepadan 80px).
- **Sidebar:** 16px chetdan suzuvchi karta, eni 264 (yig'ilganda 64), radius 30, `surface`.
  - Tepada `BrandMark`, `Logo` va kompaniya nomi, o'ngda yig'ish tugmasi.
  - Bo'limlar 48px, radius 16, 16px/500; joriysi glossy.
  - Pastda lokatsiya tanlovi va profil kartasi (`bg-muted`, radius 20, avatar 40).
- **Tepa panel:** 76px, fade fonida.
  - Chapda «Orqaga» shisha tugmasi; manzili sahifaning `BackLink` idan olinadi (`shell/back-target.tsx`).
  - O'ngda, faqat brauzerda: mavzu (oy / quyosh, «Mavzuni almashtirish») va «Chiqish». «Chiqish» alert ochadi: «Tizimdan chiqasizmi?» / «Qayta kirish uchun raqamingizga kod keladi.» / «Bekor qilish», «Chiqish».
- **Joylashuv:**
  - Varaq o'rtada, tepadan 40px, eni 540, radius 32, tutqichsiz.
  - `MainBar` o'ngda, 380px, fadesiz. Toast tepadan 20px.
  - Kanban ustuni 300px, chiplar va kanban chetga chiqmaydi. «Umumiy holat» `auto-fill minmax(300px)`.
  - Plitkalar 680px gacha, qidiruv 460px, segmented 420px.
  - Bosh sahifa boshida profil havolasi yashirin, lokatsiya o'ngda.

## Bosqichlar

Ish `dev` branch'ida. Har bosqich TDD (RED → GREEN → commit), oxirida `make lint && make test && make e2e` → `git push origin dev`. Foydalanuvchi bosqichlarni to'xtamasdan ketma-ket bajarishni so'radi (2026-10-16): hisobot oxirida beriladi.

0. **Hujjatlar:** shu spec, reja, eski hujjatlarga izohlar, `logic/roles.md` §8, `CLAUDE.md`.
1. **Qorong'i shisha va tokenlar.**
2. **Belgilar va sahifa naqshlari.**
3. **Tab-bar v2, «Sozlamalar» va «Pastki panel».**
4. **Web ko'rinishi.**
5. **Yakuniy tekshiruv:** skrinshotlar, `docs/design/README.md`, mutatsiyalar, production CSS, yon scroll, haqiqiy stack smoke.

## Testlar

- `app/globals.test.ts`: palitralar, yangi va olib tashlangan tokenlar, tab-bar qatlamlari.
- Kit, qobiq va sahifa komponentlari: o'z testlarida nomlangan utility yoki asosiy class.
- `lib/nav.test.ts`: `barOrder`, `barPages` to'ldirilishi, menyu sahifalari.
- e2e (375px va desktop): panel va «Sozlamalar», «Pastki panel» saqlash va «Standart holat», tungi Telegram ranglari, tungi kirish paneli, desktopda «Orqaga», mavzu va chiqish.

## Chegara

- Admin panel, backend, API, migratsiyalar.
- Til tanlovi, prototipning Telegram mavzulari, linzani sudrash, chapdan surib qaytish.
- Ikonkalar (favicon, apple-icon, bot avatari).
- Test va production deploy alohida so'raladi.

## Amalga oshirishda belgilangan qarorlar

(Bosqichlar davomida to'ldiriladi.)
