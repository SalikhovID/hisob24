# Tekis qayta dizayn, 1-bosqich: poydevor — reja

> **Bajaruvchiga:** superpowers:executing-plans bilan, vazifama-vazifa, shu sessiyada (subagent vositasi yo'q). Qadamlar `- [ ]` belgilari bilan kuzatiladi.

**Maqsad:** user app'ning tokenlari, shrifti, o'lchamlari va umumiy komponentlari prototip `228b1108` ning tekis uslubiga o'tadi; sahifalar eski tuzilishida, lekin yangi ranglarda va zichlikda ishlayveradi.

**Arxitektura:** telefon qiymatlari asosiy, `@media (min-width: 48rem)` web qiymatlari (tokenlar va `--text-*` o'zgaruvchilari orqali). Shisha utility'lari o'chiriladi, o'rniga oddiy Tailwind klasslari (`bg-primary text-primary-foreground`, `bg-muted`) va bitta `surface` (tekis karta: telefonda halqasiz, webda `--border` halqa). Yangi kit bo'laklari TDD bilan.

**Texnologiyalar:** Next 16, Tailwind v4 (`@theme inline`, `@utility`), Base UI, Vitest + RTL, Playwright (skrinshot uchun vaqtinchalik spec).

Spec: `docs/superpowers/specs/2026-11-03-flat-redesign-design.md` (2–4-bo'limlar).

---

## Fayllar

- `apps/web/app/globals.css`, `apps/web/app/globals.test.ts` — tokenlar, o'lchamlar, utility'lar.
- `apps/web/app/layout.tsx` — Inter (`--font-inter`).
- `apps/web/components/kit/*` va `apps/web/components/ui/*` — qayta uslublash (har biri o'z testi bilan).
- Yangi: `kit/data-table.tsx`, `kit/stat-cards.tsx` (`stat-card.tsx` kengayadi), `kit/page-tabs.tsx`, `kit/toolbar.tsx`, `kit/split.tsx`, `kit/sum-bar.tsx`, `kit/page-actions.tsx` va testlari.
- Glass utility'larini ishlatgan sahifa fayllari: klasslar almashtiriladi (`glossy` → `bg-primary text-primary-foreground`, `glossy-red` → `bg-destructive text-white`, `glass-chip` → `bg-muted`, `bg-ambient` → `bg-background`).

## Vazifalar

### 1. Tokenlar va utility'lar

- [ ] `globals.test.ts` ni yangi talablarga qayta yozish (RED): `:root` telefon yorug' (`--background: #f2f2f7`, `--card: #ffffff`, `--primary: #17595f`, `--foreground: #17181b`, `--muted-foreground: #6b6e76`, `--destructive: #b42a22`, `--positive: #1d6e43`, `--brand: #174449`), `@media (min-width: 48rem)` ichida `:root` web (`--background: #ffffff`, `--group-ring: 0 0 0 1px var(--border)`), `.dark` telefon (`#000000`, `#1c1c1e`, `#5cc4bc`, `#062a2c`), webdagi `.dark` (`--background: #1a1a1d`, `--sidebar: #111113`); `--text-base: var(--fs-base)` va `--fs-base: 17px` / `13px`; shrift `"Inter"` va `var(--font-inter)`; shisha tokenlari va utility'lari yo'q (`--ambient`, `--sheen`, `--rim`, `--btn`, `@utility glossy`, `@utility glass-chip`, `@utility bg-ambient`, `backdrop-filter: blur(12px)` skrimda); `surface` = `var(--card)` + `var(--group-ring)`; tab-bar `::before` `color-mix(in srgb, var(--card) 80%, transparent)` + `blur(24px) saturate(1.8)`; yurgan sahifa `var(--background)` bilan.
- [ ] `pnpm vitest run app/globals.test.ts` — yiqiladi (eski qiymatlar).
- [ ] `globals.css` ni yozish (GREEN), `body` `bg-background`.
- [ ] Glass klasslarini sahifalarda almashtirish (`glossy`, `glossy-red`, `glass-chip`, `gloss`, `bg-ambient`, `scrim` → `bg-scrim`), test fayllaridagi o'sha klass tasdiqlari bilan birga (talab o'zgardi).
- [ ] `layout.tsx`: Geist → Inter.
- [ ] To'liq web unit testlari; commit `feat(web): the flat redesign's tokens, sizes and font`.

### 2. Komponentlarni qayta uslublash (har biri: test RED → klasslar GREEN → commit)

- [ ] `kit/group.tsx`: `Group` `rounded-[12px] surface md:rounded-[10px] md:p-1`; `Row` telefonda `min-h-[52px] px-4 py-2.5 font-normal`, webda `md:min-h-12 md:rounded-lg md:px-3 md:py-2 md:font-medium`, bosilganda / hover `bg-muted`; ajratgich: telefonda chapdan 16px `--separator`, webda to'liq `--line-faint` (`globals.css`); `KeyValue` telefonda kalit `text-foreground`, qiymat `text-muted-foreground`, webda teskari; `SectionHeading` 13px / 12px/500 `muted`; `Foot` 13px / 12px `--faint`.
- [ ] `kit/page-title.tsx`: sarlavha `text-[32px] font-bold md:text-[20px] md:font-semibold`, izoh `text-md md:text-[13px]`; `BrandMark` sarlavhadan olib tashlanadi; `PlusButton` telefonda 36px dumaloq `bg-primary`, webda matnli urg'u tugma (`label` ko'rinadi: «+ Mijoz qo'shish»); `BackLink` Telegram'da yashirin (`[html[data-telegram]_&]:hidden`).
- [ ] `ui/button.tsx`: variantlar prototipniki (`default` urg'u, `secondary` oq halqali, `ghost`, `destructive` yumshoq qizil; o'lchamlar 32/28/40px).
- [ ] `ui/badge.tsx`: 24px / 20px, `tone` va `dot`.
- [ ] `kit/chips.tsx`, `kit/segmented.tsx`, `kit/search-box.tsx`: 3-jadval o'lchamlari.
- [ ] `kit/form-row.tsx`: yorliq ustida (`Field` ko'rinishi), maydon `--field` fonda; `PickRow` `.sel` ko'rinishli.
- [ ] `kit/main-button.tsx`: 50px / 40px, `bg-primary`; `MainBar` gradientsiz.
- [ ] `ui/dialog.tsx`: telefonda pastdan varaq (`rounded-t-[38px]`, `bg-[var(--sheet)]`, tutqich, sarlavha chapda, «×» o'ngda), webda o'rtada 480px (`rounded-xl`, `--shadow-float`, pastki panel chiziqli); `ui/alert-dialog.tsx` xuddi shunday; `kit/action-sheet.tsx` tekis.
- [ ] `ui/switch.tsx`: 51×31 yashil / 32×18 urg'u; `ui/sonner.tsx`: pastda.
- [ ] `avatar.tsx` va `kit/avatar.tsx`: nom xeshi bo'yicha rang (`#c98f6e #6f9b7d #7b86c7 #c47a9e #8c9ab0 #c2a35a`), oq bitta harf.
- [ ] `kit/hero.tsx`, `kit/amount.tsx`, `kit/stat-card.tsx`, `kit/detail-head.tsx` (`Tiles`), `kit/tile-icon.tsx`, `kit/banner.tsx`, `states.tsx`, `refusal.tsx`: tekis uslub.

### 3. Yangi bo'laklar (TDD)

- [ ] `kit/data-table.tsx`: `DataTable<T>({ rows, columns, mobileRow, href?, onRow?, label, empty })` — webda `<table>` (`hidden md:block`), telefonda `Group label` qatorlari (`md:hidden`); qator `href` bo'lsa havola.
- [ ] `kit/stat-cards.tsx`: `StatCards` (`grid-cols-2 md:grid-cols-4`, `three`), `StatCard` (`label`, `value`, `sub`, `href`, `tone`, bola).
- [ ] `kit/page-tabs.tsx`: `PageTabs` (havolalar, joriysi `aria-current="page"`), `InPageTabs` (holat, `role="tablist"`).
- [ ] `kit/toolbar.tsx`, `kit/split.tsx`, `kit/sum-bar.tsx`, `kit/page-actions.tsx`.

### 4. Bosqich oxiri

- [ ] Vaqtinchalik skrinshot spec (telefon va desktop, yorug' va qorong'i) — ko'rib chiqish, o'chirish.
- [ ] `make lint`, `make test`, `make e2e`; yiqilganlar talab o'zgarishi bo'lsa yangilanadi (hisobotda sababi bilan).
- [ ] `git push origin dev`.
