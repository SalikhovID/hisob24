# Rollar, 3-bosqich: ruxsatlar UI'da (web) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** User app bo'limlar, sahifa darvozalari va tugmalarni `/app/me` dagi `permissions` dan quradi: ruxsati yo'q bo'lim menyuda yo'q, sahifasi bosh sahifaga qaytaradi, tugmasi chizilmaydi; rol nomi badge'larda ko'rinadi. Rolsiz xodim va egasi uchun ko'rinish o'zgarmaydi.

**Architecture:**
- `lib/permissions.ts` `can(permissions, p)`; `lib/use-gate.ts` (`useGate`, `useOwner`, `usePermission`) `lib/use-owner.ts` o'rnida; `lib/nav.ts` `permission` bilan; `Sidebar` `me.data?.permissions`.
- Sahifalar: `EmployeesPage` (`employees.*`), `SettingsPage` va tur / dropdown sahifalari (`settings.*`, `SortableList disabled`), `CustomersPage` / `CustomerPage` (`customers.*`, `tasks.view`, `settings.view`), `TasksPage` / `TaskBoard` / `TaskCard` / `TaskPage` (`tasks.*`), vazifa formasi (`customers.create` → yangi mijoz qismi, `customers.view` → takliflar).
- `RoleBadge {role, name?}`, `Dashboard` rol nomi.
- Testlar: rolli xodim fixture'si `test/roles.ts` (`giveRole(phone, companyId, name, permissions)`), har sahifaga "ruxsati yo'q xodim" holati.

**Tech Stack:** Next.js 16, React, TanStack Query, Vitest + RTL, MSW.

Qoidalar: `logic/roles.md` (4, 8-bo'limlar). Dizayn: spec "User app: ruxsatlar".

---

### Task 1: `can`, `useGate`, nav
- [x] Test: `permissions.test.ts` (`can`: ro'yxatda bor / yo'q / `undefined`), `use-gate.test.tsx` (egasi o'tadi; rolli xodim ruxsati bilan o'tadi; ruxsatsiz `router.replace("/")` va `null`; yuklanmagan → `null`, yo'naltirish yo'q), `nav.test.ts` (ruxsatlar bo'yicha; `undefined` → faqat Bosh sahifa), `sidebar.test.tsx` (rolli xodim faqat ruxsatli bo'limlarni ko'radi).
- [x] Kod → GREEN → commit `feat(web): the sections and the page gates follow the permissions`.

### Task 2: `RoleBadge`, `Dashboard`
- [x] Test: badge rol nomini aytadi (`name`), nomsiz "Xodim"; dashboard kartasida rol nomi.
- [x] Kod → commit `feat(web): the role's name on the badge and the home card`.

### Task 3: Xodimlar sahifasi
- [x] Test: `employees.view` li xodim ro'yxatni ko'radi, `create` siz "Xodim qo'shish" yo'q, `edit` siz ism tugmasi yo'q, `delete` siz o'chirish yo'q; ruxsatsiz xodim bosh sahifaga.
- [x] Kod → commit `feat(web): the employees page by permission`.

### Task 4: Sozlamalar sahifalari
- [x] Test: `settings.view` li xodim sahifani ko'radi, qo'shish / tahrir / o'chirish tugmalari ruxsat bo'yicha, tartib `disabled`; tur va dropdown sahifalari ham.
- [x] Kod → commit `feat(web): the settings pages by permission`.

### Task 5: Mijozlar sahifalari
- [x] Test: `customers.view` darvozasi; qo'shish `create` bilan; mijoz sahifasida tahrir / o'chirish / tarix ruxsat bo'yicha; "Vazifalar" bo'limi `tasks.view` bilan; "Sozlamalarni ochish" `settings.view` bilan.
- [x] Kod → commit `feat(web): the customers pages by permission`.

### Task 6: Vazifalar sahifalari va forma
- [x] Test: `tasks.view` darvozasi; "Vazifa qo'shish" `tasks.create` va (`customers.view` yoki `customers.create`) bilan; kanban'da sudrash va bosqich menyusi `tasks.edit`, ustun "+" `tasks.create`; vazifa sahifasida tahrir / bosqich / o'chirish / tarix; formada `customers.create` siz yangi mijoz qismi yo'q ("mavjud mijozni biriktiring"), `customers.view` siz takliflar so'ralmaydi.
- [x] Kod → commit `feat(web): the tasks pages and the task form by permission`.

### Task 7: Yakun
- [x] `make lint`, `make test`, `make e2e`; spec "3-bosqich qarorlari"; push.
