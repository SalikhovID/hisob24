# Logotip — dizayn

Sana: 2026-10-04. Holat: foydalanuvchi tasdiqlagan (reja: `docs/superpowers/plans/2026-10-04-logo.md`), amalga oshirilgan.

## Maqsad

Foydalanuvchining so'zlari (2026-10-04): "logotype qo'shish kerak". Dizayner yettita SVG berdi (PNG nusxalari bilan); logotip ikkala ilovaga qo'shiladi.

Funksiya o'zgarmaydi: backend va `openapi.yaml` ga tegilmaydi. Bu `docs/SPEC.md` da yo'q ish, foydalanuvchi so'rovi bilan qilinadi.

## Foydalanuvchi qarorlari

1. **Joylar:** tab ikonlari; sidebar va topbar; login sahifalari; qolgan to'liq ekranlar (kompaniya tanlash, obuna tugagan, Mini App yuklanish va xato ekranlari).
2. **Rang:** brend rangi: light'da `#174449`, dark'da oq, Telegram ichida chat matn rangi. UI urg'u rangi indigo bo'lib qoladi.
3. **Web sidebar sarlavhasi:** tepada Hisob24 logotipi, ostida kompaniya nomi; yig'ilganda H24 belgi.

Rejada ko'rsatilib tasdiqlangan taxmin: web'ning telefon topbar'i ham sidebar sarlavhasi bilan bir xil (logotip ustida, kompaniya nomi ostida).

## Manba fayllar

Dizayner fayllari (`~/Downloads/Telegram Lite/`; repoga ko'chirilmaydi, geometriya `logo.tsx` va `icon.svg` da):

| Fayl | Nima | Tuval | Rang |
|---|---|---|---|
| `Hisob24_brand_svg.svg`, `Hisob24_black _svg.svg`, `Hisob24_white_svg.svg` | "Hisob24" yozuvi, 7 ta yo'l | 987×312 | `#174449`, qora, oq |
| `H24 512x512.svg`, `H24 512x512-1.svg` | "H24" belgisi, 2 ta yo'l | 512×512 | qora, oq |
| `H24 128x128.svg`, `H24 128x128-1.svg` | o'sha belgi, 4 marta kichik | 128×128 | qora, oq |

Variantlar faqat `fill` bilan farq qiladi (`diff` bilan tekshirilgan): geometriya ikkita.

| Geometriya | Aniq chegarasi (tuval birligida) | Nisbat |
|---|---|---|
| yozuv | `x 63.00 … 923.67`, `y 71.00 … 240.42` | 5.08 : 1 |
| belgi | `x 35.00 … 476.11`, `y 173.00 … 338.32` | 2.67 : 1 |

## Yondashuv

- **Inline SVG komponent, `fill="currentColor"`.** Rangni token beradi: bitta komponent light, dark va Telegram mavzusida ishlaydi. `<img>` + `public/` yoki SVGR kerak emas: yangi dependency yo'q, `deploy/next.Dockerfile` o'zgarmaydi.
- **Yo'llar dizayner faylidan aynan olinadi**; faqat `viewBox` chegaraga qirqiladi (tuvaldagi bo'sh joy ketadi) va `fill` atributlari olib tashlanadi.
- **Tab ikonlari Next fayl konvensiyasi bilan** (`app/icon.svg`, `app/apple-icon.png`, `app/favicon.ico`): `<link>` teglarini Next o'zi qo'yadi.
- **Nusxa konvensiyasi:** umumiy fayllar avval `apps/web` da test bilan yoziladi, keyin `apps/admin` ga aynan ko'chiriladi (oxirida `cmp`).

## Komponentlar

| Komponent | Fayl | Qoidasi |
|---|---|---|
| `Logo` | `apps/{web,admin}/components/logo.tsx` (bir xil) | "Hisob24" yozuvi. `role="img"`, `aria-label="Hisob24"`: sarlavha ichida turganda sarlavhaning nomi bo'ladi. `viewBox="63 71 860.67 169.42"`. O'lchami `className` bilan (balandlik; eni nisbatdan). |
| `LogoMark` | o'sha fayl | "H24" belgisi. Bezak: `aria-hidden`, `data-slot="logo-mark"` (yonida nom bor yoki tugmaning o'z nomi bor). `viewBox="35 173 441.11 165.32"`. |
| `Brand` | `apps/admin/components/brand.tsx` (faqat admin) | `Logo` + "Admin" yozuvi bir qatorda. Orasida haqiqiy bo'shliq tuguni: nomi "Hisob24 Admin" deb o'qiladi. O'lchami shrift o'lchamidan (`em`). |

## Token (`apps/{web,admin}/app/globals.css`)

| Token | Light | Dark | Telegram ichida |
|---|---|---|---|
| `--brand` (`text-brand`) | `#174449` | `#ffffff` | `var(--tg-theme-text-color)` |

- Dizaynerning uch varianti: brend rangi och fonda, oq to'q fonda; Telegram'da fon noma'lum, shuning uchun chatning matn rangi (har doim o'z foniga mos).
- Hisoblangan kontrast (WCAG): `#174449` light sahifa va sidebar fonida 10.3 : 1, kartochkada 10.7 : 1; oq dark sahifada 19.6 : 1, dark sidebar'da 17.9 : 1. `#174449` dark fonda 1.7–1.8 : 1 bo'lardi: shuning uchun dark'da oq.
- Token faqat logotipga: tugma, havola va fokus halqasi indigo bo'lib qoladi.

## Tab ikonlari (`apps/{web,admin}/app/`, bir xil)

| Fayl | Mazmuni |
|---|---|
| `icon.svg` | 512×512, burchagi yumaloq (`rx=112`) `#174449` plitka, ustida oq belgi (dizaynerning 512 tuvalidagi joyida) |
| `apple-icon.png` | 180×180, kvadrat va shaffofsiz (iOS burchakni o'zi kesadi) |
| `favicon.ico` | 16, 32, 48px (SVG ikonni tushunmaydigan brauzerlar uchun) |

- Bitta ko'rinish hamma joyda: plitka o'z fonini olib yuradi, tab tasmasi och yoki to'q bo'lishidan qat'i nazar o'qiladi (oq belgi plitkada 10.7 : 1).
- `proxy.ts` matcher'i `/icon.svg` va `/apple-icon.png` ni ham o'tkazadi: aks holda sessiyasiz so'rov `/login` ga yo'naltiriladi va login sahifasining o'zida ikon ko'rinmaydi (`/favicon.ico` avvaldan o'tkazilgan).
- Admin va web ikonlari bir xil.

## Joylar

**User app (`apps/web`)**

| Joy | Avval | Endi |
|---|---|---|
| Sidebar ustuni, yoyilgan | "H" kvadrat + kompaniya nomi | `Logo`, ostida kompaniya nomi (13px, `font-medium`) |
| Sidebar ustuni, yig'ilgan | "H" kvadrat (ustiga borilsa chevron) | `LogoMark` (ustiga borilsa chevron) |
| Telefon menyusi (sheet) | "H" kvadrat + kompaniya nomi | `Logo`, ostida kompaniya nomi. Dialog nomi kompaniya nomi bo'lib qoladi (logotip `SheetTitle` dan tashqarida) |
| Telefon topbar'i | kompaniya nomi (yo'q bo'lsa "Hisob24" matni) | `Logo`, ostida kompaniya nomi |
| `/login` | `h1` "Hisob24" matni | `h1` ichida `Logo` |
| `/select-company`, `/expired` | logo yo'q | tepada `Logo` |
| Mini App kirish ekranlari (yuklanish, "Kirish huquqi yo'q", "Telefon raqamingiz ulanmagan", "Kirib bo'lmadi") | logo yo'q | tepada `Logo` |

Kompaniya hali noma'lum bo'lsa faqat logotip ko'rinadi ("Hisob24" matni takrorlanmaydi); nom qatori joyini saqlaydi, shunda nom kelganda logotip sakramaydi.

**Admin panel (`apps/admin`)**

| Joy | Avval | Endi |
|---|---|---|
| Sidebar | "Hisob24 Admin" matni | `Brand` |
| Telefon topbar'i va menyu sarlavhasi | "Hisob24 Admin" matni | `Brand` (dialog nomi "Hisob24 Admin") |
| `/login` | `h1` "Hisob24 Admin" matni | `h1` ichida `Brand` |
| Mini App kirish ekranlari (yuklanish, "Sizda ruxsat yo'q", "Kirib bo'lmadi") | logo yo'q | tepada `Brand` |

## Testlar

- Har o'zgarish avval test bilan (reja: sikllar jadvali). Mavjud testlar o'zgarmaydi: faqat yangilari qo'shiladi.
- Vitest: `Logo`, `LogoMark`, `Brand`; har joyda `img` "Hisob24" borligi; sheet nomi; `proxy` matcher'i.
- Playwright: logotip rangi (light, dark, Telegram); qobiqdagi logotip (desktop, telefon); ikonlar sessiyasiz 200 va to'g'ri `content-type` bilan.

## Amalga oshirilgani (2026-10-04)

**O'lchamlar.** Skrinshotlarda sozlangan: 375px va 1280px; light, dark, Telegram'ning to'q va och mavzusi.

| Joy | Class'lar | Natija |
|---|---|---|
| web: sidebar ustuni, telefon menyusi, telefon topbar'i | `Logo` `h-4`; nom `h-5 truncate text-[0.8125rem] leading-5 font-medium` | logotip 16px (eni 81px), ostida nom 13px. Uch joyda bir xil: telefonda menyu ochilganda sarlavha o'lchami o'zgarmaydi |
| web: yig'ilgan sidebar | `LogoMark` `h-auto w-9`; tugma `h-8 w-10` | belgi 36 × 13.5px; ustiga borilsa chevron (avvalgidek) |
| web: `/login` | `Logo` `h-8` | 32px (eni 163px) |
| web: `/select-company`, `/expired` | `Logo` (o'z o'lchami, `h-6`) | 24px; birinchisida chapda, ikkinchisida o'rtada |
| web: Mini App kirish ekranlari | `Logo` `h-7` | 28px, har holat tepasida |
| admin: `Brand` | `inline-flex items-baseline gap-[0.35em]`; logotip `h-[1.1em]`; "Admin" `text-[0.85em] font-medium text-muted-foreground` | yozuv logotip harflarining asos chizig'ida (brauzerda o'lchangan: yozuv asos chizig'i = logotip qutisining pasti) |
| admin: sidebar / topbar va menyu / login / Mini App | `text-lg` / 16px / `text-2xl` / `text-xl` | |

Flex ustun ichida (`SheetHeader`, `/select-company`) logotipga `self-start` kerak: aks holda quti butun enga cho'ziladi va logotip o'rtaga suriladi.

**Rejadan farqlar** (hammasi qo'shimcha sikl, hech narsa tashlab ketilmagan):

- `Logo` da `data-slot` yo'q: reja `data-slot="logo"` degan edi, lekin hech bir test yoki uslubga kerak bo'lmadi. `LogoMark` da bor (`data-slot="logo-mark"`: bezak, rolsiz, testlar shu bilan topadi).
- `className` uchun alohida sikllar (`Logo`, `LogoMark`).
- Web topbar'da ham "kompaniya noma'lum bo'lsa faqat logotip" (sidebar'dagidek).
- `Brand` ning nomi ikki so'z ekani alohida sikl: bo'shliqsiz sarlavha nomi "Hisob24Admin" bo'lib chiqdi (test shuni ko'rsatdi), `{" "}` bilan "Hisob24 Admin".
- Admin'da token ikki siklda (light / dark, keyin Telegram): token bo'lmaganda logotip Telegram'da chat matn rangini meros olardi va Telegram testi tokensiz ham o'tardi.
- Xarakteristika testi: kompaniyasiz sessiyada telefon menyusining nomi "Hisob24" (avvaldan shunday edi, testi yo'q edi; mutatsiya bilan tekshirilgan).

**Ikonlarni qayta yasash.** `icon.svg` qo'lda yoziladi (dizaynerning oq belgili 512 fayli + `<rect width="512" height="512" rx="112" fill="#174449"/>`); qolgan ikkitasi undan (`rsvg-convert` va ImageMagick, Homebrew):

```bash
# apple.svg: icon.svg ning o'zi, faqat rect'da rx yo'q (kvadrat)
rsvg-convert -w 180 -h 180 apple.svg -o apps/web/app/apple-icon.png
for s in 16 32 48; do rsvg-convert -w $s -h $s apps/web/app/icon.svg -o icon-$s.png; done
magick icon-16.png icon-32.png icon-48.png apps/web/app/favicon.ico
cp apps/web/app/{icon.svg,apple-icon.png,favicon.ico} apps/admin/app/
```

16px da "H24" xira, lekin shakli taniladi; 32px dan boshlab aniq o'qiladi.

**Tekshiruv.**

- `make lint`: 0 issues. `make test`: Go 15 paket; web 231 (avval 214), admin 202 (avval 189), api-client 1. `make e2e`: admin 32 (avval 26), web 54 (avval 46).
- Mavjud testlarning birortasi o'zgarmadi, o'chirilmadi yoki o'tkazib yuborilmadi. Mavjud test fayllariga faqat yangi testlar va import qo'shildi.
- `cmp`: `components/logo.tsx`, `logo.test.tsx`, `app/icon.svg`, `apple-icon.png`, `favicon.ico`, `e2e/logo.spec.ts`, `e2e/icons.spec.ts` ikkala ilovada bayt-bir xil. `globals.css` faqat avvalgi ikki joyda farq qiladi.
- Production build (`next build` + `next start`, ikkala ilova): `/login` da uchta `<link>` (`favicon.ico` 48x48, `icon.svg` any, `apple-icon.png` 180x180); uchala manzil sessiyasiz 200 va to'g'ri `content-type` bilan; sahifalar esa avvalgidek `/login` ga yo'naltiriladi (307).
- Skrinshotlar: web va admin, telefon va desktop, light va dark, Telegram'ning ikki mavzusi: logotip har fonda o'qiladi.

## Production'ga deploy (2026-10-04)

Foydalanuvchi so'rovi bilan ("deploy qil"). Backend va migratsiya o'zgarmagan: faqat frontend image qayta qurildi.

- `6083024`: toza nusxada (`git archive HEAD`) ikkala ilova `next build` dan o'tdi; baza nusxasi `/var/backups/hisob24-v2/hisob24-pre-logo-20261004-1058.sql.gz` (11 jadval); `deploy/ship.sh` exit 0, 1 daqiqa 55 soniya; goose "no migrations to run", versiya 4.
- Sessiyasiz tekshiruv 31 / 31:
  - `healthz`;
  - ikkala saytda `/login` (logotip va uchta ikon `<link>` i), `/favicon.ico`, `/icon.svg` (ichida `#174449`), `/apple-icon.png`: 200 va to'g'ri `content-type`; CSS'da brend rangi;
  - sessiyasiz sahifa `/login` ga yo'naltiriladi (307); cookie nomi bor, qiymati soxta so'rovda qobiq HTML'ida logotip (admin'da "Admin" bilan); API soxta sessiyani rad etadi (401);
  - webhook'lar secret'siz 401.
- Birinchi o'tishda bitta so'rov (admin webhook) javobsiz qoldi (curl `000`). Uch marta qayta so'ralganda 401 keldi, to'liq qayta o'tkazilganda 31 / 31. Serverda sabab topilmadi: konteynerlar qayta ishga tushmagan (`restarts=0`), API log'ida ERROR / WARN yo'q.
- Server: to'rt konteyner healthy; satrlar soni deploy'dan oldingi bilan bir xil (11 jadval); `.env` saqlangan. Avvalgi daraxt: `/var/www/hisob24-v2.prev` (CRUD review deploy'i).
- Kirish bilan bog'liq oqimlar production'da sinalmadi (haqiqiy SMS ketadi): ular foydalanuvchiga qoladi.

## Keyingi o'zgarish (2026-10-04, login dizayni)

`/login` da logotip endi brend panelida turadi va ikkala mavzuda oq (Telegram ichida chat matn rangi): `docs/superpowers/specs/2026-10-04-login-design.md`. Shu sabab `e2e/logo.spec.ts` panelni tekshiradi; sahifa fonidagi brend rangi tekshiruvi web'da `e2e/login.spec.ts` ga (`/select-company`), admin'da `e2e/miniapp-and-mobile.spec.ts` ga (qobiq) ko'chdi. `logo.tsx` ga `Logo24` qo'shildi (belgining "24" i); belgining ikki yo'li konstantaga chiqdi, geometriya o'zgarmadi.

## Qamrovdan tashqari

- UI urg'u rangini `#174449` ga o'tkazish (hozir indigo): alohida qaror.
- Web manifest (PWA), Open Graph rasmi, README'dagi logo.
- BotFather'dagi bot rasmi: qo'lda o'rnatiladi.
