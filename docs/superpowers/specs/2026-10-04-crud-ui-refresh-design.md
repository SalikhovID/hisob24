# CRUD sahifalar ko'rinishini yangilash — dizayn

Sana: 2026-10-04. Holat: foydalanuvchi tasdiqlagan yo'nalish (reja: `docs/superpowers/plans/2026-10-04-crud-ui-refresh.md`). A-bosqich (asos va Xodimlar) va B-bosqich (admin panel, review) amalga oshirilgan.

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
| `PageHeader` | `h1` (20px, md'dan 24px, 600) + izoh (14px xira, soni bilan) + amallar. Telefonda nom va tugma bir qatorda, izoh ostida to'liq enda. Manbadagi tartib: nom, izoh, amal. `avatar`: yozuv sahifasida nom yonida, `h1` dan tashqarida (sarlavha nomi toza). `stack`: telefonda amallar nom ostidagi alohida qatorda (kompaniya sahifasi: ikki tugma). |
| `DataList` | md'dan: bitta ramka (`rounded-xl border bg-card`), sarlavha tasmasi (`bg-muted/50`, 13px xira, oddiy registr), qatorlar `px-4 py-3`, hover `bg-muted/40`, footer tasmasi ("Jami: N" yoki pager). Birinchi katak qator sarlavhasi (`th scope="row"`). Ustunlar: `primary`, `actions`, `card`, `align`, `className`. Yo'q qiymat jadvalda xira "—" (amallar katagi bo'sh qoladi). Burchaklar kesilmaydi (fokus halqasi butun ko'rinsin). |
| Telefon kartochkasi | `card`: `tag` (belgi, nomi faqat ekran o'quvchiga), `inline` (nomi bilan qiymat: "Qo'shilgan 02.10.2026"), `aside` (asosiy raqam, masalan summa: tepada, sarlavha qarshisida), `note` (erkin matn: oxirida o'z qatorida, o'raladi), `row` (default: nomli qator). Qatorda belgilar oldinda. Yo'q qiymat joy olmaydi. Manbadagi tartib: sarlavha, raqam, qator, qiymatlar, izoh, amallar (ekran o'quvchi avval yozuvni, keyin amallarni o'qiydi); ko'rinishda amallar tepada o'ngda. |
| `Identity`, `Avatar` | avatar 36px bezak (`aria-hidden`); ism o'raladi, kesilmaydi; ikkinchi qator 13px xira, bo'linmaydi; "Siz" ism yonida. Havola nomi faqat ism, lekin butun identity bosiladi (avatar va ikkinchi qator ham: barmoq uchun ism yolg'iz kichik nishon). `muted`: faol bo'lmagan yozuv xira, avatar tussiz (bosh harflar qoladi). |
| `RoleBadge` | Egasi: `bg-primary/10` + oddiy matn + indigo nuqta (nuqta faqat egasida); Xodim: neytral. |
| `ActionTooltip` | ikonka tugma ustida fe'l ("O'chirish"), 400ms; tugmaning `aria-label` i o'zgarmaydi. Telefonda 36px tugma, 44px nishon. |
| `ListLoading` | ro'yxat shaklida va o'lchamida (tasmalar, qatorlar 65px, telefonda kartochka 106px): yozuvlar kelganda hech narsa siljimaydi (o'lchangan: 0px). `mark`: `round` (odam), `square` (kompaniya), `none` (to'lov). Bitta `status` "Yuklanmoqda". `Loading` (sahifa darvozasi uchun) shakli o'zgarmadi. |
| `EmptyState`, `Failed` | ro'yxat ramkasida; xato `role="alert"`. `EmptyState`: sarlavha oddiy rangda (500), ostida xira izoh: keyin nima qilish kerakligi. Xodimlar'dagi izoh ro'yxat ostida oddiy satr. |
| `PendingButton`, `Refusal` | yuborilayotganda spinner va `aria-busy` (hamma dialog, tasdiq va "Yaratish" tugmasida; har biri sahifa testi bilan); API rad javobi ikonka bilan, maydon xatosidan ajralib turadi. |
| Dialoglar | sarlavha 16px 600; ekran bo'yidan oshmaydi (ichida scroll); footer tasmasi; telefonda tugma to'liq enda. |

## Sahifalar

**Kenglik.** Sahifa mazmuni kontent maydonining to'liq enini oladi (enwin'dagidek), o'rtaga siqilmaydi. Dizayner 768px ustun tavsiya qilgan edi; foydalanuvchi ko'rib, kengroq bo'lishini so'radi (2026-10-04). Ustunlar jadvalda tabiiy taqsimlanadi. Bosh sahifadagi kartochka o'z enida qoladi, lekin chapdan boshlanadi. Admin panelda ham `main` cheklovsiz.

**Xodimlar (web, amalga oshirilgan).** "Kompaniyangiz a'zolari · N kishi"; ustunlar: A'zo, Rol, Qo'shilgan (tor jadvalda yashirin), amallar; "Jami: N"; faqat egasi bo'lsa ro'yxat ostida izoh.

**Kompaniyalar (admin, amalga oshirilgan).** "Platformadagi kompaniyalar · N ta" (N — filtrsiz jami; tab yoki qidiruv paytida son ko'rsatilmaydi, chunki API u holda faqat mos kelganlarni sanaydi; ularni pager ko'rsatadi); tab va qidiruv bir qatorda (telefonda to'liq enda); ustunlar: Nomi (kvadrat avatar, nom havola, "Yaratilgan dd.mm.yyyy"), Tugash sanasi, Holat; pager footer'da; kartochkada holat belgisi, keyin "Tugash sanasi dd.mm.yyyy". Holat belgisi: yaxshi holat neytral, 7 kun va kam sariq, muddati o'tgan / bloklangan qizil. Bo'sh natija: "Kompaniyalar topilmadi" + nima qilish kerakligi.

**Kompaniya sahifasi (admin, amalga oshirilgan).** Orqaga havola; kvadrat avatar + `h1` (aynan kompaniya nomi); "Nomini o'zgartirish" va "Bloklash" / "Faollashtirish" konturli (telefonda nom ostida); "Ma'lumot": bitta ramkada uch katak (KPI plitka emas); "Userlar": identity + rol belgisi + qo'shilgan, "Jami: N"; "Billing tarixi": sana qator sarlavhasi, kunlar va summa o'ngda, davr xira (tor jadvalda yashirin), izoh o'raladi, "Jami: N"; telefonda to'lov kartochkasi: sana va summa tepada, kunlar va davr bir qatorda, izoh oxirida. Sahifadagi yagona to'liq indigo tugma: "Billing qo'shish". Billing dialogida "Yangi tugash sanasi" kunlar maydoni ostida alohida qator.

**Adminlar (admin, amalga oshirilgan).** "Platforma adminlari · N kishi"; identity (ism + "Telegram ID …", monospace emas; ismsiz admin ID bilan ataladi), "Siz" ism yonida, holat ("Faol" neytral, "Nofaol" konturli; o'chirilgan admin butun qatori bilan xira), qo'shilgan, o'chirish tooltip bilan; "Jami: N".

**Yangi kompaniya (admin, amalga oshirilgan).** Orqaga havola va sarlavha; bitta varaq (`max-w-lg`), ikki juft maydon bo'shliq bilan ajratilgan, rad javobi, pastida tasma va "Yaratish" (telefonda to'liq enda).

## UI agentlar

| Workflow | Agentlar | Natija |
|---|---|---|
| Reja tekshiruvi | 1 × Plan (faqat o'qiydi) | 15 ta tuzatish: `Loading` ro'yxatdan tashqarida ham ishlatiladi, footer `<table>` dan tashqarida, test ta'siri ro'yxati |
| Dizayn paneli | 2 × dizayner (`frontend-design` skill), `mobile-web-architect`, `accessibility-specialist`, `nextjs-expert`, 1 × sintez | konsepsiya, tokenlar, komponent qoidalari, a11y va mobil talablar |
| Review paneli (B-bosqich oxirida) | a11y, mobil, Next.js, kod sifati, izchillik; jiddiy topilmalar skeptik agentlar bilan tekshiriladi | topilmalar va tuzatishlar (natijasi "Review paneli natijasi" bo'limida) |

Agentlar kod yozmaydi (main'da parallel yozib bo'lmaydi); kod TDD bilan yoziladi.

## Tekshiruv (B-bosqich)

- `make lint`: 0 issues. `make test`: Go 15 paket; web 212, admin 174, api-client 1. `make e2e`: admin 22, web 46.
- Yon scroll yo'q: 320, 360, 375, 768, 1024, 1280px da, juda uzun nomlar bilan (hujjat, `main`, jadval konteynerlari).
- Yuklanish joyi → ro'yxat: to'rt ro'yxatda qatorlar 0px siljiydi.
- User app (Xodimlar) telefon ko'rinishi A-bosqichdagi bilan piksel-bir xil (faqat yuklanish joyi ataylab o'zgargan).
- Lokal haqiqiy stack (Go API + admin panel, brauzerda, desktop va 375px): 23 / 23: kirish, kompaniya yaratish, egasini almashtirish, to'lov, nom o'zgartirish, bloklash / faollashtirish, qidiruv, admin qo'shish va o'chirish. Sinov ma'lumoti o'chirilgan.
- Umumiy fayllar ikkala ilovada bayt-bir xil (24 ta); `globals.css` faqat avvalgi ikki joyda farq qiladi (izoh satri va web'dagi `scrollbar-hide`).

## Panel talablaridan kiritilganlari

- Egasi belgisida `text-primary` emas, oddiy matn: `text-primary` o'z tusida dark'da 4.3:1, Telegram'da 3.9:1.
- Yuklanish joyi `role="status"` + ko'rinmas matn; `aria-busy` olib tashlandi (band status e'lon qilinmaydi).
- Xato xabari `role="alert"`.
- Kartochkada sananing nomi ko'rinadi, belgining nomi ekran o'quvchiga qoladi; amallar nomli guruh; ustun sarlavhalarida `scope="col"`.
- Ism kesilmaydi, o'raladi; `main` ichida yon scroll yo'qligi e2e bilan tekshiriladi.
- Light `--destructive` red-700 (o'z tusida 4.0 → 5.3:1).
- Dialog ekran bo'yidan oshmaydi; `prefers-reduced-motion`.

## B-bosqich: dizayn paneli sintezi va rejadan farqlar

Dizayn panelining birlashtirilgan spetsifikatsiyasi B-bosqich boshida keldi. Undan admin sahifalari uchun olinganlar va tasdiqlangan rejadan farq qilgan joylar (hammasi "kamroq" tomonga, istalgan paytda qaytarish mumkin):

| Rejada | Qilingani | Sabab (panel) |
|---|---|---|
| Dialog sarlavhasida ikonka, tasdiqda `AlertDialogMedia` | ikonka yo'q | sarlavha amalni, izoh kimga ta'sir qilishini aytadi; tugmadagi ikonka takrorlanmaydi |
| Holat belgilarida nuqta | nuqta faqat "Egasi" da | nuqta bitta narsani bildirsin |
| "+N kun" yumshoq belgi | oddiy matn, o'ngga tekislangan | raqamlar ustuni belgilar ustuniga aylanmasin |
| Formada guruh sarlavhalari ("Kompaniya", "Egasi") va "Bekor qilish" havolasi | yo'q; ikki juft maydon bo'shliq bilan ajratilgan, orqaga havola sahifa tepasida | yorliqlar "Egasining…" deb turibdi; ortiqcha matn va ikkinchi "orqaga" kerak emas |
| Birinchi ustun "Kompaniya" / "Admin" | "Nomi" / "Ism" (mavjud nomlar); kompaniya sahifasida "A'zo" | yangi so'z kamroq |
| Yaxshi holat yashil | neytral (kulrang); sariq va qizil o'z joyida | yigirmata yashil belgi hech narsa demaydi; e'tibor kerak bo'lgan qator darhol topiladi. Yashilni qaytarish: `status-badge.tsx` da bitta satr |

Sintezdan qo'shimcha olinganlar: kartochkada manba tartibi (avval yozuv, keyin amallar), `aside` / `note`, jadvalda yo'q qiymat uchun chiziqcha, yuklanish joyining aniq o'lchami, bo'sh holatda ikki darajali matn, butun identity bosilishi, nofaol adminning xira ko'rinishi, tooltip'ning sensorli ekranda chiqmasligi.

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
| `/companies` uchun `Suspense` fallback'i (sarlavha + ro'yxat shakli) | Next.js | sahifa tuzilmasini ikkiga bo'lishni talab qiladi; hozir gidratsiyagacha bo'sh joy bir lahza ko'rinadi |
| Kompaniya sahifasi yuklanayotganda sahifa shaklidagi skeleton | dizayner | `Loading` umumiy (sessiya darvozasi ham ishlatadi), o'zgartirilmadi |

## Yangi matnlar

| Qayerda | Matn |
|---|---|
| Xodimlar, sarlavha ostida | "Kompaniyangiz a'zolari · N kishi" (yuklanayotganda "Kompaniyangiz a'zolari") |
| Ro'yxat footer'i | "Jami: N" |
| Ustun va kartochkadagi sana nomi | "Qo'shilgan" |
| Xodimlar birinchi ustuni | "A'zo" |
| Tooltip | "Ismni o'zgartirish", "O'chirish" (mavjud so'zlar) |

Admin sahifalari (B-bosqich):

| Qayerda | Matn |
|---|---|
| Kompaniyalar, sarlavha ostida | "Platformadagi kompaniyalar · N ta" (yuklanayotganda va filtr paytida "Platformadagi kompaniyalar") |
| Kompaniya identity'sining ikkinchi qatori | "Yaratilgan dd.mm.yyyy" |
| Bo'sh natija, filtr bilan | "Qidiruv yoki filtrni o'zgartirib ko'ring." ("Kompaniyalar topilmadi" ostida) |
| Bo'sh natija, filtrsiz | "Birinchi kompaniyani «Yangi kompaniya» tugmasi orqali qo'shing." |
| To'lovlar yo'q | "Birinchi to'lovni «Billing qo'shish» tugmasi orqali kiriting." ("Hali to'lovlar yo'q" ostida) |
| Kompaniya sahifasi, userlar jadvali | ustunlar "A'zo", "Rol", "Qo'shilgan" (avval "Telefon", "Ism", "Rol") |
| Adminlar, sarlavha ostida | "Platforma adminlari · N kishi" (yuklanayotganda "Platforma adminlari") |
| Admin identity'sining ikkinchi qatori | "Telegram ID N" (ismsiz adminda sarlavhaning o'zi) |
| Adminlar jadvali | ustun "Qo'shilgan"; "Telegram ID" ustuni olib tashlandi |
| Ro'yxatlar footer'i | "Jami: N" (userlar, billing, adminlar) |

## Talab o'zgargani uchun o'zgargan testlar

- `data-list.test.tsx`: birinchi katak qator sarlavhasi (kataklar ro'yxati va soni).
- `employees-page.test.tsx`: `phoneAndName` → `nameAndPhone` (ism ustida, telefon ostida); "Siz" qator sarlavhasi ichida.
- Bugun yozilgan testlar panel talablari bilan aniqlashtirildi: `ListLoading` (`aria-busy` o'rniga `status`), kartochkadagi inline qiymatlar (nomlar: belgi uchun ko'rinmas, sana uchun ko'rinadi).

B-bosqich (admin):

- `companies-page.test.tsx`: kompaniya nomi endi qator sarlavhasidagi havoladan o'qiladi (`nameOf`); kutilgan nomlar va tartib o'sha.
- `company-page.test.tsx`: `cellsOf` qator sarlavhasini ham o'qiydi; userlar jadvali `usersOf` bilan (`[ism, telefon, rol, sana]`, avval `[telefon, ism, rol]`); billing jadvalining kutilgan qiymatlari o'zgarmadi.
- `data-list.test.tsx`, `states.test.tsx`: web'dagi bilan bir xil nusxa.
- e2e: yangi ikki ssenariy (kompaniya identity'ning istalgan joyidan ochiladi; amallar keng ekranda nom yonida, telefonda ostida). Mavjud ssenariylar o'zgarmadi.

Hech bir test o'chirilmadi yoki o'tkazib yuborilmadi.
