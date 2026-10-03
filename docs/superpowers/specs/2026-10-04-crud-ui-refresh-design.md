# CRUD sahifalar ko'rinishini yangilash — dizayn

Sana: 2026-10-04. Holat: foydalanuvchi tasdiqlagan yo'nalish (reja: `docs/superpowers/plans/2026-10-04-crud-ui-refresh.md`). A-bosqich (asos va Xodimlar) amalga oshirilgan; B-bosqich (admin panel) tasdiqdan keyin.

## Maqsad

Foydalanuvchining so'zlari (2026-10-04): "localda run qil va CRUD sahifalarni chiroyliroq qilib ber ultrathink UI agentlar ishlat".

Funksiya o'zgarmaydi: qidiruv, saralash, yangi API maydoni yo'q; backend va `openapi.yaml` ga tegilmaydi. Bu `docs/SPEC.md` da yo'q ish, foydalanuvchi so'rovi bilan qilinadi.

## Foydalanuvchi qarorlari

1. Qamrov: ikkala ilova (user app: Xodimlar; admin: Kompaniyalar, kompaniya sahifasi, Adminlar, yangi kompaniya).
2. Ko'rinish: boyitilgan jadval (sarlavha ostida izoh va son; avatar + ism + ikkinchi qator bitta katakda; rol / holat belgisi; qo'shilgan sana; ikonka amallar; ramka ichida footer; telefonda kartochka).
3. Rang: indigo.
4. Agentlar: dizayn va review'da; kod TDD bilan qo'lda.

## Konsepsiya: hisob daftari

Har ro'yxat chapdan o'ngga bir xil o'qiladi: kim → holati → qachon / qancha → nima qilish mumkin. Ierarxiyani shrift vazni va bo'shliq ko'taradi, rang esa kam joyda ishlatiladi:

- **Yagona urg'u:** har ko'rinishda bitta to'liq indigo tugma (asosiy amal). Indigo yana faqat egasi belgisida (yumshoq tus + nuqta) va fokus halqasida.
- **Qator boshi shaxs:** avatar (bosh harflar) + ism (500) + xira ikkinchi qator. Doira: odam; kvadrat: kompaniya.
- **Raqamlar tekis:** sana, telefon, kunlar, summa, ID hammasi `tabular-nums`; summa va kunlar o'ngga tekislanadi.
- **Tuzilma ma'lumot beradi:** ro'yxatga bitta ramka, qatorlar orasida ingichka chiziq, ramka ichida footer. Soya faqat suzuvchi qatlamda (dialog).

Ataylab yo'q: BOSH HARFLI yorliqlar, bir xil soyali kartochkalar to'plami, gradient, bezak ikonkalar, KPI plitkalar, kirishdagi animatsiya, monospace.

## Tokenlar (`apps/{web,admin}/app/globals.css`)

| Token | Light | Dark |
|---|---|---|
| `--primary`, `--sidebar-primary` | `oklch(0.511 0.262 276.966)` | `oklch(0.673 0.182 276.935)` |
| `--primary-foreground` | `oklch(0.985 0 0)` | `oklch(0.205 0 0)` |
| `--ring`, `--sidebar-ring` | `oklch(0.585 0.233 277.117)` | `oklch(0.673 0.182 276.935)` |
| `--background`, `--sidebar` (light) | `oklch(0.985 0.003 277)` | `oklch(0.155 0.008 277)` |
| `--card`, `--popover`, `--sidebar` (dark) | `oklch(1 0 0)` | `oklch(0.205 0.01 277)` |
| `--foreground` va boshqa matn tokenlari | `oklch(0.21 0.02 277)` | `oklch(0.985 0.002 277)` |
| `--muted`, `--secondary`, `--accent`, `--sidebar-accent` | `oklch(0.955 0.006 277)` | `oklch(0.27 0.012 277)` |
| `--muted-foreground` | `oklch(0.5 0.02 277)` | `oklch(0.715 0.015 277)` |
| `--border`, `--sidebar-border` | `oklch(0.92 0.006 277)` | o'zgarmadi |
| `--input` | `oklch(0.871 0.008 277)` | o'zgarmadi |
| `--destructive` | `oklch(0.505 0.213 27.518)` | o'zgarmadi |

Hisoblangan kontrast (WCAG):

| Juftlik | Light | Dark |
|---|---|---|
| asosiy tugma matni | 6.2:1 | 5.7:1 |
| matn sahifada / kartochkada | 17.0 / 17.8 | 18.7 / 17.2 |
| xira matn: sahifa / kartochka / `muted` / tasma (`muted/50`) | 5.8 / 6.0 / 5.3 / 5.6 | 7.7 / 7.1 / 6.0 / 6.5 |
| egasi belgisi (matn `primary/10` ustida) | 15.2 | 13.9 |
| qizil matn o'z tusida (`destructive/10`) | 5.3 (avval 4.0) | 5.5 |

- Dark'da indigo-500 + oq matn 4.4:1 bo'lgani uchun dark'da och tugma + to'q matn qoldi.
- Yangi token yo'q: yumshoq fonlar `bg-primary/10` kabi. Telegram ichida (`html[data-telegram]`) hamma token chat mavzusidan olinadi va bu qatlam o'zgarmagan.
- Avatar tuslari (5 ta, to'liq class satrlari): sky, cyan, violet, fuchsia, slate. Holat ranglari (yashil, sariq, qizil) va indigo avatarga berilmaydi: avatar rangi holat deb o'qilmasin. Ismsiz yozuv: neytral tus + ikonka.
- `prefers-reduced-motion`: animatsiya va o'tishlar to'xtaydi.

## Komponentlar (ikkala ilovada bir xil nusxa)

| Komponent | Qoidasi |
|---|---|
| `PageHeader` | `h1` (20px, md'dan 24px, 600) + izoh (14px xira, soni bilan) + amallar. Telefonda nom va tugma bir qatorda, izoh ostida to'liq enda. Manbadagi tartib: nom, izoh, amal. |
| `DataList` | md'dan: bitta ramka (`rounded-xl border bg-card`), sarlavha tasmasi (`bg-muted/50`, 13px xira, oddiy registr), qatorlar `px-4 py-3`, hover `bg-muted/40`, footer tasmasi. Birinchi katak qator sarlavhasi (`th scope="row"`). Ustunlar: `primary`, `actions`, `card`, `align`, `className`. Burchaklar kesilmaydi (fokus halqasi butun ko'rinsin). |
| Telefon kartochkasi | tepada identity va amallar; ostida bir qator: belgi (nomi faqat ekran o'quvchiga) va nomi bilan sana ("Qo'shilgan 02.10.2026"); qolgan qiymatlar nomli qatorlarda. |
| `Identity`, `Avatar` | avatar 36px bezak (`aria-hidden`); ism o'raladi, kesilmaydi; ikkinchi qator 13px xira, bo'linmaydi; "Siz" ism yonida; havola faqat ismda. |
| `RoleBadge` | Egasi: `bg-primary/10` + oddiy matn + indigo nuqta (nuqta faqat egasida); Xodim: neytral. |
| `ActionTooltip` | ikonka tugma ustida fe'l ("O'chirish"), 400ms; tugmaning `aria-label` i o'zgarmaydi. Telefonda 36px tugma, 44px nishon. |
| `ListLoading` | ro'yxat shaklida (tasmalar, avatar va ikki chiziqli qatorlar), bitta `status` "Yuklanmoqda". `Loading` (sahifa darvozasi uchun) shakli o'zgarmadi. |
| `EmptyState`, `Failed` | ro'yxat ramkasida; xato `role="alert"`. Xodimlar'dagi izoh ro'yxat ostida oddiy satr. |
| `PendingButton`, `Refusal` | yuborilayotganda spinner va `aria-busy`; API rad javobi ikonka bilan, maydon xatosidan ajralib turadi. |
| Dialoglar | sarlavha 16px 600; ekran bo'yidan oshmaydi (ichida scroll); footer tasmasi; telefonda tugma to'liq enda. |

## Sahifalar

**Kenglik.** Sahifa mazmuni kontent maydonining to'liq enini oladi (enwin'dagidek), o'rtaga siqilmaydi. Dizayner 768px ustun tavsiya qilgan edi; foydalanuvchi ko'rib, kengroq bo'lishini so'radi (2026-10-04). Ustunlar jadvalda tabiiy taqsimlanadi. Bosh sahifadagi kartochka o'z enida qoladi, lekin chapdan boshlanadi. Admin panelda ham `main` cheklovsiz.

**Xodimlar (web, amalga oshirilgan).** "Kompaniyangiz a'zolari · N kishi"; ustunlar: A'zo, Rol, Qo'shilgan (tor jadvalda yashirin), amallar; "Jami: N"; faqat egasi bo'lsa ro'yxat ostida izoh.

**Kompaniyalar (admin).** Sarlavha + soni; tab va qidiruv; ustunlar: Nomi (kvadrat avatar, nom havola, "Yaratilgan dd.mm.yyyy"), Tugash sanasi, Holat; pager footer'da.

**Kompaniya sahifasi (admin).** Orqaga havola; avatar + `h1` (aynan kompaniya nomi); "Ma'lumot": bitta ramkada uch katak (KPI plitka emas); "Userlar": identity + rol belgisi + qo'shilgan; "Billing tarixi": sana qator sarlavhasi, kunlar va summa o'ngda, davr xira, izoh o'raladi.

**Adminlar (admin).** Identity (ism + "Telegram ID …", monospace emas), holat, "Siz" ism yonida, qo'shilgan, o'chirish tooltip bilan; "Jami: N".

**Yangi kompaniya (admin).** Bitta varaq (`max-w-lg`), ikki juft maydon bo'shliq bilan ajratilgan, pastida tasma va "Yaratish".

## UI agentlar

| Workflow | Agentlar | Natija |
|---|---|---|
| Reja tekshiruvi | 1 × Plan (faqat o'qiydi) | 15 ta tuzatish: `Loading` ro'yxatdan tashqarida ham ishlatiladi, footer `<table>` dan tashqarida, test ta'siri ro'yxati |
| Dizayn paneli | 2 × dizayner (`frontend-design` skill), `mobile-web-architect`, `accessibility-specialist`, `nextjs-expert`, 1 × sintez | konsepsiya, tokenlar, komponent qoidalari, a11y va mobil talablar |
| Review paneli (B-bosqich oxirida) | a11y, mobil, Next.js, kod sifati, izchillik | topilmalar va tuzatishlar |

Agentlar kod yozmaydi (main'da parallel yozib bo'lmaydi); kod TDD bilan yoziladi.

## Panel talablaridan kiritilganlari

- Egasi belgisida `text-primary` emas, oddiy matn: `text-primary` o'z tusida dark'da 4.3:1, Telegram'da 3.9:1.
- Yuklanish joyi `role="status"` + ko'rinmas matn; `aria-busy` olib tashlandi (band status e'lon qilinmaydi).
- Xato xabari `role="alert"`.
- Kartochkada sananing nomi ko'rinadi, belgining nomi ekran o'quvchiga qoladi; amallar nomli guruh; ustun sarlavhalarida `scope="col"`.
- Ism kesilmaydi, o'raladi; `main` ichida yon scroll yo'qligi e2e bilan tekshiriladi.
- Light `--destructive` red-700 (o'z tusida 4.0 → 5.3:1).
- Dialog ekran bo'yidan oshmaydi; `prefers-reduced-motion`.

## Kechiktirilgan tavsiyalar (bu ishga kirmaydi, alohida so'raladi)

| Tavsiya | Kimdan | Nega kechiktirildi |
|---|---|---|
| Fokus halqasini hamma joyda to'liq rangli `outline` ga o'tkazish (`ui/button`, `input`, `tabs`, havolalar) | a11y | hamma sahifaga ta'sir qiladi; hozirgi halqa (`ring/50`) 3:1 dan past, lekin bu avvaldan shunday |
| O'chirishdan keyin fokusni `h1` ga qaytarish; `Qayta urinish` dan keyin ham | a11y | xatti-harakat o'zgarishi, CRUD ko'rinishidan tashqari |
| Pager: tugmalar `aria-disabled` bilan fokusda qolsin, oraliq `role="status"` | a11y | mavjud testlar `disabled` ni kutadi: talab o'zgarishi |
| Tablar natijani `tabpanel` sifatida boshqarsin; bo'sh natija `aria-live` da | a11y | Kompaniyalar tuzilmasi o'zgaradi |
| Maydon xatosi `aria-describedby` bilan bog'lansin | a11y | forma komponentlari, ikkala ilova |
| Telegram ichida xira matn va qizil rangni chat matn rangiga aralashtirish (`color-mix`) | a11y, mobil | Telegram qatlami o'zgaradi; alohida tekshiruv kerak |
| Telegram'da ko'rinadigan balandlik, pastki xavfsiz zona, `overscroll` | mobil | qobiq (shell) ishi |
| Telefonda hamma boshqaruv 44px (topbar, tab, qidiruv, pager) | mobil | global `ui/*` o'zgarishi |
| Form dialoglarini telefonda tepaga yaqin joylash | mobil, dizayner | klaviatura bilan sinov kerak; hozir dialog ichida scroll bor |
| Telegram'da asosiy tugma kontrasti (chat rangi 2.6–3.7:1) | a11y | Telegram'ning o'z juftligi; chetga chiqish foydalanuvchi qarori |

## Yangi matnlar

| Qayerda | Matn |
|---|---|
| Xodimlar, sarlavha ostida | "Kompaniyangiz a'zolari · N kishi" (yuklanayotganda "Kompaniyangiz a'zolari") |
| Ro'yxat footer'i | "Jami: N" |
| Ustun va kartochkadagi sana nomi | "Qo'shilgan" |
| Xodimlar birinchi ustuni | "A'zo" |
| Tooltip | "Ismni o'zgartirish", "O'chirish" (mavjud so'zlar) |

Admin sahifalari uchun yangi matnlar B-bosqichda shu jadvalga qo'shiladi va hisobotda ko'rsatiladi.

## Talab o'zgargani uchun o'zgargan testlar

- `data-list.test.tsx`: birinchi katak qator sarlavhasi (kataklar ro'yxati va soni).
- `employees-page.test.tsx`: `phoneAndName` → `nameAndPhone` (ism ustida, telefon ostida); "Siz" qator sarlavhasi ichida.
- Bugun yozilgan testlar panel talablari bilan aniqlashtirildi: `ListLoading` (`aria-busy` o'rniga `status`), kartochkadagi inline qiymatlar (nomlar: belgi uchun ko'rinmas, sana uchun ko'rinadi).

Hech bir test o'chirilmadi yoki o'tkazib yuborilmadi.
