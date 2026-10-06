# Select'lar shadcn'ga, sozlamalar tablarga, pager raqamli — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** User app'dagi hamma select shadcn (Base UI) Select bo'ladi (ko'p tanlov ham); `/settings` uch tabga bo'linadi (Mijozlar, Vazifalar, Dropdownlar), tab manzilda; `Pager` ikkala ilovada enwin kabi raqamli sahifalar va "{total} tadan {count} ta ko'rsatilmoqda" matni bilan, bir sahifada faqat "Jami: N".

**Architecture:**
- **Pager (web + admin, bayt-bir xil):** `components/ui/pagination.tsx` (shadcn base-nova, tugmalar `<a>` emas), `components/pager.tsx` (`pageNumbers`, `Pager`), `components/pager.test.tsx`.
- **Sozlamalar:** `components/settings/use-settings-tab.ts` (`useSettingsTab`, `settingsHref`), `settings-page.tsx` tablar bilan; orqaga havolalar `task-type-page.tsx`, `dropdown-page.tsx`; `tasks-page.tsx` dagi havola.
- **Select:** `components/ui/select.tsx` (admin'dan nusxa), `components/select-field.tsx` (`SelectBox`, `SelectField`, `MultiSelectBox`), `field-answer.tsx`, `settings/field-dialog.tsx`, `tasks/task-form.tsx`, `tasks/task-page.tsx`, `tasks/tasks-page.tsx`; `test/select.ts`; `e2e/helpers.ts` `choose`. `ui/native-select.tsx` ikkala ilovadan ketadi.

**Tech Stack:** Next 16, shadcn (`base-nova`) + Base UI, TanStack Query, react-hook-form + zod, Vitest + RTL + MSW, Playwright.

Dizayn: `docs/superpowers/specs/2026-10-06-selects-settings-tabs-pager-design.md`; ko'rinish: `2026-10-04-crud-ui-refresh-design.md`.

---

## Kelishuvlar

- TDD: har sikl avval test, RED natija, keyin kod, GREEN, butun suite, commit. Testlar: `pnpm --filter @hisob24/web exec vitest run <fayl>` (admin: `@hisob24/admin`).
- Talab o'zgargani uchun o'zgaradigan testlar avval yangi talabga moslanadi (RED), keyin kod (GREEN); hech biri o'chirilmaydi yoki `skip` qilinmaydi. Ro'yxati spec'ning oxirgi bo'limiga yoziladi.
- Umumiy fayllar ikkala ilovada bayt-bir xil: `pager.tsx`, `pager.test.tsx`, `ui/pagination.tsx`, `ui/select.tsx`.
- Backend va API o'zgarmaydi.

## Matnlar

| Qayerda | Matn |
|---|---|
| Pager, ko'p sahifa | "{total} tadan {count} ta ko'rsatilmoqda"; "Oldingi", "Keyingi" (aria-label); raqamlar; "Yana sahifalar" (sr-only); `nav` "Sahifalar" |
| Pager, bir sahifa | "Jami: N" |
| Sozlamalar tablari | "Mijozlar", "Vazifalar", "Dropdownlar"; `tablist` "Sozlamalar bo'limlari" |
| Select'lar | "Tanlanmagan", "Tanlang", "Barcha bosqichlar", "Barcha mas'ullar" |

---

### Task A1: Pager (web)

- [ ] **Test** `components/pager.test.tsx` (yangi): `pageNumbers` table-driven (3 → [1,2,3]; 6 sahifa: page 1 → [1,2,…,6], page 3 → [1,2,3,4,…,6], page 4 → [1,…,3,4,5,6], page 6 → [1,…,5,6]; 20 sahifa, page 10 → [1,…,9,10,11,…,20]); `Pager`: bir sahifa (7 / 20) → faqat "Jami: 7", `navigation` yo'q; page 2 / 85 → "85 tadan 20 ta ko'rsatilmoqda", "Oldingi", "Keyingi", raqamlar 1–5, "2" `aria-current="page"`, "3" → `onPage(3)`; page 5 → "85 tadan 5 ta ko'rsatilmoqda", "Keyingi" disabled; page 1 → "Oldingi" disabled; 20 sahifada "Yana sahifalar".
- [ ] **RED** (stub `pageNumbers`) → **Kod:** `ui/pagination.tsx`, `pager.tsx` → **GREEN**.

### Task A2: Pager talab o'zgargan testlar (web)

- [ ] `customers-page.test.tsx` (sahifalash testi: yangi matnlar, raqam bilan o'tish, `aria-current`), `tasks-page.test.tsx` (xuddi shunday). **RED** → `customer-tasks.tsx` soddalashadi → **GREEN**. Commit `feat(web): numbered pages in the pager`.

### Task A3: Pager (admin)

- [ ] `ui/pagination.tsx`, `pager.tsx`, `pager.test.tsx` web'dan nusxa; `companies-page.test.tsx` yangi matnlar va raqam bilan o'tish. **RED** → **GREEN**. Commit `feat(admin): numbered pages in the pager`.

### Task B1: `useSettingsTab`

- [ ] **Test** `use-settings-tab.test.ts`: `/settings` → `customers`; `?tab=tasks` → `tasks`; `?tab=x` → `customers`; `select("tasks")` → `router.replace("/settings?tab=tasks")`; `select("customers")` → `/settings`; `settingsHref`. **RED** → **Kod** → **GREEN**.

### Task B2: Sozlamalar tablari

- [ ] **Test** `settings-page.test.tsx`: mavjud testlar tabga moslanadi (`setLocation("/settings?tab=tasks")` / `?tab=dropdowns`); yangi: uch tab, default "Mijozlar", manzil tabni tanlaydi, tab bosilsa manzil o'zgaradi va boshqa panel DOM'da yo'q; "a list that fails" vazifalar tabida (`task-stages` yiqiladi, turlar turibdi). `task-type-page.test.tsx`, `dropdown-page.test.tsx`: orqaga `href`. `tasks-page.test.tsx`: "Sozlamalarni ochish" `href`.
- [ ] **RED** → **Kod:** `settings-page.tsx`, orqaga havolalar, `tasks-page.tsx` → **GREEN**. Commit `feat(web): the settings in tabs: customers, tasks and dropdowns`.

### Task B3: e2e sozlamalar

- [ ] `e2e/settings.spec.ts`: tablar bosiladi, orqaga o'z tabiga (`toHaveURL`), 375px da yon scroll yo'q. `make e2e` (web). Commit `test(web): the settings tabs in e2e`.

### Task C1: `SelectBox`, `SelectField`

- [ ] `ui/select.tsx` admin'dan nusxa. **Test** `select-field.test.tsx` (yangi): trigger `combobox` label bilan; ochilganda `listbox` va variantlar; variant → `onChange(value)`, trigger nomni aytadi; `empty` varianti "" beradi; `placeholder` variant emas; `disabled`; `aria-invalid`; `SelectField` RHF bilan (`getByLabelText`, xato). **RED** → **Kod** `select-field.tsx` → **GREEN**. Commit `feat(web): the select is shadcn's, on Base UI`.

### Task C2: `FieldAnswer`

- [ ] **Test** `field-answer.test.tsx` (`choose`, `optionsOf`; multi: `combobox` ochiladi, `aria-selected`, trigger "Instagram, LinkedIn"), `add-customer-dialog.test.tsx` (`menu` → `listbox`), `customer-page.test.tsx`. **RED** → **Kod** `field-answer.tsx` (`dropdown`, `multi_dropdown`) → **GREEN**. Commit `feat(web): the choice fields answer through the shadcn select`.

### Task C3: Maydon dialogi

- [ ] **Test** `customer-type-page.test.tsx`, `task-type-page.test.tsx` ("Turi" `toHaveTextContent("Matn")`, `choose`). **RED** → **Kod** `field-dialog.tsx` → **GREEN**. Commit `feat(web): the field dialog's kind and dropdown are selects`.

### Task C4: Vazifa formasi

- [ ] **Test** `task-dialog.test.tsx`, `edit-task-dialog.test.tsx`, `task-board.test.tsx`. **RED** → **Kod** `task-form.tsx` → **GREEN**. Commit `feat(web): the task form's stage and assignee are selects`.

### Task C5: Vazifa sahifasi va filtrlar

- [ ] **Test** `task-page.test.tsx`, `tasks-page.test.tsx`. **RED** → **Kod** `task-page.tsx`, `tasks-page.tsx`; `native-select.tsx` ikkala ilovadan o'chiriladi; `pnpm typecheck` → **GREEN**. Commit `feat(web): the stage and the filters are selects; the native select is gone`.

### Task C6: e2e select'lar

- [ ] `e2e/helpers.ts` `choose`; `customers.spec.ts`, `settings.spec.ts`, `tasks.spec.ts`. `make e2e`. Commit `test(web): the selects in e2e`.

### Yakun

- [ ] Skrinshotlar (vaqtinchalik e2e spec, 375px va desktop, light va dark); yon scroll yo'q; spec o'chiriladi.
- [ ] README (`/settings` tablari), spec'ning "o'zgargan testlar" bo'limi. Commit `docs: …`.
- [ ] `make lint`, `make test`, `make e2e` → `git push origin main` → hisobot.
