# Login dizayni: brend paneli — dizayn

Sana: 2026-10-04. Holat: foydalanuvchi tasdiqlagan (reja: `docs/superpowers/plans/2026-10-04-login.md`).

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
| Admin bot havolasi | matn havola | 44px konturli tugma ko'rinishida |
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

## Qamrovdan tashqari

- Mini App holat ekranlari, `/select-company`, `/expired`.
- Urg'u rangini brend rangiga o'tkazish (hozir indigo): alohida qaror.
- Brauzer `theme-color` i, "kira olmayapsizmi" yordam matni.
- Production deploy.
