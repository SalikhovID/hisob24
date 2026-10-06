# Vazifalar, 3-bosqich: sozlamalar sahifalari — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Kompaniya egasi user app'ning Sozlamalar bo'limida bosqichlarni (nom, rang, "Yakuniy", tartib) va vazifa turlarini (nom, tartib, maydonlar) tuzadi; mock API Go API qoidalarini takrorlaydi; e2e ikki ko'rinishda o'tadi.

**Architecture:**
- **Mock API:** `mocks/task-settings.ts` (15 route + `/app/members`), `mocks/data.ts` ga `StageRow`, `TaskTypeRow`, `TaskFieldRow`, `seedTaskSettings` (har kompaniyaga uch bosqich va "Vazifa"), `stagesOf`, `taskTypesOf`; `mocks/customer-settings.ts` da `fieldsUsing` vazifa maydonlarini ham sanaydi. Qoidalari `mocks/handlers.test.ts` da.
- **Lib:** `lib/types.ts` (`TaskStage`, `StageColor`, `TaskType`, `TaskField`), `lib/queries.ts` (`useTaskStages`, `useTaskTypes`, `useMembers` + kalitlar), `lib/stage-colors.ts` (rang nomlari va class'lari), `lib/schemas.ts` (`stageSchema`).
- **Sahifalar:** `/settings` ga "Vazifa turlari" va "Bosqichlar" bo'limlari (`settings-page.tsx`), `stage-dialog.tsx` (nom, rang swatch'lari, "Yakuniy bosqich"), `/settings/task-types/[id]` (`task-type-page.tsx`); `field-dialog.tsx` umumiy bo'ladi (API chaqiruvi va "Takrorlanmasin" bayrog'i prop orqali); `components/tasks/stage-dot.tsx`.

**Tech Stack:** Next 16, shadcn (`base-nova`), TanStack Query, react-hook-form + zod, Vitest + RTL + MSW, Playwright.

Qoidalar: `logic/tasks.md` (2, 3-bo'limlar). Dizayn: `docs/superpowers/specs/2026-10-06-tasks-design.md` ("Sozlamalar"), ko'rinish: `2026-10-04-crud-ui-refresh-design.md`.

---

## Kelishuvlar

- Testlar: `pnpm --filter @hisob24/web exec vitest run <fayl>`; har GREEN'dan keyin butun web suite, so'ng commit. Task oxirida typecheck va lint.
- Har xato testining o'z xabari (toast'lar testlar orasida qoladi).
- Sahifa kodidan oldin `apps/web/node_modules/next/dist/docs/` dagi tegishli qo'llanma o'qiladi (`AGENTS.md`); bu bosqichda yangi route faqat `[id]/page.tsx` (mavjud namunada).

## Matnlar

| Qayerda | Matn |
|---|---|
| `/settings` izohi | "Mijozlar va vazifalar sozlamalari" |
| Bo'limlar | "Vazifa turlari" ("Vazifa qo'shishda tanlanadi. Har turning o'z maydonlari bor."), "Bosqichlar" ("Kanban ustunlari. Vazifa shulardan birida turadi."), "Dropdownlar" izohi: "Mijoz va vazifa maydonlari variantlarni shu ro'yxatlardan oladi." |
| Tugmalar | "Tur qo'shish" (vazifa turi uchun ham, dialog sarlavhasi "Vazifa turi qo'shish"), "Bosqich qo'shish" |
| Bosqich dialogi | "Bosqich qo'shish" / "Bosqichni tahrirlash"; maydonlar "Nomi", "Rangi" (radiogroup; ranglar: Kulrang, Qizil, To'q sariq, Sariq, Yashil, Moviy, Ko'k, Binafsha, Pushti), "Yakuniy bosqich" (izoh: "Bu bosqichdagi vazifa bajarilgan hisoblanadi: muddati o'tgan deb belgilanmaydi."); tugma "Qo'shish" / "Saqlash"; toast "Bosqich qo'shildi", "Bosqich saqlandi", "Bosqich o'chirildi" |
| Bosqich qatori | nuqta (rang nomi ekran o'quvchiga), nom, "Yakuniy" belgisi; amallar "Tahrirlash: Yangi", "O'chirish: Yangi"; tasdiq "Bosqichni o'chirasizmi?" ("«Yangi» bosqichi o'chadi. Vazifasi bor bosqich o'chirilmaydi.") |
| Vazifa turi qatori | nom (havola `/settings/task-types/[id]`), ostida maydonlar; "Nomini o'zgartirish: …" ("Vazifa turi nomini o'zgartirish", toast "Tur nomi o'zgartirildi"), "O'chirish: …" ("Turni o'chirasizmi?", "«…» turi va uning maydonlari o'chadi. Vazifasi bor tur o'chirilmaydi.", toast "Tur o'chirildi") |
| Bo'sh holatlar | "Hali bosqich yo'q" ("Vazifa qo'shish uchun kamida bitta bosqich kerak."), "Hali vazifa turi yo'q" ("Vazifa qo'shish uchun kamida bitta tur kerak.") |
| Tur sahifasi | orqaga "Sozlamalar"; sarlavha tur nomi, izoh "Vazifa turi · N ta maydon"; "Maydon qo'shish"; "Bu turda maydon yo'q" ("Vazifa nomi, muddati, mijozi va mas'uli bilan qo'shiladi."); izoh "Nomi, muddat va mijoz har vazifada bor va majburiy, mas'ul ixtiyoriy: ularni maydon qilib qo'shish shart emas."; "Tur topilmadi" |
| Maydon dialogi (vazifa) | mijoz turidagidek, "Takrorlanmasin" yo'q |

## Fayl tuzilmasi

| Fayl | Vazifa |
|---|---|
| `mocks/data.ts`, `mocks/task-settings.ts`, `mocks/handlers.ts`, `mocks/customer-settings.ts` (+`handlers.test.ts`) | mock API |
| `lib/types.ts`, `lib/queries.ts`, `lib/schemas.ts` (+test), `lib/stage-colors.ts` (+test) | turlar, so'rovlar, sxema, ranglar |
| `components/tasks/stage-dot.tsx` | rang nuqtasi |
| `components/settings/stage-dialog.tsx` | bosqich dialogi |
| `components/settings/settings-page.tsx` (+test) | ikki yangi bo'lim |
| `components/settings/field-dialog.tsx`, `customer-type-page.tsx` | umumiy maydon dialogi (`unique`, `add` / `save`) |
| `components/settings/task-type-page.tsx` (+test), `app/(app)/settings/task-types/[id]/page.tsx` | tur sahifasi |
| `e2e/settings.spec.ts` | e2e |

---

### Task 1: Mock API

- [ ] **Test** (`mocks/handlers.test.ts`): bosqichlar: egasi qo'shadi (`{name, color, is_done}`), xodim 403 `owner_only`, hamma o'qiydi (tartibda), `name_taken`, rang "Rangni tanlang", PATCH qisman, DELETE soft (ikkinchi marta 404 "Bosqich topilmadi"), order `order_changed`; vazifa turlari va maydonlar: mijoz turlaridagi kabi (`is_unique` javobda yo'q, "Takrorlanmasin" yo'q); `/app/customer-dropdowns/:id` DELETE vazifa maydoni ulangan bo'lsa `dropdown_in_use` (ikkalasi sanaladi); `/app/members` xodimga ham 200 (egasi birinchi), kompaniyasiz 403 `company_required`; boshlang'ich holat: har kompaniyada 3 bosqich va "Vazifa".
- [ ] **RED** → **Kod:** `data.ts` (qatorlar, `seedTaskSettings`, `stagesOf`, `taskTypesOf`, `toStage`, `toTaskType`), `task-settings.ts`, `handlers.ts` ga qo'shish, `customer-settings.ts` `fieldsUsing`. → **GREEN**, commit `feat(web): the task settings and members in the mock API`.

### Task 2: lib

- [ ] **Test:** `lib/stage-colors.test.ts` (to'qqiz rang, o'zbekcha nomlari, har birida `dot` va `badge` class'lari, "Yakuniy" uchun hech narsa yo'q); `lib/schemas.test.ts` ga `stageSchema` (nom qoidalari, rang bo'sh → "Rangni tanlang", `is_done`).
- [ ] **RED** → **Kod:** `lib/types.ts`, `lib/queries.ts` (`taskStagesKey`, `taskTypesKey`, `membersKey`, `useTaskStages`, `useTaskTypes`, `useMembers`), `lib/stage-colors.ts`, `lib/schemas.ts`. → **GREEN**, commit `feat(web): the task settings queries, the stage schema and colors`.

### Task 3: `/settings` bo'limlari va bosqich dialogi

- [ ] **Test** (`settings-page.test.tsx`): egasi "Vazifa turlari" (qatorlar `["Vazifa", null]`, havola `/settings/task-types/<id>`) va "Bosqichlar" (`["Yangi", …]`, "Yakuniy" belgisi Bajarildi'da) ro'yxatlarini ko'radi; sarlavha izohi; bosqich qo'shish dialogi (nom, rang "Moviy", "Yakuniy bosqich" belgilanadi) → toast, ro'yxatda; dialog xatolari ("Nomni kiriting", API `name_taken`); tahrirlash (nom va rang oldindan tanlangan); o'chirish (tasdiq, API rad sababi toast'da); tartib klaviatura bilan; vazifa turi qo'shish, nomini o'zgartirish, o'chirish; bo'sh holatlar.
- [ ] **RED** → **Kod:** `stage-dot.tsx`, `stage-dialog.tsx`, `settings-page.tsx` (`TaskTypes`, `Stages` bo'limlari). → **GREEN**, commit `feat(web): the stages and the task types in the settings`.

### Task 4: Umumiy maydon dialogi va tur sahifasi

- [ ] **Test** (`task-type-page.test.tsx`): maydonlar ro'yxati (tur · dropdown, "Majburiy"; "Mijoz nomi" va "Takrorlanmas" yo'q); maydon qo'shish dialogida "Takrorlanmasin" yo'q, tanlov turida "Dropdown" chiqadi; qo'shish → ro'yxatda; tahrirlash (nom, majburiy); o'chirish (API rad sababi); tartib; "Tur topilmadi"; xodim bosh sahifaga. `customer-type-page.test.tsx` o'zgarmaydi.
- [ ] **RED** → **Kod:** `field-dialog.tsx` (`AddFieldDialog({ dropdowns, unique, add })`, `EditFieldDialog({ field, kind, unique, save })`), `customer-type-page.tsx` (closure'lar), `task-type-page.tsx`, `app/(app)/settings/task-types/[id]/page.tsx`. → **GREEN**, commit `feat(web): the task type page`.

### Task 5: e2e va ko'rik

- [ ] `e2e/settings.spec.ts`: egasi bosqich qo'shadi (rang, yakuniy), tartiblaydi (telefonda klaviatura, desktop'da sichqoncha), vazifa turi qo'shadi va unga tanlov maydoni qo'shadi, shu dropdown o'chmaydi; yon scroll yo'q.
- [ ] Vaqtinchalik skrinshot spec'i (375px va desktop, light va dark): `/settings`, bosqich dialogi, tur sahifasi; ko'rib, o'chiriladi.
- [ ] `make lint`, `make test`, `make e2e`; push; spec'ga "3-bosqich qarorlari".
