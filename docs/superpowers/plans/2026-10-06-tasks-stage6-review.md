# Vazifalar, 6-bosqich: yakuniy ko'rik — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 4 va 5-bosqichlarda yozilgan kod ko'rikdan o'tadi, testlar mutatsiya bilan tekshiriladi, butun oqim lokal haqiqiy stack'da (Go API + Postgres + user app) brauzerda o'tadi; topilgan kamchiliklar TDD bilan tuzatiladi; push.

**Architecture:** o'zgarmaydi. Tuzatishlar faqat ko'rikda topilgan narsalar uchun.

**Tech Stack:** Go, Next 16, Playwright (haqiqiy stack'ga qarshi vaqtinchalik config va spec), psql.

Qoidalar: `logic/tasks.md`, `logic/customers.md`. Dizayn: `docs/superpowers/specs/2026-10-06-tasks-design.md` ("Tekshiruv").

---

## Kelishuvlar

- Mutatsiya: faylning nusxasi scratchpad'ga olinadi, mutatsiya qo'lda, test `-timeout` bilan yuguriladi, fayl nusxadan tiklanadi (`git checkout` emas).
- Haqiqiy stack: API binary `:8080` da `SMS_DRIVER=log` bilan (kod log'dan o'qiladi), `next dev` `:3000` da `API_URL=http://127.0.0.1:8080`; Playwright vaqtinchalik `playwright.real.tmp.config.ts` (MSW'siz, `baseURL` 3000, telefon va desktop) va `e2e/real.tmp.spec.ts`; ikkisi ham commit'dan oldin o'chiriladi. Sinov ma'lumoti shu ishga xos nom bilan, oxirida SQL bilan tozalanadi, satrlar boshlang'ich holat bilan solishtiriladi.

### Task 1: Kod ko'rigi

- [ ] `backend/internal/task/tasks.go`, `internal/app/tasks.go`, `mocks/tasks.ts`, `lib/queries.ts` (`moveInColumns`), `task-board.tsx`, `task-dialog.tsx`, `customer-picker.tsx`, `task-page.tsx` qayta o'qiladi: hujjat bilan farqlar (`logic/tasks.md` 6: raqamli qidiruv mijozning butun son maydonlarida ham), chekka holatlar, a11y, ortiqcha so'rovlar.
- [ ] Topilgan har kamchilik: RED → GREEN → commit.

### Task 2: Mutatsiya tekshiruvi

- [ ] Go: `customer.Delete` da `customer_in_use` tekshiruvi olib tashlanadi → `TestACustomerWithTasksIsNotDeleted` yiqiladi; `sameAssignee` doim `false` → `TestUpdateThatChangesNothingWritesNothing` yiqiladi; `Create` da mijoz tekshiruvi maydonlardan oldinga → `TestCreateRefusals` ("the answers are told before the customer") yiqiladi.
- [ ] Web: `deadlineOf` yakuniyda ham `overdue` → `lib/tasks.test.ts` yiqiladi; `CustomerPicker` 3 raqam qoidasi 1 ga → `customer-picker.test.tsx` yiqiladi; `moveInColumns` tartiblamaydi → `task-board.test.tsx` yiqiladi.
- [ ] Har mutatsiyadan keyin fayl nusxadan tiklanadi, testlar yana yashil.

### Task 3: Haqiqiy stack'da oqim

- [ ] API va web fonda; `real.tmp.spec.ts` (desktop va telefon): egasi Sozlamalarda bosqich ("Tekshiruv", rang) va tur ("Buyurtma", maydon "Izoh") yaratadi; xodim yangi mijoz bilan vazifa qo'shadi; ikkinchisida telefonning 3 raqamini yozib taklifdan mavjud mijozni tanlaydi (maydonlar to'ldirilgan va `disabled`); kanban'da sudrab (desktop) va menyu bilan (telefon) ko'chiradi; "+" bosqich tanlangan dialog ochadi; yakuniy ustunni ochib yopadi; muddati o'tgan vazifa qizil "N kun kechikdi" bilan; tahrirlaydi; egasi tarixni va mijoz sahifasidagi vazifalarni ko'radi; vazifasi bor mijoz va bosqich o'chmaydi (toast); vazifani o'chiradi; har sahifada yon scroll yo'q.
- [ ] Admin API orqali yangi kompaniya tayyor bosqich va tur bilan yaratiladi (SQL bilan tekshiriladi).
- [ ] Sinov ma'lumoti tozalanadi; vaqtinchalik fayllar o'chiriladi.

### Task 4: Yakun

- [ ] `make lint`, `make test`, `make e2e`; `git push origin main`; spec'ga "6-bosqich qarorlari"; yakuniy hisobot (har funksiya uchun RED → GREEN).
