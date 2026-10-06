# Vazifalar, 1-bosqich: umumiy maydon mantiqi (refaktoring) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mijozlar va vazifalar baham ko'radigan maydon mantiqi (maydon turlari, nom qoidalari, javob tekshiruvi, tarix farqi; frontend'da maydon input'lari, javob matni, forma sxemasi bo'laklari) alohida paket va modullarga ajratiladi. Xatti-harakat o'zgarmaydi: mijozlarning mavjud testlari to'liq o'tadi, ko'chirilgan testlar yangi joyida o'tadi.

**Architecture:**
- **Backend:** yangi `internal/fields` paketi: `Field`, `Option`, `Kind*`, `KindOf`, `CleanName`, `Taken`, `SameIDs`, `ErrOrderChanged`, `Invalid`; `Values`, `CheckValues`, `Change`, `DiffValues`, `AsText`. `internal/customer` ulardan foydalanadi (`Field`, `Option` va `Kind*` nomlari alias bo'lib qoladi: `internal/app` va testlar o'zgarmaydi). `customer.Create` → `write` + eksport `CreateIn` (vazifa yaratish shu tranzaksiyada mijoz yaratadi).
- **Frontend:** `lib/fields.ts` (`kindLabels`, `kinds`, `isChoice`, `fieldKey`, `answerText`, `answersDefaults`, `readAnswers`, `fieldColumns`), `components/field-answer.tsx` (`FieldAnswer`: bitta maydonning input'i, forma yo'li aniq beriladi), `components/history-list.tsx` (`HistoryList`: tarix yozuvlari ko'rinishi). `lib/customers.ts`, `customer-form.tsx`, `customer-history.tsx` ularning ustiga quriladi. `lib/customer-fields.ts` yo'qoladi (`nameFieldOf` → `lib/customers.ts`).

**Tech Stack:** Go (testify, pgx, pgtest), Next 16 + Vitest + RTL.

Dizayn: `docs/superpowers/specs/2026-10-06-tasks-design.md` ("Yondashuvlar", "Backend", "User app: umumiy bo'laklar"). Rejadan farq: `useHiddenColumns` prefiksi va `FieldDialog` prop'lari bu bosqichda emas, ularni talab qiladigan test bilan 5- va 3-bosqichda qilinadi (foydalanuvchisiz refaktoring bo'lmasin).

---

## Kelishuvlar

- `GOTEST`: `(set -a; . ./.env; set +a; cd backend && go test <args>)`. Web: `pnpm --filter @hisob24/web exec vitest run <fayl>`.
- Ko'chirish ham TDD bilan: avval yangi joydagi test, keyin kompilyatsiya bo'ladigan stub (mantiq bo'yicha yiqiladi), keyin kod ko'chadi. Eski joydagi testlar yangi kodga o'tgach ham o'tishi shart.
- Har GREEN'dan keyin paket (yoki web suite) testlari va commit. Bosqich oxirida `make lint`, `make test`, `make e2e`, push.
- Mutatsiya tekshiruvi kerak emas: kod ko'chadi, yangi mantiq faqat `CreateIn` (atomiklik testi bor).

## Fayl tuzilmasi

| Fayl | O'zgarish |
|---|---|
| `backend/internal/fields/fields.go` (+`fields_test.go`) | yangi: turlar, `KindOf`, `CleanName`, `Taken`, `SameIDs`, `ErrOrderChanged`, `Invalid` |
| `backend/internal/fields/values.go` (+`values_test.go`) | `customer/values.go` dan: `Values`, `CheckValues`, `Change`, `DiffValues`, `AsText` |
| `backend/internal/customer/{customer,types,values,customers,dropdowns}.go` | `fields` ga o'tadi; `values.go` da faqat `diff` (telefon + `fields.DiffValues`); `CreateIn` |
| `backend/internal/customer/{values_test,customer_test,customers_test}.go` | `values_test.go` → `fields` (telefon holatlari `TestDiff` da qoladi); `CreateIn` testi |
| `apps/web/lib/fields.ts` (+`fields.test.ts`) | `customer-fields.ts` va `customers.ts` dan umumiy qism |
| `apps/web/lib/customers.ts` (+test o'zgarmaydi), `lib/customer-fields.ts` (o'chadi), `customer-fields.test.ts` (→ `customers.test.ts` ga `nameFieldOf`) | yupqa qatlam |
| `apps/web/components/field-answer.tsx` (+`field-answer.test.tsx`) | `customer-form.tsx` dan `Labeled` va `Answer` |
| `apps/web/components/history-list.tsx` (+`history-list.test.tsx`) | `customer-history.tsx` dan ro'yxat |
| `apps/web/components/customers/{customer-form,customer-history}.tsx`, `components/settings/{field-dialog,customer-type-page}.tsx`, `components/customers/{customers-page,customer-page}.tsx` | importlar |

---

### Task 1: `internal/fields` — turlar va sozlama yordamchilari

**Files:** Create `backend/internal/fields/fields.go`, `backend/internal/fields/fields_test.go`.

- [ ] **Step 1: test** — `fields_test.go`:
  - `TestKindOf`: table: olti tur `known`; `string`, `int` choice emas; to'rt tanlov choice; `""` va `"date"` noma'lum.
  - `TestCleanName`: `"  Manba "` → `"Manba"`; `""` va `"   "` → `validation_error` "Nomni kiriting"; 60 ta `ў` o'tadi, 61 tasi "Nom 60 belgidan oshmasin".
  - `TestSameIDs`: `[1,2,3]`/`[3,1,2]` true; kam, ortiqcha, begona, takror (`[1,1,2]` vs `[1,2,3]`) false; ikkala bo'sh true.
  - `TestTaken`: `&pgconn.PgError{Code: "23505"}` true (o'ralgan holda ham), `"23503"` va `errors.New` false.
  - `TestInvalid`: `Invalid("x")` → `*apperr.Error{Kind: Invalid, Code: "validation_error", Message: "x"}`.
  - `refused` yordamchisi (`customer_test.go` dagi nusxasi) shu faylda.
- [ ] **Step 2: stub** — `fields.go`: paket izohi; konstantalar `KindString…KindCheckbox`; `KindOf` → `return false, false`; `CleanName` → `return raw, nil`; `Taken` → `false`; `SameIDs` → `false`; `ErrOrderChanged` haqiqiy (`apperr.New(apperr.Conflict, "order_changed", "Ro'yxat o'zgargan. Sahifani yangilang")`); `Invalid` haqiqiy. `GOTEST ./internal/fields/` → `TestKindOf`, `TestCleanName`, `TestSameIDs`, `TestTaken` yiqiladi (mantiq bo'yicha).
- [ ] **Step 3: kod** — `customer/customer.go` va `types.go` dagi `kindOf`, `cleanName`, `taken`, `sameIDs` tanalari (`maxName` → `MaxName`) `fields.go` ga ko'chadi (hozircha nusxa; mijoz paketi 3-taskda o'tadi). Izohlar inglizcha, mavjud uslubda.
- [ ] **Step 4:** `GOTEST ./internal/fields/` o'tadi. Commit: `feat(fields): the kinds and the name rules a form of fields shares`.

### Task 2: `fields/values.go` — javob tekshiruvi va tarix farqi

**Files:** Create `backend/internal/fields/values.go`, `backend/internal/fields/values_test.go`.

- [ ] **Step 1: test** — `customer/values_test.go` nusxasi `fields/values_test.go` ga: `checkValues` → `CheckValues`, `diff(form, formOptions, phone, tt.phone, was, tt.now)` → `DiffValues(form, formOptions, was, tt.now)`; telefon holatlari (`"the phone"`, `"the phone first, then…"` dagi telefon qatori) olib tashlanadi, `"the fields in their order"` holati qoladi (telefonsiz). Imports: `fields` paketi o'zi (package `fields`).
- [ ] **Step 2: stub** — `values.go`: `type Values map[int64]any`; `type Change struct{Label, Old, New string}` (json teglari bilan); `CheckValues(...) (Values, error)` → `return Values{}, nil`; `DiffValues(...) []Change` → `nil`; `AsText(...) string` → `""`. Test yiqiladi (javoblar bo'sh, xatolar yo'q).
- [ ] **Step 3: kod** — `customer/values.go` dan `maxText`, `maxInt`, `checkValues`→`CheckValues`, `errEmpty`, `offeredBy`, `chosen`, `readAnswer`, `offers`, `readChoices`, `readWhole`, `Change`, `diff` ning maydon qismi → `DiffValues`, `asText`→`AsText`, `optionNames` ko'chadi; `invalid` → `Invalid`; `kindOf` → `KindOf`.
- [ ] **Step 4:** `GOTEST ./internal/fields/` o'tadi. Commit: `feat(fields): the answers' checking and the history of their changes`.

### Task 3: `internal/customer` `fields` ga o'tadi

**Files:** Modify `backend/internal/customer/{customer,types,values,customers,dropdowns}.go`, `values_test.go`, `customers_test.go`; Delete nothing (fayl qoladi, qisqaradi).

- [ ] **Step 1: test** — `customer/values_test.go` da faqat `TestDiff` qoladi, telefon holatlari bilan: `"nothing"`, `"the phone"`, `"a text" (fields.DiffValues orqali)`, `"the phone first, then the fields in their order"`; `form`, `formOptions` o'zgaruvchilari shu test uchun qoladi (qisqargan). Hozir o'tadi (xarakteristika): ko'chirishdan keyin ham o'tishi shart.
- [ ] **Step 2: kod** —
  - `types.go`: `type Field = fields.Field`, `type Option = fields.Option`; `const (KindString = fields.KindString; …)`; `kindOf` olib tashlanadi, chaqiruvlar `fields.KindOf`.
  - `customer.go`: `maxName`, `cleanName`, `taken`, `errOrderChanged`, `sameIDs` olib tashlanadi; `invalid` → `fields.Invalid` (yoki `invalid := fields.Invalid`); chaqiruvlar yangilanadi (`dropdowns.go`, `types.go`).
  - `values.go`: faqat `diff`:
    ```go
    func diff(fs []Field, options map[int64][]Option, oldPhone, newPhone string, was, now Values) []Change {
        var changes []Change
        if oldPhone != newPhone {
            changes = append(changes, Change{Label: "Telefon", Old: user.FormatPhone(oldPhone), New: user.FormatPhone(newPhone)})
        }
        return append(changes, fields.DiffValues(fs, options, was, now)...)
    }
    ```
    `type Values = fields.Values`, `type Change = fields.Change`; `checkValues` chaqiruvlari → `fields.CheckValues`.
  - `customers.go`: `valueRows` da `kindOf` → `fields.KindOf`.
- [ ] **Step 3:** `GOTEST ./internal/customer/ ./internal/fields/ ./internal/app/` o'tadi; `cd backend && go vet ./... && ./bin/golangci-lint run ./...` toza. Commit: `refactor(customer): the field logic comes from internal/fields`.

### Task 4: `customer.CreateIn`

**Files:** Modify `backend/internal/customer/customers.go`, `customers_test.go`.

- [ ] **Step 1: test** — `TestCreateInWritesInsideTheCallersTransaction`: `newShop`; `tx, _ := pool.Begin`; `q := gen.New(pool).WithTx(tx)`; `q.LockCompanyCustomers`; `c, err := s.CreateIn(ctx, q, sh.id, staff, sh.jismoniy.ID, Input{…})` → `require.NoError`, `c.ID > 0`; `tx.Rollback` → `count(customers)` 0 va `count(customer_history)` 0 ("the caller's rollback takes the customer with it"); ikkinchi marta `Begin` + `CreateIn` + `Commit` → `s.Get` topadi, tarixda "created".
- [ ] **Step 2: stub** — `func (s *Service) CreateIn(ctx context.Context, q *gen.Queries, companyID int64, by string, typeID int64, in Input) (Customer, error) { return Customer{}, errors.New("not implemented") }` → test yiqiladi.
- [ ] **Step 3: kod** — `Create` ning `write` ichidagi tanasi `CreateIn` ga ko'chadi (telefon tekshiruvi ham ichida: `customerPhone` birinchi qator); `Create`:
    ```go
    func (s *Service) Create(ctx context.Context, companyID int64, by string, typeID int64, in Input) (Customer, error) {
        var c Customer
        err := s.write(ctx, companyID, func(q *gen.Queries) error {
            var err error
            c, err = s.CreateIn(ctx, q, companyID, by, typeID, in)
            return err
        })
        if err != nil {
            return Customer{}, err
        }
        return c, nil
    }
    ```
    Izoh: `CreateIn` "enters a customer inside the caller's transaction, which has to hold the company (LockCompanyCustomers): a task is entered with its new customer this way".
- [ ] **Step 4:** `GOTEST ./internal/customer/` o'tadi (`TestCreate*` ham). Commit: `feat(customer): CreateIn enters a customer inside the caller's transaction`.

### Task 5: `lib/fields.ts`

**Files:** Create `apps/web/lib/fields.ts`, `apps/web/lib/fields.test.ts`; Modify `apps/web/lib/customers.ts`, `apps/web/lib/customers.test.ts`; Delete `apps/web/lib/customer-fields.ts`, `apps/web/lib/customer-fields.test.ts`; Modify importers.

- [ ] **Step 1: test** — `lib/fields.test.ts`:
  - `customer-fields.test.ts` dagi ikki test (`kinds`/`kindLabels`, `isChoice`) ko'chadi.
  - `customers.test.ts` dagi `answerText` testi ko'chadi (import `./fields`).
  - `fieldColumns`: "a column for every field name, shared by the types that have a field of that name" — bu yerda nom maydoni o'tkazib yuborilmaydi: `fieldColumns([{id: 1, fields: [...]}, {id: 2, fields: [...]}])` har maydonni ustun qiladi (jismoniy `F.I.Sh.` ham), tartib va harf farqsizlik avvalgidek.
  - `answersDefaults(fields, values?)`: `{f101: "", …, f105: []}`; qiymatlar bilan `{f101: "30", f104: "12", f105: ["11","13"]}`; `0` → `"0"`.
  - `readAnswers(fields, form, refuse)`: to'ldirilgan forma → `{101: 30, 102: "Ali Valiyev", 104: 12, 105: [13, 11]}`; bo'shlar tashlab yuboriladi; `refuse(path, message)` majburiy bo'sh va noto'g'ri son uchun chaqiriladi (`["f101", "«Yoshi» butun son bo'lishi kerak"]`), API xabarlari bilan.
  - `fieldKey({id: 7})` → `"f7"`.
- [ ] **Step 2: stub** — `lib/fields.ts`: nomlar eksport qilinadi, tanalari bo'sh (`kindLabels` bo'sh obyekt, `isChoice` → `false`, `answerText` → `""`, `fieldColumns` → `[]`, `answersDefaults` → `{}`, `readAnswers` → `{}`, `fieldKey` → `""`). Test yiqiladi.
- [ ] **Step 3: kod** — `customer-fields.ts` (`kindLabels`, `kinds`, `isChoice`) va `customers.ts` (`Answer` turi, `answerText`, `FieldColumn`, `fieldColumns` nom-maydonsiz, `fieldKey`, `isSeveral`, `MAX_TEXT`, `readAnswer`) `fields.ts` ga; yangi `answersDefaults(fields, values?)` (`formDefaults` ning `values` qismi) va `readAnswers(fields, entries, refuse)` (`customerSchema` ning sikl qismi: har maydon uchun `readAnswer`, bo'sh majburiy → `refuse`, xato → `refuse`, qolgani natijaga).
  - `lib/customers.ts`: `nameFieldOf` (`customer-fields.ts` dan), `customerName`, `fieldColumns(types) = fields.fieldColumns(types.map(t => ({id: t.id, fields: t.fields.filter(f => f !== nameFieldOf(t))})))`, `formDefaults(type, customer) = {phone, values: answersDefaults(type.fields, customer?.values)}`, `customerSchema` (telefon + `readAnswers(type.fields, form.values, (key, message) => context.addIssue({…path: ["values", key]}))`), `CustomerForm`, `CustomerOutput` turlari; `answerText`, `fieldKey` qayta eksport qilinmaydi — importerlar `lib/fields` dan oladi.
  - `customers.test.ts`: `answerText` testi o'chadi (fields'ga ko'chdi), `nameFieldOf` testi `customer-fields.test.ts` dan keladi; qolgani o'zgarmaydi.
  - Importerlar: `customer-form.tsx` (`isChoice`, `fieldKey` ← `lib/fields`), `customers-page.tsx` va `customer-page.tsx` (`answerText` ← `lib/fields`), `field-dialog.tsx` va `customer-type-page.tsx` (`isChoice`, `kindLabels`, `kinds` ← `lib/fields`; `nameFieldOf` ← `lib/customers`), `lib/schemas.ts` (`isChoice`, `kinds` ← `./fields`).
- [ ] **Step 4:** `pnpm --filter @hisob24/web exec vitest run lib/` o'tadi; keyin butun web suite. `pnpm --filter @hisob24/web typecheck`. Commit: `refactor(web): the field helpers move to lib/fields`.

### Task 6: `components/field-answer.tsx`

**Files:** Create `apps/web/components/field-answer.tsx`, `apps/web/components/field-answer.test.tsx`; Modify `apps/web/components/customers/customer-form.tsx`.

- [ ] **Step 1: test** — `field-answer.test.tsx`: `useForm({defaultValues: {customer: {values: {f3: "", f5: []}}}})` bilan kichik forma; `<FieldAnswer control name="customer.values.f3" field={dropdown} options={…} />` va `name="customer.values.f5"` checkbox guruhi; foydalanuvchi "LinkedIn" ni tanlaydi va "Rus" ni belgilaydi → `form.getValues()` `{customer: {values: {f3: "12", f5: ["22"]}}}` ("the answer lands at the path it is given"); ixtiyoriy maydon yonida "ixtiyoriy", majburiyda yo'q; tanlovsiz dropdown ostida "Faol variant yo'q…" izohi.
- [ ] **Step 2: stub** — `FieldAnswer` `null` qaytaradi → test yiqiladi.
- [ ] **Step 3: kod** — `customer-form.tsx` dagi `Labeled`, `NONE`, `option`, `Answer` → `field-answer.tsx`: `export function FieldAnswer<T extends FieldValues, TOut extends FieldValues = T>({ control, name, field, options }: { control: Control<T, unknown, TOut>; name: FieldPath<T>; field: CustomerField; options: CustomerOption[] })`; `Controller` `name={name}`. `customer-form.tsx` da `CustomerFields` har maydon uchun `<FieldAnswer control={control} name={`values.${fieldKey(field)}`} … />`.
- [ ] **Step 4:** `vitest run components/field-answer.test.tsx components/customers/` o'tadi; butun suite; typecheck. Commit: `refactor(web): FieldAnswer, one field's input at the form path it is given`.

### Task 7: `components/history-list.tsx`

**Files:** Create `apps/web/components/history-list.tsx`, `apps/web/components/history-list.test.tsx`; Modify `apps/web/components/customers/customer-history.tsx`.

- [ ] **Step 1: test** — `history-list.test.tsx`: `<HistoryList label="Tarix" entries={[created, updated]} />` → ro'yxat "Tarix" ikki yozuv: "Qo'shildi", "Vali Aliyev, 02.10.2026 11:01"; "Tahrirlandi" yozuvida `change` qatori "INN" `avval: 301234567` → `keyin: 301234568`; bo'sh qiymat "—"; ismsiz aktyor "—".
- [ ] **Step 2: stub** — `HistoryList` → `null`; test yiqiladi.
- [ ] **Step 3: kod** — `customer-history.tsx` dagi `actions`, `shown` va `<ol>` → `history-list.tsx` (`HistoryList({ label, entries }: { label: string; entries: CustomerHistoryEntry[] })`; `entries` turi `{id, action, actor_name, created_at, changes}` — `CustomerHistoryEntry` bilan bir xil shakl, 4-bosqichda `TaskHistoryEntry` ham shu). `CustomerHistory` so'rov, sarlavha, yuklanish va xato holatini saqlaydi, ro'yxatni `HistoryList` ga beradi.
- [ ] **Step 4:** `vitest run components/history-list.test.tsx components/customers/customer-page.test.tsx` o'tadi; butun suite; typecheck. Commit: `refactor(web): HistoryList shows what happened to a record`.

### Task 8: bosqich yakuni

- [ ] `make lint` (0 issues), `make test` (Go, web, admin, api-client), `make e2e` (admin, web) — hammasi o'tadi; sonlar yozib olinadi.
- [ ] `git push origin main`.
- [ ] Spec'ga "1-bosqich qarorlari" bo'limi: nima ko'chdi, nima qoldi, test sonlari.
