# Select'lar shadcn'ga, sozlamalar tablarga, pager raqamli — dizayn

Sana: 2026-10-06. Holat: foydalanuvchi tasdiqlagan yo'nalish (reja: `docs/superpowers/plans/2026-10-06-selects-settings-tabs-pager.md`).

## Maqsad

Foydalanuvchining so'zlari (2026-10-06): "dropdownlar shadcn nikini ishlat, sozlamalarda mijozlar va vazifalarni alohida guruhla yoki sahifa qil, paginationni to'g'irla undan ../enwin dan namuna ol".

Uch ish, hammasi frontend'da. Backend, `openapi.yaml` va api-client o'zgarmaydi. `docs/SPEC.md` da yo'q ish, foydalanuvchi so'rovi bilan (Mijozlar va CRUD UI kabi).

Bungacha:

- User app'dagi hamma select brauzerning o'zi (`components/ui/native-select.tsx`): forma maydonlari (`select-field.tsx`), tanlov maydoni javobi (`field-answer.tsx`, `dropdown` turi), vazifa sahifasidagi bosqich (`task-page.tsx`), ro'yxat filtrlari (`tasks-page.tsx`). `multi_dropdown` esa checkbox'li `DropdownMenu`. Admin'da shadcn `ui/select.tsx` (base-nova, Base UI) bor edi, lekin ishlatilmasdi.
- `/settings` bitta uzun sahifa: Mijoz turlari, Vazifa turlari, Bosqichlar, Dropdownlar ketma-ket.
- `Pager` (web va admin, bayt-bir xil): "1–20 / 45" + "Oldingi" / "Keyingi"; bitta sahifada ham ko'rinardi.

Namuna (`../enwin`): `enwin-admin/components/table-pagination.tsx`, `enwin-frontend/components/data-list/data-list-table.tsx`: shadcn `Pagination`, raqamli sahifalar `1 … 4 5 6 … 20`, chap / o'ng ikonka tugmalar, "{total} tadan {count} ta ko'rsatilmoqda", bir sahifada raqamlar yo'q.

## Foydalanuvchi qarorlari

1. Sozlamalar: bitta `/settings`, tepasida tablar; tab manzilda.
2. Dropdownlar alohida uchinchi tab (mijoz va vazifa maydonlari ikkalasiga xizmat qiladi, birortasiga qo'shilmaydi).
3. Pagination: enwin kabi raqamli sahifalar, matn enwin'niki ("85 tadan 20 ta ko'rsatilmoqda"); bir sahifa bo'lsa faqat "Jami: N". Web va admin'da bir xil.
4. `multi_dropdown` ham shadcn Select (`multiple`). Bitta tanlovli select'lar hammasi Select.

## A. Pager: raqamli sahifalar (web + admin)

`components/ui/pagination.tsx` (ikkala ilovada, bayt-bir xil): shadcn base-nova `pagination` registry fayli lucide ikonkalar bilan, ikki farq bilan:

- `PaginationLink` `<a>` emas, `Button` (haqiqiy `<button type="button">`): sahifa holat bilan almashadi, havola emas. Faol raqam `variant="outline"` va `aria-current="page"`, qolgani `ghost`; `size="icon"` (32px).
- `PaginationPrevious` / `PaginationNext` faqat ikonka (enwin kabi), `aria-label` chaqiruvchidan; `disabled` chetlarda. `PaginationEllipsis` `aria-hidden` + ekran o'quvchiga "Yana sahifalar".

`components/pager.tsx` (ikkala ilovada; props o'zgarmadi: `page`, `pageSize`, `total`, `onPage`):

- `pageNumbers(page, totalPages)`: 5 va kam sahifa → hammasi; aks holda `1`, `…` (page > 3 bo'lsa), `page−1..page+1` (2 va totalPages−1 orasida), `…` (page < totalPages−2 bo'lsa), `totalPages`. Enwin algoritmi.
- `total <= pageSize` → faqat "Jami: N" (xodimlar va mijoz vazifalari footer'i kabi).
- Aks holda chapda "{total} tadan {count} ta ko'rsatilmoqda" (`count` shu sahifadagi yozuvlar soni), o'ngda `nav` "Sahifalar": ‹ raqamlar › . Telefonda ikki qatorga o'raladi: matn, ostida o'ngda raqamlar.
- `DataList` footer uslubi o'zgarmadi. `customer-tasks.tsx` o'z shartini tashladi: bir sahifada "Jami: N" ni `Pager` ning o'zi chiqaradi.

## B. Sozlamalar: tablar

- Manzil: `/settings` (Mijozlar), `/settings?tab=tasks`, `/settings?tab=dropdowns`. Noma'lum qiymat → Mijozlar.
- `components/settings/use-settings-tab.ts`: `useSettingsTab()` → `[tab, select]` (`useSearchParams` + `router.replace`, `use-customer-filter.ts` namunasida); `settingsHref(tab)`: `customers` → `/settings`, boshqalari `/settings?tab=…`.
- `settings-page.tsx`: sarlavha o'zgarmadi; ostida tablar mijozlar sahifasidagi uslubda (yon scroll'li tasma), `aria-label` "Sozlamalar bo'limlari"; "Mijozlar" → Mijoz turlari; "Vazifalar" → Vazifa turlari, Bosqichlar; "Dropdownlar" → Dropdownlar. Yashirin panel DOM'da yo'q (Base UI `Tabs.Panel`, `keepMounted` false): faqat ochiq tabning so'rovlari ketadi. Bo'lim matnlari o'zgarmadi.
- Orqaga havolalar: vazifa turi sahifasi → `/settings?tab=tasks`, dropdown sahifasi → `/settings?tab=dropdowns`, mijoz turi sahifasi → `/settings`. Yorliq "Sozlamalar".
- Vazifalar sahifasidagi "Sozlamalarni ochish" → `/settings?tab=tasks`; mijozlardagi → `/settings`.
- Sidebar, `nav.ts`, `proxy.ts`, `useOwner` o'zgarmadi.

## C. Select'lar: shadcn (Base UI) Select

- `apps/web/components/ui/select.tsx`: admin'dagi bilan bayt-bir xil (base-nova registry, lucide; `shadcn add select` natijasi).
- `components/select-field.tsx`:
  - `SelectOption = { value: string; label: string }`.
  - `SelectBox`: bitta tanlov. `value: string` ("" = tanlanmagan), `onChange(value)`, `onBlur`, `options`, `empty` (tanlovni bo'shatadigan o'z varianti: Base UI null item; trigger'da ham shu so'z), `placeholder` (variant emas, faqat taklif), `disabled`, `className`, `id`, `aria-label`, `aria-invalid`, `aria-describedby`. Root `items` bilan: trigger variant nomini aytadi.
  - `SelectField`: react-hook-form o'rami (`Field`, `FieldLabel htmlFor`, `SelectBox`, `FieldError`); `options`, `empty?`, `placeholder?`.
  - `MultiSelectBox`: `Select multiple`; `value: string[]`; trigger tanlanganlar nomlarini ", " bilan aytadi, hech narsa tanlanmagan bo'lsa xira "Tanlanmagan"; variantlarda belgi; popup tanlovdan keyin ochiq qoladi (Base UI).
- `field-answer.tsx`: `dropdown` → `SelectBox` (`empty="Tanlanmagan"`), `multi_dropdown` → `MultiSelectBox`; ikkalasi label'li tugma (`group` emas). Radio, checkbox, matn, son o'zgarmadi.
- `settings/field-dialog.tsx`: "Turi" (`kindLabels`), "Dropdown" (`placeholder="Tanlang"`). Zod sxemasi o'zgarmadi.
- `tasks/task-form.tsx`: "Bosqich" (`placeholder="Tanlang"`), "Mas'ul" (`empty="Tanlanmagan"`, chiqarilgan mas'ul oxirida).
- `tasks/task-page.tsx`: bosqich `SelectBox` (`aria-label="Bosqich"`, `h-9 bg-card`).
- `tasks/tasks-page.tsx`: filtrlar `SelectBox` (`empty="Barcha bosqichlar"` / `"Barcha mas'ullar"`).
- `components/ui/native-select.tsx` ikkala ilovadan o'chirildi.
- Rollar: trigger `button[role=combobox]`, variantlar `role="option"` + `aria-selected`, popup portal'da. Test yordamchisi `test/select.ts` (`choose`, `optionsOf`), Playwright'da `e2e/helpers.ts` `choose`.

## Matnlar

| Qayerda | Matn |
|---|---|
| Pager, ko'p sahifa | "{total} tadan {count} ta ko'rsatilmoqda"; tugmalar "Oldingi", "Keyingi" (ekran o'quvchiga), raqamlar; ellipsis "Yana sahifalar" (ekran o'quvchiga); `nav` "Sahifalar" |
| Pager, bir sahifa | "Jami: N" |
| Sozlamalar tablari | "Mijozlar", "Vazifalar", "Dropdownlar"; `tablist` "Sozlamalar bo'limlari" |
| Select'lar | "Tanlanmagan" (bo'shatadigan variant va bo'sh trigger), "Tanlang" (taklif), "Barcha bosqichlar", "Barcha mas'ullar" (mavjud so'zlar) |

## Talab o'zgargani uchun o'zgargan testlar

Har biri avval yangi talabga moslandi (RED), keyin kod yozildi (GREEN). Hech bir test o'chirilmadi yoki o'tkazib yuborilmadi.

- **Pager.** `customers-page.test.tsx`, `tasks-page.test.tsx` (web), `companies-page.test.tsx` (admin): "1–20 / N" o'rniga "N tadan M ta ko'rsatilmoqda"; sahifa raqam bilan ochiladi, faol raqam `aria-current="page"`. Admin'dagi "ikkinchi sahifa yo'lda" testi endi sahifa raqamining faolligiga qaraydi (ikki sahifaning matni bir xil: ikkalasida ham 20 ta yozuv).
- **Sozlamalar tablari.** `settings-page.test.tsx`: testlar o'z tabining manzilidan boshlanadi (`setLocation("/settings?tab=tasks")`); birinchi test ikkiga bo'lindi (mijoz turlari; dropdownlar); yiqilgan ro'yxat testi vazifalar tabida (`task-stages` yiqiladi, turlar turibdi); bo'sh holatlar ikki tabda; yangi testlar: uch tab, manzil tabni tanlaydi, tab manzilga tushadi, boshqa tabning ro'yxati DOM'da yo'q. `task-type-page.test.tsx`, `dropdown-page.test.tsx`: orqaga havola `/settings?tab=tasks` va `/settings?tab=dropdowns`. `tasks-page.test.tsx`: "Sozlamalarni ochish" `/settings?tab=tasks`. e2e `settings.spec.ts`, `tasks.spec.ts`: tab bosiladi, manzil tekshiriladi.
- **Select'lar.** `field-answer.test.tsx`, `add-customer-dialog.test.tsx`, `customer-page.test.tsx`, `customer-type-page.test.tsx`, `task-type-page.test.tsx`, `task-dialog.test.tsx`, `edit-task-dialog.test.tsx`, `task-board.test.tsx`, `task-page.test.tsx`, `tasks-page.test.tsx`: `selectOptions` o'rniga `choose` (tugma bosiladi, variant bosiladi), `toHaveValue` o'rniga `toHaveTextContent` (tugma tanlangan nomni aytadi), variantlar ochiq `listbox` dan o'qiladi (`optionsOf`), ko'p tanlovda `menu` / `menuitemcheckbox` o'rniga `listbox` / `option` (`aria-selected`). e2e `customers.spec.ts`, `settings.spec.ts`, `tasks.spec.ts`: `selectOption` o'rniga `choose`; `toHaveValue` o'rniga `toContainText` (Base UI trigger ikonkasi matnda "▼" zaxirasini qoldiradi, ko'rinmaydi).
- **Yangi testlar.** `pager.test.tsx` (ikkala ilovada), `use-settings-tab.test.ts`, `select-field.test.tsx`.

Tekshiruv: `make lint` toza; `make test`: web 68 fayl / 517 test, admin 37 / 228; `make e2e` ikki ko'rinishda. Skrinshotlar (375px va desktop, light va dark) vaqtinchalik spec bilan ko'rildi. Raqamli pager jonli ro'yxatda faqat 20 dan ko'p yozuv bilan ko'rinadi; mock ma'lumotida shuncha yozuv yo'q, u birlik testlar bilan tekshirildi.
