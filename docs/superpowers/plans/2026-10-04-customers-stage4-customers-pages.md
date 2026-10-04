# Mijozlar, 4-bosqich: Mijozlar sahifalari — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Kompaniyaning har a'zosi user app'dagi "Mijozlar" bo'limida mijozlarni ko'radi, qidiradi, tur bo'yicha filtrlaydi, qo'shadi, tahrirlaydi va o'chiradi; ustunlarni o'ziga sozlaydi. Egasi mijoz sahifasida o'zgarishlar tarixini ko'radi.

**Architecture:**
- `/customers` (`CustomersPage`): tur tablari, qidiruv, "Ustunlar" menyusi, `DataList`, pager. Filtr manzilda (`?type=&search=&page=`).
- `/customers/[id]` (`CustomerPage`): ma'lumot, tahrirlash dialogi, o'chirish tasdig'i, egasiga "Tarix".
- Forma (`CustomerForm`) turdan quriladi: telefon va maydonlar (olti tur). Zod sxemasi ham turdan (`lib/customers.ts`), xabarlari API'niki bilan bir xil.
- Ma'lumot: `GET /app/customers…` (`["customers", companyId, filter]`, `["customer", companyId, id]`, `["customer-history", companyId, id]`), turlar va dropdownlar mavjud so'rovlardan.
- Ustun tanlovi brauzerda (`localStorage`, kompaniya va user bo'yicha); storage rad etsa hammasi ko'rinadi.
- Mock API (`mocks/customers.ts`) Go API qoidalarini takrorlaydi; sozlamalarga "ishlatilgan" qoidalari qo'shiladi.

**Tech Stack:** Next 16, shadcn (`base-nova`), TanStack Query, react-hook-form + zod, Vitest + RTL + MSW, Playwright.

Qoidalar: `logic/customers.md` (4, 6, 7-bo'limlar). Dizayn: `docs/superpowers/specs/2026-10-04-customers-design.md`, ko'rinish: `2026-10-04-crud-ui-refresh-design.md`.

---

## Kelishuvlar

- Testlar: `pnpm --filter @hisob24/web exec vitest run <fayl>`; har GREEN'dan keyin butun web suite, so'ng commit. Task oxirida typecheck va lint.
- Har xato testining o'z xabari bo'ladi (sonner toast'lari testlar orasida qoladi).
- Kutayotgan tugma `aria-disabled` bo'ladi, `disabled` emas.
- Forma maydon kaliti `f<ID>` (`values.f12`): react-hook-form raqamli kalitni massiv indeksi deb oladi.

## Matnlar

| Qayerda | Matn |
|---|---|
| Bo'lim | "Mijozlar" |
| Sahifa | "Mijozlar", "Kompaniyangiz mijozlari · N ta" |
| Tablar | "Barchasi", keyin tur nomlari |
| Qidiruv | "Ism yoki telefon" (maydon nomi "Qidirish") |
| Ustunlar | "Mijoz", "Turi", maydon nomlari, "Qo'shgan", "Qo'shilgan"; menyu "Ustunlar" |
| Tugmalar | "Mijoz qo'shish", "Tahrirlash", "O'chirish", dialogda "Qo'shish" / "Saqlash" |
| Dialoglar | "Mijoz qo'shish", "Mijozni tahrirlash", "Mijozni o'chirasizmi?" |
| Forma | "Mijoz turi", "Telefon raqami", maydon nomlari; ixtiyoriy maydon yonida "ixtiyoriy"; tanlovda "Tanlanmagan" |
| Rad javobi | API xabari; 409 `customer_id` bilan kelsa "Mijozni ochish" havolasi |
| Toast | "Mijoz qo'shildi", "Mijoz saqlandi", "Mijoz o'chirildi" |
| Mijoz sahifasi | orqaga "Mijozlar"; "Ma'lumot"; "Telefon", "Qo'shgan", "Qo'shilgan"; "Tarix": "Qo'shildi", "Tahrirlandi" |
| Bo'sh holat | "Hali mijoz yo'q" ("Birinchi mijozni «Mijoz qo'shish» tugmasi orqali qo'shing."), "Mijozlar topilmadi" ("Qidiruv yoki filtrni o'zgartirib ko'ring."), "Mijoz turlari yo'q" (egasiga Sozlamalarga havola; xodimga "Kompaniya egasi mijoz turlarini sozlashi kerak."), "Mijoz topilmadi" |
| Forma xatolari | "Telefon raqamini to'liq kiriting", "«…» maydonini to'ldiring", "«…» ni tanlang", "«…» 500 belgidan oshmasin", "«…» butun son bo'lishi kerak" |

## Fayl tuzilmasi

| Fayl | Vazifa |
|---|---|
| `mocks/customers.ts`, `mocks/data.ts`, `mocks/customer-settings.ts` (+`handlers.test.ts`) | mijozlar (6 route), boshlang'ich mijozlar, "ishlatilgan" qoidalari |
| `lib/types.ts`, `lib/queries.ts` | `Customer`, `CustomerPage`, `CustomerHistoryEntry`; `useCustomers`, `useCustomer`, `useCustomerHistory` |
| `lib/api.ts` (+test) | `ApiError.customerId` |
| `lib/customers.ts` (+test) | `customerName`, `valueText`, `fieldColumns`, forma sxemasi va qiymatlari |
| `lib/format.ts` (+test) | `formatDateTime` |
| `lib/use-hidden-columns.ts` (+test) | yashirilgan ustunlar brauzerda |
| `lib/nav.ts` (+test) | "Mijozlar" (hamma) |
| `components/data-list.tsx` (ikkala ilova, +test) | `Column.key` |
| `components/ui/{tabs,radio-group}.tsx`, `components/pager.tsx` | admin va shadcn'dan nusxa |
| `components/customers/customers-page.tsx` (+test) | ro'yxat, tablar, qidiruv, pager, "Ustunlar", bo'sh holatlar |
| `components/customers/{search-input,use-customer-filter,columns-menu}.tsx` | qidiruv, manzildagi filtr, ustunlar menyusi |
| `components/customers/customer-form.tsx`, `customer-dialog.tsx` (+test) | forma (olti tur), qo'shish va tahrirlash dialoglari |
| `components/customers/customer-page.tsx`, `customer-history.tsx`, `delete-customer-button.tsx` (+test) | mijoz sahifasi |
| `app/(app)/customers/page.tsx`, `app/(app)/customers/[id]/page.tsx` | sahifalar |
| `e2e/customers.spec.ts` | oqimlar |
| `README.md` | "Mijozlar" bo'limi |

---

### Task 1: Mock API

- [ ] Boshlang'ich mijozlar (`mocks/data.ts`) va `handlers.test.ts` da "mijozlar Go API kabi javob beradi": qo'shish (javoblar, kim qo'shgani; tekshiruv xabarlari; `phone_taken`, `value_taken` `customer_id` bilan), o'qish va ro'yxat (yangi birinchi, qidiruv, tur, sahifa), tahrirlash (tarix, o'zgarishsiz saqlash, nofaol variant), o'chirish, tarix (faqat egasi), kompaniyasiz 403. Har guruh alohida sikl.
- [ ] Sozlamalar: `type_in_use`, `field_in_use`, `option_in_use`, `duplicates_exist`.

### Task 2: Poydevor

- [ ] `ApiError.customerId`; `formatDateTime`; `DataList` `Column.key` (ikkala ilova).
- [ ] `lib/customers.ts`: `customerName`, `valueText`, `fieldColumns`, forma sxemasi (`customerSchema`), `formDefaults`.
- [ ] `lib/use-hidden-columns.ts`.
- [ ] UI nusxalari: `ui/tabs.tsx`, `ui/radio-group.tsx`, `pager.tsx`. Commit: `chore(web): tabs, radio group and pager`.

### Task 3: Bo'lim va ro'yxat

- [ ] `lib/nav.ts`: "Mijozlar" hammaga (nav va sidebar testlari yangilanadi).
- [ ] Ro'yxat: "Mijoz" (nom va telefon, nom havola), "Turi", maydon ustunlari (bir xil nomlilar bitta), "Qo'shgan", "Qo'shilgan"; yuklanish, xato, bo'sh holatlar; jami son.
- [ ] Tur tablari, qidiruv va pager manzilda.
- [ ] "Ustunlar" menyusi: yashirish, saqlanishi, "Mijoz" yashirilmaydi.
- [ ] Tur yo'q: egasiga Sozlamalarga havola, xodimga izoh.

### Task 4: Qo'shish

- [ ] Dialog: tur tugmalari (birinchi yoki tanlangan tab), telefon, olti turdagi maydonlar, "ixtiyoriy" belgisi; saqlangach yopiladi va ro'yxat yangilanadi.
- [ ] Forma xatolari (API xabarlari bilan bir xil); API rad javobi; 409 da "Mijozni ochish" havolasi; nofaol variant taklif qilinmaydi.

### Task 5: Mijoz sahifasi

- [ ] Ma'lumot: nom, tur va telefon, barcha maydonlar tartibida (bo'shi "—"), "Qo'shgan", "Qo'shilgan"; yo'q mijoz.
- [ ] Tahrirlash (tur o'zgarmaydi, nofaol variant saqlanadi), o'chirish (tasdiq, ro'yxatga qaytadi).
- [ ] "Tarix" faqat egasiga.

### Task 6: Sahifalar, e2e, yakun

- [ ] `app/(app)/customers/…`; `proxy.test.ts` (xarakteristika).
- [ ] `e2e/customers.spec.ts` (375px va desktop): xodim mijoz qo'shadi, tahrirlaydi, o'chiradi; egasi qidiradi, tur tanlaydi, ustun yashiradi (reload'dan keyin saqlanadi), tarixni ko'radi; takror telefon mavjud mijozga olib boradi; yon scroll yo'q.
- [ ] README; hujjatlar holati; `make lint` → `make test` → `make e2e`; skrinshotlar (375px va desktop, light va dark); haqiqiy Go API bilan brauzerda bitta to'liq oqim; `git push origin main`.

## Self-review

- Spec qamrovi: bo'lim hammaga (T3), ro'yxat va ustunlar qoidalari (T3), ustun tanlovi brauzerda (T2, T3), qidiruv, filtr, sahifa manzilda (T3), qo'shish oynasi va olti tur (T4), takrorda havola (T2, T4), mijoz sahifasi, tahrir, o'chirish (T5), tarix faqat egasiga (T5), tur yo'q holati (T3), mock API qoidalari (T1).
