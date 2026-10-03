# Xodimlar, 3-bosqich: user app sidebar — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** User app'ning ichki sahifalari `../enwin/enwin-frontend` dizaynidagi qobiq ichida ochiladi: yig'iladigan sidebar, telefonda chapdan ochiladigan menyu, topbar'da profil menyusi.

**Architecture:**
- `app/(app)/layout.tsx` → `AppShell`: sessiya darvozasi (402 → `/expired`, kompaniya yo'q → `/select-company`, yuklanish va xato holati) + `Sidebar` + `Topbar` + `<main>`.
- Bo'limlar `lib/nav.ts` da, rol bo'yicha filtrlanadi (`ownerOnly`). Rol `/app/me` dan (`company.role`).
- Yig'ilgan holat `localStorage["sidebar_collapsed"]` da (`useSyncExternalStore`). Keng va tor ekran CSS breakpoint (`md:`) bilan ajraladi, JS bilan emas.
- `Dashboard` faqat mazmun bo'lib qoladi; "Chiqish" va mavzu tugmasi topbar'ga ko'chadi.

**Tech Stack:** Next 16, Tailwind v4, shadcn (`base-nova`, base-ui), TanStack Query, Vitest + RTL + MSW, Playwright.

Dizayn manbasi: `enwin-frontend/components/layout/{sidebar,topbar}.tsx`, `hooks/use-sidebar.ts`. Nima olinadi va olinmaydi: `docs/superpowers/specs/2026-10-03-employees-roles-sidebar-design.md`, "User app → Sidebar".

---

## Kelishuvlar

- Avval `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/{route-groups,layout}.md` o'qiladi (`apps/web/AGENTS.md`).
- Testlar: `pnpm --filter @hisob24/web exec vitest run <fayl>`; e2e: `pnpm --filter @hisob24/web exec playwright test <fayl>`.
- Har GREEN'dan keyin `pnpm --filter @hisob24/web test`, so'ng commit. TDD jurnali: `$SCRATCH/tdd-log.md`.
- Interfeys o'zbekcha: tugmalar "Menyu", "Menyuni yig'ish", "Menyuni yoyish", "Profil", "Chiqish", "Kompaniyani almashtirish", "Mavzuni almashtirish".

## Fayl tuzilmasi

| Fayl | Vazifa |
|---|---|
| `components/ui/{sheet,tooltip,dropdown-menu}.tsx` | shadcn primitivlari (`sheet` da "Yopish") |
| `app/globals.css` | `scrollbar-hide` |
| `lib/nav.ts` (+test) | bo'limlar, `navFor(role)`, `isCurrent(href, pathname)` |
| `lib/use-sidebar.ts` (+test) | `open` (telefon menyusi), `collapsed` (localStorage) |
| `components/shell/sidebar.tsx` (+test) | aside (`w-64 ↔ w-16`) + telefon uchun `Sheet` |
| `components/shell/topbar.tsx` (+test) | menyu tugmasi, mavzu, profil menyusi |
| `components/shell/app-shell.tsx` (+test) | darvoza + qobiq |
| `app/(app)/layout.tsx` | `<AppShell>` |
| `components/dashboard.tsx` (+test) | faqat mazmun |
| `e2e/shell.spec.ts`, `e2e/login.spec.ts`, `e2e/miniapp.spec.ts` | qobiq oqimlari; "Chiqish" profil menyusida |

---

### Task 1: UI primitivlar

- [ ] `pnpm --filter @hisob24/web exec shadcn add sheet tooltip dropdown-menu`.
- [ ] **RED** `components/ui/sheet.test.tsx`: ochiq sheet'ning yopish tugmasi "Yopish" (shadcn "Close" beradi). **GREEN**: `sr-only` matni "Yopish". Commit: `feat(web): sheet, tooltip and dropdown menu`
- [ ] `globals.css`: `@utility scrollbar-hide` (uslub, testsiz).

### Task 2: `lib/nav.ts` (2 sikl)

```ts
export interface NavItem { label: string; href: string; icon: LucideIcon; ownerOnly?: boolean }
export function navFor(role: Role | undefined): NavItem[]
export function isCurrent(href: string, pathname: string): boolean
```
- [ ] **RED** `navFor`: owner → "Bosh sahifa", "Xodimlar"; `user` va `undefined` → faqat "Bosh sahifa". **GREEN**. Commit: `feat(web): the app's sections, by role`
- [ ] **RED** `isCurrent`: `/` faqat `/` da; `/employees` `/employees` va `/employees/…` da, `/employees-x` da emas. **GREEN**. Commit: `feat(web): tell the section a page belongs to`

### Task 3: `lib/use-sidebar.ts` (2 sikl)

- [ ] **RED**: yoyilgan holda boshlanadi; `toggleCollapsed` yig'adi va `localStorage["sidebar_collapsed"] = "true"` yozadi; yana bosilsa yoyiladi. **GREEN**. Commit: `feat(web): the sidebar folds, and remembers it`
- [ ] **RED**: saqlangan `"true"` bilan yig'ilgan holda ochiladi; `setOpen` telefon menyusini ochadi va yopadi. **GREEN** (agar birinchi sikl kodi bilan o'tsa, xarakteristika). Commit: `test(web): the sidebar opens the way it was left`

### Task 4: `Sidebar` (4 sikl)

Props: `{ open, onOpenChange, collapsed, onToggleCollapsed }`. Aside `aria-label="Menyu"`, nav `aria-label="Bo'limlar"`.

- [ ] **RED** bo'limlar rol bo'yicha: owner (Ali) "Bosh sahifa" va "Xodimlar" ni ko'radi; xodim (Vali, Olma Savdo) "Xodimlar" ni ko'rmaydi; sarlavhada kompaniya nomi. **GREEN**. Commit: `feat(web): the sidebar lists the sections the role may open`
- [ ] **RED** joriy bo'lim: `/employees` da "Xodimlar" `aria-current="page"`, "Bosh sahifa" emas. **GREEN**. Commit: `feat(web): the sidebar marks the current section`
- [ ] **RED** yig'ish: "Menyuni yig'ish" → `onToggleCollapsed`; `collapsed` da yozuvlar yo'q, havolalar nomi saqlanadi (`aria-label`), "Menyuni yoyish" tugmasi bor. **GREEN**. Commit: `feat(web): the sidebar folds to icons`
- [ ] **RED** telefon menyusi: `open` da `dialog` ichida bo'limlar; bo'lim bosilsa `onOpenChange(false)`. **GREEN**. Commit: `feat(web): the sections open as a sheet on a phone`

### Task 5: `Topbar` (4 sikl)

Props: `{ onMenuClick }`.

- [ ] **RED** "Menyu" tugmasi `onMenuClick` ni chaqiradi; "Profil" menyusida ism va telefon. **GREEN**. Commit: `feat(web): the top bar with the menu button and who is signed in`
- [ ] **RED** chiqish: Profil → "Chiqish" → `leave("/login")`, token tozalanadi. **GREEN**. Commit: `feat(web): sign out from the profile menu`
- [ ] **RED** "Kompaniyani almashtirish" faqat ishlatsa bo'ladigan boshqa kompaniya bo'lsa (Vali: bor; Ali va Sardor: yo'q). **GREEN**. Commit: `feat(web): switch companies from the profile menu`
- [ ] **RED** mavzu tugmasi light ↔ dark; Telegram ichida mavzu tugmasi va "Chiqish" yo'q. **GREEN**. Commit: `feat(web): the theme button, and none of it inside Telegram`

### Task 6: `AppShell` va layout (3 sikl)

- [ ] **RED**: kompaniyali sessiyada bolalar va bo'limlar ko'rinadi; yuklanayotganda "Yuklanmoqda"; muddati o'tgan → `/expired`; kompaniya tanlanmagan → `/select-company` (bolalar chizilmaydi). **GREEN**. Commit: `feat(web): the app shell guards its pages and frames them`
- [ ] **RED**: yuklash yiqilsa sabab va "Qayta urinish". **GREEN**. Commit: `feat(web): the shell says why it could not load`
- [ ] **RED** integratsiya: "Menyu" → sheet ochiladi, bo'lim tanlansa yopiladi; "Menyuni yig'ish" → qayta chizilganda ham yig'ilgan. **GREEN** (`useSidebar` ulanishi). Commit: `feat(web): the shell wires the menu and the fold`
- [ ] `app/(app)/layout.tsx` → `AppShell`. `Dashboard`: header, yuklanish, xato va yo'naltirish olib tashlanadi; testlari `AppShell` va `Topbar` testlariga ko'chadi. Commit: `refactor(web): the dashboard is content, the shell frames it`

### Task 7: e2e

- [ ] `e2e/shell.spec.ts` (375px + desktop):
  - desktop: sidebar ko'rinadi, "Menyuni yig'ish" → kengligi 64px, reload'dan keyin ham; "Menyuni yoyish" → 256px;
  - telefon: sidebar yashirin, "Menyu" → bo'limlar, tanlansa yopiladi;
  - `/` da yon scroll yo'q; xodim "Xodimlar" ni ko'rmaydi.
- [ ] `e2e/login.spec.ts`: chiqish profil menyusi orqali. `e2e/miniapp.spec.ts`: profil menyusida "Chiqish" yo'q.
- [ ] Commit: `test(web): e2e for the app shell`

### Task 8: Bosqich yakuni

- [ ] `make lint` → `make test` → `make e2e`.
- [ ] curl: `/` cookie'siz → `/login` ga; cookie bilan 200 va qobiq belgilari (`Menyu`) HTML'da.
- [ ] Dizayn hujjatiga "3-bosqich qarorlari"; `git push origin main`; hisobot.

## Self-review

- Spec qamrovi: enwin'dan olinadigan har band (aside o'lchamlari, sarlavha, bo'lim uslubi, tooltip, Sheet, topbar, profil menyusi, localStorage) Task 4–6 da; Mini App qoidasi Task 5; `ownerOnly` Task 2 va 4.
- "Xodimlar" sahifasining o'zi 4-bosqichda: shu bosqich oxirida havola bor, sahifa hali yo'q (keyingi bosqich darhol boshlanadi).
- Nomlar izchil: `navFor`, `isCurrent`, `useSidebar` (`open`, `setOpen`, `collapsed`, `toggleCollapsed`), `Sidebar`, `Topbar`, `AppShell`.
