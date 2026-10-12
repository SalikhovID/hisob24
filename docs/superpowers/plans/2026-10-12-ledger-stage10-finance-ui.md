# Jurnal, 10-bosqich: moliya UI — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** «Moliya» bo'limi: Kassa (akkauntlar va qoldiqlari, akkaunt sahifasi: qoldiq kartasi, hisob harakati, kassa hujjatlari dialoglari), Xarajatlar (xarajat / kirim tablari, filtrlar, qator amallari), O'tkazmalar (o'tkazma va konvertatsiya bitta ro'yxatda); nav, route'lar, Vitest va e2e. 9-bosqich API'si va mocklari ustida.

**Architecture:**
- **Nav** (`lib/nav.ts`): «Moliya» (`finance`, `/accounts`, `WalletIcon`, `finance.view`) Ombordan keyin, Xodimlardan oldin; tablar Kassa `/accounts`, Xarajatlar `/expenses`, O'tkazmalar `/money-transfers` (har biri `finance.view`). `nav.test.ts`, `shell.spec.ts` (to'qqizta bo'lim: «Yana» ostida Sotuv, Ombor, Moliya, Xodimlar, Sozlamalar; «Bo'limlar tartibi»), `roles.spec.ts` o'zgarmaydi (Sotuvchi rolida moliya yo'q).
- **Lib**: `lib/finance.ts` (zod: `cashOpeningSchema` {bank_account_id, amount, at, note}, `expenseSchema` {kind, bank_account_id, category_id, amount, at, note}, `moneyTransferSchema` {from_account_id, to_account_id, amount, at, note}, `conversionSchema` {from_account_id, amount, to_account_id, to_amount, at, note}; `*Defaults(doc | undefined, local, firstAccount)`; `conversionRateText(amount, toAmount, fromCurrency)`; `kindTitle` moliya turlari uchun `lib/stock.ts`dagi `kindTitle`ga qo'shiladi), `lib/queries.ts` (`accountsKey/useAccountBalances`, `accountStatementKey/useAccountStatement(companyId, id, page)`, `expensesKey/useExpenses(companyId, filter)`, `moneyTransfersKey/useMoneyTransfers(companyId, filter)`, `cashOpeningsKey/useCashOpenings(companyId, accountId, page)`; `forgetFinance(queryClient, companyId)` = accounts, statement, expenses, money-transfers, cash-openings; `forgetWarehouse` ham `forgetFinance`ni chaqiradi (ta'minotchi / mijoz to'lovi akkaunt qoldig'ini o'zgartiradi) va aksincha), `lib/use-expense-filter.ts` (`?kind=&account_id=&category_id=&from=&to=&page=` manzilda).
- **Sahifalar** (`components/finance/`): `accounts-page.tsx` (`SectionTabs`; ro'yxat: Nom (nofaol belgisi), Valyuta, Qoldiq (rangli: manfiy qizil), havola `/accounts/{id}`; `finance.view`), `account-page.tsx` (sarlavha nom · valyuta; qoldiq kartasi; «Hisob harakati» `AccountStatementList` (Hujjat («Xarajat № 7», «To'lov · Xarid № 3» havola bilan), Vaqt, Qarshi tomon, Summa (±), Qoldiq, Qo'shgan); tugmalar `finance.create`: «Boshlang'ich qoldiq», «Xarajat», «Kirim», «O'tkazma», «Konvertatsiya» (dialoglar, akkaunt oldindan tanlangan)), `cash-opening-dialog.tsx`, `expense-dialog.tsx` (tur, akkaunt, kategoriya (`useFinanceCategories(kind)`, faollar; kategoriya bo'lmasa «Sozlamalarda kategoriya yarating» eslatmasi va `settings.view` bilan havola), summa (akkaunt valyutasi belgisi), vaqt, izoh), `money-transfer-dialog.tsx` (qayerdan, qayerga (shu valyutadagi akkauntlar), summa, vaqt, izoh), `conversion-dialog.tsx` (qayerdan + summa, qayerga (boshqa valyutali) + summa, hisoblangan kurs matni, vaqt, izoh), `delete-cash-document-button.tsx` (tur bo'yicha endpoint va matn), `expenses-page.tsx` (`SectionTabs`; Xarajat / Kirim `Tabs` (`?kind=`); filtrlar: akkaunt `SelectBox`, kategoriya `SelectBox`, `from`/`to` `date` maydonlari; ustunlar «Hujjat» («№ 7 · Ijara», ostida vaqt · akkaunt), «Summa», «Qo'shgan», «Amallar» (tahrirlash dialog, o'chirish); `Pager`; «Xarajat qo'shish» / «Kirim qo'shish» tugmasi joriy tabga qarab), `money-transfers-page.tsx` (`SectionTabs`; ustunlar «Hujjat» («O'tkazma № 1» / «Konvertatsiya № 2», ostida vaqt), «Qayerdan» (akkaunt, summa), «Qayerga» (akkaunt, summa; konvertatsiyada kurs), «Qo'shgan», «Amallar»; tugmalar «O'tkazma» va «Konvertatsiya»).
- **Route'lar**: `app/(app)/accounts/page.tsx`, `accounts/[id]/page.tsx`, `expenses/page.tsx`, `money-transfers/page.tsx`.
- **README**: moliya bo'limi (akkauntlar admin paneldan, kategoriyalar sozlamalardan, kassa hujjatlari).

Qoidalar: `logic/finance.md` (hammasi), `logic/currencies.md` (ko'rinish). Dizayn: `docs/superpowers/specs/2026-10-11-ledger-design.md`, CRUD va select dizayn hujjatlari.

---

## Kelishuvlar

- Kassa hujjatlari dialoglarda (alohida sahifalar yo'q: qatorlari yo'q, maydonlari oz); dialog ro'yxat qatoridan (tahrirlash) va sahifa sarlavhasidan (qo'shish) ochiladi; akkaunt sahifasidan ochilganda akkaunt oldindan tanlangan.
- Hujjat ro'yxatlarida akkaunt sahifasiga va boshqa hujjatga havolalar: hisob harakatida xarid / sotuv bilan kiritilgan to'lov o'sha hujjatga (`/purchases/{id}` / `/sales/{id}`), ta'minotchi / mijoz to'lovi ta'minotchi / mijoz sahifasiga emas (qarshi tomon nomi matn), kassa hujjati o'z dialogiga (tahrirlash).
- «O'tkazmalar» tabi ikkala turni `GET /app/money-transfers` dan oladi; tahrirlash va o'chirish turga qarab `/app/money-transfers/{id}` yoki `/app/conversions/{id}`.
- Summa maydonida akkaunt valyutasining belgisi (`accountCurrency`); konvertatsiya dialogida ikki summa ikki valyuta belgisi bilan, kurs `conversionRateText` bilan jonli hisoblanadi (so'm chiqsa chiqqan / kirgan, aks holda kirgan / chiqqan; API qoidasi).
- Xarajat formasi kategoriya bo'lmaganda saqlanmaydi (API «Kategoriyani tanlang»): dialog kategoriyasiz holatni aytadi.
- Talab o'zgargani uchun o'zgargan testlar: `nav.test.ts` (to'qqiz bo'lim), `shell.spec.ts` («Yana» ro'yxati va tartib ro'yxati).

## Fayl tuzilmasi

| Fayl | O'zgarish |
|---|---|
| `apps/web/lib/nav.ts` (+test), `lib/finance.ts` (yangi, +test), `lib/stock.ts` (`kindTitle`, +test), `lib/queries.ts`, `lib/use-expense-filter.ts` (yangi, +test) | bo'lim, sxemalar, hooklar, filtr |
| `apps/web/components/finance/*.tsx` (yangi, +testlar) | sahifalar va dialoglar |
| `apps/web/app/(app)/accounts/**`, `expenses/`, `money-transfers/` | route'lar |
| `apps/web/e2e/finance.spec.ts` (yangi), `shell.spec.ts` | e2e |
| `README.md`, `docs/superpowers/specs/2026-10-11-ledger-design.md` | hujjat; «10-bosqich qarorlari» |

---

### Task 1: Bo'lim, sxemalar, hooklar

`nav.ts` «Moliya» tablari bilan; `nav.test.ts`. `lib/finance.ts` sxemalar va defaults (+`lib/finance.test.ts`: summa / vaqt / kategoriya xabarlari, `conversionRateText`). `lib/stock.ts` `kindTitle` moliya turlari («Kassa boshlang'ich qoldig'i», «Xarajat», «Kirim», «O'tkazma», «Konvertatsiya», «To'lov» / «Mijoz to'lovi»). `queries.ts` hooklar va `forgetFinance`; `use-expense-filter.ts`. Commit.

### Task 2: Kassa: akkauntlar va akkaunt sahifasi

`accounts-page.tsx`, `account-page.tsx` (qoldiq kartasi, `AccountStatementList`), `cash-opening-dialog.tsx`, `delete-cash-document-button.tsx`; route'lar `/accounts`, `/accounts/[id]`; testlar (ro'yxat tartibi va nofaol belgisi, sahifa 404, hisob harakati qatorlari va havolalari, dialog qo'shish / tahrirlash / xatolar, o'chirish, ruxsatlar). Commit.

### Task 3: Xarajatlar

`expense-dialog.tsx`, `expenses-page.tsx` (tablar, filtrlar, qator amallari), route `/expenses`; testlar (tablar `?kind=`, filtrlar manzilda, kategoriyasiz holat, dialog xatolari «Kategoriya turi mos emas», tahrirda tur o'zgarmaydi, o'chirish). Commit.

### Task 4: O'tkazmalar

`money-transfer-dialog.tsx`, `conversion-dialog.tsx`, `money-transfers-page.tsx`, route `/money-transfers`; akkaunt sahifasidagi tugmalar; testlar (bitta ro'yxatda ikki tur, kurs matni, «Valyutalar farq qilsa konvertatsiya kiriting», «Bir xil valyutada o'tkazma kiriting», tahrirlash / o'chirish tur bo'yicha). Commit.

### Task 5: Yakun

`e2e/finance.spec.ts` (egasi: kassa boshlang'ich qoldig'i → xarajat kategoriya bilan (avval Sozlamalarda kategoriya) → kirim → o'tkazma → konvertatsiya (admin mock'da USD akkaunt: Nok Market yoki `db.accounts` seed) → akkaunt sahifasida qoldiq va hisob harakati → tahrirlash va o'chirish; rolsiz xodimda ham bor; `finance.*`siz rolda «Moliya» yo'q va manzillar uyga olib boradi), `shell.spec.ts`; README; `make lint`, `make test`, `make e2e`; spec «10-bosqich qarorlari»; push.
