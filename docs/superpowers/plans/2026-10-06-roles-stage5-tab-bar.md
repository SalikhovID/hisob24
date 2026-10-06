# Rollar, 5-bosqich: pastki tab-bar (web) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tor ekranda (768px dan tor: telefon brauzeri va Telegram Mini App) bo'limlar chapdan chiqadigan `Sheet` o'rniga pastdagi tab-bar'da; Telegram'da qobiq balandligi va pastki xavfsiz zona hisobga olinadi, vertikal swipe o'chiriladi. Keng ekranda sidebar o'zgarmaydi.

**Architecture:**
- `components/shell/tab-bar.tsx` (yangi): `navFor(me.data?.permissions)` dan 1–5 tugma, `isCurrent` bilan joriy; `md:hidden`; `pb-safe`.
- `app-shell.tsx`: `<main>` ostida `<TabBar />`, `data-slot="app-shell"`; `sidebar.tsx`: `Sheet`, `open` / `onOpenChange` yo'q; `topbar.tsx`: "Menyu" tugmasi yo'q; `use-sidebar.ts`: `open` / `setOpen` yo'q.
- `telegram-sync.tsx`: `disableVerticalSwipes?.()`; `types/telegram.d.ts`; `app/layout.tsx` `viewport.viewportFit = "cover"`; `globals.css`: `@utility pb-safe`, `html[data-telegram]` qobiq balandligi (`--tg-viewport-stable-height`) va `overscroll-behavior`.
- e2e: `helpers.ts` `sections()` telefonda tab-bar (Menyu bosilmaydi), `employees.spec.ts` ham; `shell.spec.ts` telefon tarmoqlari tab-bar; `miniapp.spec.ts` tab-bar ko'rinadi.

**Tech Stack:** Next.js 16, Tailwind v4, Vitest + RTL, Playwright.

---

### Task 1: `TabBar` va qobiq
- [x] Test: `tab-bar.test.tsx` (egasi 5 tugma, joriy `aria-current`; rolli xodim faqat ruxsatli; sessiya noma'lum → Bosh sahifa), `app-shell.test.tsx` (tab-bar `main` dan keyin, "Menyu" yo'q), `sidebar.test.tsx` (sheet testlari olib tashlanadi: talab o'zgardi), `topbar.test.tsx` (`onMenuClick` yo'q), `use-sidebar.test.tsx` (sheet testi olib tashlanadi), `telegram-sync.test.tsx` (`disableVerticalSwipes`).
- [x] Kod → GREEN → commit `feat(web): the sections in a tab bar on a phone`.

### Task 2: e2e va yakun
- [x] `helpers.ts`, `employees.spec.ts`, `shell.spec.ts`, `miniapp.spec.ts`; README; `make lint`, `make test`, `make e2e`; spec "5-bosqich qarorlari"; push.
