# CRUD sahifalar ko'rinishini yangilash — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ikkala ilovadagi CRUD sahifalar (user app: Xodimlar; admin: Kompaniyalar, kompaniya sahifasi, Adminlar, yangi kompaniya) "boyitilgan jadval" ko'rinishiga o'tadi, brend rangi indigo bo'ladi. Funksiya o'zgarmaydi.

**Architecture:**
- Umumiy bo'laklar avval `apps/web` da testlari bilan yoziladi, keyin `apps/admin` ga aynan ko'chiriladi (mavjud nusxa konvensiyasi; oxirida `cmp`).
- `DataList` umumiy bo'lib qoladi: jadval (`md+`) va kartochkalar (telefon). Yangi imkoniyatlar ustun darajasida: `actions`, `card: "inline"`, `align`, va bitta `footer`.
- Ranglar faqat tokenlar orqali (`globals.css`); yangi token yo'q, yumshoq fonlar `bg-primary/10` bilan. Telegram Mini App qatlami (`html[data-telegram]`) o'zgarmaydi.

**Tech Stack:** Next 16, Tailwind v4, shadcn `base-nova` (@base-ui/react), lucide-react, Vitest + RTL + MSW, Playwright.

Manbalar: tasdiqlangan qarorlar va dizayn `docs/superpowers/specs/2026-10-04-crud-ui-refresh-design.md` da.

---

## Kelishuvlar

- Bitta fayl: `pnpm --filter @hisob24/web exec vitest run <fayl>` (admin: `@hisob24/admin`). Har GREEN'dan keyin ilovaning butun suite'i, typecheck, lint, so'ng commit.
- Yangi modul avval stub bo'ladi: RED import xatosi emas, tasdiq xatosi bilan yiqilsin.
- **STYLE** = test yo'q, skrinshot va yashil suite'lar bilan tekshiriladi (faqat class va token). **COPY** = testi bilan aynan nusxa (namuna: `587ce54`).
- Tuzilma, semantika yoki ko'rinadigan matn o'zgarsa, avval test. Mavjud test faqat talab o'zgarganda o'zgaradi va bu commit xabarida aytiladi.
- Skrinshotlar: scratchpad'dagi `ui-shots.mjs` (Playwright, `/api/*` `page.route` bilan mock): sahifa × holat × 375px / 1280px × light / dark, Telegram mavzusi.

## Kod tekshiruvidan chiqqan qoidalar (buzilmasin)

1. `Loading` ro'yxatdan tashqarida ham ishlatiladi (`shell/app-shell.tsx`, `select-company.tsx`, admin `company-page.tsx`): u o'zgarmaydi. Ro'yxatlar uchun alohida `ListLoading`. `aria-label="Yuklanmoqda"` faqat bitta tugunda; ichida `<table>` bo'lmaydi (testlar jadvalni "yuklandi" belgisi deb oladi).
2. `footer` bitta DOM tugun, `<table>` dan tashqarida: aks holda qator sanaydigan testlar va yagona pager so'rovlari buziladi.
3. Birinchi katak qator sarlavhasi bo'lgach (`<th scope="row">`, `text-left font-normal` bilan), kataklarni indeks bilan o'qiydigan sahifa testlari shu siklning o'zida yangilanadi.
4. `DataList` ning `href` i butun birinchi katakni o'raydi. `Identity` bilan havola nomi buzilmasligi uchun `Identity` ning o'z `href` i bor (faqat sarlavhani o'raydi); Kompaniyalar'da `DataList` ga `href` berilmaydi.
5. Xodimlar'dagi "Hali xodim yo'q…" ro'yxat ostidagi izoh bo'lib qoladi (ro'yxat o'rniga emas), ichida "Xodim qo'shish" tugmasi yo'q (u sahifada yagona).
6. Bosh harflar tinish belgilarini o'tkazib yuboradi; qavs ichidagi izoh ismga kirmaydi ("Vali (hisobchi)" → "V"). Avatar `aria-hidden`, lekin harflari `textContent` da bor: qator sarlavhasining `textContent` i tenglik bilan tekshirilmaydi.
7. Web mock'da `TODAY = 2026-10-02`: testlar `02.10.2026` ni kutadi. Admin `mocks/data.ts` dagi `company()` id ≥ 21 da yaroqsiz sana beradi (`2026-09-31…`): ro'yxatda yaratilgan sana ko'rsatilishidan oldin tuzatiladi (kun `10 + id % 20`; 1–4 id'lar o'zgarmaydi). Yangi admin va billing sanalari `new Date()`: ularning sanasi tekshirilmaydi.
8. Kompaniya sahifasida `h1` aynan kompaniya nomi bo'lib qoladi (holat belgisi `h1` dan tashqarida); `region "Ma'lumot"` nomi va uch qiymati saqlanadi.
9. E2e'dagi qat'iy locator'lar: kompaniya sahifasida rol belgilaridan boshqa joyda aynan "Xodim" / "Egasi" matni bo'lmasin (ustun nomi "User"); a'zo telefoni ikki marta ko'rinmasin; Adminlar'da ortiqcha "Nofaol" bo'lmasin; "Davr" da "→" matn bo'lib qolsin; "Yangi tugash sanasi: …" bitta elementda qolsin.
10. Belgi (badge) yorlig'i `Badge` ning bevosita matn tuguni bo'lib qoladi (nuqta qo'shilganda ham): `getByText` `data-tone` li elementni qaytarishi kerak. O'chirish tasdig'idagi ism `<strong>` ga o'ralmaydi.
11. Tooltip uchun `TooltipProvider` shart emas; `aria-label` lar o'zgarmaydi. jsdom'da tooltip har fokusda ochiladi: tooltip testlari fokus orqali.
12. JSX matnida `'` o'rniga `&apos;`.

## Fayl tuzilmasi

| Fayl (ikkala ilovada bir xil) | Vazifa |
|---|---|
| `lib/initials.ts` (+test) | `initials(name)`, `tone(seed)` |
| `components/avatar.tsx` (+test) | bosh harfli bezak doira yoki ikonka |
| `components/identity.tsx` (+test), `test/identity.ts` | avatar + sarlavha + ostki matn; `href` faqat sarlavhada; test yordamchisi `identityOf` |
| `components/page-header.tsx` (+test) | `h1` + izoh + amallar + orqaga |
| `components/states.tsx` (+test) | `Loading` (o'zgarmaydi), `ListLoading`, `EmptyState`, `Failed` |
| `components/data-list.tsx` (+test) | v2 |
| `components/action-tooltip.tsx` (+test) | ikonka tugma uchun tooltip |
| `components/role-badge.tsx` (+test) | "Egasi" (nuqta bilan) / "Xodim" |
| `components/pending-button.tsx` (+test) | kutish paytida `aria-busy` + spinner |
| `components/ui/tooltip.tsx` | admin'ga nusxa |
| `app/globals.css` | indigo tokenlar |

Faqat web: `lib/format.ts` (`formatDate`, admin'dagi bilan bir xil). Sahifalar: `apps/web/components/employees/*`, `apps/admin/components/{companies,admins}/*`, `apps/admin/components/pager.tsx`, `apps/admin/app/(panel)/companies/new/page.tsx`.

`DataList` v2:

```ts
export interface Column<T> {
  header: string
  cell: (item: T) => ReactNode
  primary?: boolean          // qator sarlavhasi; kartochka tepasi; href bo'lsa havola
  actions?: boolean          // sarlavha sr-only, o'ngda; kartochkada tepada o'ngda, nomsiz
  align?: "start" | "end"    // faqat jadval
  card?: "row" | "inline"    // default "row"; "inline": sarlavha ostida bir qatorda, nomsiz
}
// props: label, items, columns, getKey, href?, footer?
```

---

## A. Asos va Xodimlar (web)

### Task 0: Tokenlar (STYLE)

- [x] `apps/web/app/globals.css`, `apps/admin/app/globals.css`: `:root` da `--primary: oklch(0.511 0.262 276.966)`, `--ring` / `--sidebar-ring: oklch(0.585 0.233 277.117)`, `--sidebar-primary` = primary; `.dark` da `--primary` / `--ring` / `--sidebar-ring` / `--sidebar-primary: oklch(0.673 0.182 276.935)`, `--primary-foreground` / `--sidebar-primary-foreground: oklch(0.205 0 0)`. Neytrallar: dizayn hujjatidagi qiymatlar. Ikkala fayl farqi avvalgidek ikki joyda qoladi. Commit: `style(web): indigo brand color`, `style(admin): indigo brand color`.

### Task 1: Umumiy bo'laklar (web)

| # | Test | RED | GREEN | Commit |
|---|---|---|---|---|
| 1.1 | `lib/initials.test.ts`: "Ali Valiyev" → "AV", "Vali" → "V", "  ali   valiyev " → "AV" | stub `null` | so'zlarning birinchi harflari, katta harf | `feat(web): initials of a name` |
| 1.2 | "Vali (hisobchi)" → "V", "Али Валиев" → "АВ", "O'ktam" → "O", `null` / "" / "—" → `null` | qavs va tire harf bo'lib chiqadi | qavs ichi olib tashlanadi, `\p{L}` | `feat(web): initials skip what is not a name` |
| 1.3 | `tone(seed)`: bir xil seed bir xil butun son `[0, TONES)`; 8 seed birdan ortiq tus | stub `0` | belgi kodlari yig'indisi mod `TONES` | `feat(web): a stable tone for a seed` |
| 1.4 | `avatar.test.tsx`: "AV" `aria-hidden="true"`, `data-tone` | stub `null` | `span` | `feat(web): the avatar` |
| 1.5 | ism yo'q: matn yo'q, `svg` bor | bo'sh doira | ikonka | `feat(web): the avatar falls back to an icon` |
| 1.6 | `identity.test.tsx`: ikki `data-slot`; ostki matn berilmasa tugun yo'q | stub | markup | `feat(web): the identity` |
| 1.7 | `getByRole("link", { name: "Olma Savdo" })` `href` bilan | havola yo'q | sarlavha atrofida `Link` | `feat(web): the identity links by its title` |
| 1.8 | `page-header.test.tsx`: `h1`, izoh, amal tugmasi | stub | markup | `feat(web): the page header` |
| 1.9 | orqaga havola nomi va `href`; berilmasa yo'q | yo'q | `back` | `feat(web): the page header leads back` |
| 1.10 | `lib/format.test.ts`: admin'dagi ikki `formatDate` testi | stub `""` | admin'dagi kod | `feat(web): formatDate` |
| 1.11 | `states.test.tsx`: `EmptyState` sarlavha va izoh (`p`, heading emas) | stub | markup | `feat(web): the empty state` |
| 1.12 | `ListLoading`: bitta `getByLabelText("Yuklanmoqda")`, `aria-busy`, `table` yo'q | stub | skeleton | `feat(web): a list-shaped loading placeholder` |
| 1.13 | `data-list.test.tsx`: `rowheader` "Olma Savdo", kataklar `["01.11.2026"]`, uzunlik 2; `employees-page.test.tsx` `phoneAndName` shu siklda | `rowheader` topilmadi | `<th scope="row">` | `feat(web): the data list's primary value is the row's header` |
| 1.14 | `actions`: kartochkada "Amallar" matni yo'q, tugma bor; amalsiz yozuvda blok yo'q; jadvalda ustun sarlavhasi bor | kartochkada nom bor | `actions` | `feat(web): the data list puts actions at the top of a card` |
| 1.15 | `card: "inline"`: kartochkada qiymatlar bir qatorda, nomsiz; yo'q qiymat ortiqcha ajratkich qoldirmaydi | nomli qatorlar | `inline` | `feat(web): the data list joins inline values in one line` |
| 1.16 | `footer`: "Jami: 2" bir marta; qatorlar soni o'zgarmaydi | topilmadi | `footer` | `feat(web): the data list's footer` |
| 1.17 | STYLE: ramka, bo'shliqlar, sarlavha qatori, hover, `align` | — | — | `style(web): the data list as an enriched table` |
| 1.18 | `action-tooltip.test.tsx`: fokusda "O'chirish" chiqadi, tugma nomi saqlanadi | bolalar o'zi | `Tooltip` | `feat(web): tooltips for icon actions` |
| 1.19 | `role-badge.test.tsx`: "Egasi" `data-role="owner"`, "Xodim" `data-role="user"` | stub | `Badge` + nuqta | `feat(web): the role badge` |
| 1.20 | `pending-button.test.tsx`: kutishda `disabled`, `aria-busy`, nomi o'sha | stub | `Button` + spinner | `feat(web): a button that shows its request is on the way` |

### Task 2: Xodimlar (`employees-page.test.tsx`)

| # | Test | RED | GREEN | Commit |
|---|---|---|---|---|
| 2.1 | `nameAndPhone` (`identityOf`): `["Ali Valiyev", "+998 90 123 45 67"]`…; ustunlar `["A'zo", "Rol", "Amallar"]` | sarlavha sloti yo'q | `Identity` ustuni | `feat(web): each member is one identity, the name over the phone` |
| 2.2 | ismsiz a'zo telefoni bilan ko'rinadi (ostki matn yo'q) | "—" | zaxira | `feat(web): a member without a name goes by their phone` |
| 2.3 | "Qo'shilgan" ustuni, `02.10.2026` | topilmadi | `formatDate(created_at)` | `feat(web): the employees list says when each member joined` |
| 2.4 | "Kompaniyangiz a'zolari · 3 kishi" | topilmadi | `PageHeader` | `feat(web): the employees page says how many members there are` |
| 2.5 | "Jami: 3" | topilmadi | `footer` | `feat(web): the employees list ends with its total` |
| 2.6 | kartochka: rol va sana bir qatorda, "Rol" / "Amallar" yozuvi yo'q, o'chirish tugmasi bor | nomlar bor | `inline`, `actions` | `feat(web): a member's card` |
| 2.7 | amallar fokusda nima qilishini aytadi | tooltip yo'q | `ActionTooltip` | `feat(web): tooltips on the employee actions` |
| 2.8 | STYLE: `RoleBadge`, "Siz", `ListLoading`, izoh `EmptyState` ko'rinishida, tasdiqda `AlertDialogMedia`, dialog sarlavhasida ikonka, `PendingButton` | — | — | `style(web): the employees page` |
| 2.9 | `pnpm --filter @hisob24/web test:e2e` (selector o'zgarishi kutilmaydi) | — | — | — |

- [x] Bosqich yakuni: `make lint`, `make test`, `make e2e`, "keyin" skrinshotlari, push, hisobot. **Foydalanuvchi tasdiqladi (2026-10-04).**

## B. Admin panel va review

### Task 3: Admin'ga ko'chirish

- [x] 3.1 COPY: `ui/tooltip.tsx`, `lib/initials.ts`, `components/{avatar,identity,page-header,action-tooltip,role-badge,pending-button}.tsx`, `test/identity.ts`, testlari bilan. `feat(admin): avatar, identity, page header and action tooltips`
- [x] 3.2 COPY: `components/states.tsx` + test; `Empty` → `EmptyState` (`companies-page.tsx`, `billing-history.tsx`; matnlar o'sha). `feat(admin): the shared loading, empty and failed states`
- [x] 3.3 `data-list.test.tsx` nusxasi, `cellsOf` va `names()` yangilanadi → RED (`rowheader` topilmadi) → `data-list.tsx` nusxasi. `feat(admin): the data list with a row header, card actions, inline values and a footer`

### Task 4: Kompaniyalar (`companies-page.test.tsx`)

| # | Test | GREEN | Commit |
|---|---|---|---|
| 4.1 | ustunlar `["Kompaniya", "Tugash sanasi", "Holat"]`; qatorda yaratilgan sana | `Identity` (`href`), `DataList` `href` olib tashlanadi, `mocks/data.ts` sanasi tuzatiladi | `feat(admin): each company is an identity with the day it was created` |
| 4.2 | sarlavha ostida son (qidiruvda mos son) | `PageHeader` | `feat(admin): the companies page says how many match` |
| 4.3 | kartochka: holat bir qarashda, "Holat" yozuvi yo'q | `inline` | `feat(admin): a company's card shows how it stands at a glance` |
| 4.4 | STYLE: `Pager` `footer` da, toolbar, holat nuqtasi, `ListLoading`, `EmptyState` | — | `style(admin): the companies page` |

### Task 5: Kompaniya sahifasi (`company-page.test.tsx`)

| # | Test | GREEN | Commit |
|---|---|---|---|
| 5.1 | `usersOf`: `["Ali Valiyev", "+998 90 123 45 67", "Egasi", "20.09.2026"]`… | `Identity`, `RoleBadge`, "Qo'shilgan"; ustun "User" | `feat(admin): a company's users are identities with role and joining day` |
| 5.2 | billing kartochkasi: kunlar va summa bir qatorda | `inline` | `feat(admin): a payment's card puts days and amount in one line` |
| 5.3 | STYLE: `PageHeader` (orqaga, avatar, amallar), "Ma'lumot" (o'sha region, `dl`, matnlar), "+N kun" belgisi, summa o'ngda `tabular-nums`, dialoglarda ikonka va spinner | — | `style(admin): the company page` |

### Task 6: Adminlar (`admins-page.test.tsx`)

| # | Test | GREEN | Commit |
|---|---|---|---|
| 6.1 | qator sarlavhasida ism va Telegram ID; birinchi ustun "Admin" | `Identity` | `feat(admin): each admin is an identity, the name over the Telegram ID` |
| 6.2 | "Qo'shilgan" (`01.10.2026`, faqat boshlang'ich qatorlarda) | ustun | `feat(admin): the admins list says when each was added` |
| 6.3 | sarlavha ostida son | `PageHeader` | `feat(admin): the admins page says how many admins there are` |
| 6.4 | "Jami: N" | `footer` | `feat(admin): the admins list ends with its total` |
| 6.5 | kartochka: "Holat" / "Amallar" yozuvi yo'q, "Faol" va tugma bor | `inline`, `actions` | `feat(admin): an admin's card` |
| 6.6 | o'chirish tugmasi fokusda "O'chirish" | `ActionTooltip` | `feat(admin): a tooltip on the admin action` |
| 6.7 | STYLE: holat nuqtalari, "Siz", `ListLoading`, dialog ikonkasi | — | `style(admin): the admins page` |

### Task 7: Yangi kompaniya (`new-company-form.test.tsx`)

| # | Test | GREEN | Commit |
|---|---|---|---|
| 7.1 | `group "Kompaniya"` (nom, tugash sanasi) va `group "Egasi"` (telefon, ism) | `FieldSet` + `FieldLegend` + `FieldDescription` | `feat(admin): the new company form groups the company and its owner` |
| 7.2 | STYLE: kartochka; sahifada `PageHeader` (server fayl, hook'siz); "Bekor qilish" havolasi | — | `style(admin): the new company page` |

### Task 8: Review va yakun

- [ ] Review workflow (UI agentlar): a11y, mobil, Next.js, kod sifati, izchillik. Tasdiqlangan topilmalar TDD bilan tuzatiladi.
- [x] `make lint`, `make test`, `make e2e`.
- [x] `cmp`: `components/{data-list,avatar,identity,page-header,states,action-tooltip,role-badge,pending-button}.tsx` va testlari, `components/ui/tooltip.tsx`, `lib/initials.ts` (+test), `test/identity.ts`. `globals.css` farqi avvalgi ikki joyda.
- [x] Skrinshotlar (oldin / keyin), real stack sinovi (lokal, haqiqiy API), push, yakuniy hisobot.

## B-bosqich: amalda bajarilgan sikllar (2026-10-04)

Reja jadvallaridan farqlar dizayn panelining sintezidan kelib chiqdi (dizayn hujjatidagi "B-bosqich: dizayn paneli sintezi va rejadan farqlar" bo'limi). Har qator: avval yiqilgan test, keyin kod, keyin commit. **STYLE** qatorlari testsiz (faqat class), skrinshot va o'lchov bilan tekshirilgan.

| # | Xatti-harakat | RED (qisqa) | Commit |
|---|---|---|---|
| 3.1 | COPY: umumiy bo'laklar admin'da | — (testlari bilan nusxa, `cmp`) | `feat(admin): avatar, identity, page header and action tooltips` |
| 3.2 | holatlar: status, alert, `ListLoading`, `EmptyState` | 6 ta: `role "status"` / `role "alert"` topilmadi… | `feat(admin): the shared loading, empty and failed states` |
| 3.3 | `DataList` v2 admin'da | 13 ta: `role "rowheader"` topilmadi… | `feat(admin): the data list with a row header, card actions, inline values and a footer` |
| D1 | yo'q qiymat: jadvalda "—", kartochkada joy yo'q | `toHaveTextContent("—")`, Received: "" | `feat: a missing value is a dash in the table and no line on the card` |
| D2 | kartochka qatorida belgilar oldinda | `['Tugash sanasi','Holat']` ≠ `['Holat','Tugash sanasi']` | `feat: a card's line leads with its tags` |
| D5 | kartochkada manba tartibi: yozuv, keyin amallar | `[null,'data-list-meta',null]` ≠ `['data-list-title',…,'data-list-actions']` | `feat: a card reads the record before its actions` |
| D3 | `card: "aside"` | `toHaveClass("sr-only")` yiqildi | `feat: a card's aside figure stands across from its title` |
| D4 | `card: "note"` | `Unable to find … Izoh` | `feat: a card's note takes a line of its own` |
| PH1 | `PageHeader` da avatar, `h1` dan tashqarida | `Unable to find … OS` | `feat: a page header shows its record's avatar beside the name` |
| 4.1 | kompaniya identity + "Yaratilgan …" | `[[null,null],…]` ≠ `[['Olcha Servis','Yaratilgan 13.09.2026'],…]` | `feat(admin): each company is an identity with the day it was created` |
| 4.2 | sarlavha ostida platformadagi kompaniyalar soni | `Unable to find … Platformadagi kompaniyalar` | `feat(admin): the companies page says how many companies the platform has` |
| 4.3 | kartochka: holat, keyin tugash sanasi | `[]` ≠ `[['Holat',…],['Tugash sanasi',…]]` | `feat(admin): a company's card shows how it stands at a glance` |
| 4.4a | bo'sh natija (filtr): nima qilish | `Unable to find … Qidiruv yoki filtrni o'zgartirib ko'ring.` | `feat(admin): an empty filtered list suggests changing the filter` |
| 4.4b | platformada kompaniya yo'q | `Unable to find … Birinchi kompaniyani …` | `feat(admin): a platform with no company yet says how to add the first` |
| 4.5 | e2e: kompaniya identity'ning istalgan joyidan ochiladi | `Expected pattern: /\/companies\/1$/`, Received `…/companies` | `feat: a linked identity opens from anywhere on it` |
| — | STYLE: `ListLoading` o'lchami, `EmptyState` ikki daraja | o'lchov: siljish 0px | `style: the list placeholder keeps the list's size, the empty state has two levels` |
| — | e2e fixture: sahifalar mock'dan oldin yopiladi | "Failed to proxy" 0 ta | `test(admin): close the pages before the mock network goes` |
| 4.6 | STYLE: Kompaniyalar | skrinshot | `style(admin): the companies page` |
| 5.1 | userlar: identity + rol belgisi + sana | `['Telefon','Ism','Rol']` ≠ `["A'zo",'Rol',"Qo'shilgan"]` | `feat(admin): a company's users are identities with role and joining day` |
| 5.1b | userlar "Jami: N" | `Unable to find … Jami: 2` | `feat(admin): a company's users list ends with its total` |
| 5.1c | billing "Jami: N" | `Unable to find … Jami: 1` | `feat(admin): the billing history ends with its total` |
| 5.2 | to'lov kartochkasi | `aside: []` ≠ `[['Summa','150 000,50']]` | `feat(admin): a payment's card reads as a ledger line` |
| 5.2b | to'lovlar yo'q: nima qilish | `Unable to find … Birinchi to'lovni …` | `feat(admin): a company without payments says how to add the first` |
| 5.3 | tugmalar "yo'lda" (5 sikl: nom, bloklash, faollashtirish, egasi, billing) | `toHaveAttribute("aria-busy","true")`, yo'q | `feat(admin): the … button says … is on its way` (5 ta) |
| 5.4 | e2e: amallar keng ekranda nom yonida, telefonda ostida | mutatsiya: `Expected: >= 360, Received: 216` | `style(admin): the company page` ichida |
| — | STYLE: `PageHeader` `stack`; kompaniya sahifasi | skrinshot | `style: a page header may stack its actions under the name on a phone`, `style(admin): the company page` |
| 6.1 | admin identity + "Siz" ism yonida | `[[null,null],…]` ≠ `[['Owner','Telegram ID 461603558'],…]` | `feat(admin): each admin is an identity, the name over the Telegram ID` |
| 6.2 | "Qo'shilgan" | `['Ism','Holat','Amallar']` da yo'q | `feat(admin): the admins list says when each was added` |
| 6.3 | sarlavha ostida son | `Unable to find … Platforma adminlari` | `feat(admin): the admins page says how many admins there are` |
| 6.4 | "Jami: N" | `Unable to find … Jami: 3` | `feat(admin): the admins list ends with its total` |
| 6.5 | kartochka | `[]` ≠ `[['Holat','Faol'],["Qo'shilgan",'01.10.2026']]` | `feat(admin): an admin's card shows status and date in one line, the action at its top` |
| 6.6 | tooltip | `Unable to find … O'chirish` | `feat(admin): a tooltip on the admin's action` |
| 6.7 | tugmalar "yo'lda" (2 sikl) | `aria-busy` yo'q | `feat(admin): the add-admin dialog's button…`, `…the turn-off confirmation's button…` |
| — | STYLE: `muted` identity; Adminlar | skrinshot | `style: a muted identity steps back`, `style(admin): the admins page` |
| 7.1 | "Yaratish" tugmasi "yo'lda" | `aria-busy` yo'q | `feat(admin): the new company form's button says the company is on its way` |
| — | STYLE: Yangi kompaniya; tooltip sensorli ekranda chiqmaydi | skrinshot | `style(admin): the new company page`, `style: an action's tooltip never shows where nothing hovers` |

## Self-review

- Qamrov: tokenlar (T0), umumiy bo'laklar (T1), Xodimlar (T2), admin nusxa (T3), Kompaniyalar (T4), kompaniya sahifasi (T5), Adminlar (T6), forma (T7), review (T8).
- Nomlar izchil: `initials`, `tone`, `Avatar`, `Identity`, `identityOf`, `PageHeader`, `ListLoading`, `EmptyState`, `ActionTooltip`, `RoleBadge`, `PendingButton`.
- Yangi funksiya yo'q: qidiruv, saralash, yangi API maydoni qo'shilmaydi.
