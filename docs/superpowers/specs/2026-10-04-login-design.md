# Login dizayni: brend paneli — dizayn

Sana: 2026-10-04. Holat: foydalanuvchi tasdiqlagan (reja: `docs/superpowers/plans/2026-10-04-login.md`), amalga oshirilgan.

## Maqsad

Foydalanuvchining so'zlari (2026-10-04): "login dizaynini chiroyliroq qilish kerak".

Avval ikkala `/login`: bo'sh sahifa o'rtasida 384px ustun, 32px maydon va tugma, brend faqat 32px logotip. Keng ekranda sahifaning ko'p qismi bo'sh edi, telefonda boshqaruvlar barmoq uchun kichik.

Funksiya o'zgarmaydi: backend, `openapi.yaml`, API chaqiruvlari va kirish oqimi o'sha. Bu `docs/SPEC.md` da yo'q ish (7-bo'lim "shadcn standart uslubi" deydi), foydalanuvchi so'rovi bilan qilinadi.

## Foydalanuvchi qarorlari

Uch yo'nalish ko'rsatildi (brend paneli; markazda kartochka; minimal sayqal) va uch qamrov.

1. **Ko'rinish:** brend paneli. Keng ekranda chapda `#174449` panel (oq logotip, katta "24", bir satr tavsif), o'ngda forma. Telefonda panel tepada tasma, forma uning ostidan varaq bo'lib chiqadi.
2. **Qamrov:** ikkala ilovaning brauzerdagi `/login` i (web: telefon, keyin SMS kod; admin: bot kodi). Mini App holat ekranlari (`Centered`), `/select-company`, `/expired` o'zgarmaydi.

Reja bilan birga tasdiqlangan takliflar (maketda yo'q edi): yangi matnlar, "Kodni olish" dagi spinner, qadam almashgandagi siljish, API rad javobidagi ikonka, Telegram ichida panelning chat ranglarida bo'lishi.

Avvalgi qarorlar kuchda: urg'u rangi indigo (tugma); Telegram ichida hamma rang chat mavzusidan.

## Konsepsiya

```
Kompyuter (lg, 1024px dan)                         Telefon
┌──────────────────────┬─────────────────────────┐ ┌──────────────────┐
│██ Hisob24 ███████████│                         │ │██ Hisob24 ▒▒24▒▒█│
│█████████████▒▒▒▒▒▒▒▒▒│   Kirish                │ │██ Biznesingiz… ██│
│███████████▒▒ 24 ▒▒▒▒▒│   Telefon raqamingizni… │ │╭────────────────╮│
│█████████████▒▒▒▒▒▒▒▒▒│   [ +998  90 123 45 67 ]│ ││ Kirish         ││
│██ Biznesingiz uchun █│   [    Kodni olish     ]│ ││ [+998 90 123…] ││
│██ hisob tizimi ██████│                         │ ││ [Kodni olish ] ││
└──────────────────────┴─────────────────────────┘ └──────────────────┘
```

- **Jasorat bitta joyda:** panel. Forma tomoni sokin, bitta urg'u (indigo tugma).
- **Grafika brendning o'zidan:** logotipdagi "24" raqami, juda katta va chetidan kesilgan, fon tusida. Gradient, rasm, bezak ikonka yo'q.
- **Raqamlar mazmun:** telefon va kod katta, `tabular-nums`.
- **Barmoq uchun:** bosiladigan hamma narsa kamida 44px.
- **Harakat faqat amalga javob:** kod yuborilganda yangi qadam o'ngdan, raqamga qaytganda chapdan 200ms da kiradi. Sahifa ochilganda hech narsa qimirlamaydi.
- Matn chapga tekislangan (avval o'rtada edi).

## Tokenlar (`apps/{web,admin}/app/globals.css`)

| Token | Light va dark | Telegram ichida |
|---|---|---|
| `--brand-panel` (`bg-brand-panel`) | `#174449` | `var(--tg-theme-secondary-bg-color)` |
| `--brand-panel-foreground` | `#ffffff` (10.7 : 1) | `var(--tg-theme-text-color)` |

- Panel ichida `--brand` va `--muted-foreground` qayta belgilanadi (`.dark` va `html[data-telegram]` qilganidek): `Logo` va `Brand` o'zgarmasdan panel ustida oq bo'ladi; "Admin" so'zi va telefondagi tavsif 72% oq (6.4 : 1).
- Telegram ichida fon noma'lum, shuning uchun u yerda panel ham chat ranglarida (login faqat Telegram orqali kirish muvaffaqiyatsiz bo'lgandagina ko'rinadi).

## Komponentlar

| Komponent | Fayl | Qoidasi |
|---|---|---|
| `Logo24` | `apps/{web,admin}/components/logo.tsx` (bir xil) | Belgining "24" i, yolg'iz. Bezak: `aria-hidden`, `data-slot="logo-24"`. `viewBox="218.22 173 257.89 164.8"` (yo'l chegarasi). Yo'l `LogoMark` bilan bitta konstantadan. |
| `LoginFrame` | `apps/{web,admin}/components/login/login-frame.tsx` (bir xil) | `header` (panel): `h1` ichida `brand`, tavsif, fonda `Logo24`. `main`: forma. lg dan boshlab ikki ustun (5 : 6), undan torda panel tepada tasma, `main` uning pastki chetiga chiqqan varaq. |
| `CodeField` | `apps/{web,admin}/components/login/code-field.tsx` (bir xil) | Olti xonali kod, har raqamga alohida katak (`InputOTP` o'rami). `aria-label="Kod"`, faqat raqam, oltinchi raqam `onComplete` ni chaqiradi; `invalid`, `disabled`. Avval ikki joyda takrorlangan edi. |
| `PhoneField` | `apps/web/components/phone-field.tsx` | yangi `size?: "default" \| "lg"`: login'da 48px. |

`components/ui/*` tahrirlanmaydi: o'lchamlar `className` orqali.

## Forma tomoni

| Bo'lak | Avval | Endi |
|---|---|---|
| Qadam sarlavhasi | yo'q | `h2`, 24px, 600 |
| Telefon maydoni | 32px | 48px, 18px raqamlar, `rounded-xl` |
| "Kodni olish" | 32px | 48px, 16px; so'rov ketayotganda spinner (`PendingButton`) |
| Kod kataklari | 44px, yopishgan | 56px baland, alohida-alohida, 24px 600 raqam |
| "Kodni qayta yuborish" | 32px ghost | 44px konturli |
| "Raqamni o'zgartirish" | 32px link | 44px ghost |
| Admin bot havolasi | matn havola | 44px to'ldirilgan tugma ko'rinishida |
| API rad javobi | qizil matn | `Refusal` (ikonka bilan, boshqa formalardagidek) |

`h1` brend bo'lib qoladi (web "Hisob24", admin "Hisob24 Admin"); qadam sarlavhalari `h2`.

## Yangi matnlar

| Qayerda | Matn |
|---|---|
| web panel | "Biznesingiz uchun hisob tizimi" (ilovaning mavjud tavsifi) |
| web 1-qadam | sarlavha "Kirish"; izoh "Telefon raqamingizni kiriting, kod SMS orqali keladi" (avval "Telefon raqamingizni kiriting") |
| web 2-qadam | sarlavha "Kodni kiriting"; izoh o'zgarmaydi ("Kod … raqamiga yuborildi") |
| admin panel | "Kompaniyalar, billing va adminlar boshqaruvi" |
| admin | sarlavha "Kirish"; "Kodni olish uchun botga /login yozing" o'zgarmaydi |

## Testlar

- Har o'zgarish avval test bilan (reja: sikllar jadvali).
- Vitest: `Logo24`, `LoginFrame`, `CodeField`; login ramkada turishi, qadam sarlavhalari, band tugma.
- Playwright: joylashuv (keng ekran, telefon), panel va logotip rangi (light, dark, Telegram), boshqaruvlar balandligi (44px), yon scroll yo'qligi.

**Talab o'zgargani uchun o'zgargan test.** `apps/{web,admin}/e2e/logo.spec.ts` (bitta test, ikkala ilovada bir xil) `/login` da logotip light'da `rgb(23, 68, 73)` ekanini tekshirardi. Endi login'da logotip panel ustida, ikkala mavzuda oq: test shunga qayta yozildi. Brend rangi tekshiruvi yo'qolmadi: undan oldin yangi testlar qo'shildi (web: `/select-company`; admin: qobiq), mutatsiya bilan tekshirilgan.

Boshqa hech bir mavjud test o'zgarmaydi, o'chirilmaydi, o'tkazib yuborilmaydi.

## Amalga oshirilgani (2026-10-04)

**O'lchamlar.** Skrinshotlarda sozlangan: 375px va 1280px, light, dark, Telegram'ning to'q mavzusi; qo'shimcha 320, 768, 1024, 1280×600, 1920px.

| Bo'lak | Class'lar | Natija |
|---|---|---|
| Ramka | `flex min-h-svh flex-col lg:grid lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]` | lg dan boshlab ikki ustun (1280px da panel 582px), har biri ekran bo'yi |
| Panel, telefonda | `px-6 pt-10 pb-16`; logotip `h-7`; tavsif 14px, 72% oq | tasma 160px, shundan 136px ko'rinadi (varaq 24px ustiga chiqadi) |
| Panel, keng ekranda | `lg:p-12`, `justify-between`; logotip `h-8`; tavsif `lg:max-w-[14ch] lg:text-4xl lg:leading-[1.1] lg:font-semibold lg:tracking-tight` | logotip tepada, tavsif pastda: "Biznesingiz uchun / hisob tizimi" |
| `Logo24` | telefonda `-right-16 bottom-0 h-[110%]`; lg dan `-right-20 w-[105%]`, bo'yi bo'yicha o'rtada; `opacity-[0.07]`, `-z-10` | telefonda tepasi va o'ng tomoni kesilgan; keng ekranda "2" butun, "4" tikuvda kesilgan |
| Varaq (`main`) | `-mt-6 rounded-t-3xl px-6 pt-8 pb-10`; lg dan `mt-0 rounded-none px-12 justify-center`; ustun `max-w-sm` | telefonda forma tepadan boshlanadi (klaviatura ochilganda sakramaydi); keng ekranda bo'yi bo'yicha o'rtada |
| Qadam sarlavhasi va izoh | `text-2xl font-semibold tracking-tight`; `text-sm text-muted-foreground`; orasi 6px, formagacha 32px | |
| Telefon maydoni | `PhoneField size="lg"`: `h-12 rounded-xl`, raqamlar `text-lg font-medium tabular-nums` | 48px; yozilgan raqam yonidagi +998 bilan bir vaznda |
| "Kodni olish" | `h-12 w-full rounded-xl text-base` | 48px |
| Kod kataklari | `h-14 flex-1 rounded-xl border text-2xl font-semibold tabular-nums`, orasi 8px | 56px baland; eni 375px da 48px, 320px da 39px, 1280px da 57px |
| Ikkinchi darajali amallar | `h-11 w-full rounded-xl`; qayta yuborish konturli, raqamni o'zgartirish ghost; kataklardan 8px pastroq | 44px |
| Admin bot havolasi | `buttonVariants({ variant: "secondary" })`, `h-11 w-full rounded-xl` | 44px, to'ldirilgan |
| Telegram'dan qaytgan xabar | `mb-6 rounded-xl bg-destructive/10 px-3.5 py-3 text-sm` | sarlavha ustida |

**Rejadan farqlar.**

- `CodeField` ga ikki qo'shimcha sikl: maydon ochilganda klaviaturani oladi (`autoFocus`), va uni ushlab turgan qadam `ref` orqali inputga yetadi (rad etilgan koddan keyin fokusni qaytarish uchun). Ikkalasi avvalgi nusxalarda bor edi, endi testi ham bor.
- Bot havolasi konturli emas, to'ldirilgan tugma (`secondary`): konturli holda kod ustidagi yettinchi bo'sh katakdek ko'rinardi.
- Panel tavsifi `text-balance` siz, 14ch o'lchovda: muvozanatli o'rash uni birinchi so'zdan keyin sindirardi ("Biznesingiz / uchun hisob tizimi"; brauzerda o'lchangan: ikki bo'linish eni 297 va 296px, deyarli teng).
- Yozilgan telefon raqami `font-medium`: +998 bilan bir vaznda.

**Harakat** (brauzerda o'lchangan): sahifa ochilganda animatsiya yo'q; kod yuborilganda va raqamga qaytilganda `enter`, 0.2s. `prefers-reduced-motion` umumiy qoida bilan o'chadi.

**Tekshiruv.**

- `make lint`: 0 issues. `make test`: Go 15 paket; web 247 (avval 231), admin 216 (avval 202), api-client 1. `make e2e`: admin 40 (avval 32), web 62 (avval 54).
- O'zgargan mavjud test bitta: `e2e/logo.spec.ts` (ikkala ilovada, yuqorida). Boshqa mavjud testlar o'zgarmadi, o'chirilmadi, o'tkazib yuborilmadi; mavjud test fayllariga faqat yangi testlar va import qo'shildi.
- Xarakteristika testlari mutatsiya bilan tekshirildi: sahifa fonidagi logotip rangi (ikkala ilova; light va dark tokeni navbat bilan qizil qilindi) va admin'dagi joylashuv (grid va varaqning ustiga chiqishi olib tashlandi). Har safar fayl zaxira nusxadan tiklandi.
- `cmp`: `components/logo.tsx`, `login/login-frame.tsx`, `login/code-field.tsx` (testlari bilan) va `e2e/logo.spec.ts` ikkala ilovada bayt-bir xil. `globals.css` faqat avvalgi ikki joyda farq qiladi.
- Production build (`next build`): ikkala ilova.
- Yon scroll yo'q: 320, 375, 768, 1024, 1280 (shu jumladan 1280×600) va 1920px da, ikkala qadamda.
- Lokal haqiqiy stack (Go API, haqiqiy Postgres, `SMS_DRIVER=log`; telefon o'lchami va desktop), 12 / 12: sessiyasiz `/login` ga yo'naltirish, raqam, noto'g'ri kod rad etilishi, log'dagi kod bilan kirish, reload'dan keyin sessiya; admin'da noto'g'ri kod va `cmd/otp` kodi bilan kirish. API rad etgan javoblar faqat kutilganlari: ikki noto'g'ri kod (401) va reload'dan keyingi `GET /app/me` (401, keyin refresh). Shu tekshiruv ochgan satrlar o'chirildi, satrlar soni boshlang'ich bilan bir xil.

## Production'ga deploy (2026-10-04)

Foydalanuvchi so'rovi bilan ("deploy qil"). Backend va migratsiya o'zgarmagan: faqat frontend image qayta qurildi.

- `7737522`: toza nusxada (`git archive HEAD`) `pnpm install --frozen-lockfile` va ikkala ilova `next build` dan o'tdi; baza nusxasi `/var/backups/hisob24-v2/hisob24-pre-login-20261004-1554.sql.gz` (11 jadval); `deploy/ship.sh` exit 0, 1 daqiqa 58 soniya; goose "no migrations to run", versiya 4.
- Sessiyasiz tekshiruv 42 / 42, hammasi birinchi urinishda:
  - `healthz`;
  - ikkala saytda `/login`: panel tavsifi, sarlavha, panel class'i, fondagi "24", baland telefon maydoni (web) va alohida kod kataklari (admin), CSS'da ikki token; admin'da bot havolasi 44px tugma;
  - `/favicon.ico`, `/icon.svg`, `/apple-icon.png` (ikkala sayt): 200 va to'g'ri `content-type`;
  - sessiyasiz sahifa `/login` ga yo'naltiriladi (307); cookie nomi bor, qiymati soxta so'rovda qobiq 200; API soxta sessiyani rad etadi (401);
  - webhook'lar secret'siz 401.
- Brauzerda (faqat sahifa ochildi; 375px va 1280px, ikkala sayt): panel foni `rgb(23, 68, 73)`, logotip oq, yon scroll 0px, rad etilgan so'rov yo'q, GET'dan boshqa so'rov yuborilmadi.
- Server: to'rt konteyner healthy, `restarts=0`; satrlar soni deploy'dan oldingi bilan bir xil (11 jadval); `.env` saqlangan (16 kalit, avvalgi daraxtdagi bilan bir xil); API log'ida ERROR / WARN yo'q. Avvalgi daraxt: `/var/www/hisob24-v2.prev` (logo deploy'i).
- Kirish bilan bog'liq oqimlar production'da sinalmadi (haqiqiy SMS ketadi): ular foydalanuvchiga qoladi.

## Qamrovdan tashqari

- Mini App holat ekranlari, `/select-company`, `/expired`.
- Urg'u rangini brend rangiga o'tkazish (hozir indigo): alohida qaror.
- Brauzer `theme-color` i, "kira olmayapsizmi" yordam matni.
