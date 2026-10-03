# Xodimlar, 4-bosqich: Xodimlar sahifasi — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Owner user app'dagi "Xodimlar" sahifasida kompaniya a'zolarini ko'radi, xodim qo'shadi, ismini tahrirlaydi va o'chiradi. `user` rolidagi a'zo sahifaga kira olmaydi.

**Architecture:**
- `app/(app)/employees/page.tsx` → `EmployeesPage` (qobiq ichida). Ro'yxat `GET /app/employees` dan (`["employees", companyId]` kaliti: kompaniya almashsa eski ro'yxat ko'rinmaydi).
- Qo'shish va tahrirlash `Dialog` + rhf + zod, o'chirish `AlertDialog`. Mutatsiyadan keyin ro'yxat invalidate qilinadi.
- Telefon maydoni (`+998` yonida) login'dagi `PhoneStep` dan `PhoneField` ga ajratiladi va ikkala joyda ishlatiladi.
- Mock API (`mocks/`) Go API bilan bir xil qoidalarda `/app/employees` ni beradi; a'zolik ismi mock'da ham a'zolikda.

**Tech Stack:** Next 16, shadcn (`base-nova`), TanStack Query, react-hook-form + zod, Vitest + RTL + MSW, Playwright.

Qoidalar: `logic/user.md` (3, 5, 6-bo'limlar), `logic/roles.md` (4, 7-bo'limlar).

---

## Kelishuvlar

- Testlar: `pnpm --filter @hisob24/web exec vitest run <fayl>`; har GREEN'dan keyin butun web suite, typecheck, lint, so'ng commit.
- Matnlar: sarlavha "Xodimlar"; tugma "Xodim qo'shish"; dialoglar "Xodim qo'shish", "Ismni o'zgartirish", "Xodimni o'chirasizmi?"; toastlar "Xodim qo'shildi", "Ism o'zgartirildi", "Xodim o'chirildi"; rollar "Egasi", "Xodim"; o'z qatori "Siz".

## Fayl tuzilmasi

| Fayl | Vazifa |
|---|---|
| `components/ui/{dialog,alert-dialog,table}.tsx`, `components/{data-list,text-field}.tsx` | admin'dan nusxa (+ `dialog.test.tsx`, `data-list.test.tsx`) |
| `mocks/data.ts`, `mocks/handlers.ts` | a'zolik ismi va vaqti; `/app/employees` (GET, POST, PATCH, DELETE) |
| `components/phone-field.tsx` | `+998` maydoni; `login/phone-step.tsx` shuni ishlatadi |
| `lib/schemas.ts` (+test) | `employeeSchema`, `renameSchema` |
| `lib/queries.ts`, `lib/types.ts` | `useEmployees(companyId)`, `employeesKey`, `Member` |
| `components/employees/employees-page.tsx` (+test) | ro'yxat, rol darvozasi |
| `components/employees/add-employee-dialog.tsx` | qo'shish |
| `components/employees/rename-employee-dialog.tsx` | ismni tahrirlash |
| `components/employees/remove-employee-button.tsx` | tasdiq bilan o'chirish |
| `app/(app)/employees/page.tsx`, `proxy.test.ts` | sahifa; `/employees` ham himoyalangan |
| `e2e/employees.spec.ts` | oqimlar |
| `README.md`, `logic/*.md` holati | hujjat |

---

### Task 1: Poydevor

- [ ] UI nusxalari: `dialog` (+test "Yopish"), `alert-dialog`, `table`, `data-list` (+test), `text-field`. Testlar nusxa bilan birga keladi va o'tadi (admin'da RED → GREEN bo'lgan kod). Commit: `feat(web): dialog, alert dialog, table and the data list`
- [ ] **RED** `lib/api.test.ts` "the employees API of the mock answers as the Go API does": owner ro'yxatni oladi (owner birinchi, a'zolik ismlari); xodim → 403 `owner_only`; qo'shish 201, qayta qo'shish 409; tahrir 200, owner → 409; o'chirish 204, yo'q → 404. Hozir: handler yo'q (MSW `onUnhandledRequest: error`). **GREEN**: `mocks/data.ts` (a'zolik `fullName`, `joinedAt`; `membersOf`), `mocks/handlers.ts`. `/app/me` ismi a'zolikdan. Commit: `test(web): the mock API serves /app/employees as the Go API does`
- [ ] **Refactor** `PhoneField`: `phone-step.tsx` dagi maydon `components/phone-field.tsx` ga; login testlari yashil qoladi. Commit: `refactor(web): the phone field on its own, for the login and the employees`
- [ ] **RED** `lib/schemas.test.ts`: `employeeSchema` `{phone: "90 222 33 44", full_name: " Vali "}` → `{phone: "998902223344", full_name: "Vali"}`; to'liq bo'lmagan raqam → "Telefon raqamini to'liq kiriting"; bo'sh ism → "Ismni kiriting"; `renameSchema` ismni trim qiladi. **GREEN**. Commit: `feat(web): the employee forms' schemas`

### Task 2: Ro'yxat (3 sikl)

- [ ] **RED** `employees-page.test.tsx`: owner (Ali) sarlavha va jadvalni ko'radi: `[+998 90 123 45 67, Ali Valiyev, Egasi Siz]`, keyin xodimlar; yuklanayotganda "Yuklanmoqda". Stub `return null`. **GREEN**: `useEmployees`, `DataList`. Commit: `feat(web): the employees page lists the company's members`
- [ ] **RED** xodim (Vali, Olma Savdo) `/` ga qaytariladi, ro'yxat so'ralmaydi va ko'rsatilmaydi. **GREEN**. Commit: `feat(web): the employees page is the owner's`
- [ ] **RED** yuklash yiqilsa sabab va "Qayta urinish"; faqat owner bo'lsa "Hali xodim yo'q" izohi. **GREEN**. Commit: `feat(web): the employees page says why it failed, and when there is nobody yet`

### Task 3: Qo'shish (2 sikl)

- [ ] **RED**: "Xodim qo'shish" → dialog → telefon `90 777 88 99`, ism → "Qo'shish" → dialog yopiladi, toast "Xodim qo'shildi", jadvalda yangi qator "Xodim". **GREEN**: `add-employee-dialog.tsx`. Commit: `feat(web): add an employee from the page`
- [ ] **RED**: bo'sh forma → "Telefon raqamini to'liq kiriting", "Ismni kiriting"; o'z raqami → API xabari "Bu raqam kompaniyangizga allaqachon qo'shilgan" dialog ichida, dialog ochiq qoladi. **GREEN**. Commit: `feat(web): the add-employee dialog says what is wrong`

### Task 4: Tahrirlash (1 sikl)

- [ ] **RED**: "Ismni o'zgartirish: Vali Aliyev" → dialog hozirgi ism bilan → yangi ism → "Saqlash" → toast "Ism o'zgartirildi", jadvalda yangi ism; owner qatorida tugma yo'q. **GREEN**: `rename-employee-dialog.tsx`. Commit: `feat(web): rename an employee`

### Task 5: O'chirish (1 sikl)

- [ ] **RED**: "O'chirish: Vali Aliyev" → `alertdialog` "Xodimni o'chirasizmi?" → "O'chirish" → toast "Xodim o'chirildi", qator yo'q; "Bekor qilish" hech narsani o'zgartirmaydi; owner qatorida tugma yo'q. **GREEN**: `remove-employee-button.tsx`. Commit: `feat(web): remove an employee, after asking`

### Task 6: Sahifa va e2e

- [ ] **RED** `proxy.test.ts`: `/employees` sessiyasiz `/login` ga (matcher allaqachon qamraydi: xarakteristika). `app/(app)/employees/page.tsx`. Commit: `feat(web): /employees`
- [ ] `e2e/employees.spec.ts` (375px + desktop):
  - owner xodim qo'shadi → chiqadi → xodim kiradi: "Salom, <ism>", "Xodimlar" bo'limi yo'q, `/employees` → `/`;
  - owner boshqa kompaniyada bor raqamni qo'shadi → u kirganda `/select-company`, Olma Savdo'da owner bergan ism;
  - owner ismni o'zgartiradi va xodimni o'chiradi; o'chirilgan xodim (yagona kompaniyasi) kod bilan kira olmaydi;
  - sessiyasi ochiq xodim o'chirilsa, sahifani yangilaganda `/login` ga tushadi;
  - `/employees` da yon scroll yo'q; telefonda ro'yxat kartochka, desktop'da jadval.
- [ ] Commit: `test(web): e2e for the employees page`

### Task 7: Yakun

- [ ] `README.md`: "Rollar va xodimlar" (qisqa, `logic/` ga havola); `logic/*.md` va dizayn hujjatida holat "amalga oshirilgan".
- [ ] `make lint` → `make test` → `make e2e`.
- [ ] curl (real stack): owner SMS bilan kiradi → `/employees` sahifasi 200 → API orqali qo'shish, tahrirlash, o'chirish; xodim 403; sessiyasiz `/employees` → `/login`.
- [ ] `git push origin main`; yakuniy hisobot.

## Self-review

- Spec qamrovi: ro'yxat va rol darvozasi (T2), qo'shish (T3), tahrirlash (T4), o'chirish (T5), multi-user va kira olmaslik (T6 e2e), Mini App'ga moslik: sahifa qobiq ichida, dialoglar telefonda ishlaydi (e2e 375px).
- Nomlar izchil: `useEmployees`, `employeesKey`, `employeeSchema`, `renameSchema`, `PhoneField`, `EmployeesPage`, `AddEmployeeDialog`, `RenameEmployeeDialog`, `RemoveEmployeeButton`.
