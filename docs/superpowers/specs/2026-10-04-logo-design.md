# Logotip — dizayn

Sana: 2026-10-04. Holat: foydalanuvchi tasdiqlagan (reja: `docs/superpowers/plans/2026-10-04-logo.md`).

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

## Qamrovdan tashqari

- UI urg'u rangini `#174449` ga o'tkazish (hozir indigo): alohida qaror.
- Web manifest (PWA), Open Graph rasmi, README'dagi logo.
- BotFather'dagi bot rasmi: qo'lda o'rnatiladi.
- Production deploy: alohida so'raladi.
