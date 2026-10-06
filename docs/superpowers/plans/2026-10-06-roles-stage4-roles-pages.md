# Rollar, 4-bosqich: rollar sahifalari (web) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Egasi Sozlamalarning "Rollar" tabida rollarni ko'radi va o'chiradi, `/settings/roles/new` va `/settings/roles/[id]` da nom va ruxsat matritsasini to'ldiradi, Xodimlar sahifasida xodimga rol biriktiradi yoki olib tashlaydi; e2e butun oqim; README.

**Architecture:**
- `lib/queries.ts` `rolesKey`, `useRoles`; `lib/schemas.ts` `roleSchema`; `lib/permissions.ts` matritsa katalogi (`sections`, `actionsOf`, `actionLabels`, `permissionOf`, `summaryOf`).
- `use-settings-tab.ts` `"roles"`; `settings-page.tsx` to'rtinchi tab (faqat egasiga) va `Roles` bo'limi; `role-form.tsx` (nom + matritsa, "Ko'rish" qoidasi, yaratish / saqlash); `role-page.tsx` (`RolePage`, `NewRolePage`); route'lar.
- `employees/employee-role-dialog.tsx` (`SelectBox`, `empty="Rolsiz"`), `EmployeesPage` egasiga rol tugmasi.
- Testlar: Vitest (tab, ro'yxat, o'chirish; forma qoidalari va yuborish; sahifa; dialog), Playwright `roles.spec.ts` (egasi rol yaratadi → xodimga beradi → xodim faqat ruxsatli bo'limlarni ko'radi → rol olinadi).

**Tech Stack:** Next.js 16, react-hook-form + zod, TanStack Query, Base UI select, Vitest, Playwright.

---

### Task 1: "Rollar" tabi va ro'yxat
- [ ] Test (`settings-page.test.tsx`): egasida 4 tab, "Rollar" ro'yxati (nom havola, izoh "Mijozlar, Vazifalar · 1 ta xodim" / "Hech kimda"), "Rol qo'shish" havolasi `/settings/roles/new`; `settings.view` li xodimda 3 tab va `?tab=roles` Mijozlarni ochadi; o'chirish (bo'sh rol o'chadi, biriktirilgan rol 409 xabari).
- [ ] Kod: `useRoles`, `summaryOf`, tab, `Roles` bo'limi → commit `feat(web): the roles tab of the settings`.

### Task 2: Rol formasi va sahifalari
- [ ] Test (`role-form.test.tsx`, `role-page.test.tsx`): amal belgilansa "Ko'rish" ham; "Ko'rish" olinsa bo'lim tozalanadi; yaratish → `POST`, toast "Rol yaratildi", `/settings?tab=roles`; nom bo'sh → "Nomni kiriting"; API 409 → `Refusal`; mavjud rol sahifasi nom va belgilar bilan ochiladi, saqlash → `PUT`, "Rol saqlandi"; topilmasa "Rol topilmadi"; xodim bosh sahifaga.
- [ ] Kod: `roleSchema`, `RoleForm`, `RolePage`, `NewRolePage`, route'lar → commit `feat(web): the role pages`.

### Task 3: Xodimga rol biriktirish
- [ ] Test (`employee-role-dialog.test.tsx`, `employees-page.test.tsx`): egasi xodim qatorida "Rolni o'zgartirish: Vali Aliyev" ni ochadi, rolni tanlaydi → `PUT`, toast, ro'yxatda rol nomi; "Rolsiz" → olib tashlanadi; rol yo'q bo'lsa Sozlamalarga havola; `employees.*` li xodimda tugma yo'q; egasining qatorida yo'q.
- [ ] Kod → commit `feat(web): the owner gives an employee a role`.

### Task 4: e2e, README, yakun
- [ ] `e2e/roles.spec.ts`; README "Rollar va xodimlar"; `make lint`, `make test`, `make e2e`; spec "4-bosqich qarorlari"; push.
