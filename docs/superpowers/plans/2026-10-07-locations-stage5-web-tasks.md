# Lokatsiyalar, 5-bosqich: tanlovchi va vazifalar (web) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** User app'da joriy lokatsiya: topbar'dagi tanlovchi (2+ ruxsatli lokatsiyada), vazifalar ro'yxati va kanban joriy lokatsiyaniki, yangi vazifa unga tushadi, mas'ul tanlovi lokatsiya bo'yicha, vazifa sahifasida "Lokatsiya" fakti, mijoz sahifasida belgi, lokatsiyasiz xodim holati (`logic/locations.md`, 4 va 6-bo'limlar).

**Architecture:**
- `lib/use-location.ts` `useLocation()` (`useMe().locations`, `useKept("location:<kompaniya>:<telefon>")`, `current`, `choose`).
- `lib/members.ts` `worksIn(member, locationId)`, `assigneeOptions(members, locationId, task?)`.
- `components/shell/location-switcher.tsx` (`SelectBox`, `aria-label="Lokatsiya"`, `MapPinIcon`), `Topbar` o'rtasida.
- `lib/queries.ts` `TaskFilter.locationId`, `StageFilter`; `tasks-page.tsx` (filtr, `canAdd`, lokatsiyasiz karta, almashtirishda 1-sahifa), `task-board.tsx`, `task-dialog.tsx` (`location_id`), `task-form.tsx` (`locationId` → mas'ullar), `edit-task-dialog.tsx`, `task-page.tsx` (fakt), `customer-tasks.tsx` (belgi).
- Mock: `POST /app/tasks` `location_id` majburiy (400 "Lokatsiyani tanlang"); openapi `TaskCreate.location_id` required; seed: Nok Market "Chilonzor", DILNOZA.
- Vitest, e2e `locations.spec.ts`, README.

---

### Task 1: `useLocation`, `worksIn`, `assigneeOptions`
- [ ] `lib/use-location.test.tsx`: 2 lokatsiyada eslanmagan → birinchisi; eslangan → o'sha; eslangani ruxsatli emas → birinchisi; bo'sh → `null`; `choose` eslaydi (`localStorage`). `lib/members.test.ts`: `worksIn` (null → hamma; ro'yxatda bor/yo'q); `assigneeOptions` (joriy lokatsiyada ishlaydiganlar; hozirgi mas'ul u yerda ishlamasa "(bu lokatsiyada ishlamaydi)", chiqarilgan "(chiqarilgan)"). RED → kod → GREEN, commit.

### Task 2: Tanlovchi va topbar
- [ ] `components/shell/location-switcher.test.tsx` / `topbar.test.tsx`: 1 lokatsiyada yo'q; 2+ da `combobox` "Lokatsiya" joriy nomi bilan; tanlov eslanadi; telefonda kompaniya nomi va profil orasida. RED → kod → GREEN, commit.

### Task 3: Vazifalar sahifasi, kanban, dialoglar
- [ ] `tasks-page.test.tsx`: ro'yxat va kanban joriy lokatsiya vazifalari (boshqa lokatsiyadagi ko'rinmaydi; eslangan lokatsiya o'zgarsa ro'yxat o'zgaradi va 1-sahifaga qaytadi); lokatsiyasiz xodim: "Sizga lokatsiya biriktirilmagan", qo'shish tugmasi yo'q. `task-dialog.test.tsx`: `POST` tanasida joriy `location_id`; mas'ul tanlovida faqat shu lokatsiyada ishlaydiganlar. `edit-task-dialog.test.tsx`: vazifaning lokatsiyasi bo'yicha; "(bu lokatsiyada ishlamaydi)". `task-page.test.tsx`: 2+ da "Lokatsiya" fakti, 1 da yo'q. `customer-page`/`customer-tasks` testi: hamma ruxsatli lokatsiya, 2+ da belgi. RED → kod → GREEN, commit.

### Task 4: Mock va kontrakt
- [ ] `handlers.test.ts`: `location_id` berilmasa 400 "Lokatsiyani tanlang" (vaqtinchalik qoida tugaydi). openapi `TaskCreate.required` ga `location_id`; `make api-client`; seed Nok Market "Chilonzor", DILNOZA (`TG_DILNOZA`). RED → GREEN, commit.

### Task 5: e2e va README
- [ ] `e2e/locations.spec.ts` (375px va desktop): Vali Nok Market'da tanlovchini ko'radi, "Chilonzor"da vazifa qo'shadi (yangi mijoz bilan), "Asosiy"ga o'tganda ko'rinmaydi, mijoz sahifasida "Chilonzor" belgisi bilan ko'rinadi, vazifa sahifasida "Lokatsiya" fakti; Olma Savdo'da tanlovchi yo'q. README "Lokatsiyalar". `make lint`, `make test`, `make e2e`; spec'ga "5-bosqich qarorlari"; commit.
