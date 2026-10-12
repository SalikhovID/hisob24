# Jurnal, 9-bosqich: moliya API — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Kassa hujjatlari (`cash_opening`, `expense` / `income`, `money_transfer`, `conversion`), akkaunt qoldiqlari (o'z valyutasida) va akkaunt hisob harakati, `account_in_use` / `category_in_use` hujjat bo'yicha — API (`finance.*`), kontrakt, TS client va web mocklari. Sahifalar 10-bosqichda.

**Architecture:**
- **So'rovlar** (yangi `cash.sql`): `GetCashDocument(id, company_id)` (besh tur uchun bitta qator: akkaunt va valyutasi, maqsad akkaunt, kategoriya, `total`, `to_total`), `ListCashDocuments` / `CountCashDocuments(company_id, kinds text[], account_id?, category_id?, from?, to?, limit, offset)` (`doc_at DESC, id DESC`; akkaunt filtri manba **yoki** maqsad), `ListAccountBalances(company_id)` (akkauntlar ID tartibida, nofaollar oxirida; qoldiq = `+` cash_opening, income, customer_payment, money_transfer maqsad, conversion maqsad `to_total`; `−` expense, supplier_payment, money_transfer manba, conversion manba `total`), `ListAccountStatement` / `CountAccountStatement(company_id, account_id, limit, offset)` (± summa akkaunt valyutasida, `SUM() OVER` qoldiq; kontragent: ta'minotchi / mijoz nomi, kategoriya, boshqa akkaunt; bog'langan hujjat raqami), `CountAccountDocuments(account_id)`, `CountCategoryDocuments(category_id)`.
- **Servis** (`internal/finance`): `cash.go` (`Document`, `DocumentPage`, `ListInput`, `Get`, `List`, `Delete` — turga qarab; `checkHead`: akkaunt → maqsad akkaunt → kategoriya → vaqt → summa → maqsad summa → izoh), `cash_openings.go`, `expenses.go` (`Kind` expense | income, kategoriya turi mos), `money_transfers.go` (bir valyuta), `conversions.go` (valyutalar farq, ikki summa, `rate` = `to_total / total` ma'lumot), `accounts.go` (+`AccountBalances`, `AccountStatement`; `account_in_use` o'chirish va valyuta almashtirishda), `categories.go` (`category_in_use`). Umumiy mayda yordamchilar `ledger`ga ko'chadi: `PageSize`, `PageOf`, `Note`, `Amount`, `AccountFor` (warehouse shu yordamchilarni chaqiradi, testlari o'zgarmaydi).
- **API** (`internal/app/finance.go`): `GET /app/accounts`, `GET /app/accounts/{id}/statement?page=`, `GET/POST /app/cash-openings`, `GET/PUT/DELETE /app/cash-openings/{id}`, `GET/POST /app/expenses`, `GET/PUT/DELETE /app/expenses/{id}`, `GET/POST /app/money-transfers`, `GET/PUT/DELETE /app/money-transfers/{id}`, `GET/POST /app/conversions`, `GET/PUT/DELETE /app/conversions/{id}` (`finance.view` / `create` / `edit` / `delete`); `from` / `to` kun filtri a'zoning timezone'i bilan (`currentAccess(ctx).Timezone`, `ledger.DayRange`).
- **Kontrakt**: `AccountBalance`, `AccountStatementRow`, `AccountStatementPage`, `CashOpening(+Input, Page)`, `Expense(+Input, Page)`, `MoneyTransfer(+Input, Page)`, `Conversion(+Input, Page)`; `make api-client`.
- **Mock** (`mocks/finance.ts`, `mocks/ledger.ts`, `mocks/data.ts`): Go qoidalarida; `handlers.test.ts`.

Qoidalar: `logic/finance.md` (hammasi), `logic/currencies.md` (4-bo'lim), `logic/warehouse.md` (1-bo'lim). Dizayn: `docs/superpowers/specs/2026-10-11-ledger-design.md`.

---

## Kelishuvlar

- Kassa hujjatlari `internal/finance` paketida (`finance.Service` allaqachon akkaunt, kategoriya va kompaniya qulfini (`write`) tutadi; 7-bosqich qarori sotuvga tegishli edi: sotuv tovar qatorlari yordamchilarini bo'lishadi, kassa hujjatlari esa faqat mayda yordamchilarni). Shu yordamchilar `ledger`ga chiqadi: `PageSize = 20`, `PageOf(page)` («Sahifa raqami noto'g'ri»), `Note(raw)` (500, «Izoh 500 belgidan oshmasin»), `Amount(raw)` («Summani kiriting», «Summa noto'g'ri»; = hozirgi `paymentAmount`), `AccountFor(ctx, q, companyID, id, keep)` («Akkauntni tanlang», «Akkaunt nofaol»). `warehouse` o'z nomlari bilan ularga murojaat qiladi.
- Kassa hujjatida kurs maydoni **yo'q** (spec API jadvali: `{bank_account_id, amount, at, note?}`): `currency_rate_id` hujjat sanasidagi standart qator (`ledger.PriceIn` akkaunt valyutasi bilan, kurs kiritilmagan), javobda `rate` ko'rsatilmaydi. `logic/finance.md` 5-bo'limidagi «formada o'zgartirish mumkin» jumlasi shunga moslanadi (akkaunt qoldiqlari o'z valyutasida: kurs hech narsaga ta'sir qilmaydi).
- Bitta `Document` turi beshala hujjatga: `{ID, Kind, Number, At, BankAccountID, AccountName, CurrencyID, Amount, ToBankAccountID?, ToAccountName?, ToCurrencyID?, ToAmount?, CategoryID?, CategoryName?, Rate? (faqat konvertatsiya: `to_total / total`, 4 kasr), Note, CreatedByName, CreatedAt, UpdatedAt}`; API'da har tur o'z sxemasi bilan (`CashOpening`, `Expense`, `MoneyTransfer`, `Conversion`), handler kerakli maydonlarni oladi. `Get` / `Delete` turni tekshiradi: boshqa turdagi id 404 «Hujjat topilmadi».
- Tekshiruv tartibi `logic/finance.md` 5-bo'limi: akkaunt → maqsad akkaunt (boshqa; o'tkazmada bir valyuta «Valyutalar farq qilsa konvertatsiya kiriting», konvertatsiyada farq «Bir xil valyutada o'tkazma kiriting») → kategoriya («Kategoriyani tanlang», «Kategoriya nofaol» (tahrirda avvalgisi qoladi), «Kategoriya turi mos emas») → vaqt → summa → maqsad summa («Maqsad summani kiriting», «Maqsad summa noto'g'ri») → izoh. Tahrirda nofaol akkaunt avvaldan hujjatniki bo'lsa qoladi (`keep`: manba va maqsad alohida).
- Akkaunt hisob harakati qatori: `{id, kind, number, at, delta (± akkaunt valyutasida), balance, party_name (ta'minotchi / mijoz nomi, kategoriya, boshqa akkaunt; chakana to'lovda null), linked_id, linked_number (xarid / sotuv bilan kiritilgan to'lov), note, created_by_name}`; `amount` yo'q (delta yetarli), valyuta akkauntniki.
- `from` / `to`: `YYYY-MM-DD`, a'zoning timezone'ida kun boshi va oxiri (`ledger.DayRange(from, to, tz)` → `[start, end)` UTC); noto'g'ri yoki `from > to` 400 «Sana noto'g'ri». Mock'da timezone `Asia/Tashkent`.
- `account_in_use`: admin akkauntni o'chirsa yoki valyutasini o'zgartirsa `CountAccountDocuments` (manba yoki maqsad bo'lgan jonli hujjatlar) > 0 → 409 «Bu akkauntda N ta hujjat bor»; `category_in_use`: kategoriya o'chirilsa 409 «Bu kategoriyada N ta hujjat bor». Admin ro'yxatida `BankAccount.documents` soni (sxemada bo'lsa to'ldiriladi).
- Raqam har turda alohida (`ledger.NextNumber`); kassa boshlang'ich qoldig'i raqamlanadi, ko'rsatilmaydi (`Numbered` false). O'chirish yashirish, raqam bo'shamaydi.

## Fayl tuzilmasi

| Fayl | O'zgarish |
|---|---|
| `backend/internal/ledger/helpers.go` (yangi, +test), `warehouse/*.go` | `PageSize`, `PageOf`, `Note`, `Amount`, `AccountFor`, `DayRange` |
| `backend/internal/db/queries/cash.sql` (yangi), `bank_accounts.sql`, `finance_categories.sql` (+`internal/db/cash_test.go`) | so'rovlar |
| `backend/internal/finance/cash.go`, `cash_openings.go`, `expenses.go`, `money_transfers.go`, `conversions.go`, `accounts.go`, `categories.go` (+testlar) | servis |
| `backend/internal/app/finance.go`, `handler.go`, `admin` akkauntlar (+`finance_test.go`, `permissions_test.go`) | API |
| `backend/openapi.yaml`, `packages/api-client`, `apps/web/lib/types.ts`, `apps/admin/lib/types.ts` | kontrakt |
| `apps/web/mocks/finance.ts`, `ledger.ts`, `data.ts` (+`handlers.test.ts`) | mock |
| `logic/finance.md`, `docs/superpowers/specs/2026-10-11-ledger-design.md` | kurs jumlasi; «9-bosqich qarorlari» |

---

### Task 1: `ledger` yordamchilari va so'rovlar

`ledger/helpers.go`: `PageSize`, `PageOf`, `Note`, `Amount`, `AccountFor`, `DayRange` (+ `helpers_test.go`: table-driven; `DayRange("2026-10-05", "2026-10-05", "Asia/Tashkent")` → `2026-10-04T19:00Z`–`2026-10-05T19:00Z`). `warehouse` o'z yordamchilarini shularga buradi (`go test ./internal/warehouse/...` o'zgarmay o'tadi). `cash.sql`: yuqoridagi so'rovlar; `make sqlc`; `internal/db/cash_test.go`: qoldiq ishorasi har tur uchun, hisob harakati qoldiq balansi, filtrlar (`kinds`, akkaunt manba / maqsad, kategoriya, kun oralig'i), `CountAccountDocuments` / `CountCategoryDocuments` o'chirilganlarni sanamaydi. Commit.

### Task 2: Kassa boshlang'ich qoldig'i va xarajat / kirim (servis)

`cash.go`: `Document`, `DocumentPage`, `ListInput{Kinds, AccountID, CategoryID, From, To *time.Time, Page}`, `checkHead`, `Get(kind)`, `List`, `Delete(kind)`; `cash_openings.go`: `CashOpeningInput{BankAccountID, Amount, At, Note}`, `AddCashOpening`, `UpdateCashOpening`; `expenses.go`: `ExpenseInput{Kind, BankAccountID, CategoryID, Amount, At, Note}`, `AddExpense`, `UpdateExpense` (`kind` o'zgarmaydi: «Tur o'zgartirilmaydi»). Testlar: qo'shish (raqam turda alohida, akkaunt valyutasi), rad javoblari tartibi, kategoriya turi mos emas, nofaol kategoriya tahrirda qoladi, ro'yxat filtrlari, o'chirish yashiradi, atomiklik (`FailInserts("transactions")` tegishli bo'lsa). Commit.

### Task 3: O'tkazma, konvertatsiya, akkaunt qoldiqlari va hisob harakati, `*_in_use`

`money_transfers.go`: `MoneyTransferInput{FromAccountID, ToAccountID, Amount, At, Note}`; `conversions.go`: `ConversionInput{FromAccountID, Amount, ToAccountID, ToAmount, At, Note}` (`to_total`, `Rate`); `accounts.go`: `AccountBalance{Account, Balance string}`, `AccountBalances`, `AccountStatement(companyID, accountID, page)` (404 «Akkaunt topilmadi»), `DeleteAccount` / `PatchAccount` valyuta → `account_in_use`; `categories.go` `DeleteCategory` → `category_in_use`. Testlar: o'ziga o'tkazma, valyuta farqi, konvertatsiya ikki tomon qoldig'i, tahrirda ikkala qoldiq qayta, hisob harakati tartibi va qoldiq, nofaol akkaunt qoldig'i ko'rinadi, 409 lar. Commit.

### Task 4: API, kontrakt, client

`internal/app/finance.go`: JSON turlari, handlerlar, `documentListParams` (`kind`, `account_id`, `category_id`, `from`, `to`, `page`; «Akkaunt noto'g'ri», «Kategoriya noto'g'ri», «Tur noto'g'ri», «Sana noto'g'ri»), route'lar `allowed(access.Finance*)`; `permissions_test.go` qatorlari; `finance_test.go` (`httptest`, pgtest: har endpoint, 403 tartibi, 404 boshqa kompaniya). Admin: akkaunt o'chirish / valyuta 409. `openapi.yaml` + kontrakt testi; `make api-client`; `lib/types.ts` (web, admin). Commit.

### Task 5: Mock va yakun

`mocks/finance.ts`: kassa hujjatlari CRUD va ro'yxatlar (Go qoidalari), `GET /app/accounts`, `…/statement`; `mocks/ledger.ts`: `accountBalanceOf`, `accountStatementOf`; `mocks/data.ts`: `seedFinance` (kategoriyalar, USD akkaunt); admin mock akkaunt 409; `handlers.test.ts`. `make lint`, `make test`, `make e2e`; `logic/finance.md` kurs jumlasi; spec «9-bosqich qarorlari»; push.
