# Lokatsiyalar, 6-bosqich: xodim cheklovi (web) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Egasi Xodimlar sahifasida xodimni lokatsiyalar bilan cheklaydi yoki cheklovni olib tashlaydi; ro'yxatda har xodimning lokatsiyalari (`logic/locations.md`, 5-bo'lim); README.

**Architecture:**
- `employees-page.tsx`: 2+ lokatsiyada "Lokatsiyalar" ustuni ("Barchasi" / nomlar / "—"); egasiga `EmployeeLocationsDialog` tugmasi (`MapPinIcon`, `user` qatorlarida).
- `employee-locations-dialog.tsx`: "Lokatsiyalarni o'zgartirish"; "Barcha lokatsiyalar" checkbox + har lokatsiyaga checkbox (`me.locations`); izoh; ogohlantirish "Boshqa lokatsiyalarda N ta vazifaga mas'ul" (`useQueries`: har lokatsiyaga `GET /app/tasks?assignee=&location_id=&page=1`, tanlanmaganlar `total` yig'indisi); "Kamida bitta lokatsiyani tanlang"; `PUT …/locations` → `employeesKey`, `membersKey` invalidatsiya, toast "Lokatsiyalar o'zgartirildi".
- `lib/queries.ts`: `useAssignedCounts(companyId, phone, locations)`.
- Vitest, e2e, README "Lokatsiyalar".

---

### Task 1: Ustun va dialog
- [ ] `employees-page.test.tsx`: 1 lokatsiyada ustun yo'q; 2+ da ustun: egasi "Barchasi", cheklangan xodim nomlar, hammasi o'chirilgan "—"; tugma faqat egasiga va `user` qatorlarida; dialog: belgilar hozirgi holatdan (hammasi / tanlanganlar), "Barchasi" belgilansa ro'yxat o'chiq, hech biri yo'q → "Kamida bitta lokatsiyani tanlang", saqlash → toast, ustun yangilanadi, `db.members[VALI].locationIds`; ogohlantirish: Vali Asosiy'da 2 ta vazifaga mas'ul, Chilonzor tanlansa "Boshqa lokatsiyalarda 2 ta vazifaga mas'ul", Asosiy ham tanlansa yo'q; `employees.*` ruxsatli xodim ustunni ko'radi, tugmani ko'rmaydi. RED → kod → GREEN, commit.

### Task 2: e2e va README
- [ ] `e2e/locations.spec.ts` ga: egasi (Vali, Nok Market) Dilnoza'ni qo'shadi (`join`), Asosiy'da unga vazifa biriktiradi, "Chilonzor" bilan cheklaydi (dialog ogohlantiradi), Dilnoza kirgach tanlovchi yo'q, Asosiy'dagi vazifa ko'rinmaydi, Chilonzor'da vazifa qo'shadi; egasi "Asosiy"da vazifa formasida Dilnoza'ni mas'ul tanlovida ko'rmaydi; cheklov olingach Dilnoza ikkalasini ko'radi. README "Lokatsiyalar" bo'limi. `make lint`, `make test`, `make e2e`; spec'ga "5 va 6-bosqich qarorlari"; commit.
