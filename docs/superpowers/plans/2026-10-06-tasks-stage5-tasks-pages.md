# Vazifalar, 5-bosqich: vazifalar sahifalari — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Har a'zo user app'da vazifalarni ro'yxat va kanban ko'rinishida ko'radi, qo'shadi (mavjud mijozni telefon takliflaridan tanlab yoki yangi mijoz bilan), tahrirlaydi, bosqichini sudrab yoki menyudan ko'chiradi, o'chiradi; vazifa sahifasi, mijoz sahifasidagi vazifalar; egasi tarixni ko'radi. Mock API Go API qoidalarini takrorlaydi; e2e ikki ko'rinishda o'tadi.

**Architecture:**
- **Mock API:** `mocks/tasks.ts` (7 route), `mocks/data.ts` ga `TaskRow`, `TaskHistoryRow`, `seedTasks`, `seedOrderType`, `localToday`; `mocks/customers.ts` ga `?phone=` va `customer_in_use`; `mocks/task-settings.ts` ga `stage_in_use`, `type_in_use`, `field_in_use`; `mocks/customer-settings.ts` ga `option_in_use` (vazifalar). Qoidalari `mocks/handlers.test.ts` da.
- **Lib:** `lib/types.ts` (`Task`, `TaskPage`, `TaskHistoryEntry`, …), `lib/queries.ts` (`useTasks`, `useStageTasks`, `useTask`, `useTaskHistory`, `useCustomerSuggestions`, `useMoveTask` + kalitlar), `lib/tasks.ts` (`deadlineOf`, forma turlari, `taskSchema`, `taskDefaults`), `lib/use-kept.ts` (brauzerda eslangan tanlov; `use-hidden-columns.ts` shundan quriladi va ro'yxat nomini oladi), `lib/nav.ts`.
- **Sahifalar:** `/tasks` (`tasks-page.tsx`: tur tablari, qidiruv, "Bosqich" va "Mas'ul" tanlovlari, ko'rinish tugmalari, ro'yxat `DataList` yoki kanban `task-board.tsx`), qo'shish dialogi (`task-dialog.tsx`, `task-form.tsx`, `customer-picker.tsx`), tahrirlash (`edit-task-dialog.tsx`), `/tasks/[id]` (`task-page.tsx`, `task-history.tsx`, `delete-task-button.tsx`), mijoz sahifasida `customer-tasks.tsx`; umumiy `deadline.tsx`, `stage-badge.tsx`.

**Tech Stack:** Next 16, shadcn (`base-nova`), TanStack Query (`useInfiniteQuery` kanban ustunlari uchun), react-hook-form + zod, dnd-kit (`useDraggable`, `useDroppable`, `DragOverlay`), Vitest + RTL + MSW, Playwright.

Qoidalar: `logic/tasks.md` (2, 4, 6, 7, 8-bo'limlar), `logic/customers.md` (6-bo'lim). Dizayn: `docs/superpowers/specs/2026-10-06-tasks-design.md` ("User app", 13–23-qarorlar, "4-bosqich qarorlari"), ko'rinish: `2026-10-04-crud-ui-refresh-design.md`.

---

## Kelishuvlar

- Testlar: `pnpm --filter @hisob24/web exec vitest run <fayl>`; har GREEN'dan keyin butun web suite, so'ng commit. Task oxirida typecheck va lint.
- Har xato testining o'z xabari (toast'lar testlar orasida qoladi); kutilayotgan tugmalar `aria-disabled`.
- Muddatning "bugun"i brauzerning lokal sanasi: mock seed'lari muddatni `localToday()` dan hisoblaydi (`TODAY` obuna uchun qoladi); testlar ham shundan.
- Har xil jadval ID'lari ustma-ust tushishi mumkin: mock'da `nextId()` umumiy, lekin testlar ID'ni nom orqali oladi.
- Sahifa kodidan oldin `apps/web/node_modules/next/dist/docs/` dagi tegishli qo'llanma o'qiladi (`AGENTS.md`); yangi route'lar `app/(app)/tasks/page.tsx` va `[id]/page.tsx` mijozlardagi namunada.
- Skrinshotlar vaqtinchalik `e2e/*.tmp.spec.ts` bilan, commit'dan oldin o'chiriladi.

## Matnlar

| Qayerda | Matn |
|---|---|
| Bo'lim | "Vazifalar" (`/tasks`, `ListTodoIcon`), Mijozlardan keyin, hammaga |
| Sahifa | "Vazifalar", izoh "Kompaniyangiz vazifalari" (+ " · N ta" filtrsiz), tugma "Vazifa qo'shish" |
| Asboblar | tablar "Barchasi" + turlar; qidiruv "Nomi, mijoz yoki telefon" (`aria-label` "Qidirish"); "Bosqich" tanlovi ("Barcha bosqichlar" + bosqichlar; faqat ro'yxatda); "Mas'ul" tanlovi ("Barcha mas'ullar", "Men", hozirgi a'zolar); ko'rinish `radiogroup` "Ko'rinish": "Ro'yxat", "Kanban"; "Ustunlar" (faqat ro'yxatda) |
| Ro'yxat ustunlari | "Vazifa" (nom, havola), "Mijoz" (nom yoki telefon, ostida telefon; havola mijozga), "Turi" (faqat "Barchasi" da), "Bosqich", "Muddat", "Mas'ul", maydonlar, "Qo'shgan", "Qo'shilgan" |
| Muddat | `dd.mm.yyyy` va "Bugun" / "N kun qoldi" / "N kun kechikdi"; yakuniy bosqichda faqat sana; muddati o'tgan va yakuniy emas: `text-destructive` |
| Bo'sh holatlar | "Hali vazifa yo'q" ("Birinchi vazifani «Vazifa qo'shish» tugmasi orqali qo'shing."), "Vazifalar topilmadi" ("Qidiruv yoki filtrni o'zgartirib ko'ring."); bosqich yo'q: "Bosqichlar yo'q" (egasiga "Vazifa qo'shish uchun avval Sozlamalarda bosqich yarating." + "Sozlamalarni ochish"; xodimga "Kompaniya egasi bosqichlarni sozlashi kerak."); tur yo'q: "Vazifa turlari yo'q" (egasiga "Vazifa qo'shish uchun avval Sozlamalarda tur yarating.", xodimga "Kompaniya egasi vazifa turlarini sozlashi kerak.") |
| Kanban | ustun sarlavhasi: nuqta, nom, soni; "+" tugmasi `aria-label` "Vazifa qo'shish: <bosqich>"; yig'ilgan yakuniy ustun tugmasi "<bosqich> (N)" `aria-expanded`; "Yana" tugmasi; "Jami: N"; bo'sh ustun "Vazifa yo'q"; kartada "Bosqich: <nom>" menyusi (bosqichlar `menuitemradio`); e'lon "«<nom>» «<bosqich>» bosqichiga ko'chirildi"; rad: toast xabari, karta qaytadi |
| Qo'shish dialogi | "Vazifa qo'shish" ("Turni tanlang, mijozni biriktiring va vazifani to'ldiring."); `radiogroup` "Vazifa turi"; `fieldset` "Mijoz": `radiogroup` "Mijoz turi", "Telefon raqami" (combobox; `listbox` "Mijoz takliflari"), mijoz maydonlari; "Mavjud mijoz" kartasi (nom, telefon, tur; havola "Mijozni ochish"; tugma "Boshqa mijoz"); mijoz turi yo'q: "Mijoz turlari yo'q: faqat mavjud mijozni biriktirish mumkin."; `fieldset` "Vazifa": "Nomi", "Muddat" (`type="date"`), "Bosqich", "Mas'ul" ("Tanlanmagan" + a'zolar; "Ism (chiqarilgan)"), maydonlar; tugma "Qo'shish"; toast "Vazifa qo'shildi" |
| Rad (409 `phone_taken`) | xabar + tugma "Shu mijozni biriktirish" + havola "Mijozni ochish" |
| Tahrirlash | "Vazifani tahrirlash" ("<Tur> · mijoz va tur o'zgarmaydi"); "Saqlash"; toast "Vazifa saqlandi" |
| Vazifa sahifasi | orqaga "Vazifalar"; izoh "<Tur> · <Bosqich> · <muddat>"; "Tahrirlash", "O'chirish", tanlov "Bosqich" (toast "Bosqich o'zgartirildi"); bo'limlar "Mijoz", "Ma'lumot" (Nomi, Muddat, Bosqich, Mas'ul, maydonlar, Qo'shgan, Qo'shilgan), "Tarix"; "Vazifa topilmadi" ("Bu vazifa o'chirilgan yoki sizning kompaniyangizniki emas.") |
| O'chirish | "Vazifani o'chirasizmi?" ("«<nom>» vazifalar ro'yxatidan olib tashlanadi. Qayta tiklab bo'lmaydi."); toast "Vazifa o'chirildi" |
| Mijoz sahifasi | bo'lim "Vazifalar": ustunlar "Vazifa", "Bosqich", "Muddat"; "Jami: N"; "Bu mijozda vazifa yo'q" |
| Sxema xabarlari | API'niki: "Vazifa nomini kiriting", "Vazifa nomi 200 belgidan oshmasin", "Muddatni kiriting", "Bosqichni tanlang", "Mijozni tanlang", "Telefon raqamini to'liq kiriting", maydon xabarlari |

## Fayl tuzilmasi

| Fayl | Vazifa |
|---|---|
| `mocks/data.ts`, `mocks/tasks.ts`, `mocks/customers.ts`, `mocks/task-settings.ts`, `mocks/customer-settings.ts`, `mocks/handlers.ts` (+`handlers.test.ts`) | mock API |
| `lib/types.ts`, `lib/queries.ts`, `lib/tasks.ts` (+test), `lib/use-kept.ts` (+test), `lib/use-hidden-columns.ts` (+test), `lib/nav.ts` (+test, `sidebar.test.tsx`, `proxy.test.ts`) | turlar, so'rovlar, muddat va sxema, eslangan tanlovlar, bo'lim |
| `components/tasks/deadline.tsx` (+test), `stage-badge.tsx` | muddat va bosqich belgisi |
| `components/tasks/use-task-filter.ts`, `tasks-page.tsx` (+test), `app/(app)/tasks/page.tsx` | ro'yxat sahifasi |
| `components/tasks/task-board.tsx`, `task-card.tsx`, `stage-menu.tsx` (+`task-board.test.tsx`) | kanban |
| `components/tasks/task-dialog.tsx`, `task-form.tsx`, `customer-picker.tsx` (+`task-dialog.test.tsx`, `customer-picker.test.tsx`) | qo'shish |
| `components/tasks/edit-task-dialog.tsx`, `task-page.tsx`, `task-history.tsx`, `delete-task-button.tsx` (+`task-page.test.tsx`), `app/(app)/tasks/[id]/page.tsx` | vazifa sahifasi |
| `components/customers/customer-tasks.tsx`, `customer-page.tsx` (+test) | mijozning vazifalari |
| `e2e/tasks.spec.ts`, `README.md` | e2e, hujjat |

---

### Task 1: Mock API

- [ ] **Test** (`mocks/handlers.test.ts`, +6): (1) a'zo mavjud mijoz bilan vazifa qo'shadi va o'qiydi (`customer {id, phone, name}`, `assignee {phone, full_name}`, `deadline`, `values`, `created_by_name`); yangi mijoz bilan bitta so'rovda (mijoz yoziladi, tarixi "created"); takror telefon 409 `phone_taken` `customer_id` bilan, vazifa ham mijoz ham yozilmaydi; tekshiruv tartibi va xabarlari (nom, muddat, tur, bosqich, mas'ul, maydon, mijoz; `customer: {}` → "Mijozni tanlang"); (2) ro'yxat: muddat bo'yicha (bir kunlilar `id` bo'yicha), 20 tadan, `type_id`, `stage_id`, `assignee` (noto'g'ri → "Mas'ul noto'g'ri"), `customer_id`, `search` (nom, vazifa matni, mijoz nomi; raqam → telefon, son javobi), noto'g'ri param xabarlari; (3) tahrir: hamma maydon almashadi, mijoz va tur qoladi, o'zgarishsiz saqlash tarixga yozilmaydi, chiqarilgan mas'ul o'zgartirilmasa qoladi; tarix tartibi va `changes` (Nomi, Muddat `dd.mm.yyyy`, Bosqich, Mas'ul, maydonlar), egasiga 200, xodimga 403; (4) ko'chirish: `PATCH …/stage`, o'sha bosqich hech narsa yozmaydi, boshqa kompaniya bosqichi 400 "Bosqichni tanlang"; (5) o'chirish: 204, keyin 404 "Vazifa topilmadi", ro'yxatdan chiqadi, tarixi 404; (6) ishlatilayotgan narsa: `customer_in_use` ("Bu mijozda 1 ta vazifa bor"), `stage_in_use`, `type_in_use`, `field_in_use`, `option_in_use` (vazifalar; mijozlar birinchi), o'chirilgan vazifa sanalmaydi; `GET /app/customers?phone=` prefiks (998 dan keyingi raqamlar, 1–9 ta; `abc` → 400 "Telefon raqami noto'g'ri").
- [ ] **RED** → **Kod:** `data.ts` (`TaskRow {id, companyId, typeId, stageId, customerId, title, deadline, assignee, assigneeName, values, by, byName, createdAt, updatedAt, deleted?}`, `TaskHistoryRow`, `db.tasks`, `db.taskHistory`, `localToday()`, `customerNameOf(customer)`, `seedTasks()` — Olma Savdo'ga `seedCustomers()` dan keyin: "Qo'ng'iroq qilish" (Dilshod, Yangi, 3 kundan keyin, mas'ul Vali, Ali qo'shgan), "Shartnoma yuborish" (Anor Tekstil, Jarayonda, bugun, mas'ulsiz, Vali), "Hisob-faktura" (Malika, Yangi, 2 kun kechikkan, Sardor), "Eski buyurtma" (Dilshod, Bajarildi, 5 kun kechikkan, Ali); `seedOrderType()` — Olma Savdo'ga tur "Buyurtma": Izoh (matn, majburiy), Summa (son), Kanal (checkbox, Manba)); `tasks.ts` (`toTask`, `checkTask`, `found`, 7 handler; `values` tekshiruvi `customers.ts` dagi `checkValues` bilan — uni `readAnswer`/`checkValues` eksport qilib qayta ishlatish); `customers.ts` (`?phone=`, `customer_in_use`); `task-settings.ts` (uch `*_in_use`); `customer-settings.ts` (`option_in_use` vazifalar); `handlers.ts`. → **GREEN**, commit `feat(web): the tasks in the mock API`.

### Task 2: lib

- [ ] **Test:** `lib/tasks.test.ts`: `deadlineOf(deadline, done, today)` → `{date: "dd.mm.yyyy", relative, overdue}`: bugun → "Bugun", +1 → "1 kun qoldi", +12 → "12 kun qoldi", −1 → "1 kun kechikdi" `overdue`, yakuniy → `relative: null`, `overdue: false`; `taskSchema(type, customerType, linked)`: nom (bo'sh, 200 belgi — belgi sifatida), muddat bo'sh, bosqich bo'sh, mas'ul "" → `null`, maydon xabarlari (vazifa va mijoz), `linked=true` da mijoz qismi tekshirilmaydi va natija `customer: {id}`, `linked=false` da `{type_id, phone, values}` va telefon "Telefon raqamini to'liq kiriting", `customerType=null` va `linked=false` → "Mijozni tanlang"; `taskDefaults` (bo'sh muddat, mas'ul "", bosqich: berilgani yoki birinchisi; tahrirda vazifaniki). `lib/use-kept.test.tsx`: `useKept(key)` → `[value, set]`, boshqa oynadan o'zgarish, buzilgan storage. `lib/use-hidden-columns.test.tsx` (+1): `useHiddenColumns(1, phone, "tasks")` kaliti `tasks_hidden_columns:…`, mijozlarniki bilan aralashmaydi. `lib/nav.test.ts`, `components/shell/sidebar.test.tsx`, `proxy.test.ts`: "Vazifalar" hammaga, Mijozlardan keyin; `/tasks`, `/tasks/7` himoyalangan.
- [ ] **RED** → **Kod:** `lib/types.ts` (+`Task`, `TaskPage`, `TaskHistoryEntry`, `TaskCustomer`, `TaskAssignee`, `TaskCreate`, `TaskUpdate`), `lib/tasks.ts` (`todayISO`, `deadlineOf`, `TaskForm {title, deadline, stage_id, assignee_phone, values, customer: {type_id, phone, values}}`, `TaskOutput`, `taskSchema`, `taskDefaults`, `fieldColumns` turlar uchun `lib/fields.ts` dan to'g'ridan), `lib/use-kept.ts`, `lib/use-hidden-columns.ts` (`list` parametri, default "customers"), `lib/nav.ts`, `lib/queries.ts` (`tasksKey`, `TaskFilter {search, typeId, stageId, assignee, customerId, page}`, `useTasks`, `useStageTasks` (`useInfiniteQuery`, `initialPageParam: 1`, `getNextPageParam`), `taskKey`, `useTask`, `taskHistoryKey`, `useTaskHistory`, `useCustomerSuggestions(companyId, digits)` (3+ raqamda, `?phone=`), `useMoveTask(companyId)` — `PATCH …/stage`, `onSuccess`: `taskKey` yangilanadi, `tasksKey` qayta so'raladi; `onError`: `tasksKey` qayta, 400 bo'lsa `taskStagesKey` ham). → **GREEN**, commit `feat(web): the tasks lib, the section and the kept choices`.

### Task 3: Muddat, bosqich belgisi, ro'yxat sahifasi

- [ ] **Test:** `components/tasks/deadline.test.tsx`: sana va nisbiy matn, muddati o'tgan qizil (`text-destructive`), yakuniyda faqat sana, ekran o'quvchiga bitta matn. `components/tasks/tasks-page.test.tsx` (ro'yxat, `?view=list`): sarlavha va soni; ustunlar (Vazifa, Mijoz, Turi, Bosqich, Muddat, Mas'ul, maydonlar, Qo'shgan, Qo'shilgan); tartib muddat bo'yicha; "Mijoz" ustunidagi havola `/customers/[id]`, "Vazifa" havolasi `/tasks/[id]`; tur tabida "Turi" yo'q va maydonlar shu turniki; "Bosqich" va "Mas'ul" tanlovlari manzilda (`?stage=`, `?assignee=`), qidiruv `?search=`; "Men"; "Ustunlar" (kalit `tasks_hidden_columns`); bo'sh holatlar; bosqich yo'q / tur yo'q (egasiga havola, xodimga matn); yuklanmadi → qayta urinish; ko'rinish tugmalari `?view=` ni o'zgartiradi va eslaydi (`tasks_view:…`); `?view` yo'q va eslanmagan → kanban (Task 4 gacha kanban `TaskBoard` stub'i "Kanban" matnini chiqaradi).
- [ ] **RED** → **Kod:** `deadline.tsx`, `stage-badge.tsx` (`colorClasses[color].badge`), `use-task-filter.ts` (`view`, `type`, `search`, `stage`, `assignee`, `page`), `tasks-page.tsx` (mijozlar sahifasi namunasida; `TaskBoard` stub), `app/(app)/tasks/page.tsx`. → **GREEN**, commit `feat(web): the tasks list`.

### Task 4: Kanban

- [ ] **Test** (`components/tasks/task-board.test.tsx`): ustunlar bosqich tartibida, sarlavhada soni; kartalar muddat bo'yicha (nom havolasi, mijoz, muddat, mas'ul, "Barchasi" da tur); yakuniy ustun yig'ilgan (`aria-expanded=false`, "Bajarildi (1)"), ochilsa kartalar va holat eslanadi (`tasks_board_open:…`); "Yana" ikkinchi sahifani qo'shadi (21 vazifa), "Jami: N"; kartaning "Bosqich" menyusi (`menuitemradio`, hozirgisi belgilangan) → `PATCH`, karta yangi ustunda o'z o'rnida, e'lon matni; rad (bosqich o'chirilgan: 400) → karta qaytadi, toast, bosqichlar qayta so'raladi; tur, qidiruv va mas'ul filtrlari ustunlarga ta'sir qiladi; "+" sarlavhada dialogni shu bosqich bilan ochadi (`AddTaskDialog` `stageId`; dialog Task 5 da — bu testda tugma `onAdd(stageId)` ni chaqirishi tekshiriladi); bo'sh ustun "Vazifa yo'q"; bosqich yo'q holati sahifada (Task 3).
- [ ] **RED** → **Kod:** `task-board.tsx` (`DndContext` sensorlari `SortableList` dagidek; `useDroppable` ustun, `useDraggable` karta, `DragOverlay`; `onDragEnd` → `useMoveTask`; optimistik: `setQueryData` ikki ustun keshi (eskisidan olib, yangisiga muddat tartibida qo'yish, `total` ±1), xato bo'lsa qayta so'rash; `aria-live` e'lon; yig'ilgan ustun `useKept`), `task-card.tsx`, `stage-menu.tsx` (`DropdownMenu` + `DropdownMenuRadioGroup`). → **GREEN**, commit `feat(web): the task board`.

### Task 5: Qo'shish dialogi va mijoz tanlash

- [ ] **Test:** `components/tasks/customer-picker.test.tsx`: 3 raqamgacha so'rov yo'q; 300 ms pauzadan keyin `?phone=<raqamlar>` (fetch kuzatiladi); `listbox` 5 tagacha (nom yoki telefon, telefon, tur); strelkalar `aria-activedescendant`, Enter tanlaydi, Escape yopadi, bosish tanlaydi; tanlangach `onSelect(customer)`. `components/tasks/task-dialog.test.tsx`: dialog `sm:max-w-3xl`, tepada "Vazifa turi" (bitta turda yo'q), chapda "Mijoz" (`fieldset`), o'ngda "Vazifa"; bosqich: berilgani yoki birinchisi, muddat bo'sh, mas'ul "Tanlanmagan"; yangi mijoz bilan yuborish → `POST /app/tasks` tanasi `customer: {type_id, phone, values}`, toast, ro'yxat/kanban yangilanadi; taklifdan tanlash → mijoz turi va maydonlar to'ldirilgan va `disabled`, "Mavjud mijoz" kartasi, "Boshqa mijoz" yechadi; tanlangan mijoz bilan yuborish → `customer: {id}`, bog'langan mijozning maydonlari tekshirilmaydi (majburiy bo'sh maydon to'sqinlik qilmaydi); xatolar bir vaqtda (nom, muddat, mijoz telefoni, maydon); 409 `phone_taken` → "Shu mijozni biriktirish" (GET mijoz → tanlangan holat) va "Mijozni ochish"; mijoz turi yo'q → faqat mavjud mijoz, matn; chiqarilgan mas'ul tahrirda "(chiqarilgan)" (Task 6 da).
- [ ] **RED** → **Kod:** `customer-picker.tsx` (`role="combobox"`, `aria-expanded`, `aria-controls`, `aria-activedescendant`, `InputGroup` +998; `useCustomerSuggestions`), `task-form.tsx` (`TaskFields`: o'ng ustun; `CustomerSection`: chap ustun, `linked` holati; `TaskRefusal`), `task-dialog.tsx` (`AddTaskDialog({companyId, types, stages, customerTypes, dropdowns, members, typeId, stageId, trigger?})`, `DialogContent className="sm:max-w-3xl"`, `md:grid-cols-2`), `tasks-page.tsx` va `task-board.tsx` ga ulash. → **GREEN**, commit `feat(web): the task dialog with the customer picker`.

### Task 6: Vazifa sahifasi, tahrirlash, o'chirish, tarix

- [ ] **Test** (`components/tasks/task-page.test.tsx`): sarlavha, izoh "<Tur> · <Bosqich> · <muddat>" (muddati o'tgan qizil), orqaga; "Mijoz" bo'limi (`Identity`, havola); "Ma'lumot" juftliklari tartibda (Nomi, Muddat, Bosqich, Mas'ul, maydonlar, Qo'shgan, Qo'shilgan; bo'shi "—"); "Bosqich" tanlovi → `PATCH`, toast, izoh yangilanadi; "Tarix" faqat egasiga (yozuvlar, `changes`); 404 "Vazifa topilmadi"; yuklanmadi. `edit-task-dialog.test.tsx`: forma vazifaning qiymatlari bilan, mijoz kartasi (tanlab bo'lmaydi), tur o'zgarmaydi (izoh), chiqarilgan mas'ul "Ism (chiqarilgan)" tanlangan, saqlash → `PUT`, sahifa yangilanadi, toast; bo'sh qoldirilgan javob o'chadi; xato xabari. `delete-task-button` (sahifa testida): tasdiq, 204 → `/tasks`, toast; rad toast.
- [ ] **RED** → **Kod:** `task-page.tsx` (`Fact` mijoz sahifasidan umumiy `components/facts.tsx` ga ko'chadi, mijoz sahifasi ham undan), `task-history.tsx` (`HistoryList`), `edit-task-dialog.tsx`, `delete-task-button.tsx`, `app/(app)/tasks/[id]/page.tsx` (metadata "Vazifa — Hisob24"). → **GREEN**, commit `feat(web): the task page`.

### Task 7: Mijoz sahifasidagi vazifalar

- [ ] **Test** (`components/customers/customer-page.test.tsx`, +2): "Vazifalar" bo'limi (Vazifa havolasi, Bosqich, Muddat; muddat bo'yicha; "Jami: N"), vazifasiz "Bu mijozda vazifa yo'q"; vazifasi bor mijozni o'chirish rad'i toast'da ("Bu mijozda 1 ta vazifa bor"), mijoz qoladi.
- [ ] **RED** → **Kod:** `customer-tasks.tsx` (`useTasks(companyId, {customerId, page})`, `DataList`, `Pager` 20 dan ko'p bo'lsa), `customer-page.tsx`. → **GREEN**, commit `feat(web): a customer's tasks on its page`.

### Task 8: e2e, README, ko'rik

- [ ] **e2e** (`e2e/tasks.spec.ts`, telefon va desktop): (1) xodim yangi mijoz bilan vazifa qo'shadi: kanban ochiladi (default), karta "Yangi" da, muddat nisbiy matn bilan; ro'yxat ko'rinishiga o'tadi va qaytadi (eslangan); (2) ikkinchi vazifada telefonning 3 raqami yoziladi, taklifdan mijoz tanlanadi (maydonlar to'ldirilgan va `disabled`), yuboriladi; (3) kanban: "+" shu bosqich tanlangan dialogni ochadi; karta menyu bilan (telefon) yoki sudrab (desktop, `page.mouse`) "Bajarildi" ga; yakuniy ustun yig'ilgan — ochilsa karta ko'rinadi; muddati o'tgan vazifa qizil "N kun kechikdi"; (4) egasi tahrirlaydi, tarixni ko'radi ("Bosqich", "Nomi"), mijoz sahifasida vazifani ko'radi, vazifasi bor mijozni o'chira olmaydi (toast), vazifani o'chiradi; `sideScroll` har sahifada 0.
- [ ] **README** "Vazifalar" bo'limi (Mijozlardan keyin): bo'limlar jadvali, doimiy maydonlar, bosqich va kanban, mijoz takliflari, o'chirish qoidalari, tarix; `logic/tasks.md` havolasi. `logic/tasks.md` holati o'zgarmaydi (6-bosqichda).
- [ ] **Ko'rik:** vaqtinchalik skrinshot spec'i (375px va desktop, light va dark: ro'yxat, kanban (yig'ilgan va ochiq ustun, sudrash overlay'i), qo'shish dialogi (taklif ro'yxati, bog'langan mijoz), vazifa sahifasi, mijoz sahifasi); rang belgilarining kontrasti; commit'dan oldin o'chiriladi.
- [ ] `make lint`, `make test`, `make e2e`; commit `test(web): e2e for the tasks`; `git push origin main`; spec'ga "5-bosqich qarorlari".
