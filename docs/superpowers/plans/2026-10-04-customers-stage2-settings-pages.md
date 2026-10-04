# Mijozlar, 2-bosqich: Sozlamalar sahifalari — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Kompaniya egasi user app'dagi "Sozlamalar" bo'limida mijoz turlarini, ularning maydonlarini, dropdownlarni va variantlarni qo'shadi, nomlaydi, sudrab tartiblaydi va o'chiradi. Xodim bo'limni ko'rmaydi.

**Architecture:**
- `/settings` (`SettingsPage`): ikki ro'yxat. `/settings/customer-types/[id]` (`CustomerTypePage`): maydonlar. `/settings/dropdowns/[id]` (`DropdownPage`): variantlar.
- Ma'lumot `GET /app/customer-types` va `GET /app/customer-dropdowns` dan (`["customer-types", companyId]`, `["customer-dropdowns", companyId]`). Har yozuvdan keyin tegishli kalit qayta so'raladi.
- Tartib: `SortableList` (dnd-kit; tutqichni sudrash yoki klaviaturada strelkalar). Yangi tartib darhol ko'rinadi, API rad etsa qaytadi.
- Umumiy bo'laklar: `NameDialog` (bitta nomli forma: qo'shish va nom o'zgartirish), `DeleteButton` (tasdiq bilan o'chirish), `SettingRow`.
- Mock API (`mocks/`) Go API qoidalarini takrorlaydi.

**Tech Stack:** Next 16, shadcn (`base-nova`), TanStack Query, react-hook-form + zod, dnd-kit, Vitest + RTL + MSW, Playwright.

Qoidalar: `logic/customers.md` (2, 3, 5-bo'limlar). Dizayn: `docs/superpowers/specs/2026-10-04-customers-design.md`, ko'rinish: `2026-10-04-crud-ui-refresh-design.md`.

---

## Kelishuvlar

- Testlar: `pnpm --filter @hisob24/web exec vitest run <fayl>`; har GREEN'dan keyin butun web suite, so'ng commit. Task oxirida typecheck va lint.
- Har xato testining o'z xabari bo'ladi (sonner toast'lari testlar orasida qoladi).
- Kutayotgan tugma `aria-disabled` bo'ladi, `disabled` emas.

## Matnlar

| Qayerda | Matn |
|---|---|
| Sahifa | "Sozlamalar", "Mijozlar bo'limi sozlamalari" |
| Bo'limlar | "Mijoz turlari" ("Mijoz qo'shishda tanlanadi. Har turning o'z maydonlari bor."), "Dropdownlar" ("Tanlov maydonlari variantlarni shu ro'yxatlardan oladi.") |
| Tugmalar | "Tur qo'shish", "Dropdown qo'shish", "Maydon qo'shish", variant satrida "Qo'shish" |
| Dialoglar | "Tur qo'shish", "Tur nomini o'zgartirish", "Dropdown qo'shish", "Dropdown nomini o'zgartirish", "Variant nomini o'zgartirish", "Maydon qo'shish", "Maydonni tahrirlash" |
| Maydonlar | "Nomi", "Turi", "Dropdown", "Majburiy", "Takrorlanmasin" |
| Maydon turlari | "Matn", "Butun son", "Dropdown (bitta tanlov)", "Dropdown (bir nechta tanlov)", "Radio (bitta tanlov)", "Checkbox (bir nechta tanlov)" |
| Belgilar | "Majburiy", "Takrorlanmas", "Mijoz nomi", "Nofaol" |
| Tasdiq | "Turni o'chirasizmi?", "Dropdownni o'chirasizmi?", "Maydonni o'chirasizmi?", "Variantni o'chirasizmi?" |
| Toast | "Tur qo'shildi", "Dropdown qo'shildi", "Maydon qo'shildi", "Variant qo'shildi", "Nom o'zgartirildi", "Maydon saqlandi", "Tur o'chirildi", "Dropdown o'chirildi", "Maydon o'chirildi", "Variant o'chirildi", "Variant nofaol qilindi", "Variant faollashtirildi" |
| Tutqich | "<nom>: tartibini o'zgartirish"; e'lon: "<nom>: N tadan K-o'rinda" |
| Bo'sh holat | "Hali tur yo'q", "Hali dropdown yo'q", "Bu turda maydon yo'q", "Hali variant yo'q" |
| Forma xatolari | "Nomni kiriting", "Nom 60 belgidan oshmasin", "Dropdownni tanlang" |

## Fayl tuzilmasi

| Fayl | Vazifa |
|---|---|
| `components/ui/{checkbox,native-select}.tsx` | shadcn va admin'dan nusxa |
| `components/sortable-list.tsx` (+test) | sudraladigan ro'yxat (`../h24` dan, o'zbekcha matnlar) |
| `mocks/data.ts`, `mocks/handlers.ts` (+`handlers.test.ts`) | dropdownlar, turlar va 17 route |
| `lib/types.ts`, `lib/queries.ts` | `CustomerType`, `CustomerDropdown`, `useCustomerTypes`, `useCustomerDropdowns` |
| `lib/schemas.ts` (+test) | `nameSchema`, `fieldSchema` |
| `lib/customer-fields.ts` (+test) | tur nomlari, `isChoice`, `nameFieldOf` |
| `lib/use-owner.ts` | egasi darvozasi (Xodimlar sahifasidan ajratiladi) |
| `lib/nav.ts` (+test) | "Sozlamalar" (`ownerOnly`) |
| `components/settings/{name-dialog,delete-button,setting-row}.tsx` | umumiy bo'laklar |
| `components/settings/settings-page.tsx` (+test) | turlar va dropdownlar ro'yxati |
| `components/settings/customer-type-page.tsx`, `field-dialog.tsx` (+test) | maydonlar |
| `components/settings/dropdown-page.tsx`, `add-option-form.tsx` (+test) | variantlar |
| `app/(app)/settings/page.tsx`, `customer-types/[id]/page.tsx`, `dropdowns/[id]/page.tsx` | sahifalar |
| `e2e/settings.spec.ts` | oqimlar |

---

### Task 1: Poydevor

- [ ] UI nusxalari va dnd-kit. Commit: `chore(web): drag and drop, checkbox and native select`
- [ ] `SortableList`: RED testlar (strelka bilan siljiydi va e'lon qiladi, fokus qoladi; Home va End; chetdan oshmaydi; o'qish rejimida tutqich o'chiq) → GREEN.
- [ ] Mock API: `handlers.test.ts` da "sozlamalar Go API kabi javob beradi": o'qish (a'zo, xodim, kompaniyasiz 403 `company_required`), dropdown va variantlar, tur va maydonlar, tartib, rad javoblari (`name_taken`, `dropdown_in_use`, `order_changed`, `owner_only`, 404). Har guruh alohida sikl.
- [ ] `nameSchema`, `fieldSchema`, `lib/customer-fields.ts`.
- [ ] Refactor: `useOwner` (Xodimlar testlari yashil qoladi).

### Task 2: Bo'lim va `/settings`

- [ ] `lib/nav.ts`: "Sozlamalar" faqat egasiga (nav va sidebar testlari yangilanadi).
- [ ] Ro'yxat: turlar (nom, maydonlari) va dropdownlar (nom, variantlari); yuklanish; xodim bosh sahifaga; yuklash xatosi va "Qayta urinish"; bo'sh holatlar.
- [ ] Tur: qo'shish, nom o'zgartirish, o'chirish (tasdiq, rad javobi toast'da), tartib (klaviatura; rad etilsa qaytadi).
- [ ] Dropdown: qo'shish, nom o'zgartirish, o'chirish (`dropdown_in_use` toast'da).

### Task 3: Tur sahifasi

- [ ] Maydonlar ro'yxati: nom, tur matni va dropdown nomi, belgilar; birinchi matn maydonida "Mijoz nomi"; telefon haqida izoh; yo'q tur.
- [ ] Maydon qo'shish (tur tanlansa dropdown tanlovi va "Takrorlanmasin" mos ravishda chiqadi), tahrirlash, o'chirish, tartib.

### Task 4: Dropdown sahifasi

- [ ] Variantlar ro'yxati, tez qo'shish satri (Enter, maydon tozalanadi va fokusda qoladi), nom o'zgartirish, nofaol qilish va faollashtirish, o'chirish, tartib; yo'q dropdown.

### Task 5: Sahifalar, e2e, yakun

- [ ] `app/(app)/settings/…`; `proxy.test.ts` (xarakteristika).
- [ ] `e2e/settings.spec.ts` (375px va desktop): egasi dropdown va variantlar yaratadi, tur va maydonlar qo'shadi, sichqoncha bilan sudrab tartiblaydi, ulangan dropdown o'chmaydi; xodimda "Sozlamalar" yo'q va `/settings` → `/`; yon scroll yo'q.
- [ ] `make lint` → `make test` → `make e2e`; skrinshotlar (375px va desktop, light va dark); `git push origin main`.

## Self-review

- Spec qamrovi: sozlamalar faqat egasiga (T2), turlar va maydonlar (T2, T3), olti maydon turi va belgilar (T3), dropdown va variantlar, nofaol variant (T4), sudrab tartiblash (T1 `SortableList`, T2–T4), rad javoblari (T2–T4). `type_in_use`, `field_in_use`, `option_in_use`, `duplicates_exist` API'da 3-bosqichda: interfeys ularni hozirdanoq umumiy yo'l bilan ko'rsatadi (toast yoki dialog ichida).
