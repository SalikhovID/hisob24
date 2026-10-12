# Mini App UI, 1-bosqich: poydevor (tokenlar va `kit` to'plami) — amalga oshirish rejasi

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `apps/web` ga prototipning tokenlarini (`globals.css`) va yangi `components/kit/*` primitivlarini (guruh/qator, sarlavhalar, plitkalar, chiplar, segmented, qidiruv, asosiy tugma, varaq-dialog, alert, action sheet, kalit, forma qatorlari, picker / sana / summa varaqlari, holatlar, toast, kartalar, hero, banner, tab ikonkalari) testlari bilan kiritish; mavjud sahifalar eski komponentlar bilan ishlayveradi (yangi ranglarda).

**Architecture:** Prototip CSS o'zgaruvchilari shadcn token nomlariga ulanadi, shunda `bg-card`, `text-muted-foreground` kabi classlar ishlayveradi; yetishmaganlari yangi token (`--press`, `--heading`, `--primary-soft`, `--sheet`, `--menu`, `--glass`, …). Primitivlar Base UI (Dialog, Tabs, Switch, Radio) ustida, Tailwind v4 classlari bilan, har biri `data-slot` belgisi bilan. Varaq-dialog `components/ui/dialog.tsx` ning o'zi (API o'zgarmaydi: `role="dialog"`, «Yopish» tugmasi), shunda ~30 mavjud dialog shu bosqichdayoq varaq bo'lib ochiladi.

**Tech Stack:** Next 16 (App Router), React 19.2, Tailwind v4 (`@theme inline`), Base UI 1.8 (`@base-ui/react/*`), lucide-react, react-hook-form, Vitest + Testing Library (jsdom), Playwright (vaqtinchalik skrinshot spec).

---

## Ish tartibi

- Spec: `docs/superpowers/specs/2026-10-13-mini-app-ui-design.md`. Dizayn manbasi: artifact `6634ff38-…` (prototipning CSS classlari rejada qavsda: `.group`, `.row`, `.sh`, …).
- Har vazifa: testni yoz → `pnpm exec vitest run <fayl>` (ishchi papka `apps/web`) → yiqilishini ko'r (sabab: komponent yo'q, `Cannot find module` emas: avval bo'sh stub, yoki testda nima kutilgani aniq bo'lsin) → kod → o'tishini ko'r → `git add` aniq fayllar → commit (Conventional Commits, inglizcha, attribution qatorlari bilan).
- `cn` `@/lib/utils` dan; ikonkalar `lucide-react`; test yordamchilari `@testing-library/react`, `@testing-library/user-event`, `vitest`.
- Admin app'ga (`apps/admin`) tegilmaydi. Mavjud `components/avatar.tsx`, `identity.tsx`, `data-list.tsx`, `page-header.tsx`, `states.tsx` (nomlari saqlanadi) keyingi bosqichlarda almashtiriladi; shu bosqichda faqat `states.tsx` qayta uslublanadi (API o'sha).
- Vizual tekshiruv oxirida: vaqtinchalik `app/kit-preview/page.tsx` + vaqtinchalik Playwright spec bilan skrinshotlar (375 @2x, 1280; light / dark), ikkalasi commit'dan oldin o'chiriladi.

## Fayllar xaritasi

| Fayl | Mas'uliyati |
|---|---|
| `app/globals.css` (o'zgaradi) | tokenlar (light / dark / Telegram), radiuslar, matn o'lchamlari, soyalar, easing, avatar gradientlari, qator ajratgichlari, `pb-bar`, `pb-safe-*` |
| `app/layout.tsx` (o'zgaradi) | Geist `--font-geist` o'zgaruvchisi (shrift stack'i CSS'da) |
| `app/globals.test.ts` (yangi) | tokenlar borligini mahkamlaydi |
| `components/ui/badge.tsx` (o'zgaradi) + `badge.test.tsx` | 22px badge, `neutral \| accent \| red \| green \| warn`, `dot`; eski nomlar alias |
| `components/ui/button.tsx`, `ui/dropdown-menu.tsx`, `ui/skeleton.tsx` (o'zgaradi) | uslub: radiuslar, balandliklar, shisha menyu, skeleton rangi |
| `components/kit/avatar.tsx` + test | gradientli avatar (`.av`) |
| `components/kit/tile-icon.tsx` + test | `TileIcon` (`.tile-ic`), `sectionColors` |
| `components/kit/group.tsx` + test | `Group`, `Row`, `KeyValue`, `SectionHeading`, `Foot` |
| `components/kit/page-title.tsx` + test | `PageTitle`, `BackLink`, `PlusButton` |
| `components/kit/detail-head.tsx` + test | `DetailHead`, `Tiles`, `Tile` |
| `components/kit/chips.tsx` + test | `Chips`, `Chip`, `ChoiceChips` |
| `components/kit/segmented.tsx` + test | `Segmented` (Base UI Tabs + Indicator) |
| `components/kit/search-box.tsx` + test | `SearchBox` (debounce) |
| `components/kit/main-button.tsx` + test | `MainButton`, `MainBar` |
| `components/ui/dialog.tsx` (o'zgaradi) + `dialog.test.tsx` (kengayadi) | varaq (`.sheet`) |
| `components/ui/alert-dialog.tsx` (o'zgaradi) + `alert-dialog.test.tsx` (yangi) | `.alert` |
| `components/kit/action-sheet.tsx` + test | `ActionSheet` (`.asheet`) |
| `components/ui/switch.tsx` (yangi) + test | iOS kalit (`.sw`) |
| `components/kit/form-row.tsx` + test | `FormRow`, `TextRow`, `PhoneRow`, `AmountRow`, `PickRow`, `SwitchRow`, `OptionChips` |
| `components/kit/picker-sheet.tsx` + test | `PickerSheet`, `MultiPickerSheet`, `SelectRow`, `MultiSelectRow`, `SearchPickerSheet` |
| `components/kit/date-sheet.tsx` + test | `DateSheet`, `DateRow`, `DateTimeRow`, `monthGrid`, `addDays` |
| `components/kit/amount.tsx` + test | `Amount`, `splitAmount`, `groupDigits` |
| `components/kit/amount-sheet.tsx` + test | `nextAmount`, `amountToDecimal`, `Keypad`, `AmountSheet` |
| `components/states.tsx` (o'zgaradi) + `states.test.tsx` (kengayadi) | `Loading`, `ListLoading`, `Failed`, `EmptyState`, `NotFound`, `Splash`, `StateScreen` |
| `components/ui/sonner.tsx`, `components/refusal.tsx`, `components/history-list.tsx` (o'zgaradi) | toast, rad javobi, tarix uslubi (testlari o'sha) |
| `components/kit/stat-card.tsx` + test | `StatCard`, `Bars`, `Sparkline` |
| `components/kit/hero.tsx` + test | `Hero` |
| `components/kit/banner.tsx` + test | `HomeBanner` |
| `components/kit/tab-icons.tsx` + test | `tabIcons` (9 ta to'ldirilgan ikonka) |
| `components/sortable-list.tsx` (o'zgaradi) + test (kengayadi) | `sorting` rejimi, tutqich uslubi |

---

### Task 1: Tokenlar, shrift va asos CSS

**Files:**
- Modify: `apps/web/app/globals.css`
- Modify: `apps/web/app/layout.tsx:8,24`
- Test: `apps/web/app/globals.test.ts`

- [ ] **Step 1: Yiqiladigan testni yoz**

```ts
// apps/web/app/globals.test.ts
import { readFileSync } from "node:fs"
import { expect, test } from "vitest"

// The tokens are the prototype's: the pages take their colors from them.
const css = readFileSync(new URL("./globals.css", import.meta.url), "utf8")

const block = (selector: string) => {
  const start = css.indexOf(selector)
  expect(start, selector).toBeGreaterThan(-1)
  return css.slice(start, css.indexOf("}", start))
}

test("the light theme wears the prototype's colors", () => {
  const root = block(":root {")
  expect(root).toContain("--background: #EDEEF2")
  expect(root).toContain("--card: #ffffff")
  expect(root).toContain("--primary: #117A68")
  expect(root).toContain("--muted-foreground: #636368")
  expect(root).toContain("--press: #E2E3E8")
  expect(root).toContain("--sheet: #F2F2F7")
  expect(root).toContain("--positive: #1A7F37")
})

test("the dark theme wears the prototype's colors", () => {
  const dark = block(".dark {")
  expect(dark).toContain("--background: #000000")
  expect(dark).toContain("--card: #1C1C1E")
  expect(dark).toContain("--primary: #3CC5AE")
  expect(dark).toContain("--primary-foreground: #00261F")
})

test("inside Telegram the chat gives the colors", () => {
  const telegram = block("html[data-telegram] {")
  expect(telegram).toContain("--background: var(--tg-theme-secondary-bg-color)")
  expect(telegram).toContain("--primary: var(--tg-theme-button-color)")
  expect(telegram).toContain("--sheet: var(--tg-theme-secondary-bg-color)")
})

test("the radii, the text sizes and the font stack are the prototype's", () => {
  const theme = block("@theme inline {")
  expect(theme).toContain("--radius-group: 22px")
  expect(theme).toContain("--radius-sheet: 36px")
  expect(theme).toContain("--radius-main: 14px")
  expect(theme).toContain("--text-base: 17px")
  expect(theme).toContain("--text-md: 15px")
  expect(theme).toMatch(/--font-sans: -apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", var\(--font-geist\)/)
  expect(css).toContain("@utility pb-bar")
})
```

- [ ] **Step 2: Yiqilishini ko'r**

Run: `cd apps/web && pnpm exec vitest run app/globals.test.ts`
Expected: FAIL — `expected '...' to contain '--background: #EDEEF2'` (hozirgi `oklch` qiymatlar).

- [ ] **Step 3: `globals.css` ni yoz**

Faylni to'liq shu bilan almashtir:

```css
@import "tailwindcss";
@import "tw-animate-css";
@import "shadcn/tailwind.css";

@custom-variant dark (&:is(.dark *));

@theme inline {
    /* The prototype's stack: the system's SF on Apple devices, Geist (next/font) elsewhere. */
    --font-sans: -apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", var(--font-geist), system-ui, "Segoe UI", sans-serif;
    --font-heading: var(--font-sans);
    --color-sidebar-ring: var(--sidebar-ring);
    --color-sidebar-border: var(--sidebar-border);
    --color-sidebar-accent-foreground: var(--sidebar-accent-foreground);
    --color-sidebar-accent: var(--sidebar-accent);
    --color-sidebar-primary-foreground: var(--sidebar-primary-foreground);
    --color-sidebar-primary: var(--sidebar-primary);
    --color-sidebar-foreground: var(--sidebar-foreground);
    --color-sidebar: var(--sidebar);
    --color-chart-5: var(--chart-5);
    --color-chart-4: var(--chart-4);
    --color-chart-3: var(--chart-3);
    --color-chart-2: var(--chart-2);
    --color-chart-1: var(--chart-1);
    --color-ring: var(--ring);
    --color-input: var(--input);
    --color-border: var(--border);
    --color-destructive: var(--destructive);
    --color-destructive-soft: var(--destructive-soft);
    --color-accent-foreground: var(--accent-foreground);
    --color-accent: var(--accent);
    --color-muted-foreground: var(--muted-foreground);
    --color-muted: var(--muted);
    --color-secondary-foreground: var(--secondary-foreground);
    --color-secondary: var(--secondary);
    --color-primary-foreground: var(--primary-foreground);
    --color-primary: var(--primary);
    --color-primary-soft: var(--primary-soft);
    --color-popover-foreground: var(--popover-foreground);
    --color-popover: var(--popover);
    --color-card-foreground: var(--card-foreground);
    --color-card: var(--card);
    --color-foreground: var(--foreground);
    --color-background: var(--background);
    --color-brand: var(--brand);
    --color-brand-panel: var(--brand-panel);
    --color-brand-panel-foreground: var(--brand-panel-foreground);
    /* The prototype's own tokens. */
    --color-press: var(--press);
    --color-heading: var(--heading);
    --color-positive: var(--positive);
    --color-positive-soft: var(--positive-soft);
    --color-warning: var(--warning);
    --color-warning-soft: var(--warning-soft);
    --color-glass: var(--glass);
    --color-glass-edge: var(--glass-edge);
    --color-menu: var(--menu);
    --color-sheet: var(--sheet);
    --color-sheet-cell: var(--sheet-cell);
    --color-scrim: var(--scrim);
    --color-skeleton: var(--skel);
    --radius-sm: calc(var(--radius) * 0.6);
    --radius-md: calc(var(--radius) * 0.8);
    --radius-lg: var(--radius);
    --radius-xl: calc(var(--radius) * 1.4);
    --radius-2xl: calc(var(--radius) * 1.8);
    --radius-3xl: calc(var(--radius) * 2.2);
    --radius-4xl: calc(var(--radius) * 2.6);
    --radius-badge: 7px;
    --radius-main: 14px;
    --radius-tile: 18px;
    --radius-group: 22px;
    --radius-sheet: 36px;
    /* The prototype's type scale: 17px rows, 15px secondary, 14px small, 13px notes. */
    --text-xs: 13px;
    --text-xs--line-height: 1.3;
    --text-sm: 14px;
    --text-sm--line-height: 1.35;
    --text-md: 15px;
    --text-md--line-height: 1.35;
    --text-base: 17px;
    --text-base--line-height: 1.3;
    --shadow-float: var(--shadow);
    --shadow-bar: 0 10px 30px rgba(0, 0, 0, 0.13), 0 1px 2px rgba(0, 0, 0, 0.06);
    --ease-out-expo: cubic-bezier(0.23, 1, 0.32, 1);
    --ease-drawer: cubic-bezier(0.32, 0.72, 0, 1);
    --ease-spring: cubic-bezier(0.34, 1.4, 0.52, 1);
}

:root {
    --background: #EDEEF2;
    --foreground: #000000;
    --card: #ffffff;
    --card-foreground: #000000;
    --popover: #ffffff;
    --popover-foreground: #000000;
    --primary: #117A68;
    --primary-foreground: #ffffff;
    --primary-soft: rgba(17, 122, 104, 0.12);
    --secondary: rgba(118, 118, 128, 0.12);
    --secondary-foreground: #000000;
    --muted: rgba(118, 118, 128, 0.12);
    --muted-foreground: #636368;
    --accent: rgba(118, 118, 128, 0.12);
    --accent-foreground: #000000;
    --destructive: #D92D20;
    --destructive-soft: rgba(217, 45, 32, 0.1);
    --positive: #1A7F37;
    --positive-soft: rgba(26, 127, 55, 0.12);
    --warning: #A15C00;
    --warning-soft: rgba(255, 149, 0, 0.14);
    --border: rgba(60, 60, 67, 0.17);
    --input: rgba(60, 60, 67, 0.17);
    --ring: #117A68;
    --press: #E2E3E8;
    --heading: #3A3A3F;
    --glass: rgba(255, 255, 255, 0.56);
    --glass-edge: rgba(255, 255, 255, 0.9);
    --menu: rgba(250, 250, 252, 0.86);
    --sheet: #F2F2F7;
    --sheet-cell: #ffffff;
    --scrim: rgba(0, 0, 0, 0.26);
    --shadow: 0 12px 34px rgba(0, 0, 0, 0.14);
    --skel: rgba(0, 0, 0, 0.065);
    --chart-1: oklch(0.87 0 0);
    --chart-2: oklch(0.556 0 0);
    --chart-3: oklch(0.439 0 0);
    --chart-4: oklch(0.371 0 0);
    --chart-5: oklch(0.269 0 0);
    --radius: 14px;
    /* The logo's color: the brand's own on a light page, white on a dark one,
       the chat's text color inside Telegram (its background is the chat's). */
    --brand: #174449;
    /* The brand's own surface (the login's panel) and what stands on it: the
       same in light and in dark, as the surface's color is known. */
    --brand-panel: #174449;
    --brand-panel-foreground: #ffffff;
    --sidebar: #EDEEF2;
    --sidebar-foreground: #000000;
    --sidebar-primary: #117A68;
    --sidebar-primary-foreground: #ffffff;
    --sidebar-accent: rgba(17, 122, 104, 0.12);
    --sidebar-accent-foreground: #117A68;
    --sidebar-border: rgba(60, 60, 67, 0.17);
    --sidebar-ring: #117A68;
    color-scheme: light;
}

.dark {
    --background: #000000;
    --foreground: #ffffff;
    --card: #1C1C1E;
    --card-foreground: #ffffff;
    --popover: #1C1C1E;
    --popover-foreground: #ffffff;
    --primary: #3CC5AE;
    --primary-foreground: #00261F;
    --primary-soft: rgba(60, 197, 174, 0.16);
    --secondary: rgba(118, 118, 128, 0.24);
    --secondary-foreground: #ffffff;
    --muted: rgba(118, 118, 128, 0.24);
    --muted-foreground: #98989F;
    --accent: rgba(118, 118, 128, 0.24);
    --accent-foreground: #ffffff;
    --destructive: #FF6961;
    --destructive-soft: rgba(255, 105, 97, 0.16);
    --positive: #4CD27A;
    --positive-soft: rgba(76, 210, 122, 0.15);
    --warning: #FFB340;
    --warning-soft: rgba(255, 179, 64, 0.16);
    --border: rgba(84, 84, 88, 0.6);
    --input: rgba(84, 84, 88, 0.6);
    --ring: #3CC5AE;
    --press: #2C2C2E;
    --heading: #D1D1D6;
    --glass: rgba(40, 40, 44, 0.5);
    --glass-edge: rgba(255, 255, 255, 0.16);
    --menu: rgba(38, 38, 42, 0.88);
    --sheet: #1C1C1E;
    --sheet-cell: #2C2C2E;
    --scrim: rgba(0, 0, 0, 0.55);
    --shadow: 0 12px 34px rgba(0, 0, 0, 0.55);
    --skel: rgba(255, 255, 255, 0.08);
    --chart-1: oklch(0.87 0 0);
    --chart-2: oklch(0.556 0 0);
    --chart-3: oklch(0.439 0 0);
    --chart-4: oklch(0.371 0 0);
    --chart-5: oklch(0.269 0 0);
    --brand: #ffffff;
    --sidebar: #000000;
    --sidebar-foreground: #ffffff;
    --sidebar-primary: #3CC5AE;
    --sidebar-primary-foreground: #00261F;
    --sidebar-accent: rgba(60, 197, 174, 0.16);
    --sidebar-accent-foreground: #3CC5AE;
    --sidebar-border: rgba(84, 84, 88, 0.6);
    --sidebar-ring: #3CC5AE;
    color-scheme: dark;
}

/* Inside Telegram (TelegramSync sets data-telegram) the app wears the
   chat's colors: telegram-web-app.js publishes themeParams as --tg-theme-*.
   The fallbacks cover clients older than Bot API 7.0. The soft tints are
   mixed from the chat's own colors; the statuses (green, amber) keep their
   own hues. */
html[data-telegram] {
    --background: var(--tg-theme-secondary-bg-color);
    --foreground: var(--tg-theme-text-color);
    --card: var(--tg-theme-section-bg-color, var(--tg-theme-bg-color));
    --card-foreground: var(--tg-theme-text-color);
    --popover: var(--tg-theme-section-bg-color, var(--tg-theme-bg-color));
    --popover-foreground: var(--tg-theme-text-color);
    --primary: var(--tg-theme-button-color);
    --primary-foreground: var(--tg-theme-button-text-color);
    --primary-soft: color-mix(in srgb, var(--tg-theme-button-color) 12%, transparent);
    --secondary: color-mix(in srgb, var(--tg-theme-hint-color) 14%, transparent);
    --secondary-foreground: var(--tg-theme-text-color);
    --muted: color-mix(in srgb, var(--tg-theme-hint-color) 14%, transparent);
    --muted-foreground: var(--tg-theme-hint-color);
    --accent: color-mix(in srgb, var(--tg-theme-hint-color) 14%, transparent);
    --accent-foreground: var(--tg-theme-text-color);
    --destructive: var(--tg-theme-destructive-text-color, #D92D20);
    --destructive-soft: color-mix(in srgb, var(--tg-theme-destructive-text-color, #D92D20) 12%, transparent);
    --border: var(--tg-theme-section-separator-color, color-mix(in srgb, var(--tg-theme-hint-color) 30%, transparent));
    --input: var(--tg-theme-section-separator-color, color-mix(in srgb, var(--tg-theme-hint-color) 30%, transparent));
    --ring: var(--tg-theme-button-color);
    --press: color-mix(in srgb, var(--tg-theme-text-color) 8%, var(--tg-theme-section-bg-color, var(--tg-theme-bg-color)));
    --heading: color-mix(in srgb, var(--tg-theme-text-color) 85%, var(--tg-theme-secondary-bg-color));
    --glass: color-mix(in srgb, var(--tg-theme-bg-color) 60%, transparent);
    --glass-edge: color-mix(in srgb, var(--tg-theme-text-color) 12%, transparent);
    --menu: color-mix(in srgb, var(--tg-theme-section-bg-color, var(--tg-theme-bg-color)) 88%, transparent);
    --sheet: var(--tg-theme-secondary-bg-color);
    --sheet-cell: var(--tg-theme-section-bg-color, var(--tg-theme-bg-color));
    --skel: color-mix(in srgb, var(--tg-theme-text-color) 7%, transparent);
    --sidebar: var(--tg-theme-secondary-bg-color);
    --sidebar-foreground: var(--tg-theme-text-color);
    --sidebar-primary: var(--tg-theme-button-color);
    --sidebar-primary-foreground: var(--tg-theme-button-text-color);
    --sidebar-accent: color-mix(in srgb, var(--tg-theme-button-color) 12%, transparent);
    --sidebar-accent-foreground: var(--tg-theme-button-color);
    --brand: var(--tg-theme-text-color);
    --brand-panel: var(--tg-theme-secondary-bg-color);
    --brand-panel-foreground: var(--tg-theme-text-color);
}

/* A list that scrolls without showing its scrollbar: the sidebar's sections,
   the chips, a sheet's body. */
@utility scrollbar-hide {
  -ms-overflow-style: none;
  scrollbar-width: none;

  &::-webkit-scrollbar {
    display: none;
  }
}

/* The bottom tab bar keeps clear of the phone's home indicator and, inside
   Telegram (Bot API 8.0+ publishes --tg-safe-area-inset-*), of the client's
   own bottom edge. */
@utility pb-safe {
  padding-bottom: max(env(safe-area-inset-bottom), var(--tg-safe-area-inset-bottom, 0px));
}

/* pb-safe-<n>: padding of its own plus the bottom edge (the main button's bar). */
@utility pb-safe-* {
  padding-bottom: calc(--spacing(--value(integer)) + max(env(safe-area-inset-bottom), var(--tg-safe-area-inset-bottom, 0px)));
}

/* pb-bar: room under a page for the floating tab bar (64px, 22px off the
   bottom) and the bottom edge. */
@utility pb-bar {
  padding-bottom: calc(128px + max(env(safe-area-inset-bottom), var(--tg-safe-area-inset-bottom, 0px)));
}

/* --safe-top is what lies over the top of the page: in a Telegram Mini App
   opened full screen (TelegramSync asks for it on a phone) the status bar
   (--tg-safe-area-inset-top) and Telegram's floating controls
   (--tg-content-safe-area-inset-top); both are 0 under the client's header
   and in a browser tab. pt-safe keeps a frame clear of it, pt-safe-<n> a
   screen that has padding of its own. */
:root {
  --safe-top: max(
    env(safe-area-inset-top),
    calc(var(--tg-safe-area-inset-top, 0px) + var(--tg-content-safe-area-inset-top, 0px))
  );
}

@utility pt-safe {
  padding-top: var(--safe-top);
}

@utility pt-safe-* {
  padding-top: calc(--spacing(--value(integer)) + var(--safe-top));
}

/* Inside Telegram the shell is as tall as the Mini App's stable viewport
   (telegram-web-app.js publishes it), not the window, so the tab bar stays
   in sight while the client's own panels come and go; and the page does not
   bounce, which the client would take for a swipe. */
html[data-telegram] [data-slot="app-shell"] {
  height: var(--tg-viewport-stable-height, 100dvh);
}

html[data-telegram] body {
  overscroll-behavior: none;
}

/* The avatars' tints: a gradient per tone (lib/initials.ts picks it by seed). */
[data-slot="avatar"][data-tone="0"] { background: linear-gradient(180deg, #72D5FD, #2A9EF1); }
[data-slot="avatar"][data-tone="1"] { background: linear-gradient(180deg, #E0A2F3, #C85FE6); }
[data-slot="avatar"][data-tone="2"] { background: linear-gradient(180deg, #6FE0EE, #22A6C0); }
[data-slot="avatar"][data-tone="3"] { background: linear-gradient(180deg, #FFA8C4, #E2648D); }
[data-slot="avatar"][data-tone="4"] { background: linear-gradient(180deg, #B9C3D0, #7F8DA1); }

/* The hairline between the rows of a group starts where the group's inset
   says (--inset: after the avatar, the tile icon, or at the text); a form
   row's starts at the text. */
[data-slot="row"],
[data-slot="form-row"] {
  position: relative;
}
[data-slot="row"] + [data-slot="row"]::before,
[data-slot="row-item"] + [data-slot="row-item"] > [data-slot="row"]::before,
[data-slot="form-row"] + [data-slot="form-row"]::before,
[data-slot="row"] + [data-slot="form-row"]::before,
[data-slot="form-row"] + [data-slot="row"]::before {
  content: "";
  position: absolute;
  top: 0;
  right: 0;
  left: var(--inset, 16px);
  height: 0.5px;
  background: var(--border);
}

/* Motion answers an action (a dialog opening, a row under the pointer) and
   nothing else; whoever asked for less of it gets none. */
@media (prefers-reduced-motion: reduce) {
  *,
  ::before,
  ::after {
    animation-duration: 1ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 1ms !important;
    scroll-behavior: auto !important;
  }
}

@layer base {
  * {
    @apply border-border outline-ring/50;
  }
  body {
    @apply bg-background text-base text-foreground antialiased;
    font-variant-numeric: tabular-nums;
    -webkit-tap-highlight-color: transparent;
  }
  html {
    @apply font-sans;
  }
}
```

- [ ] **Step 4: `layout.tsx` da shrift o'zgaruvchisini `--font-geist` qil**

```tsx
const geist = Geist({ subsets: ["latin"], variable: "--font-geist" })
```
(`<html className={cn("font-sans", geist.variable)}>` o'zgarmaydi: `font-sans` endi `@theme` dagi stack.)

- [ ] **Step 5: O'tishini ko'r va butun to'plamni tekshir**

Run: `cd apps/web && pnpm exec vitest run app/globals.test.ts && pnpm exec vitest run`
Expected: `globals.test.ts` 4 passed; butun to'plam avvalgidek o'tadi (ranglar o'zgardi, tuzilma emas). `pnpm typecheck` toza.

- [ ] **Step 6: Commit**

```bash
git add apps/web/app/globals.css apps/web/app/layout.tsx apps/web/app/globals.test.ts
git commit -m "feat(web): the prototype's tokens: the iOS grouped-list colors in light, dark and Telegram, the radii, the type scale and the system font stack"
```

---

### Task 2: `Badge` (`.badge`)

**Files:**
- Modify: `apps/web/components/ui/badge.tsx`
- Test: `apps/web/components/ui/badge.test.tsx`

- [ ] **Step 1: Yiqiladigan testni yoz**

```tsx
// apps/web/components/ui/badge.test.tsx
import { render, screen } from "@testing-library/react"
import { expect, test } from "vitest"
import { Badge } from "./badge"

test("a badge is neutral unless told, and says its variant for the styles", () => {
  const { rerender } = render(<Badge>Xodim</Badge>)
  expect(screen.getByText("Xodim")).toHaveAttribute("data-variant", "neutral")

  rerender(<Badge variant="red">Muddati o&apos;tgan</Badge>)
  expect(screen.getByText("Muddati o'tgan")).toHaveAttribute("data-variant", "red")
})

test("a badge may lead with a dot, which is decoration", () => {
  render(<Badge variant="accent" dot>Egasi</Badge>)
  const badge = screen.getByText("Egasi")
  const dot = badge.querySelector('[data-slot="badge-dot"]')
  expect(dot).toHaveAttribute("aria-hidden", "true")
  expect(badge).toHaveTextContent(/^Egasi$/)
})

test("the names from before still work, for the pages not yet moved over", () => {
  render(<Badge variant="secondary">Jismoniy</Badge>)
  expect(screen.getByText("Jismoniy")).toHaveAttribute("data-variant", "secondary")
})
```

- [ ] **Step 2: Yiqilishini ko'r**

Run: `cd apps/web && pnpm exec vitest run components/ui/badge.test.tsx`
Expected: FAIL — `data-variant` `default` (hozirgi standart) va `dot` prop'i noma'lum (`badge-dot` topilmaydi).

- [ ] **Step 3: `badge.tsx` ni yoz**

```tsx
import { mergeProps } from "@base-ui/react/merge-props"
import { useRender } from "@base-ui/react/use-render"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"

// The prototype's badge: 22px tall, 7px corners, a soft tint with the hue's
// own text. The names from before (default, secondary, destructive, outline)
// stay for the pages not yet moved over.
const badgeVariants = cva(
  "group/badge inline-flex h-[22px] w-fit shrink-0 items-center justify-center gap-1.5 rounded-badge px-2 text-xs font-medium whitespace-nowrap tabular-nums [&>svg]:pointer-events-none [&>svg]:size-3!",
  {
    variants: {
      variant: {
        neutral: "bg-muted text-muted-foreground",
        accent: "bg-primary-soft text-primary",
        red: "bg-destructive-soft text-destructive",
        green: "bg-positive-soft text-positive",
        warn: "bg-warning-soft text-warning",
        default: "bg-primary-soft text-primary",
        secondary: "bg-muted text-muted-foreground",
        destructive: "bg-destructive-soft text-destructive",
        outline: "bg-transparent text-muted-foreground ring-1 ring-border ring-inset",
      },
    },
    defaultVariants: {
      variant: "neutral",
    },
  }
)

function Badge({
  className,
  variant = "neutral",
  dot = false,
  render,
  children,
  ...props
}: useRender.ComponentProps<"span"> & VariantProps<typeof badgeVariants> & { dot?: boolean }) {
  return useRender({
    defaultTagName: "span",
    props: mergeProps<"span">(
      {
        className: cn(badgeVariants({ variant }), className),
        children: (
          <>
            {dot && <span aria-hidden="true" data-slot="badge-dot" className="size-2 shrink-0 rounded-full bg-current" />}
            {children}
          </>
        ),
      },
      props
    ),
    render,
    state: {
      slot: "badge",
      variant,
    },
  })
}

export { Badge, badgeVariants }
```

- [ ] **Step 4: O'tishini ko'r**

Run: `cd apps/web && pnpm exec vitest run components/ui/badge.test.tsx components/role-badge.test.tsx components/tasks`
Expected: PASS (rol badge'i va bosqich badge'i eski nomlar bilan ishlaydi).

- [ ] **Step 5: Commit**

```bash
git add apps/web/components/ui/badge.tsx apps/web/components/ui/badge.test.tsx
git commit -m "feat(web): the badge in the prototype's shape, with a dot and the accent, red, green and warn tints"
```

---

### Task 3: `Button`, `DropdownMenu`, `Skeleton` uslubi (testsiz: faqat classlar)

**Files:**
- Modify: `apps/web/components/ui/button.tsx:5-40`
- Modify: `apps/web/components/ui/dropdown-menu.tsx` (`DropdownMenuContent`, `DropdownMenuItem`, `DropdownMenuSeparator` classlari)
- Modify: `apps/web/components/ui/skeleton.tsx`

- [ ] **Step 1: `button.tsx` variantlari**

`buttonVariants` ni shu bilan almashtir (API o'sha: `variant`, `size`; yangi `size: "round" | "mini"`):

```tsx
const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center gap-1.5 rounded-main border border-transparent bg-clip-padding text-md font-semibold whitespace-nowrap transition-[transform,background-color,color] duration-150 ease-out-expo outline-none select-none focus-visible:ring-3 focus-visible:ring-ring/50 active:not-aria-[haspopup]:scale-[.98] disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground active:opacity-90",
        outline: "bg-card text-primary ring-[0.5px] ring-border ring-inset active:bg-press",
        secondary: "bg-muted text-foreground active:bg-press",
        ghost: "text-primary active:bg-muted",
        destructive: "bg-destructive text-white active:opacity-90",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-3.5",
        xs: "h-7 rounded-full px-2.5 text-xs",
        sm: "h-8 rounded-full px-3 text-sm",
        lg: "h-11 px-4 text-base",
        mini: "h-[34px] rounded-full bg-muted px-3 text-sm",
        round: "size-11 rounded-full p-0 [&_svg:not([class*='size-'])]:size-[22px]",
        icon: "size-9",
        "icon-xs": "size-7 rounded-full [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-8 rounded-full",
        "icon-lg": "size-11",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)
```

- [ ] **Step 2: `dropdown-menu.tsx` classlari**

`DropdownMenuContent` ning `className` ini shu bilan almashtir:

```tsx
"z-50 max-h-(--available-height) min-w-[236px] origin-(--transform-origin) overflow-x-hidden overflow-y-auto rounded-[24px] bg-menu p-1.5 text-foreground shadow-float ring-[0.5px] ring-glass-edge ring-inset backdrop-blur-[30px] backdrop-saturate-[1.8] duration-200 ease-out-expo outline-none data-open:animate-in data-open:fade-in-0 data-open:zoom-in-75 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95"
```

`DropdownMenuItem` ning asosiy classlarida `rounded-md px-1.5 py-1 text-sm` → `min-h-11 rounded-[16px] px-3.5 text-[16px] [&_svg:not([class*='size-'])]:size-5`, `DropdownMenuSeparator` → `mx-2.5 my-1.5 h-px bg-border`, `DropdownMenuLabel` → `px-3.5 py-1.5 text-sm text-muted-foreground`. (Faylni och, mos satrlarni almashtir; qolgan tuzilma o'zgarmaydi.)

- [ ] **Step 3: `skeleton.tsx`**

```tsx
className={cn("animate-pulse rounded-[14px] bg-skeleton", className)}
```

- [ ] **Step 4: Tekshir**

Run: `cd apps/web && pnpm exec vitest run && pnpm lint && pnpm typecheck`
Expected: hammasi o'tadi (classlar o'zgardi, rollar va nomlar emas).

- [ ] **Step 5: Commit**

```bash
git add apps/web/components/ui/button.tsx apps/web/components/ui/dropdown-menu.tsx apps/web/components/ui/skeleton.tsx
git commit -m "style(web): the buttons, the glass menu and the skeleton in the prototype's shapes"
```

---

### Task 4: `Avatar` (`.av`)

**Files:**
- Create: `apps/web/components/kit/avatar.tsx`
- Test: `apps/web/components/kit/avatar.test.tsx`

- [ ] **Step 1: Yiqiladigan testni yoz**

```tsx
// apps/web/components/kit/avatar.test.tsx
import { render } from "@testing-library/react"
import { expect, test } from "vitest"
import { tone } from "@/lib/initials"
import { Avatar } from "./avatar"

const avatar = (container: HTMLElement) => container.querySelector('[data-slot="avatar"]') as HTMLElement

test("an avatar shows the initials in the tint its seed always gets, and is decoration", () => {
  const { container } = render(<Avatar name="Ali Valiyev" seed="998901234567" />)
  const mark = avatar(container)
  expect(mark).toHaveTextContent("AV")
  expect(mark).toHaveAttribute("aria-hidden", "true")
  expect(mark).toHaveAttribute("data-tone", String(tone("998901234567")))
})

test("a record with a letter mark shows its first letter alone; one with no name shows an icon and no tint", () => {
  const { container, rerender } = render(<Avatar name="olma" seed={4} letter square />)
  expect(avatar(container)).toHaveTextContent(/^O$/)

  rerender(<Avatar name={null} seed={4} />)
  expect(avatar(container)).not.toHaveAttribute("data-tone")
  expect(avatar(container).querySelector("svg")).toBeInTheDocument()
})

test("a large avatar says its size for the styles", () => {
  const { container } = render(<Avatar name="Olma Savdo" seed={1} size="lg" square />)
  expect(avatar(container)).toHaveAttribute("data-size", "lg")
  expect(avatar(container)).toHaveAttribute("data-square", "true")
})
```

- [ ] **Step 2: Yiqilishini ko'r**

Run: `cd apps/web && pnpm exec vitest run components/kit/avatar.test.tsx`
Expected: FAIL — `Failed to resolve import "./avatar"`. Bo'sh stub yarat (`export function Avatar() { return null }`) va qayta ishga tushir: `data-slot="avatar"` topilmay yiqiladi.

- [ ] **Step 3: `avatar.tsx` ni yoz**

```tsx
import { type LucideIcon, UserIcon } from "lucide-react"
import { initials, tone } from "@/lib/initials"
import { cn } from "@/lib/utils"

// Avatar is the mark beside a name, as the prototype draws it: the initials
// on the gradient its seed (a phone, an ID) always gets (globals.css,
// data-tone), or a plain icon when there is no name to take them from. People
// are round, companies and products square; a product shows its first
// letter alone (letter). One that is muted (someone no longer active) keeps
// its initials and loses its tint. It is decoration: the name itself is
// beside it, so assistive technology skips it.
export function Avatar({
  name,
  seed,
  icon: Icon = UserIcon,
  square = false,
  size = "md",
  letter = false,
  muted = false,
  className,
}: {
  name: string | null | undefined
  seed: string | number
  icon?: LucideIcon
  square?: boolean
  size?: "md" | "lg"
  letter?: boolean
  muted?: boolean
  className?: string
}) {
  const text = letter ? (name ?? "").trim().charAt(0).toUpperCase() || null : initials(name)
  const tinted = text !== null && !muted
  return (
    <span
      aria-hidden="true"
      data-slot="avatar"
      data-size={size}
      data-square={square || undefined}
      data-tone={tinted ? tone(seed) : undefined}
      className={cn(
        "flex shrink-0 items-center justify-center font-semibold leading-none tracking-[0.02em] select-none",
        size === "lg" ? "size-[88px] text-[32px]" : "size-10 text-[15px]",
        square ? (size === "lg" ? "rounded-[26px]" : "rounded-[12px]") : "rounded-full",
        tinted ? "text-white [text-shadow:0_1px_1px_rgba(0,0,0,.12)]" : "bg-muted text-muted-foreground",
        className,
      )}
    >
      {text ?? <Icon className={size === "lg" ? "size-9" : "size-5"} />}
    </span>
  )
}
```

- [ ] **Step 4: O'tishini ko'r**

Run: `cd apps/web && pnpm exec vitest run components/kit/avatar.test.tsx`
Expected: PASS (3).

- [ ] **Step 5: Commit**

```bash
git add apps/web/components/kit/avatar.tsx apps/web/components/kit/avatar.test.tsx
git commit -m "feat(web): the kit's avatar on the prototype's gradients, round or square, with a large size and a letter mark"
```

---

### Task 5: `TileIcon` (`.tile-ic`) va bo'lim ranglari

**Files:**
- Create: `apps/web/components/kit/tile-icon.tsx`
- Test: `apps/web/components/kit/tile-icon.test.tsx`

- [ ] **Step 1: Yiqiladigan testni yoz**

```tsx
// apps/web/components/kit/tile-icon.test.tsx
import { render } from "@testing-library/react"
import { UserIcon } from "lucide-react"
import { expect, test } from "vitest"
import { sectionColors, TileIcon } from "./tile-icon"

test("a tile icon is a colored square with an icon, decoration beside its row's text", () => {
  const { container } = render(<TileIcon icon={UserIcon} color="#34C759" />)
  const tile = container.querySelector('[data-slot="tile-icon"]') as HTMLElement
  expect(tile).toHaveAttribute("aria-hidden", "true")
  expect(tile.style.background).toBe("rgb(52, 199, 89)")
  expect(tile.querySelector("svg")).toBeInTheDocument()
})

test("every section has a color of its own", () => {
  expect(sectionColors.home).toBe("#174449")
  expect(sectionColors.customers).toBe("#007AFF")
  expect(new Set(Object.values(sectionColors)).size).toBe(Object.keys(sectionColors).length)
})
```

- [ ] **Step 2: Yiqilishini ko'r**

Run: `cd apps/web && pnpm exec vitest run components/kit/tile-icon.test.tsx`
Expected: FAIL — modul yo'q; stub bilan `data-slot="tile-icon"` topilmaydi.

- [ ] **Step 3: `tile-icon.tsx` ni yoz**

```tsx
import type { LucideIcon } from "lucide-react"
import type { ReactNode } from "react"
import type { NavKey } from "@/lib/nav"
import { cn } from "@/lib/utils"

// sectionColors are the sections' own hues (the prototype's SECCOL): the
// tile icon a section's row wears on the home page, in the settings and in
// the profile. The sales and the finance came after the prototype and take
// hues of their own in the same family.
export const sectionColors: Record<NavKey, string> = {
  home: "#174449",
  customers: "#007AFF",
  tasks: "#FF9500",
  products: "#A2845E",
  sales: "#FF2D55",
  warehouse: "#AF52DE",
  finance: "#5856D6",
  employees: "#34C759",
  settings: "#8E8E93",
}

// TileIcon is the iOS-style square icon that opens a row: a 32px rounded
// square in a color, a white icon on it. It is decoration: the row's text
// names the row.
export function TileIcon({
  icon: Icon,
  color,
  className,
  children,
}: {
  icon?: LucideIcon
  color: string
  className?: string
  children?: ReactNode
}) {
  return (
    <span
      aria-hidden="true"
      data-slot="tile-icon"
      style={{ background: color }}
      className={cn("grid size-8 shrink-0 place-items-center rounded-[9px] text-white [&_svg]:size-[19px]", className)}
    >
      {children ?? (Icon && <Icon strokeWidth={2.2} />)}
    </span>
  )
}
```

- [ ] **Step 4: O'tishini ko'r**

Run: `cd apps/web && pnpm exec vitest run components/kit/tile-icon.test.tsx`
Expected: PASS (2).

- [ ] **Step 5: Commit**

```bash
git add apps/web/components/kit/tile-icon.tsx apps/web/components/kit/tile-icon.test.tsx
git commit -m "feat(web): the tile icon and the sections' colors"
```

---

### Task 6: `Group`, `Row`, `KeyValue`, `SectionHeading`, `Foot` (`.group`, `.row`, `.kv`, `.sh`, `.foot`)

**Files:**
- Create: `apps/web/components/kit/group.tsx`
- Test: `apps/web/components/kit/group.test.tsx`

- [ ] **Step 1: Yiqiladigan testni yoz**

```tsx
// apps/web/components/kit/group.test.tsx
import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { expect, test, vi } from "vitest"
import { Foot, Group, KeyValue, Row, SectionHeading } from "./group"

test("a group with a label is a list, its rows the items; a row with a way in is a link named by its title", () => {
  render(
    <Group label="Mijozlar" inset="icon">
      <Row href="/customers/1" media={<span>AV</span>} title="Ali Valiyev" sub="+998 90 123 45 67" end="2 vazifa" />
      <Row href="/customers/2" title="Bahor Agro XK" />
    </Group>,
  )
  const list = screen.getByRole("list", { name: "Mijozlar" })
  expect(list).toHaveAttribute("data-inset", "icon")
  expect(within(list).getAllByRole("listitem")).toHaveLength(2)
  const link = within(list).getByRole("link", { name: /Ali Valiyev/ })
  expect(link).toHaveAttribute("href", "/customers/1")
  expect(link).toHaveTextContent("+998 90 123 45 67")
  expect(link).toHaveTextContent("2 vazifa")
  // The chevron is decoration.
  expect(link.querySelector("svg")).toHaveAttribute("aria-hidden", "true")
})

test("a row that does something is a button; a plain row is neither", async () => {
  const open = vi.fn()
  render(
    <Group>
      <Row onClick={open} title="Lokatsiya" end="Chilonzor" />
      <Row title="Telefon" end="+998 90 123 45 67" />
    </Group>,
  )
  await userEvent.click(screen.getByRole("button", { name: /Lokatsiya/ }))
  expect(open).toHaveBeenCalledTimes(1)
  expect(screen.queryByRole("list")).not.toBeInTheDocument()
  expect(screen.getAllByRole("button")).toHaveLength(1)
})

test("a danger row is centered red text, a link row the accent, both buttons", () => {
  render(
    <Group>
      <Row variant="danger" onClick={() => {}} title="Mijozni o'chirish" />
      <Row variant="link" onClick={() => {}} title="Barcha vazifalar" />
    </Group>,
  )
  expect(screen.getByRole("button", { name: "Mijozni o'chirish" })).toHaveAttribute("data-variant", "danger")
  expect(screen.getByRole("button", { name: "Barcha vazifalar" })).toHaveAttribute("data-variant", "link")
})

test("a key-value row shows a dash for a value that is not there", () => {
  render(
    <Group as="dl">
      <KeyValue label="Izoh" value="" />
      <KeyValue label="Birlik" value="kg" />
    </Group>,
  )
  const terms = screen.getAllByRole("term")
  expect(terms.map((term) => term.textContent)).toEqual(["Izoh", "Birlik"])
  expect(screen.getAllByRole("definition").map((d) => d.textContent)).toEqual(["—", "kg"])
})

test("a section heading is a heading with a hint or an action beside it; a foot is a note", () => {
  render(
    <>
      <SectionHeading hint="Jami: 5">Yaqin muddatlar</SectionHeading>
      <SectionHeading action={<button type="button">Tartiblash</button>}>Maydonlar</SectionHeading>
      <Foot>Nofaol variant yangi tanlovlarda chiqmaydi.</Foot>
    </>,
  )
  expect(screen.getByRole("heading", { level: 2, name: "Yaqin muddatlar" })).toBeInTheDocument()
  expect(screen.getByText("Jami: 5")).toBeInTheDocument()
  expect(screen.getByRole("button", { name: "Tartiblash" })).toBeInTheDocument()
  expect(screen.getByText("Nofaol variant yangi tanlovlarda chiqmaydi.")).toHaveAttribute("data-slot", "foot")
})
```

- [ ] **Step 2: Yiqilishini ko'r**

Run: `cd apps/web && pnpm exec vitest run components/kit/group.test.tsx`
Expected: FAIL — modul yo'q; bo'sh stublar bilan rollar topilmaydi.

- [ ] **Step 3: `group.tsx` ni yoz**

```tsx
"use client"

import { ChevronRightIcon } from "lucide-react"
import Link from "next/link"
import { type ComponentProps, type CSSProperties, createContext, type ReactNode, useContext } from "react"
import { cn } from "@/lib/utils"

// The hairline between rows starts after the row's media: an avatar (icon),
// a tile icon (tile), or at the text (none). globals.css draws it at --inset.
const insets = { none: "16px", icon: "68px", tile: "60px" } as const

// Whether the rows stand in a list, in which case each takes a list item.
const ListContext = createContext(false)

// Group is the prototype's grouped block: a white card of rows with
// hairlines between them. With a label it is a list (the rows become its
// items); as "dl" it holds key-value rows.
export function Group({
  inset = "none",
  as = "div",
  label,
  className,
  style,
  children,
}: {
  inset?: keyof typeof insets
  as?: "div" | "dl"
  label?: string
  className?: string
  style?: CSSProperties
  children: ReactNode
}) {
  const styles = { ...style, "--inset": insets[inset] } as CSSProperties
  const classes = cn("overflow-hidden rounded-group bg-card [[data-slot=group]+&]:mt-6", className)
  if (label) {
    return (
      <ListContext value={true}>
        <ul role="list" aria-label={label} data-slot="group" data-inset={inset} className={classes} style={styles}>
          {children}
        </ul>
      </ListContext>
    )
  }
  const Tag = as
  return (
    <ListContext value={false}>
      <Tag data-slot="group" data-inset={inset} className={classes} style={styles}>
        {children}
      </Tag>
    </ListContext>
  )
}

export interface RowProps {
  // media leads the row: an avatar, a tile icon, a colored dot.
  media?: ReactNode
  title: ReactNode
  // badge stands beside the title; sub is the line under it.
  badge?: ReactNode
  sub?: ReactNode
  // end is the value at the right (an amount, a date, a status), endSub the
  // line under it.
  end?: ReactNode
  endSub?: ReactNode
  // chevron: by default a row with a way in shows one; false hides it.
  chevron?: boolean
  href?: string
  onClick?: () => void
  // link and accent are centered accent text, danger centered red text:
  // the rows that do one thing ("Barcha vazifalar", "Mijozni o'chirish").
  variant?: "default" | "link" | "accent" | "danger"
  compact?: boolean
  disabled?: boolean
  className?: string
  "aria-label"?: string
}

const variants = {
  default: "",
  link: "justify-center text-primary",
  accent: "justify-center font-medium text-primary",
  danger: "justify-center font-medium text-destructive",
}

// Row is one row of a group: media, a title with a badge and a line under
// it, a value at the right and a chevron. With href it is a link, with
// onClick a button, otherwise a plain row; a pressed row darkens.
export function Row({
  media,
  title,
  badge,
  sub,
  end,
  endSub,
  chevron,
  href,
  onClick,
  variant = "default",
  compact = false,
  disabled = false,
  className,
  ...aria
}: RowProps) {
  const inList = useContext(ListContext)
  const interactive = href !== undefined || onClick !== undefined
  const showChevron = chevron ?? (interactive && variant === "default")
  const centered = variant !== "default"
  const body = centered ? (
    <span data-slot="row-title" className="truncate">
      {title}
    </span>
  ) : (
    <>
      {media}
      <span data-slot="row-body" className="min-w-0 flex-1">
        <span data-slot="row-title" className="flex min-w-0 items-center gap-1.5 leading-tight font-medium">
          <span className="truncate">{title}</span>
          {badge}
        </span>
        {sub && (
          <span data-slot="row-sub" className="mt-0.5 block truncate text-sm text-muted-foreground">
            {sub}
          </span>
        )}
      </span>
      {(end || endSub) && (
        <span data-slot="row-end" className="max-w-[52%] shrink-0 text-right">
          {end && (
            <span data-slot="row-value" className="block whitespace-nowrap">
              {end}
            </span>
          )}
          {endSub && (
            <span data-slot="row-end-sub" className="mt-0.5 block whitespace-nowrap text-sm text-muted-foreground">
              {endSub}
            </span>
          )}
        </span>
      )}
      {showChevron && (
        <ChevronRightIcon aria-hidden="true" strokeWidth={2.6} className="-ml-1 size-[18px] shrink-0 text-muted-foreground opacity-60" />
      )}
    </>
  )
  const classes = cn(
    "flex w-full items-center gap-3 px-4 py-2 text-left text-base text-foreground no-underline outline-none focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset",
    compact ? "min-h-12" : variant === "link" ? "min-h-[50px]" : "min-h-14",
    variants[variant],
    interactive && !disabled && "active:bg-press",
    disabled && "opacity-50",
    className,
  )
  const common = { "data-slot": "row", "data-variant": variant, className: classes, ...aria }
  const element =
    href !== undefined ? (
      <Link href={href} aria-disabled={disabled || undefined} {...common}>
        {body}
      </Link>
    ) : onClick !== undefined ? (
      <button type="button" onClick={onClick} disabled={disabled} {...common}>
        {body}
      </button>
    ) : (
      <div {...common}>{body}</div>
    )
  return inList ? <li data-slot="row-item">{element}</li> : element
}

// KeyValue is a row of the "Ma'lumot" block: the name at the left, the
// value at the right in the hint color, a dash where there is none. It
// lives in a Group as "dl".
export function KeyValue({ label, value }: { label: ReactNode; value?: ReactNode }) {
  const present = value !== null && value !== undefined && value !== false && value !== ""
  return (
    <div data-slot="row" className="flex min-h-12 items-center gap-3 px-4 py-2 text-base">
      <dt className="min-w-0 flex-1 text-foreground">{label}</dt>
      <dd className="max-w-[62%] text-right text-muted-foreground [overflow-wrap:anywhere]">{present ? value : "—"}</dd>
    </div>
  )
}

// SectionHeading heads a block of a page: a heading at the left, an action
// (a button or a link) or a hint (a count) at the right.
export function SectionHeading({
  children,
  action,
  hint,
  className,
}: {
  children: ReactNode
  action?: ReactNode
  hint?: ReactNode
  className?: string
}) {
  return (
    <div data-slot="section-heading" className={cn("flex items-baseline justify-between gap-3 px-1 pb-2 text-heading", className)}>
      <h2 className="min-w-0 truncate text-base font-semibold">{children}</h2>
      {action && <span className="shrink-0 text-[16px] font-medium text-primary [&_a]:text-primary [&_button]:min-h-8 [&_button]:text-primary">{action}</span>}
      {hint !== undefined && (
        <span data-slot="section-hint" className="shrink-0 text-md text-muted-foreground">
          {hint}
        </span>
      )}
    </div>
  )
}

// Foot is the note under a group: what the block means or what to do next.
// Right after a group it tucks up to it.
export function Foot({ children, center = false, className }: { children: ReactNode; center?: boolean; className?: string }) {
  return (
    <p
      data-slot="foot"
      className={cn(
        "px-4 text-xs leading-[1.4] text-muted-foreground [[data-slot=group]+&]:-mt-3.5 [&_a]:text-primary [&_button]:text-primary",
        center && "text-center",
        className,
      )}
    >
      {children}
    </p>
  )
}

export type GroupProps = ComponentProps<typeof Group>
```

- [ ] **Step 4: O'tishini ko'r**

Run: `cd apps/web && pnpm exec vitest run components/kit/group.test.tsx`
Expected: PASS (5).

- [ ] **Step 5: Commit**

```bash
git add apps/web/components/kit/group.tsx apps/web/components/kit/group.test.tsx
git commit -m "feat(web): the kit's group, row, key-value row, section heading and foot"
```

---

### Task 7: `PageTitle`, `BackLink`, `PlusButton` (`.ltitle`, `.plus`, Telegram «Back» o'rnida o'z tugmasi)

**Files:**
- Create: `apps/web/components/kit/page-title.tsx`
- Test: `apps/web/components/kit/page-title.test.tsx`

- [ ] **Step 1: Yiqiladigan testni yoz**

```tsx
// apps/web/components/kit/page-title.test.tsx
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { expect, test, vi } from "vitest"
import { BackLink, PageTitle, PlusButton } from "./page-title"

test("a page title names the page, says what it holds and carries its action", async () => {
  const add = vi.fn()
  render(<PageTitle title="Mijozlar" description="Kompaniyangiz mijozlari · 10 ta" action={<PlusButton label="Mijoz qo'shish" onClick={add} />} />)
  expect(screen.getByRole("heading", { level: 1, name: "Mijozlar" })).toBeInTheDocument()
  expect(screen.getByText("Kompaniyangiz mijozlari · 10 ta")).toBeInTheDocument()
  await userEvent.click(screen.getByRole("button", { name: "Mijoz qo'shish" }))
  expect(add).toHaveBeenCalledTimes(1)
})

test("a page under another leads back to it", () => {
  render(<PageTitle title="Yangi rol" back={{ href: "/settings/roles", label: "Rollar" }} />)
  expect(screen.getByRole("link", { name: "Rollar" })).toHaveAttribute("href", "/settings/roles")
})

test("a plus button may be a link", () => {
  render(<PlusButton label="Xarid qo'shish" href="/purchases/new" />)
  expect(screen.getByRole("link", { name: "Xarid qo'shish" })).toHaveAttribute("href", "/purchases/new")
})

test("a back link's chevron is decoration", () => {
  render(<BackLink href="/" label="Bosh sahifa" />)
  expect(screen.getByRole("link", { name: "Bosh sahifa" }).querySelector("svg")).toHaveAttribute("aria-hidden", "true")
})
```

- [ ] **Step 2: Yiqilishini ko'r**

Run: `cd apps/web && pnpm exec vitest run components/kit/page-title.test.tsx`
Expected: FAIL — modul yo'q; stub bilan heading topilmaydi.

- [ ] **Step 3: `page-title.tsx` ni yoz**

```tsx
"use client"

import { ChevronLeftIcon, PlusIcon } from "lucide-react"
import Link from "next/link"
import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

// BackLink is the way back from a page under another, as iOS draws it: a
// chevron and the parent's name in the accent color, with a thumb-sized
// target. Inside Telegram the BackButton (TelegramSync) stands beside it.
export function BackLink({ href, label, className }: { href: string; label: string; className?: string }) {
  return (
    <Link
      href={href}
      data-slot="back-link"
      className={cn(
        "relative -ml-1.5 inline-flex min-h-11 items-center gap-0.5 pr-3 text-base text-primary outline-none after:absolute after:-inset-x-2 after:-inset-y-1 focus-visible:ring-3 focus-visible:ring-ring/50",
        className,
      )}
    >
      <ChevronLeftIcon aria-hidden="true" strokeWidth={2.4} className="size-6" />
      <span>{label}</span>
    </Link>
  )
}

// PlusButton is the round accent button that adds a record, at the right of
// a page's title: a button or a link, named in full for assistive technology
// ("Mijoz qo'shish").
export function PlusButton({ label, onClick, href, className }: { label: string; onClick?: () => void; href?: string; className?: string }) {
  const classes = cn(
    "grid size-11 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground transition-transform duration-150 ease-out-expo outline-none active:scale-[.92] focus-visible:ring-3 focus-visible:ring-ring/50",
    className,
  )
  const icon = <PlusIcon aria-hidden="true" strokeWidth={2.6} className="size-[22px]" />
  if (href !== undefined) {
    return (
      <Link href={href} aria-label={label} data-slot="plus-button" className={classes}>
        {icon}
      </Link>
    )
  }
  return (
    <button type="button" aria-label={label} data-slot="plus-button" onClick={onClick} className={classes}>
      {icon}
    </button>
  )
}

// PageTitle opens a page as the prototype does: the way back (on a page
// under another), the name large, a line under it on what the page holds
// (with how many, when that is known) and, at the right, what can be done
// (a PlusButton, or another control).
export function PageTitle({
  title,
  description,
  action,
  back,
  className,
}: {
  title: string
  description?: ReactNode
  action?: ReactNode
  back?: { href: string; label: string }
  className?: string
}) {
  return (
    <header data-slot="page-title" className={className}>
      {back && <BackLink {...back} />}
      <div className="flex items-start justify-between gap-3 px-0.5 pt-1.5 pb-3.5">
        <div className="min-w-0">
          <h1 className="text-[30px] leading-[1.1] font-bold tracking-[-0.025em] [overflow-wrap:anywhere]">{title}</h1>
          {description && <p className="mt-0.5 text-md text-muted-foreground">{description}</p>}
        </div>
        {action}
      </div>
    </header>
  )
}
```

- [ ] **Step 4: O'tishini ko'r**

Run: `cd apps/web && pnpm exec vitest run components/kit/page-title.test.tsx`
Expected: PASS (4).

- [ ] **Step 5: Commit**

```bash
git add apps/web/components/kit/page-title.tsx apps/web/components/kit/page-title.test.tsx
git commit -m "feat(web): the kit's page title with the back link and the plus button"
```

---

### Task 8: `DetailHead`, `Tiles`, `Tile` (`.dhead`, `.tiles`)

**Files:**
- Create: `apps/web/components/kit/detail-head.tsx`
- Test: `apps/web/components/kit/detail-head.test.tsx`

- [ ] **Step 1: Yiqiladigan testni yoz**

```tsx
// apps/web/components/kit/detail-head.test.tsx
import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { PencilIcon, PhoneIcon, Trash2Icon } from "lucide-react"
import { expect, test, vi } from "vitest"
import { DetailHead, Tile, Tiles } from "./detail-head"

test("a detail head names the record, with its mark and badges outside the heading", () => {
  render(<DetailHead media={<span aria-hidden="true">AV</span>} title="Ali Valiyev" description="Jismoniy · +998 90 123 45 67" badges={<span>Nofaol</span>} />)
  const heading = screen.getByRole("heading", { level: 1, name: "Ali Valiyev" })
  expect(heading).toHaveTextContent(/^Ali Valiyev$/)
  expect(screen.getByText("Jismoniy · +998 90 123 45 67")).toBeInTheDocument()
  expect(screen.getByText("Nofaol")).toBeInTheDocument()
})

test("the tiles are the record's actions: buttons, a link to call, a red one to delete", async () => {
  const edit = vi.fn()
  render(
    <Tiles>
      <Tile icon={PencilIcon} label="Tahrirlash" onClick={edit} />
      <Tile icon={PhoneIcon} label="Qo'ng'iroq" href="tel:+998901234567" />
      {false}
      <Tile icon={Trash2Icon} label="O'chirish" onClick={() => {}} danger />
    </Tiles>,
  )
  const group = screen.getByRole("group", { name: "Amallar" })
  // Three tiles share the width: the false child does not count.
  expect(group.style.getPropertyValue("--n")).toBe("3")
  await userEvent.click(within(group).getByRole("button", { name: "Tahrirlash" }))
  expect(edit).toHaveBeenCalledTimes(1)
  expect(within(group).getByRole("link", { name: "Qo'ng'iroq" })).toHaveAttribute("href", "tel:+998901234567")
  expect(within(group).getByRole("button", { name: "O'chirish" })).toHaveAttribute("data-danger", "true")
})
```

- [ ] **Step 2: Yiqilishini ko'r**

Run: `cd apps/web && pnpm exec vitest run components/kit/detail-head.test.tsx`
Expected: FAIL — modul yo'q; stub bilan heading topilmaydi.

- [ ] **Step 3: `detail-head.tsx` ni yoz**

```tsx
"use client"

import type { LucideIcon } from "lucide-react"
import Link from "next/link"
import { Children, type ReactNode } from "react"
import { cn } from "@/lib/utils"

// DetailHead opens a record's page as the prototype does: its mark (a large
// avatar, a colored icon) over its name, a line under it (the type, the
// phone) and its badges. The heading stays the name alone.
export function DetailHead({
  media,
  title,
  description,
  badges,
  className,
}: {
  media?: ReactNode
  title: string
  description?: ReactNode
  badges?: ReactNode
  className?: string
}) {
  return (
    <header data-slot="detail-head" className={cn("flex flex-col items-center px-4 pt-4 pb-5 text-center", className)}>
      {media && <div className="mb-3">{media}</div>}
      <h1 className="text-[26px] leading-[1.15] font-bold tracking-[-0.02em] [overflow-wrap:anywhere]">{title}</h1>
      {description && <p className="mt-1.5 text-md text-muted-foreground">{description}</p>}
      {badges && <div className="mt-2.5 flex flex-wrap justify-center gap-1.5">{badges}</div>}
    </header>
  )
}

// Tiles are a record's quick actions in a row of equal squares under its
// head; on a wide screen they keep a tile's width instead of stretching.
export function Tiles({ children, label = "Amallar", className }: { children: ReactNode; label?: string; className?: string }) {
  const count = Children.toArray(children).length
  return (
    <div
      role="group"
      aria-label={label}
      data-slot="tiles"
      style={{ "--n": String(count) } as React.CSSProperties}
      className={cn("mb-3 grid grid-cols-[repeat(var(--n),minmax(0,1fr))] gap-2 md:grid-cols-[repeat(var(--n),minmax(0,10rem))]", className)}
    >
      {children}
    </div>
  )
}

// Tile is one action: a round icon over its name; a button, or a link (an
// address of the app, or tel: to call). A danger tile is red.
export function Tile({
  icon: Icon,
  label,
  onClick,
  href,
  danger = false,
  disabled = false,
}: {
  icon: LucideIcon
  label: string
  onClick?: () => void
  href?: string
  danger?: boolean
  disabled?: boolean
}) {
  const classes = cn(
    "flex min-h-[74px] flex-col items-center justify-center gap-1.5 rounded-tile bg-card px-0.5 py-2 text-xs font-semibold no-underline transition-transform duration-150 ease-out-expo outline-none active:scale-95 focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50",
    danger ? "text-destructive" : "text-primary",
  )
  const content = (
    <>
      <span aria-hidden="true" className={cn("grid size-7 place-items-center rounded-full", danger ? "bg-destructive text-white" : "bg-primary text-primary-foreground")}>
        <Icon strokeWidth={2.6} className="size-[17px]" />
      </span>
      <span className="max-w-full truncate">{label}</span>
    </>
  )
  if (href !== undefined) {
    return href.startsWith("/") ? (
      <Link href={href} data-slot="tile" data-danger={danger || undefined} className={classes}>
        {content}
      </Link>
    ) : (
      <a href={href} data-slot="tile" data-danger={danger || undefined} className={classes}>
        {content}
      </a>
    )
  }
  return (
    <button type="button" data-slot="tile" data-danger={danger || undefined} onClick={onClick} disabled={disabled} className={classes}>
      {content}
    </button>
  )
}
```

- [ ] **Step 4: O'tishini ko'r**

Run: `cd apps/web && pnpm exec vitest run components/kit/detail-head.test.tsx`
Expected: PASS (2).

- [ ] **Step 5: Commit**

```bash
git add apps/web/components/kit/detail-head.tsx apps/web/components/kit/detail-head.test.tsx
git commit -m "feat(web): the kit's detail head and the tiles of a record's actions"
```

---

### Task 9: `Chips`, `Chip`, `ChoiceChips` (`.chips`, `.chip`)

**Files:**
- Create: `apps/web/components/kit/chips.tsx`
- Test: `apps/web/components/kit/chips.test.tsx`

- [ ] **Step 1: Yiqiladigan testni yoz**

```tsx
// apps/web/components/kit/chips.test.tsx
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { expect, test, vi } from "vitest"
import { Chip, Chips, ChoiceChips } from "./chips"

test("choice chips are one choice among several, the chosen one checked", async () => {
  const choose = vi.fn()
  render(
    <ChoiceChips
      label="Mijoz turi"
      value="all"
      onChange={choose}
      options={[
        { value: "all", label: "Barchasi" },
        { value: "1", label: "Jismoniy", count: 8 },
        { value: "2", label: "Yuridik", count: 2 },
      ]}
    />,
  )
  const group = screen.getByRole("radiogroup", { name: "Mijoz turi" })
  expect(group).toBeInTheDocument()
  expect(screen.getByRole("radio", { name: "Barchasi" })).toHaveAttribute("aria-checked", "true")
  await userEvent.click(screen.getByRole("radio", { name: "Jismoniy 8" }))
  expect(choose).toHaveBeenCalledWith("1")
})

test("a chip is a toggle button, pressed when on, and may open something with a chevron", async () => {
  const open = vi.fn()
  render(
    <Chips label="Filtrlar">
      <Chip pressed onClick={() => {}}>Faol</Chip>
      <Chip pressed={false} chevron onClick={open}>Barcha mas&apos;ullar</Chip>
    </Chips>,
  )
  expect(screen.getByRole("group", { name: "Filtrlar" })).toBeInTheDocument()
  expect(screen.getByRole("button", { name: "Faol" })).toHaveAttribute("aria-pressed", "true")
  const picker = screen.getByRole("button", { name: "Barcha mas'ullar" })
  expect(picker).toHaveAttribute("aria-pressed", "false")
  expect(picker.querySelector("svg")).toHaveAttribute("aria-hidden", "true")
  await userEvent.click(picker)
  expect(open).toHaveBeenCalledTimes(1)
})
```

- [ ] **Step 2: Yiqilishini ko'r**

Run: `cd apps/web && pnpm exec vitest run components/kit/chips.test.tsx`
Expected: FAIL — modul yo'q; stub bilan `radiogroup` topilmaydi.

- [ ] **Step 3: `chips.tsx` ni yoz**

```tsx
"use client"

import { Radio } from "@base-ui/react/radio"
import { RadioGroup } from "@base-ui/react/radio-group"
import { ChevronDownIcon } from "lucide-react"
import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

const strip = "-mx-4 flex gap-1.5 overflow-x-auto px-4 py-0.5 scrollbar-hide"

const chip =
  "relative inline-flex h-9 shrink-0 items-center gap-1 rounded-full px-3.5 text-md font-medium whitespace-nowrap text-heading outline-none transition-colors after:absolute after:-inset-x-0.5 after:-inset-y-1 focus-visible:ring-3 focus-visible:ring-ring/50"
const on = "bg-primary-soft font-semibold text-primary"

// Chips is the strip of filters under a search: it scrolls sideways, out to
// the page's edges, rather than squeezing.
export function Chips({ children, label, className }: { children: ReactNode; label?: string; className?: string }) {
  return (
    <div role={label ? "group" : undefined} aria-label={label} data-slot="chips" className={cn(strip, className)}>
      {children}
    </div>
  )
}

// Chip is one filter that is on or off (a toggle), or one that opens a
// picker (with a chevron); a count may stand beside its name.
export function Chip({
  pressed,
  onClick,
  count,
  chevron = false,
  children,
  className,
}: {
  pressed?: boolean
  onClick: () => void
  count?: number
  chevron?: boolean
  children: ReactNode
  className?: string
}) {
  return (
    <button type="button" aria-pressed={pressed} data-slot="chip" onClick={onClick} className={cn(chip, pressed && on, className)}>
      {children}
      {count !== undefined && (
        <>
          {" "}
          <span data-slot="chip-count" className="font-medium text-muted-foreground">
            {count}
          </span>
        </>
      )}
      {chevron && <ChevronDownIcon aria-hidden="true" strokeWidth={2.4} className="size-4 opacity-70" />}
    </button>
  )
}

// ChoiceChips are one choice among several (every type, one type): radios
// drawn as chips. A chip's name includes its count ("Jismoniy 8").
export function ChoiceChips({
  label,
  value,
  onChange,
  options,
  className,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  options: { value: string; label: string; count?: number }[]
  className?: string
}) {
  return (
    <RadioGroup aria-label={label} value={value} onValueChange={(next) => onChange(String(next))} data-slot="chips" className={cn(strip, className)}>
      {options.map((option) => (
        <Radio.Root key={option.value} value={option.value} data-slot="chip" className={cn(chip, "data-checked:bg-primary-soft data-checked:font-semibold data-checked:text-primary")}>
          {option.label}
          {option.count !== undefined && (
            <>
              {" "}
              <span data-slot="chip-count" className="font-medium text-muted-foreground">
                {option.count}
              </span>
            </>
          )}
        </Radio.Root>
      ))}
    </RadioGroup>
  )
}
```

- [ ] **Step 4: O'tishini ko'r**

Run: `cd apps/web && pnpm exec vitest run components/kit/chips.test.tsx`
Expected: PASS (2).

- [ ] **Step 5: Commit**

```bash
git add apps/web/components/kit/chips.tsx apps/web/components/kit/chips.test.tsx
git commit -m "feat(web): the kit's filter chips, as toggles and as a choice of one"
```

---

### Task 10: `Segmented` (`.seg`, Base UI Tabs + Indicator)

**Files:**
- Create: `apps/web/components/kit/segmented.tsx`
- Test: `apps/web/components/kit/segmented.test.tsx`

- [ ] **Step 1: Yiqiladigan testni yoz**

```tsx
// apps/web/components/kit/segmented.test.tsx
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { expect, test, vi } from "vitest"
import { Segmented } from "./segmented"

test("a segmented control is a tab list; the chosen segment is selected and a press chooses another", async () => {
  const change = vi.fn()
  render(
    <Segmented
      label="Ko'rinish"
      value="board"
      onChange={change}
      options={[
        { value: "board", label: "Kanban" },
        { value: "list", label: "Ro'yxat" },
      ]}
    />,
  )
  const list = screen.getByRole("tablist", { name: "Ko'rinish" })
  expect(list.style.getPropertyValue("--n")).toBe("2")
  expect(screen.getByRole("tab", { name: "Kanban" })).toHaveAttribute("aria-selected", "true")
  expect(screen.getByRole("tab", { name: "Ro'yxat" })).toHaveAttribute("aria-selected", "false")
  await userEvent.click(screen.getByRole("tab", { name: "Ro'yxat" }))
  expect(change).toHaveBeenCalledWith("list")
})
```

- [ ] **Step 2: Yiqilishini ko'r**

Run: `cd apps/web && pnpm exec vitest run components/kit/segmented.test.tsx`
Expected: FAIL — modul yo'q; stub bilan `tablist` topilmaydi.

- [ ] **Step 3: `segmented.tsx` ni yoz**

```tsx
"use client"

import { Tabs } from "@base-ui/react/tabs"
import type { LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"

// Segmented is the prototype's segmented control: two or three views of one
// thing (Kanban / Ro'yxat, Mahsulotlar / Xizmatlar) on a pill, a white
// thumb sliding under the chosen one. It is a tab list (Base UI Tabs) with
// no panels of its own: the page shows the view.
export function Segmented({
  label,
  value,
  onChange,
  options,
  className,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  options: { value: string; label: string; icon?: LucideIcon }[]
  className?: string
}) {
  return (
    <Tabs.Root value={value} onValueChange={(next) => onChange(String(next))} className={className}>
      <Tabs.List
        aria-label={label}
        data-slot="segmented"
        style={{ "--n": String(options.length) } as React.CSSProperties}
        className="relative flex h-10 rounded-full bg-muted p-[3px]"
      >
        <Tabs.Indicator
          aria-hidden="true"
          data-slot="segmented-thumb"
          className="absolute top-[3px] left-0 h-[34px] w-(--active-tab-width) translate-x-(--active-tab-left) rounded-full bg-card shadow-[0_2px_8px_rgba(0,0,0,.1),0_0_0_.5px_rgba(0,0,0,.04)] transition-transform duration-300 ease-spring dark:bg-[#636366]"
        />
        {options.map((option) => (
          <Tabs.Tab
            key={option.value}
            value={option.value}
            data-slot="segmented-tab"
            className="relative z-[1] flex min-h-[34px] flex-1 items-center justify-center gap-1.5 rounded-full text-md font-medium text-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring/50 data-active:font-semibold [&_svg]:size-4"
          >
            {option.icon && <option.icon aria-hidden="true" />}
            {option.label}
          </Tabs.Tab>
        ))}
      </Tabs.List>
    </Tabs.Root>
  )
}
```

- [ ] **Step 4: O'tishini ko'r**

Run: `cd apps/web && pnpm exec vitest run components/kit/segmented.test.tsx`
Expected: PASS (1).

- [ ] **Step 5: Commit**

```bash
git add apps/web/components/kit/segmented.tsx apps/web/components/kit/segmented.test.tsx
git commit -m "feat(web): the kit's segmented control on Base UI tabs, with a sliding thumb"
```

---

### Task 11: `SearchBox` (`.search`)

**Files:**
- Create: `apps/web/components/kit/search-box.tsx`
- Test: `apps/web/components/kit/search-box.test.tsx`

- [ ] **Step 1: Yiqiladigan testni yoz**

```tsx
// apps/web/components/kit/search-box.test.tsx
import { act, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, expect, test, vi } from "vitest"
import { SearchBox } from "./search-box"

beforeEach(() => vi.useFakeTimers({ shouldAdvanceTime: true }))
afterEach(() => vi.useRealTimers())

test("the box reports what was typed once typing pauses, trimmed", async () => {
  const search = vi.fn()
  render(<SearchBox value="" onSearch={search} placeholder="Ism yoki telefon" />)
  const box = screen.getByRole("searchbox", { name: "Qidirish" })
  expect(box).toHaveAttribute("placeholder", "Ism yoki telefon")
  await userEvent.type(box, " ali ")
  expect(search).not.toHaveBeenCalled()
  await act(() => vi.advanceTimersByTimeAsync(300))
  expect(search).toHaveBeenCalledWith("ali")
})

test("the clear button empties the box and reports at once; it is not there while the box is empty", async () => {
  const search = vi.fn()
  render(<SearchBox value="ali" onSearch={search} />)
  expect(screen.getByRole("searchbox")).toHaveValue("ali")
  await userEvent.click(screen.getByRole("button", { name: "Tozalash" }))
  expect(search).toHaveBeenCalledWith("")
  expect(screen.getByRole("searchbox")).toHaveValue("")
  expect(screen.queryByRole("button", { name: "Tozalash" })).not.toBeInTheDocument()
})

test("a search changed from outside is shown", () => {
  const { rerender } = render(<SearchBox value="ali" onSearch={() => {}} />)
  rerender(<SearchBox value="" onSearch={() => {}} />)
  expect(screen.getByRole("searchbox")).toHaveValue("")
})

test("with no delay the box reports every keystroke (a picker's list)", async () => {
  const search = vi.fn()
  render(<SearchBox value="" onSearch={search} delay={0} />)
  await userEvent.type(screen.getByRole("searchbox"), "ol")
  expect(search).toHaveBeenLastCalledWith("ol")
})
```

- [ ] **Step 2: Yiqilishini ko'r**

Run: `cd apps/web && pnpm exec vitest run components/kit/search-box.test.tsx`
Expected: FAIL — modul yo'q; stub bilan `searchbox` topilmaydi.

- [ ] **Step 3: `search-box.tsx` ni yoz**

```tsx
"use client"

import { SearchIcon, XIcon } from "lucide-react"
import { useEffect, useState } from "react"
import { cn } from "@/lib/utils"

// SearchBox is the prototype's search pill. It reports what was typed once
// typing pauses for delay ms (300 by default; 0 reports every keystroke, for
// a list that filters in place). The search it is given may also change from
// outside (a link to the bare list drops it from the address): the box then
// follows, so what was typed before is not taken for fresh typing and sent
// again. The × empties it at once.
export function SearchBox({
  value,
  onSearch,
  placeholder = "Ism yoki telefon",
  label = "Qidirish",
  delay = 300,
  className,
}: {
  value: string
  onSearch: (value: string) => void
  placeholder?: string
  label?: string
  delay?: number
  className?: string
}) {
  const [text, setText] = useState(value)
  const [seen, setSeen] = useState(value)
  if (value !== seen) {
    setSeen(value)
    // The box follows only if it agreed with the search before the change.
    // A box that is ahead of it is being typed in: the change is then its
    // own earlier report arriving, and what was typed since stays.
    if (text.trim() === seen) setText(value)
  }

  useEffect(() => {
    if (text.trim() === value) return
    if (delay === 0) {
      onSearch(text.trim())
      return
    }
    const timer = setTimeout(() => onSearch(text.trim()), delay)
    return () => clearTimeout(timer)
  }, [text, value, delay, onSearch])

  return (
    <div data-slot="search-box" className={cn("flex h-11 items-center gap-2 rounded-full bg-muted px-3.5 text-muted-foreground", className)}>
      <SearchIcon aria-hidden="true" strokeWidth={2.4} className="size-[19px] shrink-0" />
      <input
        type="search"
        aria-label={label}
        placeholder={placeholder}
        value={text}
        onChange={(event) => setText(event.target.value)}
        autoComplete="off"
        enterKeyHint="search"
        className="h-full min-w-0 flex-1 bg-transparent text-base text-foreground outline-none placeholder:text-muted-foreground [&::-webkit-search-cancel-button]:hidden"
      />
      {text !== "" && (
        <button
          type="button"
          aria-label="Tozalash"
          onClick={() => {
            setText("")
            onSearch("")
          }}
          className="-mr-2 grid size-8 shrink-0 place-items-center"
        >
          <span className="grid size-[18px] place-items-center rounded-full bg-muted-foreground/70 text-card">
            <XIcon strokeWidth={3.4} className="size-[11px]" />
          </span>
        </button>
      )}
    </div>
  )
}
```

- [ ] **Step 4: O'tishini ko'r**

Run: `cd apps/web && pnpm exec vitest run components/kit/search-box.test.tsx`
Expected: PASS (4).

- [ ] **Step 5: Commit**

```bash
git add apps/web/components/kit/search-box.tsx apps/web/components/kit/search-box.test.tsx
git commit -m "feat(web): the kit's search pill, debounced or immediate, with a clear button"
```

---

### Task 12: `MainButton`, `MainBar` (`.mainbtn`, `.mainbar`)

**Files:**
- Create: `apps/web/components/kit/main-button.tsx`
- Test: `apps/web/components/kit/main-button.test.tsx`

- [ ] **Step 1: Yiqiladigan testni yoz**

```tsx
// apps/web/components/kit/main-button.test.tsx
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { expect, test, vi } from "vitest"
import { MainBar, MainButton } from "./main-button"

test("a main button that is pending is busy, keeps focus, shows it is sending and takes no press", async () => {
  const submit = vi.fn()
  const { rerender } = render(<MainButton onClick={submit}>Saqlash</MainButton>)
  const button = screen.getByRole("button", { name: "Saqlash" })
  await userEvent.click(button)
  expect(submit).toHaveBeenCalledTimes(1)

  rerender(<MainButton onClick={submit} pending>Saqlash</MainButton>)
  expect(button).toHaveAttribute("aria-busy", "true")
  expect(button).toHaveAttribute("aria-disabled", "true")
  expect(button).not.toBeDisabled()
  expect(button).toHaveTextContent("Yuborilmoqda")
  button.focus()
  expect(button).toHaveFocus()
  await userEvent.click(button)
  expect(submit).toHaveBeenCalledTimes(1)
})

test("a main button says its variant; a bar holds the buttons under a page", () => {
  render(
    <MainBar>
      <MainButton variant="red">O&apos;chirish</MainButton>
      <MainButton variant="ghost">Bekor qilish</MainButton>
    </MainBar>,
  )
  expect(screen.getByRole("button", { name: "O'chirish" })).toHaveAttribute("data-variant", "red")
  expect(screen.getByRole("button", { name: "Bekor qilish" })).toHaveAttribute("data-variant", "ghost")
  expect(screen.getByRole("button", { name: "O'chirish" }).closest('[data-slot="main-bar"]')).toBeInTheDocument()
})
```

- [ ] **Step 2: Yiqilishini ko'r**

Run: `cd apps/web && pnpm exec vitest run components/kit/main-button.test.tsx`
Expected: FAIL — modul yo'q; stub bilan tugma topilmaydi.

- [ ] **Step 3: `main-button.tsx` ni yoz**

```tsx
"use client"

import type { ComponentProps, MouseEvent, ReactNode } from "react"
import { cn } from "@/lib/utils"

// MainButton is the prototype's main button: full width, 52px, the accent
// (or a ghost in the accent color, or red for an irreversible act). While
// its request is on its way it is busy: it says so, keeps the focus (a
// button the browser disables cannot hold it, and whoever pressed Enter on
// it would be dropped to the top of the page), shows a spinner and takes no
// press.
export function MainButton({
  variant = "accent",
  pending = false,
  disabled,
  type = "button",
  onClick,
  className,
  children,
  ...props
}: Omit<ComponentProps<"button">, "onClick"> & {
  variant?: "accent" | "ghost" | "red"
  pending?: boolean
  onClick?: (event: MouseEvent<HTMLButtonElement>) => void
}) {
  return (
    <button
      type={type}
      data-slot="main-button"
      data-variant={variant}
      aria-busy={pending || undefined}
      aria-disabled={pending || undefined}
      disabled={disabled}
      onClick={(event) => {
        if (pending) {
          event.preventDefault()
          return
        }
        onClick?.(event)
      }}
      className={cn(
        "flex h-[52px] w-full items-center justify-center gap-2 rounded-main text-base font-semibold outline-none transition-[transform,opacity] duration-150 ease-out-expo active:scale-[.98] focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50 aria-disabled:pointer-events-none",
        variant === "accent" && "bg-primary text-primary-foreground",
        variant === "ghost" && "h-11 bg-transparent text-primary",
        variant === "red" && "bg-destructive text-white",
        className,
      )}
      {...props}
    >
      {pending && (
        <>
          <span aria-hidden="true" className="size-5 animate-spin rounded-full border-[2.4px] border-current border-r-transparent motion-reduce:animate-none" />
          <span className="sr-only">Yuborilmoqda</span>
        </>
      )}
      {children}
    </button>
  )
}

// MainBar is the bar the main button stands in at the bottom of a page or
// a sheet: it sticks to the bottom, fades the content under it and keeps
// clear of the phone's bottom edge. tone "sheet" fades into a sheet's own
// background.
export function MainBar({ children, tone = "page", className }: { children: ReactNode; tone?: "page" | "sheet"; className?: string }) {
  return (
    <div
      data-slot="main-bar"
      className={cn(
        "sticky bottom-0 z-[5] -mx-4 mt-auto flex flex-col gap-1 px-4 pt-3 pb-safe-7",
        tone === "page" ? "bg-gradient-to-t from-background from-70% to-transparent" : "bg-gradient-to-t from-sheet from-70% to-transparent",
        className,
      )}
    >
      {children}
    </div>
  )
}
```

- [ ] **Step 4: O'tishini ko'r**

Run: `cd apps/web && pnpm exec vitest run components/kit/main-button.test.tsx`
Expected: PASS (2).

- [ ] **Step 5: Commit**

```bash
git add apps/web/components/kit/main-button.tsx apps/web/components/kit/main-button.test.tsx
git commit -m "feat(web): the kit's main button, busy without losing focus, and its bar"
```

---

### Task 13: `Dialog` = pastdan chiqadigan varaq (`.sheet`)

**Files:**
- Modify: `apps/web/components/ui/dialog.tsx`
- Test: `apps/web/components/ui/dialog.test.tsx` (kengayadi)

- [ ] **Step 1: Testlarni qo'sh** (mavjud «Yopish» testi qoladi)

```tsx
// apps/web/components/ui/dialog.test.tsx ga qo'shiladi
import userEvent from "@testing-library/user-event"
import { vi } from "vitest"
import { DialogDescription, DialogFooter, DialogHeader } from "./dialog"

test("a dialog comes up as a sheet named by its title; the close button at its head closes it", async () => {
  const change = vi.fn()
  render(
    <Dialog open onOpenChange={change}>
      <DialogContent tall>
        <DialogHeader>
          <DialogTitle>Mijoz qo&apos;shish</DialogTitle>
          <DialogDescription>Turni tanlang.</DialogDescription>
        </DialogHeader>
        <p>Tana</p>
        <DialogFooter>
          <button type="button">Qo&apos;shish</button>
        </DialogFooter>
      </DialogContent>
    </Dialog>,
  )
  const dialog = await screen.findByRole("dialog", { name: "Mijoz qo'shish" })
  expect(dialog).toHaveAttribute("data-tall", "true")
  expect(dialog).toHaveAccessibleDescription("Turni tanlang.")
  // The grab handle is decoration; the body scrolls, the footer stays.
  expect(dialog.querySelector('[data-slot="dialog-grab"]')).toHaveAttribute("aria-hidden", "true")
  expect(screen.getByRole("button", { name: "Qo'shish" }).closest('[data-slot="dialog-footer"]')).toBeInTheDocument()
  await userEvent.click(screen.getByRole("button", { name: "Yopish" }))
  expect(change).toHaveBeenCalledWith(false, expect.anything())
})
```

- [ ] **Step 2: Yiqilishini ko'r**

Run: `cd apps/web && pnpm exec vitest run components/ui/dialog.test.tsx`
Expected: FAIL — `tall` prop'i va `data-tall` yo'q; `dialog-grab` topilmaydi.

- [ ] **Step 3: `dialog.tsx` ni yoz**

```tsx
"use client"

import * as React from "react"
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog"
import { cn } from "cn"
import { XIcon } from "lucide-react"

// The dialogs are the prototype's sheets: they come up from the bottom of
// the screen (on a wide screen too, 480px wide in the middle), a grab
// handle on top, the close button at the top left, the title centered, the
// body scrolling under a sticky head, the main button in a sticky footer.
// The API is the one from before (Dialog, DialogContent, DialogHeader,
// DialogTitle, DialogDescription, DialogFooter), so every dialog of the app
// is a sheet from here on.

function Dialog({ ...props }: DialogPrimitive.Root.Props) {
  return <DialogPrimitive.Root data-slot="dialog" {...props} />
}

function DialogTrigger({ ...props }: DialogPrimitive.Trigger.Props) {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />
}

function DialogPortal({ ...props }: DialogPrimitive.Portal.Props) {
  return <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />
}

function DialogClose({ ...props }: DialogPrimitive.Close.Props) {
  return <DialogPrimitive.Close data-slot="dialog-close" {...props} />
}

function DialogOverlay({ className, ...props }: DialogPrimitive.Backdrop.Props) {
  return (
    <DialogPrimitive.Backdrop
      data-slot="dialog-overlay"
      className={cn(
        "fixed inset-0 isolate z-50 bg-scrim transition-opacity duration-300 data-starting-style:opacity-0 data-ending-style:opacity-0",
        className
      )}
      {...props}
    />
  )
}

function DialogContent({
  className,
  children,
  showCloseButton = true,
  tall = false,
  right,
  ...props
}: DialogPrimitive.Popup.Props & {
  showCloseButton?: boolean
  // tall: the sheet takes the whole height (a long form, a list to search).
  tall?: boolean
  // right: a control at the head's right (a second action).
  right?: React.ReactNode
}) {
  return (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Popup
        data-slot="dialog-content"
        data-tall={tall || undefined}
        className={cn(
          "group/sheet fixed inset-x-2 bottom-2 z-50 mx-auto flex max-h-[calc(100dvh-18px)] w-auto max-w-[480px] flex-col overflow-hidden rounded-sheet bg-sheet text-foreground shadow-[0_-4px_40px_rgba(0,0,0,.12)] outline-none transition-transform duration-[440ms] ease-drawer data-starting-style:translate-y-[105%] data-ending-style:translate-y-[105%] data-tall:h-[calc(100dvh-18px)]",
          className
        )}
        {...props}
      >
        <span aria-hidden="true" data-slot="dialog-grab" className="absolute top-1.5 left-1/2 z-10 h-[5px] w-9 -translate-x-1/2 rounded-full bg-muted-foreground/35" />
        {showCloseButton && (
          <DialogPrimitive.Close
            data-slot="dialog-close"
            aria-label="Yopish"
            className="absolute top-3 left-3 z-10 grid size-11 place-items-center rounded-full outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <span className="grid size-9 place-items-center rounded-full bg-muted text-foreground">
              <XIcon strokeWidth={2.6} className="size-4" />
            </span>
          </DialogPrimitive.Close>
        )}
        {right && (
          <span data-slot="dialog-right" className="absolute top-3 right-3 z-10 flex h-11 items-center">
            {right}
          </span>
        )}
        <div data-slot="dialog-body" className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain px-4 pb-4 scrollbar-hide">
          {children}
        </div>
      </DialogPrimitive.Popup>
    </DialogPortal>
  )
}

// DialogHeader is the sheet's head: it stays at the top while the body
// scrolls, the title centered between the close button and the right slot.
function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-header"
      className={cn("sticky top-0 z-[1] -mx-4 mb-2 flex flex-col gap-1 bg-sheet px-14 pt-5 pb-2 text-center", className)}
      {...props}
    />
  )
}

// DialogFooter is the main button's bar at the bottom of the sheet.
function DialogFooter({
  className,
  showCloseButton = false,
  children,
  ...props
}: React.ComponentProps<"div"> & {
  showCloseButton?: boolean
}) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn(
        "sticky bottom-0 z-[1] -mx-4 -mb-4 mt-auto flex flex-col gap-1 bg-gradient-to-t from-sheet from-70% to-transparent px-4 pt-3 pb-4 [&>*]:w-full",
        className
      )}
      {...props}
    >
      {children}
      {showCloseButton && (
        <DialogPrimitive.Close className="h-11 rounded-main text-base font-semibold text-primary">
          Yopish
        </DialogPrimitive.Close>
      )}
    </div>
  )
}

function DialogTitle({ className, ...props }: DialogPrimitive.Title.Props) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn("text-base leading-tight font-semibold", className)}
      {...props}
    />
  )
}

function DialogDescription({ className, ...props }: DialogPrimitive.Description.Props) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn("text-sm leading-snug text-muted-foreground *:[a]:underline *:[a]:underline-offset-3", className)}
      {...props}
    />
  )
}

export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
}
```

- [ ] **Step 4: O'tishini ko'r va mavjud dialog testlarini tekshir**

Run: `cd apps/web && pnpm exec vitest run components/ui/dialog.test.tsx && pnpm exec vitest run`
Expected: `dialog.test.tsx` 2 passed; butun to'plam o'tadi (dialoglarning rollari, sarlavhalari va «Yopish» o'zgarmadi). Agar biror sahifa testi `DialogContent` ning `className="sm:max-w-md"` kabi eski kengliklariga bog'liq bo'lsa — bo'lmasligi kerak (classlar tekshirilmaydi).

- [ ] **Step 5: Commit**

```bash
git add apps/web/components/ui/dialog.tsx apps/web/components/ui/dialog.test.tsx
git commit -m "feat(web): every dialog is a bottom sheet: a grab handle, the close button at the head, a sticky title and footer, tall when told"
```

---

### Task 14: `AlertDialog` (`.alert`)

**Files:**
- Modify: `apps/web/components/ui/alert-dialog.tsx`
- Test: `apps/web/components/ui/alert-dialog.test.tsx` (yangi)

- [ ] **Step 1: Yiqiladigan testni yoz**

```tsx
// apps/web/components/ui/alert-dialog.test.tsx
import { render, screen } from "@testing-library/react"
import { expect, test } from "vitest"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "./alert-dialog"

test("an alert dialog asks its question in the middle of the screen, its two buttons side by side", async () => {
  render(
    <AlertDialog open>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Mijozni o&apos;chirasizmi?</AlertDialogTitle>
          <AlertDialogDescription>«Ali Valiyev» o&apos;chiriladi.</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Bekor qilish</AlertDialogCancel>
          <AlertDialogAction variant="destructive">O&apos;chirish</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>,
  )
  const dialog = await screen.findByRole("alertdialog", { name: "Mijozni o'chirasizmi?" })
  expect(dialog).toHaveAccessibleDescription("«Ali Valiyev» o'chiriladi.")
  expect(screen.getByRole("button", { name: "Bekor qilish" })).toHaveAttribute("data-slot", "alert-dialog-cancel")
  expect(screen.getByRole("button", { name: "O'chirish" })).toHaveAttribute("data-slot", "alert-dialog-action")
})
```

- [ ] **Step 2: Yiqilishini ko'r**

Run: `cd apps/web && pnpm exec vitest run components/ui/alert-dialog.test.tsx`
Expected: FAIL — `AlertDialogCancel` tugmasida `data-slot` `render` orqali `Button` ga o'tib ketadi (`data-slot="button"`); yoki o'tsa, 3-qadamdan keyin ham o'tishi kerak (test uslubni emas, tuzilmani mahkamlaydi). Yiqilmasa, 3-qadamga o'tib, keyin to'plam bilan tekshir.

- [ ] **Step 3: `alert-dialog.tsx` classlarini almashtir**

`AlertDialogOverlay`: `bg-black/10 … backdrop-blur-xs` → `bg-scrim transition-opacity duration-200 data-starting-style:opacity-0 data-ending-style:opacity-0`.

`AlertDialogContent` ning className'i:

```tsx
"group/alert-dialog-content fixed top-1/2 left-1/2 z-50 w-[calc(100%-3rem)] max-w-[300px] -translate-x-1/2 -translate-y-1/2 rounded-[32px] bg-menu px-[18px] pt-[22px] pb-4 text-center text-foreground shadow-float backdrop-blur-[30px] backdrop-saturate-[1.8] transition-[opacity,transform] duration-200 ease-out-expo outline-none data-starting-style:scale-[1.12] data-starting-style:opacity-0 data-ending-style:opacity-0"
```

`AlertDialogHeader`: `"grid place-items-center gap-1.5 text-center"`. `AlertDialogFooter`: `"mt-[18px] flex gap-2 [&>*]:h-12 [&>*]:flex-1 [&>*]:rounded-full [&>*]:text-base"`. `AlertDialogTitle`: `"text-base leading-tight font-semibold"`. `AlertDialogDescription`: `"text-sm leading-snug text-muted-foreground"`. `AlertDialogAction` `data-slot="alert-dialog-action"` qoladi; `AlertDialogCancel` da `variant = "secondary"` standart bo'lsin va `data-slot="alert-dialog-cancel"` `render` dan keyin turishi uchun `{...props}` dan keyin `data-slot` berilsin:

```tsx
function AlertDialogCancel({ className, variant = "secondary", size = "default", ...props }: AlertDialogPrimitive.Close.Props & Pick<React.ComponentProps<typeof Button>, "variant" | "size">) {
  return (
    <AlertDialogPrimitive.Close
      className={cn(className)}
      render={<Button variant={variant} size={size} />}
      {...props}
      data-slot="alert-dialog-cancel"
    />
  )
}
```

- [ ] **Step 4: O'tishini ko'r**

Run: `cd apps/web && pnpm exec vitest run components/ui/alert-dialog.test.tsx && pnpm exec vitest run components -t "o'chir"`
Expected: PASS; o'chirish tasdiqlari (`delete-*-button.test.tsx`) o'tadi.

- [ ] **Step 5: Commit**

```bash
git add apps/web/components/ui/alert-dialog.tsx apps/web/components/ui/alert-dialog.test.tsx
git commit -m "feat(web): the alert dialog as the prototype's glass alert, two round buttons side by side"
```

---

### Task 15: `ActionSheet` (`.asheet`)

**Files:**
- Create: `apps/web/components/kit/action-sheet.tsx`
- Test: `apps/web/components/kit/action-sheet.test.tsx`

- [ ] **Step 1: Yiqiladigan testni yoz**

```tsx
// apps/web/components/kit/action-sheet.test.tsx
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { expect, test, vi } from "vitest"
import { ActionSheet } from "./action-sheet"

test("an action sheet lists what can be done; a choice does it and closes the sheet", async () => {
  const edit = vi.fn()
  const remove = vi.fn()
  const change = vi.fn()
  render(
    <ActionSheet
      open
      onOpenChange={change}
      title="Yetkazib berish · 30 000 so'm"
      items={[
        { label: "Tahrirlash", onSelect: edit },
        { label: "O'chirish", onSelect: remove, danger: true },
      ]}
    />,
  )
  const dialog = await screen.findByRole("dialog", { name: "Yetkazib berish · 30 000 so'm" })
  expect(dialog).toBeInTheDocument()
  expect(screen.getByRole("menuitem", { name: "O'chirish" })).toHaveAttribute("data-danger", "true")
  await userEvent.click(screen.getByRole("menuitem", { name: "Tahrirlash" }))
  expect(edit).toHaveBeenCalledTimes(1)
  expect(change).toHaveBeenCalledWith(false)
  await userEvent.click(screen.getByRole("button", { name: "Bekor qilish" }))
  expect(change).toHaveBeenLastCalledWith(false, expect.anything())
})

test("a choice among states marks the current one", () => {
  render(
    <ActionSheet
      open
      onOpenChange={() => {}}
      items={[
        { label: "Asosiy", onSelect: () => {}, checked: true },
        { label: "Chilonzor", onSelect: () => {}, checked: false },
      ]}
    />,
  )
  expect(screen.getByRole("menuitemradio", { name: "Asosiy" })).toHaveAttribute("aria-checked", "true")
  expect(screen.getByRole("menuitemradio", { name: "Chilonzor" })).toHaveAttribute("aria-checked", "false")
})
```

- [ ] **Step 2: Yiqilishini ko'r**

Run: `cd apps/web && pnpm exec vitest run components/kit/action-sheet.test.tsx`
Expected: FAIL — modul yo'q; stub bilan dialog topilmaydi.

- [ ] **Step 3: `action-sheet.tsx` ni yoz**

```tsx
"use client"

import { Dialog as DialogPrimitive } from "@base-ui/react/dialog"
import { CheckIcon } from "lucide-react"
import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

export interface ActionItem {
  label: string
  onSelect: () => void
  // danger is red (deleting); checked marks the current one among states
  // (a location, a stage); dot is a color beside the name (a stage's).
  danger?: boolean
  checked?: boolean
  dot?: string
  disabled?: boolean
}

const glass = "rounded-[24px] bg-menu p-1.5 shadow-float ring-[0.5px] ring-glass-edge ring-inset backdrop-blur-[30px] backdrop-saturate-[1.8]"

// ActionSheet is the prototype's action sheet: what can be done with a
// record (edit, deactivate, delete) or which state to put it in, in a glass
// list at the bottom of the screen, «Bekor qilish» under it. A choice does
// its thing and closes the sheet.
export function ActionSheet({
  open,
  onOpenChange,
  title,
  items,
  cancelLabel = "Bekor qilish",
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title?: ReactNode
  items: ActionItem[]
  cancelLabel?: string
}) {
  const choice = items.some((item) => item.checked !== undefined)
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop className="fixed inset-0 z-50 bg-scrim transition-opacity duration-250 data-starting-style:opacity-0 data-ending-style:opacity-0" />
        <DialogPrimitive.Popup
          data-slot="action-sheet"
          aria-label={title === undefined ? "Amallar" : undefined}
          className="fixed inset-x-2 bottom-3 z-50 mx-auto flex w-auto max-w-[480px] flex-col gap-2 outline-none transition-transform duration-[380ms] ease-drawer data-starting-style:translate-y-[110%] data-ending-style:translate-y-[110%]"
        >
          <div role="menu" className={glass}>
            {title !== undefined && (
              <>
                <DialogPrimitive.Title className="px-4 pt-2.5 pb-2 text-center text-xs leading-snug font-normal text-muted-foreground">{title}</DialogPrimitive.Title>
                <hr className="mx-2.5 mb-1 h-px border-0 bg-border" />
              </>
            )}
            {items.map((item) => (
              <button
                key={item.label}
                type="button"
                role={choice ? "menuitemradio" : "menuitem"}
                aria-checked={choice ? item.checked === true : undefined}
                data-danger={item.danger || undefined}
                disabled={item.disabled}
                onClick={() => {
                  onOpenChange(false)
                  item.onSelect()
                }}
                className={cn(
                  "relative flex min-h-[52px] w-full items-center justify-center gap-3 rounded-[16px] px-3.5 text-base text-foreground outline-none active:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-45",
                  item.danger && "text-destructive",
                )}
              >
                {item.dot && <span aria-hidden="true" style={{ background: item.dot }} className="size-2.5 shrink-0 rounded-full" />}
                <span>{item.label}</span>
                {item.checked && <CheckIcon aria-hidden="true" strokeWidth={2.6} className="absolute right-4 size-5 text-primary" />}
              </button>
            ))}
          </div>
          <div className={glass}>
            <DialogPrimitive.Close className="flex min-h-[52px] w-full items-center justify-center rounded-[16px] text-base font-semibold text-foreground outline-none active:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50">
              {cancelLabel}
            </DialogPrimitive.Close>
          </div>
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
```

- [ ] **Step 4: O'tishini ko'r**

Run: `cd apps/web && pnpm exec vitest run components/kit/action-sheet.test.tsx`
Expected: PASS (2).

- [ ] **Step 5: Commit**

```bash
git add apps/web/components/kit/action-sheet.tsx apps/web/components/kit/action-sheet.test.tsx
git commit -m "feat(web): the kit's action sheet, with danger items, checked states and a cancel"
```

---

### Task 16: `Switch` (`.sw`, Base UI Switch)

**Files:**
- Create: `apps/web/components/ui/switch.tsx`
- Test: `apps/web/components/ui/switch.test.tsx`

- [ ] **Step 1: Yiqiladigan testni yoz**

```tsx
// apps/web/components/ui/switch.test.tsx
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { expect, test, vi } from "vitest"
import { Switch } from "./switch"

test("a switch is a switch: it says whether it is on, and a press turns it", async () => {
  const change = vi.fn()
  render(<Switch aria-label="Majburiy" checked={false} onCheckedChange={change} />)
  const toggle = screen.getByRole("switch", { name: "Majburiy" })
  expect(toggle).toHaveAttribute("aria-checked", "false")
  await userEvent.click(toggle)
  expect(change).toHaveBeenCalledWith(true, expect.anything())
})

test("a label beside the switch names it, and a press on the label turns it", async () => {
  const change = vi.fn()
  render(
    <>
      <label htmlFor="final">Yakuniy bosqich</label>
      <Switch id="final" checked onCheckedChange={change} />
    </>,
  )
  expect(screen.getByRole("switch", { name: "Yakuniy bosqich" })).toHaveAttribute("aria-checked", "true")
  await userEvent.click(screen.getByText("Yakuniy bosqich"))
  expect(change).toHaveBeenCalledWith(false, expect.anything())
})
```

- [ ] **Step 2: Yiqilishini ko'r**

Run: `cd apps/web && pnpm exec vitest run components/ui/switch.test.tsx`
Expected: FAIL — modul yo'q; stub bilan `switch` roli topilmaydi.

- [ ] **Step 3: `switch.tsx` ni yoz**

```tsx
"use client"

import { Switch as SwitchPrimitive } from "@base-ui/react/switch"
import { cn } from "cn"

// Switch is the iOS switch of the prototype (51×31, a white thumb that
// slides right and turns the track the accent), on Base UI's switch: a
// button with role switch, labeled by a label beside it.
function Switch({ className, ...props }: SwitchPrimitive.Root.Props) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      className={cn(
        "relative h-[31px] w-[51px] shrink-0 rounded-full bg-[#E3E3E8] transition-colors duration-200 outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-45 data-checked:bg-primary dark:bg-muted",
        className
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className="block size-[27px] translate-x-0.5 rounded-full bg-white shadow-[0_3px_8px_rgba(0,0,0,.15),0_1px_1px_rgba(0,0,0,.08)] transition-transform duration-250 ease-spring data-checked:translate-x-[22px]"
      />
    </SwitchPrimitive.Root>
  )
}

export { Switch }
```

- [ ] **Step 4: O'tishini ko'r**

Run: `cd apps/web && pnpm exec vitest run components/ui/switch.test.tsx`
Expected: PASS (2).

- [ ] **Step 5: Commit**

```bash
git add apps/web/components/ui/switch.tsx apps/web/components/ui/switch.test.tsx
git commit -m "feat(web): the iOS switch on Base UI"
```

---

### Task 17: Forma qatorlari (`.frow`, `.ferr`, `.opts`): `FormRow`, `TextRow`, `PhoneRow`, `AmountRow`, `PickRow`, `SwitchRow`, `OptionChips`

**Files:**
- Create: `apps/web/components/kit/form-row.tsx`
- Test: `apps/web/components/kit/form-row.test.tsx`

- [ ] **Step 1: Yiqiladigan testni yoz**

```tsx
// apps/web/components/kit/form-row.test.tsx
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { useForm } from "react-hook-form"
import { expect, test, vi } from "vitest"
import { AmountRow, OptionChips, PhoneRow, PickRow, SwitchRow, TextRow } from "./form-row"

type Values = { name: string; phone: string; price: string; required: boolean; source: string; langs: string[] }

// Form renders the rows bound to a form and submits what the form holds.
function Form({ onSubmit, defaults }: { onSubmit: (values: Values) => void; defaults?: Partial<Values> }) {
  const form = useForm<Values>({ defaultValues: { name: "", phone: "", price: "", required: false, source: "", langs: [], ...defaults } })
  return (
    <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
      <TextRow control={form.control} name="name" label="Nomi" placeholder="Masalan, Olma" />
      <PhoneRow control={form.control} name="phone" />
      <AmountRow control={form.control} name="price" label="Sotuv narxi" />
      <SwitchRow control={form.control} name="required" label="Majburiy" />
      <OptionChips control={form.control} name="source" label="Manba" options={[{ value: "1", label: "Instagram" }, { value: "2", label: "YouTube" }]} />
      <OptionChips control={form.control} name="langs" label="Tillar" multiple options={[{ value: "uz", label: "O'zbek" }, { value: "ru", label: "Rus" }]} />
      <button type="submit">Saqlash</button>
    </form>
  )
}

test("the rows are labeled fields bound to the form; the phone is masked and the +998 sits beside it", async () => {
  const submit = vi.fn()
  render(<Form onSubmit={submit} />)
  await userEvent.type(screen.getByRole("textbox", { name: "Nomi" }), "Olma")
  const phone = screen.getByRole("textbox", { name: "Telefon" })
  await userEvent.type(phone, "901234567")
  expect(phone).toHaveValue("90 123 45 67")
  expect(screen.getByText("+998")).toBeInTheDocument()
  await userEvent.type(screen.getByRole("textbox", { name: "Sotuv narxi" }), "12000")
  expect(screen.getByText("so'm")).toBeInTheDocument()
  await userEvent.click(screen.getByRole("switch", { name: "Majburiy" }))
  await userEvent.click(screen.getByRole("radio", { name: "Instagram" }))
  await userEvent.click(screen.getByRole("checkbox", { name: "O'zbek" }))
  await userEvent.click(screen.getByRole("checkbox", { name: "Rus" }))
  await userEvent.click(screen.getByRole("checkbox", { name: "O'zbek" }))
  await userEvent.click(screen.getByRole("button", { name: "Saqlash" }))
  expect(submit).toHaveBeenCalledWith(
    { name: "Olma", phone: "90 123 45 67", price: "12000", required: true, source: "1", langs: ["ru"] },
    expect.anything(),
  )
})

test("a chosen radio chip pressed again is unchosen", async () => {
  const submit = vi.fn()
  render(<Form onSubmit={submit} defaults={{ source: "2" }} />)
  const chosen = screen.getByRole("radio", { name: "YouTube" })
  expect(chosen).toHaveAttribute("aria-checked", "true")
  await userEvent.click(chosen)
  expect(chosen).toHaveAttribute("aria-checked", "false")
})

test("a pick row is a button that says its label and its value, or a prompt while there is none", async () => {
  const open = vi.fn()
  const { rerender } = render(<PickRow label="Bosqich" onClick={open} />)
  const row = screen.getByRole("button", { name: "Bosqich Tanlang" })
  expect(row).toHaveAttribute("aria-haspopup", "dialog")
  await userEvent.click(row)
  expect(open).toHaveBeenCalledTimes(1)
  rerender(<PickRow label="Bosqich" value="Yangi" onClick={open} error="Bosqichni tanlang" />)
  expect(screen.getByRole("button", { name: "Bosqich Yangi" })).toHaveAccessibleDescription("Bosqichni tanlang")
  expect(screen.getByRole("alert")).toHaveTextContent("Bosqichni tanlang")
})
```

- [ ] **Step 2: Yiqilishini ko'r**

Run: `cd apps/web && pnpm exec vitest run components/kit/form-row.test.tsx`
Expected: FAIL — modul yo'q; stublar bilan maydonlar topilmaydi.

- [ ] **Step 3: `form-row.tsx` ni yoz**

```tsx
"use client"

import { CheckIcon, ChevronRightIcon } from "lucide-react"
import { type ComponentProps, type ReactNode, useId } from "react"
import { type Control, Controller, type FieldPath, type FieldValues } from "react-hook-form"
import { Switch } from "@/components/ui/switch"
import { formatPhoneInput } from "@/lib/phone"
import { cn } from "@/lib/utils"

// The rows of a form, as the prototype draws them inside a Group: the label
// at the left (112px), the control beside it, the error under them in red.
// Each is bound to a react-hook-form field through Controller. TOut is what
// the form's schema turns the values into.

const labelClass = "shrink-0 basis-[112px] text-[16px] leading-tight text-foreground group-data-invalid:text-destructive"
const inputClass = "h-10 min-w-0 flex-1 bg-transparent text-base text-foreground outline-none placeholder:text-muted-foreground/80 disabled:opacity-60"

interface Bound<T extends FieldValues, TOut extends FieldValues> {
  control: Control<T, unknown, TOut>
  name: FieldPath<T>
  label: string
}

// FormRow is the frame: a label (for the control with htmlFor, or plain
// text beside a group), the control, the error. stack puts the control
// under the label (a group of chips).
export function FormRow({
  label,
  htmlFor,
  error,
  errorId,
  stack = false,
  children,
  className,
}: {
  label: ReactNode
  htmlFor?: string
  error?: string
  errorId?: string
  stack?: boolean
  children: ReactNode
  className?: string
}) {
  return (
    <div data-slot="form-row" data-invalid={error ? true : undefined} className={cn("group px-4", className)}>
      <div className={cn("flex min-h-[52px] gap-3 py-1.5", stack ? "flex-col items-stretch gap-2 py-3" : "items-center")}>
        {htmlFor ? (
          <label htmlFor={htmlFor} className={cn(labelClass, stack && "basis-auto")}>
            {label}
          </label>
        ) : (
          <span className={cn(labelClass, stack && "basis-auto")}>{label}</span>
        )}
        {children}
      </div>
      {error && (
        <p id={errorId} role="alert" data-slot="form-error" className="-mt-1.5 pb-2.5 text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}

// TextRow is a text input in a row; prefix and suffix stand beside it.
export function TextRow<T extends FieldValues, TOut extends FieldValues = T>({
  control,
  name,
  label,
  prefix,
  suffix,
  className,
  ...input
}: Bound<T, TOut> & { prefix?: ReactNode; suffix?: ReactNode } & Omit<ComponentProps<"input">, "name" | "value" | "onChange" | "onBlur">) {
  const id = useId()
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <FormRow label={label} htmlFor={id} error={fieldState.error?.message} errorId={`${id}-error`}>
          {prefix && <span className="text-base text-muted-foreground">{prefix}</span>}
          <input
            id={id}
            aria-invalid={fieldState.invalid || undefined}
            aria-describedby={fieldState.error ? `${id}-error` : undefined}
            className={cn(inputClass, className)}
            {...input}
            {...field}
            value={field.value ?? ""}
          />
          {suffix && <span className="text-md text-muted-foreground">{suffix}</span>}
        </FormRow>
      )}
    />
  )
}

// PhoneRow is a phone after +998, shown as 90 123 45 67 (lib/phone.ts); the
// field holds what is shown, phoneDigits turns it into what the API takes.
export function PhoneRow<T extends FieldValues, TOut extends FieldValues = T>({
  control,
  name,
  label = "Telefon",
  readOnly,
  autoComplete = "off",
}: Omit<Bound<T, TOut>, "label"> & { label?: string; readOnly?: boolean; autoComplete?: string }) {
  const id = useId()
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <FormRow label={label} htmlFor={id} error={fieldState.error?.message} errorId={`${id}-error`}>
          <span className="text-base text-muted-foreground">+998</span>
          <input
            id={id}
            type="tel"
            inputMode="tel"
            placeholder="__ ___ __ __"
            readOnly={readOnly}
            autoComplete={autoComplete}
            aria-invalid={fieldState.invalid || undefined}
            aria-describedby={fieldState.error ? `${id}-error` : undefined}
            className={inputClass}
            {...field}
            value={field.value ?? ""}
            onChange={(event) => field.onChange(formatPhoneInput(event.target.value))}
          />
        </FormRow>
      )}
    />
  )
}

// AmountRow is an amount of money (or a quantity): a decimal keyboard, the
// unit beside it. The field holds the digits as typed; the schema parses.
export function AmountRow<T extends FieldValues, TOut extends FieldValues = T>({
  suffix = "so'm",
  placeholder = "0",
  ...props
}: Bound<T, TOut> & { suffix?: ReactNode; placeholder?: string }) {
  return <TextRow inputMode="decimal" autoComplete="off" placeholder={placeholder} suffix={suffix} {...props} />
}

// PickRow is a choice made elsewhere (a picker sheet, a calendar): the row
// is a button that says the label and the value (or a prompt), with a
// chevron; a press opens the sheet.
export function PickRow({
  label,
  value,
  placeholder = "Tanlang",
  onClick,
  error,
  errorId,
  disabled = false,
  id,
}: {
  label: string
  value?: ReactNode
  placeholder?: string
  onClick: () => void
  error?: string
  errorId?: string
  disabled?: boolean
  id?: string
}) {
  const own = useId()
  const described = errorId ?? `${own}-error`
  return (
    <div data-slot="form-row" data-invalid={error ? true : undefined} className="group">
      <button
        type="button"
        id={id}
        aria-haspopup="dialog"
        aria-describedby={error ? described : undefined}
        disabled={disabled}
        onClick={onClick}
        className="flex min-h-[52px] w-full items-center gap-3 px-4 py-1.5 text-left outline-none active:bg-press focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset disabled:opacity-60"
      >
        <span className={labelClass}>{label}</span>{" "}
        <span data-slot="pick-value" className={cn("min-w-0 flex-1 truncate text-right text-base", value ? "text-foreground" : "text-muted-foreground")}>
          {value ?? placeholder}
        </span>
        <ChevronRightIcon aria-hidden="true" strokeWidth={2.6} className="-mr-1 size-[18px] shrink-0 text-muted-foreground opacity-60" />
      </button>
      {error && (
        <p id={described} role="alert" data-slot="form-error" className="-mt-1.5 px-4 pb-2.5 text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}

// SwitchRow is a yes-or-no in a row: the name at the left, the switch at
// the right; a line under the name may say more.
export function SwitchRow<T extends FieldValues, TOut extends FieldValues = T>({
  control,
  name,
  label,
  description,
}: Bound<T, TOut> & { description?: ReactNode }) {
  const id = useId()
  return (
    <Controller
      control={control}
      name={name}
      render={({ field }) => (
        <div data-slot="form-row" className="flex min-h-12 items-center gap-3 px-4 py-1.5">
          <label htmlFor={id} className="min-w-0 flex-1 text-base">
            {label}
            {description && <span className="block text-sm text-muted-foreground">{description}</span>}
          </label>
          <Switch id={id} checked={!!field.value} onCheckedChange={(checked) => field.onChange(checked)} onBlur={field.onBlur} disabled={field.disabled} />
        </div>
      )}
    />
  )
}

const optClass = "inline-flex h-9 items-center gap-1.5 rounded-full bg-muted px-3.5 text-md font-medium outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
const optOn = "bg-primary text-primary-foreground"

// OptionChips are the options of a choice field drawn as chips: one of
// them (radios; the chosen one pressed again is unchosen) or several
// (checkboxes). The field holds the value, "" for none, or the values.
export function OptionChips<T extends FieldValues, TOut extends FieldValues = T>({
  control,
  name,
  label,
  options,
  multiple = false,
  optional = false,
}: Bound<T, TOut> & { options: { value: string; label: string }[]; multiple?: boolean; optional?: boolean }) {
  const id = useId()
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => {
        const chosen: string[] = multiple ? ((field.value as string[] | undefined) ?? []) : field.value ? [String(field.value)] : []
        const toggle = (value: string) => {
          if (multiple) field.onChange(chosen.includes(value) ? chosen.filter((v) => v !== value) : [...chosen, value])
          else field.onChange(chosen.includes(value) ? "" : value)
        }
        return (
          <FormRow
            stack
            label={
              <>
                {label}
                {optional && <span className="text-sm text-muted-foreground"> · ixtiyoriy</span>}
              </>
            }
            error={fieldState.error?.message}
            errorId={`${id}-error`}
          >
            <div role={multiple ? "group" : "radiogroup"} aria-label={label} aria-describedby={fieldState.error ? `${id}-error` : undefined} className="flex flex-wrap gap-1.5">
              {options.map((option) => {
                const on = chosen.includes(option.value)
                return (
                  <button
                    key={option.value}
                    type="button"
                    role={multiple ? "checkbox" : "radio"}
                    aria-checked={on}
                    data-slot="option-chip"
                    onClick={() => toggle(option.value)}
                    className={cn(optClass, on && optOn)}
                  >
                    {multiple && on && <CheckIcon aria-hidden="true" strokeWidth={3} className="size-[15px]" />}
                    {option.label}
                  </button>
                )
              })}
            </div>
          </FormRow>
        )
      }}
    />
  )
}
```

- [ ] **Step 4: O'tishini ko'r**

Run: `cd apps/web && pnpm exec vitest run components/kit/form-row.test.tsx`
Expected: PASS (3).

- [ ] **Step 5: Commit**

```bash
git add apps/web/components/kit/form-row.tsx apps/web/components/kit/form-row.test.tsx
git commit -m "feat(web): the kit's form rows: text, phone, amount, pick, switch and option chips bound to react-hook-form"
```

---

### Task 18: `PickerSheet`, `MultiPickerSheet`, `SelectRow`, `MultiSelectRow`, `SearchPickerSheet` (prototip `picker`)

**Files:**
- Create: `apps/web/components/kit/picker-sheet.tsx`
- Test: `apps/web/components/kit/picker-sheet.test.tsx`

- [ ] **Step 1: Yiqiladigan testni yoz**

```tsx
// apps/web/components/kit/picker-sheet.test.tsx
import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { useForm } from "react-hook-form"
import { expect, test, vi } from "vitest"
import { MultiPickerSheet, PickerSheet, SearchPickerSheet, SelectRow } from "./picker-sheet"

const stages = [
  { value: "1", label: "Yangi" },
  { value: "2", label: "Jarayonda", sub: "3 ta vazifa" },
  { value: "3", label: "Bajarildi" },
]

test("a picker sheet lists the options; the chosen one is selected, a press chooses another and closes the sheet", async () => {
  const change = vi.fn()
  const open = vi.fn()
  render(<PickerSheet open onOpenChange={open} title="Bosqich" options={stages} value="1" onChange={change} />)
  const list = within(await screen.findByRole("dialog", { name: "Bosqich" })).getByRole("listbox", { name: "Bosqich" })
  expect(within(list).getByRole("option", { name: "Yangi" })).toHaveAttribute("aria-selected", "true")
  await userEvent.click(within(list).getByRole("option", { name: /Jarayonda/ }))
  expect(change).toHaveBeenCalledWith("2")
  expect(open).toHaveBeenCalledWith(false)
})

test("a search narrows the options; «none» clears the choice", async () => {
  const change = vi.fn()
  render(<PickerSheet open onOpenChange={() => {}} title="Mas'ul" options={stages} value="2" onChange={change} none="Tanlanmagan" search="Ism bo'yicha" />)
  await userEvent.type(screen.getByRole("searchbox", { name: "Qidirish" }), "baj")
  expect(screen.getAllByRole("option").map((o) => o.textContent)).toEqual(["Bajarildi"])
  await userEvent.clear(screen.getByRole("searchbox", { name: "Qidirish" }))
  await userEvent.click(screen.getByRole("option", { name: "Tanlanmagan" }))
  expect(change).toHaveBeenCalledWith("")
})

test("a multi picker keeps the sheet open while options are taken and put back, and hands them over on «Tayyor»", async () => {
  const change = vi.fn()
  const open = vi.fn()
  render(<MultiPickerSheet open onOpenChange={open} title="Kanallar" options={stages} value={["1"]} onChange={change} />)
  await userEvent.click(screen.getByRole("option", { name: "Bajarildi" }))
  await userEvent.click(screen.getByRole("option", { name: "Yangi" }))
  expect(open).not.toHaveBeenCalled()
  await userEvent.click(screen.getByRole("button", { name: "Tayyor" }))
  expect(change).toHaveBeenCalledWith(["3"])
  expect(open).toHaveBeenCalledWith(false)
})

function Form({ onSubmit }: { onSubmit: (values: { stage: string }) => void }) {
  const form = useForm<{ stage: string }>({ defaultValues: { stage: "" } })
  return (
    <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
      <SelectRow control={form.control} name="stage" label="Bosqich" options={stages} />
      <button type="submit">Saqlash</button>
    </form>
  )
}

test("a select row opens the picker and shows the choice", async () => {
  const submit = vi.fn()
  render(<Form onSubmit={submit} />)
  await userEvent.click(screen.getByRole("button", { name: "Bosqich Tanlang" }))
  await userEvent.click(await screen.findByRole("option", { name: "Yangi" }))
  expect(screen.getByRole("button", { name: "Bosqich Yangi" })).toBeInTheDocument()
  await userEvent.click(screen.getByRole("button", { name: "Saqlash" }))
  expect(submit).toHaveBeenCalledWith({ stage: "1" }, expect.anything())
})

test("a search picker asks its owner for the matches of what is typed", async () => {
  const query = vi.fn()
  render(
    <SearchPickerSheet open onOpenChange={() => {}} title="Ta'minotchi" placeholder="Nom bo'yicha" query="" onQuery={query} options={[]} value="" onChange={() => {}} loading={false} />,
  )
  await userEvent.type(screen.getByRole("searchbox", { name: "Qidirish" }), "ag")
  await vi.waitFor(() => expect(query).toHaveBeenLastCalledWith("ag"))
  expect(screen.getByText("Hech narsa topilmadi")).toBeInTheDocument()
})
```

- [ ] **Step 2: Yiqilishini ko'r**

Run: `cd apps/web && pnpm exec vitest run components/kit/picker-sheet.test.tsx`
Expected: FAIL — modul yo'q; stublar bilan `listbox` topilmaydi.

- [ ] **Step 3: `picker-sheet.tsx` ni yoz**

```tsx
"use client"

import { CheckIcon } from "lucide-react"
import { type KeyboardEvent, type ReactNode, useEffect, useState } from "react"
import { type Control, Controller, type FieldPath, type FieldValues } from "react-hook-form"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import { PickRow } from "./form-row"
import { Foot } from "./group"
import { MainButton } from "./main-button"
import { SearchBox } from "./search-box"

export interface PickerOption {
  value: string
  label: string
  // sub is a line under the name (a phone, a unit and a price); media leads
  // the row (an avatar, a dot); badge stands beside the name.
  sub?: string
  media?: ReactNode
  badge?: ReactNode
  disabled?: boolean
}

// norm is text for matching: lowercase, the apostrophes of o' and g' and
// the tutuq dropped, so "o'zbek", "oʻzbek" and "ozbek" meet.
const norm = (text: string) => text.toLowerCase().replace(/['ʻʼ’`]/g, "")

const matches = (options: PickerOption[], query: string) =>
  query === "" ? options : options.filter((option) => norm(`${option.label} ${option.sub ?? ""}`).includes(norm(query)))

// Option is one row of the list: a listbox option, taken with a press or
// the keyboard.
function Option({
  option,
  selected,
  onSelect,
}: {
  option: PickerOption
  selected: boolean
  onSelect: () => void
}) {
  const onKeyDown = (event: KeyboardEvent<HTMLLIElement>) => {
    if (event.key !== "Enter" && event.key !== " ") return
    event.preventDefault()
    onSelect()
  }
  return (
    <li
      role="option"
      aria-selected={selected}
      aria-disabled={option.disabled || undefined}
      tabIndex={option.disabled ? -1 : 0}
      data-slot="row"
      onClick={option.disabled ? undefined : onSelect}
      onKeyDown={option.disabled ? undefined : onKeyDown}
      className={cn(
        "flex min-h-12 w-full cursor-default items-center gap-3 px-4 py-2 text-left text-base outline-none active:bg-press focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset",
        option.disabled && "opacity-45",
      )}
    >
      {option.media}
      <span className="min-w-0 flex-1">
        <span className="flex min-w-0 items-center gap-1.5 font-medium">
          <span className="truncate">{option.label}</span>
          {option.badge}
        </span>
        {option.sub && <span className="mt-0.5 block truncate text-sm text-muted-foreground">{option.sub}</span>}
      </span>
      {selected && <CheckIcon aria-hidden="true" strokeWidth={2.6} className="size-5 shrink-0 text-primary" />}
    </li>
  )
}

// OptionList is the options in a group, with what to say when none match.
function OptionList({
  title,
  options,
  isSelected,
  onSelect,
  emptyText,
}: {
  title: string
  options: PickerOption[]
  isSelected: (value: string) => boolean
  onSelect: (value: string) => void
  emptyText: string
}) {
  const inset = options.some((option) => option.media) ? "68px" : "16px"
  return (
    <ul role="listbox" aria-label={title} style={{ "--inset": inset } as React.CSSProperties} className="overflow-hidden rounded-group bg-sheet-cell">
      {options.map((option) => (
        <Option key={option.value} option={option} selected={isSelected(option.value)} onSelect={() => onSelect(option.value)} />
      ))}
      {options.length === 0 && <li className="px-4 py-4 text-center text-sm text-muted-foreground">{emptyText}</li>}
    </ul>
  )
}

interface SheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  options: PickerOption[]
  // search, when given, is the search box's placeholder: the options are
  // narrowed in place as it is typed in.
  search?: string
  note?: string
  emptyText?: string
}

// PickerSheet is a choice of one option in a sheet (the prototype's
// picker): the options as a listbox, the chosen one marked, with a search
// over them when there are many; «none» is a first option that clears the
// choice. A press chooses and closes the sheet.
export function PickerSheet({
  open,
  onOpenChange,
  title,
  options,
  value,
  onChange,
  none,
  search,
  note,
  emptyText = "Hech narsa topilmadi",
}: SheetProps & { value: string; onChange: (value: string) => void; none?: string }) {
  const [query, setQuery] = useState("")
  useEffect(() => {
    if (!open) setQuery("")
  }, [open])
  const shown = matches(options, query)
  const listed = none && query === "" ? [{ value: "", label: none }, ...shown] : shown
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent tall={search !== undefined || options.length > 8}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        {search !== undefined && <SearchBox value={query} onSearch={setQuery} placeholder={search} delay={0} className="mb-3" />}
        <OptionList
          title={title}
          options={listed}
          isSelected={(candidate) => candidate === value}
          onSelect={(candidate) => {
            onChange(candidate)
            onOpenChange(false)
          }}
          emptyText={emptyText}
        />
        {note && <Foot className="mt-3">{note}</Foot>}
      </DialogContent>
    </Dialog>
  )
}

// MultiPickerSheet is a choice of several: the sheet stays open while
// options are taken and put back, and hands them over on «Tayyor».
export function MultiPickerSheet({
  open,
  onOpenChange,
  title,
  options,
  value,
  onChange,
  search,
  note,
  emptyText = "Hech narsa topilmadi",
}: SheetProps & { value: string[]; onChange: (value: string[]) => void }) {
  const [query, setQuery] = useState("")
  const [chosen, setChosen] = useState(value)
  useEffect(() => {
    if (open) setChosen(value)
    else setQuery("")
  }, [open, value])
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent tall={search !== undefined || options.length > 8}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        {search !== undefined && <SearchBox value={query} onSearch={setQuery} placeholder={search} delay={0} className="mb-3" />}
        <OptionList
          title={title}
          options={matches(options, query)}
          isSelected={(candidate) => chosen.includes(candidate)}
          onSelect={(candidate) => setChosen(chosen.includes(candidate) ? chosen.filter((v) => v !== candidate) : [...chosen, candidate])}
          emptyText={emptyText}
        />
        {note && <Foot className="mt-3">{note}</Foot>}
        <DialogFooter>
          <MainButton
            onClick={() => {
              onChange(chosen)
              onOpenChange(false)
            }}
          >
            Tayyor
          </MainButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

interface Bound<T extends FieldValues, TOut extends FieldValues> {
  control: Control<T, unknown, TOut>
  name: FieldPath<T>
  label: string
  options: PickerOption[]
  search?: string
  note?: string
  disabled?: boolean
}

// SelectRow is a PickRow bound to a form field with a PickerSheet behind
// it: the row says the chosen option's name, or the prompt (none's name,
// when there is one).
export function SelectRow<T extends FieldValues, TOut extends FieldValues = T>({
  control,
  name,
  label,
  options,
  none,
  placeholder,
  search,
  note,
  disabled,
}: Bound<T, TOut> & { none?: string; placeholder?: string }) {
  const [open, setOpen] = useState(false)
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => {
        const current = options.find((option) => option.value === String(field.value ?? ""))
        return (
          <>
            <PickRow
              label={label}
              value={current?.label}
              placeholder={placeholder ?? none ?? "Tanlang"}
              onClick={() => setOpen(true)}
              error={fieldState.error?.message}
              disabled={disabled || field.disabled}
            />
            <PickerSheet
              open={open}
              onOpenChange={setOpen}
              title={label}
              options={options}
              value={String(field.value ?? "")}
              onChange={(value) => field.onChange(value)}
              none={none}
              search={search}
              note={note}
            />
          </>
        )
      }}
    />
  )
}

// MultiSelectRow is the same for a choice of several: the row lists the
// chosen names.
export function MultiSelectRow<T extends FieldValues, TOut extends FieldValues = T>({
  control,
  name,
  label,
  options,
  placeholder = "Tanlanmagan",
  search,
  note,
  disabled,
}: Bound<T, TOut> & { placeholder?: string }) {
  const [open, setOpen] = useState(false)
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => {
        const chosen = (field.value as string[] | undefined) ?? []
        const names = options.filter((option) => chosen.includes(option.value)).map((option) => option.label)
        return (
          <>
            <PickRow
              label={label}
              value={names.length > 0 ? names.join(", ") : undefined}
              placeholder={placeholder}
              onClick={() => setOpen(true)}
              error={fieldState.error?.message}
              disabled={disabled || field.disabled}
            />
            <MultiPickerSheet open={open} onOpenChange={setOpen} title={label} options={options} value={chosen} onChange={(value) => field.onChange(value)} search={search} note={note} />
          </>
        )
      }}
    />
  )
}

// SearchPickerSheet finds a record on the server: what is typed is told to
// the owner (onQuery), who brings the matches (options) from its hook; the
// list says it is loading or that nothing matched. A press chooses and
// closes the sheet.
export function SearchPickerSheet({
  open,
  onOpenChange,
  title,
  placeholder,
  query,
  onQuery,
  options,
  value,
  onChange,
  loading,
  emptyText = "Hech narsa topilmadi",
  note,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  placeholder: string
  query: string
  onQuery: (query: string) => void
  options: PickerOption[]
  value: string
  onChange: (value: string) => void
  loading: boolean
  emptyText?: string
  note?: string
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent tall>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <SearchBox value={query} onSearch={onQuery} placeholder={placeholder} className="mb-3" />
        <OptionList
          title={title}
          options={options}
          isSelected={(candidate) => candidate === value}
          onSelect={(candidate) => {
            onChange(candidate)
            onOpenChange(false)
          }}
          emptyText={loading ? "Yuklanmoqda…" : emptyText}
        />
        {note && <Foot className="mt-3">{note}</Foot>}
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 4: O'tishini ko'r**

Run: `cd apps/web && pnpm exec vitest run components/kit/picker-sheet.test.tsx`
Expected: PASS (5). (`SearchBox` 300ms kechiktiradi: `SearchPickerSheet` testida `onQuery` `userEvent.type` dan keyin kutiladi — `vi.waitFor` bilan `expect(query).toHaveBeenLastCalledWith("ag")` ga o'ra, agar darhol kelmasa.)

- [ ] **Step 5: Commit**

```bash
git add apps/web/components/kit/picker-sheet.tsx apps/web/components/kit/picker-sheet.test.tsx
git commit -m "feat(web): the kit's picker sheets: one or several options, a search over them, bound rows and a server-searched picker"
```

---

### Task 19: `DateSheet`, `DateRow`, `DateTimeRow` (prototip `datePicker`, `.cal`)

**Files:**
- Create: `apps/web/components/kit/date-sheet.tsx`
- Test: `apps/web/components/kit/date-sheet.test.tsx`

- [ ] **Step 1: Yiqiladigan testni yoz**

```tsx
// apps/web/components/kit/date-sheet.test.tsx
import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { useForm } from "react-hook-form"
import { afterEach, beforeEach, expect, test, vi } from "vitest"
import { addDays, DateRow, DateSheet, DateTimeRow, monthGrid } from "./date-sheet"

beforeEach(() => vi.setSystemTime(new Date("2026-10-13T09:00:00+05:00")))
afterEach(() => vi.useRealTimers())

test("a month's grid starts on Monday, with blanks before the first day", () => {
  // October 2026 starts on a Thursday: three blanks, then 31 days.
  const grid = monthGrid(2026, 10)
  expect(grid.slice(0, 4)).toEqual([null, null, null, "2026-10-01"])
  expect(grid.filter(Boolean)).toHaveLength(31)
  expect(addDays("2026-10-30", 3)).toBe("2026-11-02")
})

test("the calendar shows the month of the value, marks today and the value, and hands the pressed day over on «Tanlash»", async () => {
  const change = vi.fn()
  const open = vi.fn()
  render(<DateSheet open onOpenChange={open} title="Muddat" value="2026-10-20" onChange={change} />)
  const dialog = await screen.findByRole("dialog", { name: "Muddat" })
  expect(within(dialog).getByText("oktabr 2026")).toBeInTheDocument()
  expect(within(dialog).getByRole("button", { name: "13.10.2026" })).toHaveAttribute("data-today", "true")
  expect(within(dialog).getByRole("button", { name: "20.10.2026" })).toHaveAttribute("aria-pressed", "true")
  await userEvent.click(within(dialog).getByRole("button", { name: "Keyingi oy" }))
  expect(within(dialog).getByText("noyabr 2026")).toBeInTheDocument()
  await userEvent.click(within(dialog).getByRole("button", { name: "05.11.2026" }))
  await userEvent.click(within(dialog).getByRole("button", { name: "Tanlash" }))
  expect(change).toHaveBeenCalledWith("2026-11-05")
  expect(open).toHaveBeenCalledWith(false)
})

test("the presets jump: tomorrow is the day after today", async () => {
  const change = vi.fn()
  render(<DateSheet open onOpenChange={() => {}} value="" onChange={change} />)
  await userEvent.click(screen.getByRole("button", { name: "Ertaga" }))
  await userEvent.click(screen.getByRole("button", { name: "Tanlash" }))
  expect(change).toHaveBeenCalledWith("2026-10-14")
})

function Form({ onSubmit }: { onSubmit: (values: { deadline: string; at: string }) => void }) {
  const form = useForm<{ deadline: string; at: string }>({ defaultValues: { deadline: "2026-10-13", at: "2026-10-13T10:30" } })
  return (
    <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
      <DateRow control={form.control} name="deadline" label="Muddat" />
      <DateTimeRow control={form.control} name="at" label="Vaqt" />
      <button type="submit">Saqlash</button>
    </form>
  )
}

test("a date row says the day (and that it is today); a date-time row keeps the time beside the day", async () => {
  const submit = vi.fn()
  render(<Form onSubmit={submit} />)
  expect(screen.getByRole("button", { name: "Muddat 13.10.2026 · bugun" })).toBeInTheDocument()
  await userEvent.click(screen.getByRole("button", { name: /^Vaqt/ }))
  await userEvent.click(await screen.findByRole("button", { name: "15.10.2026" }))
  await userEvent.click(screen.getByRole("button", { name: "Tanlash" }))
  const time = screen.getByLabelText("Vaqt: soat")
  expect(time).toHaveValue("10:30")
  await userEvent.clear(time)
  await userEvent.type(time, "18:45")
  await userEvent.click(screen.getByRole("button", { name: "Saqlash" }))
  expect(submit).toHaveBeenCalledWith({ deadline: "2026-10-13", at: "2026-10-15T18:45" }, expect.anything())
})
```

- [ ] **Step 2: Yiqilishini ko'r**

Run: `cd apps/web && pnpm exec vitest run components/kit/date-sheet.test.tsx`
Expected: FAIL — modul yo'q; stublar bilan `monthGrid` noto'g'ri qaytaradi.

- [ ] **Step 3: `date-sheet.tsx` ni yoz**

```tsx
"use client"

import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react"
import { useEffect, useId, useState } from "react"
import { type Control, Controller, type FieldPath, type FieldValues } from "react-hook-form"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { formatDate } from "@/lib/format"
import { cn } from "@/lib/utils"
import { Chip, Chips } from "./chips"
import { PickRow } from "./form-row"
import { MainButton } from "./main-button"

export const MONTHS = ["yanvar", "fevral", "mart", "aprel", "may", "iyun", "iyul", "avgust", "sentabr", "oktabr", "noyabr", "dekabr"]
const WEEKDAYS = ["Du", "Se", "Ch", "Pa", "Ju", "Sh", "Ya"]

const pad = (n: number) => String(n).padStart(2, "0")
const iso = (year: number, month: number, day: number) => `${year}-${pad(month)}-${pad(day)}`

// today is the day in the browser's time zone, as YYYY-MM-DD.
export function today(): string {
  const now = new Date()
  return iso(now.getFullYear(), now.getMonth() + 1, now.getDate())
}

// addDays moves a day by n days.
export function addDays(day: string, n: number): string {
  const [year, month, date] = day.split("-").map(Number)
  const moved = new Date(Date.UTC(year, month - 1, date + n))
  return iso(moved.getUTCFullYear(), moved.getUTCMonth() + 1, moved.getUTCDate())
}

// monthGrid is a month's days in seven columns from Monday: null where the
// week before the first day is blank.
export function monthGrid(year: number, month: number): (string | null)[] {
  const first = new Date(Date.UTC(year, month - 1, 1)).getUTCDay()
  const blanks = (first + 6) % 7
  const days = new Date(Date.UTC(year, month, 0)).getUTCDate()
  return [...Array.from({ length: blanks }, () => null), ...Array.from({ length: days }, (_, i) => iso(year, month, i + 1))]
}

// DateSheet is the prototype's calendar sheet: presets (today, tomorrow, in
// three days, in a week), a month to page through, the days as buttons;
// «Tanlash» hands the pressed day over and closes the sheet.
export function DateSheet({
  open,
  onOpenChange,
  title = "Sana",
  value,
  onChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title?: string
  value: string
  onChange: (value: string) => void
}) {
  const now = today()
  const [picked, setPicked] = useState(value || now)
  const [[year, month], setShown] = useState(() => {
    const [y, m] = (value || now).split("-").map(Number)
    return [y, m]
  })
  useEffect(() => {
    if (!open) return
    const start = value || today()
    setPicked(start)
    const [y, m] = start.split("-").map(Number)
    setShown([y, m])
  }, [open, value])

  const pick = (day: string) => {
    setPicked(day)
    const [y, m] = day.split("-").map(Number)
    setShown([y, m])
  }
  const page = (by: number) => {
    let m = month + by
    let y = year
    if (m < 1) {
      m = 12
      y -= 1
    }
    if (m > 12) {
      m = 1
      y += 1
    }
    setShown([y, m])
  }
  const presets: [string, string][] = [
    ["Bugun", now],
    ["Ertaga", addDays(now, 1)],
    ["3 kundan keyin", addDays(now, 3)],
    ["1 haftadan keyin", addDays(now, 7)],
  ]

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <Chips className="mb-2.5">
          {presets.map(([label, day]) => (
            <Chip key={label} pressed={picked === day} onClick={() => pick(day)} className={picked !== day ? "bg-sheet-cell text-foreground" : undefined}>
              {label}
            </Chip>
          ))}
        </Chips>
        <div data-slot="calendar" className="rounded-group bg-sheet-cell px-3 pt-2.5 pb-3">
          <div className="flex items-center justify-between px-0.5 pb-2">
            <b className="text-base font-semibold">
              {MONTHS[month - 1]} {year}
            </b>
            <div className="flex">
              <button type="button" aria-label="Oldingi oy" onClick={() => page(-1)} className="grid size-11 place-items-center text-primary">
                <ChevronLeftIcon aria-hidden="true" strokeWidth={2.4} className="size-6" />
              </button>
              <button type="button" aria-label="Keyingi oy" onClick={() => page(1)} className="grid size-11 place-items-center text-primary">
                <ChevronRightIcon aria-hidden="true" strokeWidth={2.4} className="size-6" />
              </button>
            </div>
          </div>
          <div className="grid grid-cols-7 gap-y-0.5 text-center">
            {WEEKDAYS.map((weekday) => (
              <span key={weekday} aria-hidden="true" className="pt-1 pb-1.5 text-[12px] font-semibold text-muted-foreground">
                {weekday}
              </span>
            ))}
            {monthGrid(year, month).map((day, index) =>
              day === null ? (
                <span key={`blank-${index}`} />
              ) : (
                <button
                  key={day}
                  type="button"
                  aria-label={formatDate(day)}
                  aria-pressed={day === picked}
                  data-today={day === now || undefined}
                  onClick={() => pick(day)}
                  className={cn(
                    "size-[42px] justify-self-center rounded-full text-base outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                    day === now && "font-bold text-primary",
                    day === picked && "bg-primary font-semibold text-primary-foreground",
                  )}
                >
                  {Number(day.slice(8))}
                </button>
              ),
            )}
          </div>
        </div>
        <DialogFooter>
          <MainButton
            onClick={() => {
              onChange(picked)
              onOpenChange(false)
            }}
          >
            Tanlash
          </MainButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

interface Bound<T extends FieldValues, TOut extends FieldValues> {
  control: Control<T, unknown, TOut>
  name: FieldPath<T>
  label: string
  disabled?: boolean
}

// shownDay is a day as the row says it: dd.mm.yyyy, "· bugun" when it is today.
const shownDay = (day: string) => (day ? `${formatDate(day)}${day === today() ? " · bugun" : ""}` : undefined)

// DateRow is a day in a form (YYYY-MM-DD): a pick row that opens the calendar.
export function DateRow<T extends FieldValues, TOut extends FieldValues = T>({ control, name, label, disabled }: Bound<T, TOut>) {
  const [open, setOpen] = useState(false)
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <>
          <PickRow label={label} value={shownDay(String(field.value ?? ""))} placeholder="Sanani tanlang" onClick={() => setOpen(true)} error={fieldState.error?.message} disabled={disabled || field.disabled} />
          <DateSheet open={open} onOpenChange={setOpen} title={label} value={String(field.value ?? "")} onChange={(day) => field.onChange(day)} />
        </>
      )}
    />
  )
}

// DateTimeRow is a moment in a form (YYYY-MM-DDTHH:mm, what a
// datetime-local input gives): the day picked in the calendar, the time
// typed beside it.
export function DateTimeRow<T extends FieldValues, TOut extends FieldValues = T>({ control, name, label, disabled }: Bound<T, TOut>) {
  const [open, setOpen] = useState(false)
  const id = useId()
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => {
        const [day = "", time = "00:00"] = String(field.value ?? "").split("T")
        return (
          <>
            <div className="flex items-stretch">
              <div className="min-w-0 flex-1">
                <PickRow label={label} value={shownDay(day)} placeholder="Sanani tanlang" onClick={() => setOpen(true)} error={fieldState.error?.message} disabled={disabled || field.disabled} />
              </div>
              <label className="flex shrink-0 items-center pr-4">
                <span className="sr-only">{label}: soat</span>
                <input
                  id={id}
                  type="time"
                  value={time}
                  disabled={disabled || field.disabled}
                  onChange={(event) => field.onChange(`${day}T${event.target.value || "00:00"}`)}
                  onBlur={field.onBlur}
                  className="h-10 bg-transparent text-base text-foreground outline-none"
                />
              </label>
            </div>
            <DateSheet open={open} onOpenChange={setOpen} title={label} value={day} onChange={(picked) => field.onChange(`${picked}T${time}`)} />
          </>
        )
      }}
    />
  )
}
```

- [ ] **Step 4: O'tishini ko'r**

Run: `cd apps/web && pnpm exec vitest run components/kit/date-sheet.test.tsx`
Expected: PASS (4). Eslatma: `vitest.config` `TZ=Asia/Tashkent` beradi, `vi.setSystemTime` shu soat bilan ishlaydi.

- [ ] **Step 5: Commit**

```bash
git add apps/web/components/kit/date-sheet.tsx apps/web/components/kit/date-sheet.test.tsx
git commit -m "feat(web): the kit's calendar sheet with presets, and the date and date-time rows"
```

---

### Task 20: `Amount` (`.amount`: enga sig'adigan katta summa)

**Files:**
- Create: `apps/web/components/kit/amount.tsx`
- Test: `apps/web/components/kit/amount.test.tsx`

- [ ] **Step 1: Yiqiladigan testni yoz**

```tsx
// apps/web/components/kit/amount.test.tsx
import { render, screen } from "@testing-library/react"
import { expect, test } from "vitest"
import { Amount, groupDigits, splitAmount } from "./amount"

test("the digits are grouped by thousands with a no-break space, the decimals kept apart", () => {
  expect(groupDigits("1250000")).toBe("1 250 000")
  expect(splitAmount("1250000.50")).toEqual({ whole: "1 250 000", decimals: ",50" })
  expect(splitAmount("12000.00")).toEqual({ whole: "12 000", decimals: "" })
  expect(splitAmount("7")).toEqual({ whole: "7", decimals: "" })
})

test("an amount reads as one number with its unit", () => {
  render(<Amount value="1250000.50" unit="so'm" />)
  const amount = screen.getByText((_, element) => element?.getAttribute("data-slot") === "amount")
  // jest-dom folds a no-break space into a space when it reads text.
  expect(amount).toHaveTextContent("1 250 000,50 so'm")
  expect(amount.querySelector('[data-slot="amount-whole"]')).toHaveTextContent("1 250 000")
  expect(amount.querySelector('[data-slot="amount-decimals"]')).toHaveTextContent(",50")
})
```

- [ ] **Step 2: Yiqilishini ko'r**

Run: `cd apps/web && pnpm exec vitest run components/kit/amount.test.tsx`
Expected: FAIL — modul yo'q.

- [ ] **Step 3: `amount.tsx` ni yoz**

```tsx
"use client"

import { useLayoutEffect, useRef, useState } from "react"
import { cn } from "@/lib/utils"

// groupDigits puts a no-break space between the thousands of a whole number.
export const groupDigits = (digits: string) => digits.replace(/\B(?=(\d{3})+(?!\d))/g, " ")

// splitAmount takes an amount as the API writes it ("1250000.50") apart
// into its grouped whole part and its decimals after a comma, which are
// left out when they are all zero.
export function splitAmount(value: string): { whole: string; decimals: string } {
  const [whole, decimals = ""] = value.split(".")
  return { whole: groupDigits(whole), decimals: /^0*$/.test(decimals) ? "" : `,${decimals}` }
}

// Amount is the prototype's large figure: the whole part big, the decimals
// smaller, the unit in the hint color; the whole shrinks to fit its box
// (down to half) when it is too long. size "input" is the keypad's, with a
// caret after the digits.
export function Amount({
  value,
  unit,
  size = "hero",
  caret = false,
  muted = false,
  className,
}: {
  value: string
  unit: string
  size?: "hero" | "input"
  caret?: boolean
  muted?: boolean
  className?: string
}) {
  const { whole, decimals } = splitAmount(value)
  const ref = useRef<HTMLSpanElement>(null)
  const [scale, setScale] = useState(1)

  // The figure is measured at full size against its parent; a longer one is
  // scaled down, never below half.
  useLayoutEffect(() => {
    const node = ref.current
    const parent = node?.parentElement
    if (!node || !parent) return
    const fit = () => {
      node.style.setProperty("--k", "1")
      const room = parent.clientWidth - 8
      const width = node.scrollWidth
      const next = room <= 0 || width === 0 ? 1 : Math.max(0.5, Math.min(1, room / width))
      // Set on the node too: React re-applies the style prop only when the
      // state changes, and a resize that keeps the scale would leave it at 1.
      node.style.setProperty("--k", String(next))
      setScale(next)
    }
    fit()
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(fit)
    observer?.observe(parent)
    return () => observer?.disconnect()
  }, [whole, decimals, unit])

  const big = size === "hero" ? 56 : 52
  const small = size === "hero" ? 40 : 52
  return (
    <span
      ref={ref}
      data-slot="amount"
      style={{ "--k": String(scale) } as React.CSSProperties}
      className={cn("inline-flex items-baseline justify-center leading-none font-bold tracking-[-0.035em] whitespace-nowrap", muted && "text-muted-foreground", className)}
    >
      <span data-slot="amount-whole" style={{ fontSize: `calc(${big}px * var(--k))` }}>
        {whole}
      </span>
      {decimals && (
        <span data-slot="amount-decimals" style={{ fontSize: `calc(${small}px * var(--k))` }}>
          {decimals}
        </span>
      )}
      {caret && <span aria-hidden="true" className="mx-0.5 inline-block h-[46px] w-[2.5px] self-center rounded-sm bg-primary motion-safe:animate-[blink_1s_steps(1)_infinite]" />}
      <span data-slot="amount-unit" className="ml-[calc(9px*var(--k))] font-semibold tracking-[-0.01em] text-muted-foreground" style={{ fontSize: "calc(32px * var(--k))" }}>
        {" "}
        {unit}
      </span>
    </span>
  )
}
```

`globals.css` ga caret uchun keyframe qo'sh (`@layer base` dan oldin):

```css
@keyframes blink {
  50% { opacity: 0; }
}
```

- [ ] **Step 4: O'tishini ko'r**

Run: `cd apps/web && pnpm exec vitest run components/kit/amount.test.tsx`
Expected: PASS (2).

- [ ] **Step 5: Commit**

```bash
git add apps/web/components/kit/amount.tsx apps/web/components/kit/amount.test.tsx apps/web/app/globals.css
git commit -m "feat(web): the kit's large amount that shrinks to fit"
```

---

### Task 21: `AmountSheet`, `Keypad`, `nextAmount` (prototip `paymentSheet`, `.keypad`)

**Files:**
- Create: `apps/web/components/kit/amount-sheet.tsx`
- Test: `apps/web/components/kit/amount-sheet.test.tsx`

- [ ] **Step 1: Yiqiladigan testni yoz**

```tsx
// apps/web/components/kit/amount-sheet.test.tsx
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { expect, test, vi } from "vitest"
import { AmountSheet, amountToDecimal, nextAmount } from "./amount-sheet"

test("the keys build an amount: at most eleven whole digits, two decimals, one comma, no leading zero", () => {
  expect(nextAmount("", "0")).toBe("0")
  expect(nextAmount("0", "5")).toBe("5")
  expect(nextAmount("5", ",")).toBe("5,")
  expect(nextAmount("5,", ",")).toBe("5,")
  expect(nextAmount("5,", "2")).toBe("5,2")
  expect(nextAmount("5,25", "9")).toBe("5,25")
  expect(nextAmount("", ",")).toBe("0,")
  expect(nextAmount("12345678901", "2")).toBe("12345678901")
  expect(nextAmount("5,2", "del")).toBe("5,")
  expect(amountToDecimal("1250,5")).toBe("1250.5")
  expect(amountToDecimal("")).toBe("")
})

test("the sheet shows the amount as typed on the keypad and hands it over", async () => {
  const change = vi.fn()
  const submit = vi.fn()
  render(
    <AmountSheet open onOpenChange={() => {}} title="To'lov qo'shish" subtitle="Agro Fresh MChJ" value="" onChange={change} hint="Qarz: 300 000 so'm" submitLabel="Qo'shish" onSubmit={submit} pending={false} />,
  )
  expect(await screen.findByRole("dialog", { name: "To'lov qo'shish" })).toBeInTheDocument()
  const keys = screen.getByRole("group", { name: "Raqamlar" })
  await userEvent.click(screen.getByRole("button", { name: "1" }))
  expect(change).toHaveBeenLastCalledWith("1")
  expect(keys.querySelector('[aria-label="O\'chirish"]')).toBeInTheDocument()
  await userEvent.click(screen.getByRole("button", { name: "Qo'shish" }))
  expect(submit).toHaveBeenCalledTimes(1)
})

test("a «To'liq» offer fills the whole debt; an error is said under the amount", async () => {
  const full = vi.fn()
  render(<AmountSheet open onOpenChange={() => {}} title="To'lov" value="" onChange={() => {}} onFull={full} error="Summani kiriting" submitLabel="Qo'shish" onSubmit={() => {}} pending={false} />)
  await userEvent.click(screen.getByRole("button", { name: "To'liq" }))
  expect(full).toHaveBeenCalledTimes(1)
  expect(screen.getByRole("alert")).toHaveTextContent("Summani kiriting")
})
```

- [ ] **Step 2: Yiqilishini ko'r**

Run: `cd apps/web && pnpm exec vitest run components/kit/amount-sheet.test.tsx`
Expected: FAIL — modul yo'q.

- [ ] **Step 3: `amount-sheet.tsx` ni yoz**

```tsx
"use client"

import { DeleteIcon } from "lucide-react"
import type { ReactNode } from "react"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import { Amount } from "./amount"
import { MainButton } from "./main-button"

export type Key = "0" | "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" | "," | "del"

const KEYS: Key[] = ["1", "2", "3", "4", "5", "6", "7", "8", "9", ",", "0", "del"]

// nextAmount is the amount after a key: digits as typed (eleven at most
// before the comma, two after it), one comma, no zero in front.
export function nextAmount(current: string, key: Key | string): string {
  if (key === "del") return current.slice(0, -1)
  if (key === ",") return current.includes(",") ? current : `${current || "0"},`
  const [whole, decimals] = current.split(",")
  if (decimals !== undefined) return decimals.length < 2 ? current + key : current
  if (whole.length >= 11) return current
  return (current === "0" ? "" : current) + key
}

// amountToDecimal is the typed amount as the API takes it: a dot for the comma.
export const amountToDecimal = (typed: string) => typed.replace(",", ".")

// Keypad is the prototype's keypad: the digits, the comma and delete.
export function Keypad({ onKey }: { onKey: (key: Key) => void }) {
  return (
    <div role="group" aria-label="Raqamlar" data-slot="keypad" className="grid grid-cols-3 gap-1.5 pt-2 pb-1">
      {KEYS.map((key) => (
        <button
          key={key}
          type="button"
          aria-label={key === "del" ? "O'chirish" : key === "," ? "vergul" : key}
          onClick={() => onKey(key)}
          className={cn(
            "grid h-[52px] place-items-center rounded-main text-[25px] font-medium outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
            key === "," || key === "del" ? "bg-transparent" : "bg-sheet-cell shadow-[0_1px_0_rgba(0,0,0,.08)] active:bg-press",
          )}
        >
          {key === "del" ? <DeleteIcon aria-hidden="true" strokeWidth={1.9} className="size-[26px]" /> : key}
        </button>
      ))}
    </div>
  )
}

// AmountSheet is the sheet an amount is typed in (a payment): the figure
// large with a caret, a hint under it (the debt, with «To'liq» to fill it),
// rows for whatever else the document needs (children: the day, a note),
// the keypad, and the main button.
export function AmountSheet({
  open,
  onOpenChange,
  title,
  subtitle,
  value,
  onChange,
  hint,
  onFull,
  error,
  unit = "so'm",
  children,
  submitLabel,
  onSubmit,
  pending,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  subtitle?: string
  value: string
  onChange: (value: string) => void
  hint?: ReactNode
  onFull?: () => void
  error?: string
  unit?: string
  children?: ReactNode
  submitLabel: string
  onSubmit: () => void
  pending: boolean
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent tall>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {subtitle && <span className="text-sm text-muted-foreground">{subtitle}</span>}
        </DialogHeader>
        <div data-slot="amount-input" className="px-0 pt-4 pb-2 text-center">
          <Amount value={value === "" ? "0" : amountToDecimal(value)} unit={unit} size="input" caret muted={value === ""} />
          {(hint || onFull) && (
            <p className="mt-2.5 text-sm text-muted-foreground">
              {hint}
              {onFull && (
                <>
                  {hint && " · "}
                  <button type="button" onClick={onFull} className="min-h-8 text-sm font-semibold text-primary">
                    To&apos;liq
                  </button>
                </>
              )}
            </p>
          )}
          {error && (
            <p role="alert" className="mt-2 text-sm text-destructive">
              {error}
            </p>
          )}
        </div>
        {children}
        <Keypad onKey={(key) => onChange(nextAmount(value, key))} />
        <DialogFooter>
          <MainButton onClick={onSubmit} pending={pending}>
            {submitLabel}
          </MainButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 4: O'tishini ko'r**

Run: `cd apps/web && pnpm exec vitest run components/kit/amount-sheet.test.tsx`
Expected: PASS (3).

- [ ] **Step 5: Commit**

```bash
git add apps/web/components/kit/amount-sheet.tsx apps/web/components/kit/amount-sheet.test.tsx
git commit -m "feat(web): the kit's amount sheet with the keypad"
```

---

### Task 22: Holatlar: `EmptyState`, `NotFound`, `Failed`, `Loading`, `ListLoading`, `Splash`, `StateScreen` (`.empty`, `.state`, `.skel`, `.markt`)

**Files:**
- Modify: `apps/web/components/states.tsx`
- Test: `apps/web/components/states.test.tsx` (kengayadi; mavjud 5 test o'zgarmaydi)

- [ ] **Step 1: Testlarni qo'sh**

```tsx
// apps/web/components/states.test.tsx ga qo'shiladi
import { CalendarXIcon, UserIcon } from "lucide-react"
import { NotFound, Splash, StateScreen } from "./states"

test("an empty state may carry an icon and the way forward, as a button", async () => {
  const add = vi.fn()
  render(<EmptyState icon={UserIcon} title="Hali mijoz yo'q" description="Birinchi mijozni qo'shing." action={<button type="button" onClick={add}>Mijoz qo&apos;shish</button>} />)
  expect(screen.getByText("Hali mijoz yo'q").closest('[data-slot="empty-state"]')?.querySelector("svg")).toHaveAttribute("aria-hidden", "true")
  await userEvent.click(screen.getByRole("button", { name: "Mijoz qo'shish" }))
  expect(add).toHaveBeenCalledTimes(1)
})

test("a record not found is said as a heading and a line under it", () => {
  render(<NotFound title="Mijoz topilmadi" description="Bu mijoz o'chirilgan." />)
  expect(screen.getByRole("heading", { level: 1, name: "Mijoz topilmadi" })).toBeInTheDocument()
  expect(screen.getByText("Bu mijoz o'chirilgan.")).toBeInTheDocument()
})

test("the splash is a status that says what is going on", () => {
  render(<Splash>Telegram orqali kirilmoqda…</Splash>)
  expect(screen.getByRole("status")).toHaveTextContent("Telegram orqali kirilmoqda…")
})

test("a state screen heads its message and holds the way out under it", () => {
  render(
    <StateScreen icon={CalendarXIcon} tone="red" title="Obuna muddati tugagan" description="Administrator bilan bog'laning.">
      <button type="button">Boshqa kompaniyani tanlash</button>
    </StateScreen>,
  )
  expect(screen.getByRole("heading", { level: 1, name: "Obuna muddati tugagan" })).toBeInTheDocument()
  expect(screen.getByRole("button", { name: "Boshqa kompaniyani tanlash" })).toBeInTheDocument()
})
```

(`vi`, `userEvent` importlari faylda bor.)

- [ ] **Step 2: Yiqilishini ko'r**

Run: `cd apps/web && pnpm exec vitest run components/states.test.tsx`
Expected: FAIL — `NotFound`, `Splash`, `StateScreen` eksport qilinmagan; `EmptyState` `icon`/`action` ni bilmaydi.

- [ ] **Step 3: `states.tsx` ni yoz**

```tsx
import { type LucideIcon, RotateCwIcon } from "lucide-react"
import type { ReactNode } from "react"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

// Placeholder is what stands in while something loads: a status named
// "Yuklanmoqda", which it also says in words for a screen reader passing by.
// The bars are for the eyes only. It is not marked busy: a busy status is
// not announced.
function Placeholder({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div role="status" aria-label="Yuklanmoqda">
      <span className="sr-only">Yuklanmoqda</span>
      <div aria-hidden="true" className={className}>
        {children}
      </div>
    </div>
  )
}

// Loading holds the place of a page or a part of it while it loads.
export function Loading({ rows = 3 }: { rows?: number }) {
  return (
    <Placeholder className="grid gap-3">
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className="h-16 w-full rounded-group" />
      ))}
    </Placeholder>
  )
}

// Names differ in length, and so do the bars that stand for them.
const nameWidths = ["w-36", "w-44", "w-28"]

// The mark that opens a row: round for a person, square for a company, none
// for a record that has no avatar (a payment).
const marks = { round: "rounded-full", square: "rounded-[12px]" }

// ListLoading holds the place of a group of rows while it loads, in the
// group's own shape and size, so nothing moves when the records come: a
// row per record, the mark, the name and the line under it. The whole
// placeholder pulses as one, and only for those who have not asked for less
// motion.
export function ListLoading({ rows = 3, mark = "round" }: { rows?: number; mark?: "round" | "square" | "none" }) {
  return (
    <Placeholder className="overflow-hidden rounded-group bg-card motion-safe:animate-pulse">
      {Array.from({ length: rows }, (_, i) => (
        <div
          key={i}
          data-slot="list-loading-row"
          className={cn("flex items-center gap-3 px-4 not-first:border-t-[0.5px] not-first:border-border", mark === "none" ? "h-12" : "h-14")}
        >
          {mark !== "none" && <Skeleton className={cn("size-10 shrink-0 animate-none", marks[mark])} />}
          <div className="grid flex-1 gap-2">
            <Skeleton className={cn("h-3.5 max-w-full animate-none", nameWidths[i % nameWidths.length])} />
            {mark !== "none" && <Skeleton className="h-3 w-24 max-w-full animate-none" />}
          </div>
          <Skeleton className="h-3.5 w-14 animate-none" />
        </div>
      ))}
    </Placeholder>
  )
}

// Failed says why something did not load, aloud too (an alert is announced
// when it appears), and offers to try again. It takes the list's place, in
// the list's frame.
export function Failed({ error, onRetry }: { error: Error; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-group bg-card px-6 py-8 text-center">
      <p role="alert" className="text-md text-balance text-destructive">
        {error.message}
      </p>
      <Button variant="secondary" size="lg" onClick={onRetry}>
        <RotateCwIcon />
        Qayta urinish
      </Button>
    </div>
  )
}

// EmptyState says there is nothing to show and, under that, what would
// change it: with an icon in the accent tint, and the way forward (a
// button) when there is one. It takes the list's place, in the list's
// frame: a note inside its section, so it has no heading.
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon?: LucideIcon
  title: string
  description?: string
  action?: ReactNode
  className?: string
}) {
  return (
    <div data-slot="empty-state" className={cn("rounded-group bg-card px-6 py-7 text-center", className)}>
      {Icon && (
        <span aria-hidden="true" className="mx-auto mb-3.5 grid size-16 place-items-center rounded-[20px] bg-primary-soft text-primary">
          <Icon aria-hidden="true" strokeWidth={1.9} className="size-[30px]" />
        </span>
      )}
      <p className="text-[18px] font-semibold">{title}</p>
      {description && <p className="mt-1.5 text-md text-pretty text-muted-foreground">{description}</p>}
      {action && <div className="mt-4 inline-flex">{action}</div>}
    </div>
  )
}

// NotFound is a record that is gone (or another company's): the page's
// heading says so, a line under it says why.
export function NotFound({ title, description, icon: Icon }: { title: string; description: string; icon?: LucideIcon }) {
  return (
    <div data-slot="not-found" className="mt-10 rounded-group bg-card px-6 py-7 text-center">
      {Icon && (
        <span aria-hidden="true" className="mx-auto mb-3.5 grid size-16 place-items-center rounded-[20px] bg-muted text-muted-foreground">
          <Icon aria-hidden="true" strokeWidth={1.9} className="size-[30px]" />
        </span>
      )}
      <h1 className="text-[18px] font-semibold">{title}</h1>
      <p className="mt-1.5 text-md text-pretty text-muted-foreground">{description}</p>
    </div>
  )
}

// Splash is the app's opening screen while Telegram signs the user in: the
// pulsing mark, a loading line and a word on what is going on.
export function Splash({ children }: { children: ReactNode }) {
  return (
    <div role="status" data-slot="splash" className="flex flex-1 flex-col items-center justify-center px-7 pt-6 pb-[140px] text-center">
      <span
        aria-hidden="true"
        className="grid size-[84px] place-items-center rounded-[26px] bg-brand-panel text-[30px] font-extrabold tracking-[-0.05em] text-brand-panel-foreground italic shadow-[0_10px_30px_rgba(23,68,73,.3)] motion-safe:animate-[pulse-mark_1.4s_ease-in-out_infinite]"
      >
        H24
      </span>
      <span aria-hidden="true" className="mt-7 h-1 w-[120px] overflow-hidden rounded-sm bg-muted">
        <span className="block h-full w-2/5 rounded-sm bg-primary motion-safe:animate-[load-line_1.1s_ease-in-out_infinite]" />
      </span>
      <p className="mt-3.5 text-md text-muted-foreground">{children}</p>
    </div>
  )
}

const tones = {
  accent: "bg-primary-soft text-primary",
  red: "bg-destructive-soft text-destructive",
  warn: "bg-warning-soft text-warning",
}

// StateScreen is a screen with one message and one way out, with no shell
// around it (the subscription expired, the phone not shared, no access):
// an icon in its tone, a heading, a line and, under them, the main button.
export function StateScreen({
  icon: Icon,
  tone = "accent",
  title,
  description,
  children,
}: {
  icon: LucideIcon
  tone?: keyof typeof tones
  title: string
  description?: ReactNode
  children?: ReactNode
}) {
  return (
    <div data-slot="state-screen" className="flex min-h-full flex-1 flex-col">
      <div className="flex flex-1 flex-col items-center justify-center px-7 pt-6 pb-[140px] text-center">
        <span aria-hidden="true" className={cn("grid size-[84px] place-items-center rounded-[28px]", tones[tone])}>
          <Icon strokeWidth={1.9} className="size-10" />
        </span>
        <h1 className="mt-[18px] text-[26px] leading-[1.2] font-bold tracking-[-0.02em]">{title}</h1>
        {description && <p className="mt-2 max-w-[300px] text-[16px] leading-[1.45] text-muted-foreground">{description}</p>}
      </div>
      {children}
    </div>
  )
}
```

`globals.css` ga keyframe'lar (`blink` yonida):

```css
@keyframes pulse-mark {
  50% { transform: scale(0.94); opacity: 0.85; }
}
@keyframes load-line {
  from { transform: translateX(-100%); }
  to { transform: translateX(260%); }
}
```

- [ ] **Step 4: O'tishini ko'r**

Run: `cd apps/web && pnpm exec vitest run components/states.test.tsx && pnpm exec vitest run`
Expected: `states.test.tsx` 9 passed; butun to'plam o'tadi (`ListLoading` qator belgisi va `status` saqlandi).

- [ ] **Step 5: Commit**

```bash
git add apps/web/components/states.tsx apps/web/components/states.test.tsx apps/web/app/globals.css
git commit -m "feat(web): the states in the prototype's shapes: the empty state with an icon and a way forward, not found, the splash and the state screen"
```

---

### Task 23: Toast, `Refusal`, `HistoryList` uslubi (`.toast`, `.refusal`, `.hist`)

**Files:**
- Modify: `apps/web/components/ui/sonner.tsx`
- Modify: `apps/web/components/refusal.tsx`
- Modify: `apps/web/components/history-list.tsx`
- Test: `apps/web/components/refusal.test.tsx` (kengayadi), mavjud `history-list.test.tsx`, `ui/sonner.test.tsx` o'zgarmaydi

- [ ] **Step 1: `Refusal` testini qo'sh**

```tsx
// apps/web/components/refusal.test.tsx ga qo'shiladi
import userEvent from "@testing-library/user-event"
import { vi } from "vitest"

test("a refusal may offer what to do about it, as buttons beside the reason", async () => {
  const open = vi.fn()
  render(
    <Refusal actions={<button type="button" onClick={open}>Mijozni ochish</button>}>
      Bu raqamli mijoz allaqachon bor
    </Refusal>,
  )
  expect(screen.getByRole("alert")).toHaveTextContent("Bu raqamli mijoz allaqachon bor")
  await userEvent.click(screen.getByRole("button", { name: "Mijozni ochish" }))
  expect(open).toHaveBeenCalledTimes(1)
})
```

- [ ] **Step 2: Yiqilishini ko'r**

Run: `cd apps/web && pnpm exec vitest run components/refusal.test.tsx`
Expected: FAIL — `actions` prop'i yo'q, tugma chizilmaydi.

- [ ] **Step 3: `refusal.tsx` ni yoz**

```tsx
import { CircleAlertIcon } from "lucide-react"
import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

// Refusal is the API's reason for turning a form down (a phone that is in
// the company already), as the prototype draws it: a red card with an icon,
// between the fields and the button, and under the reason what can be done
// about it (actions: buttons such as "Mijozni ochish"). The reason is the
// alert's own text: the pages (and their tests) find it by that.
export function Refusal({ children, actions, className }: { children: ReactNode; actions?: ReactNode; className?: string }) {
  return (
    <div data-slot="refusal" className={cn("flex gap-2.5 rounded-[16px] bg-destructive-soft px-3.5 py-3 text-md leading-snug text-destructive", className)}>
      <CircleAlertIcon aria-hidden="true" className="mt-0.5 size-5 shrink-0" />
      <div className="min-w-0 flex-1">
        <div role="alert">{children}</div>
        {actions && <div className="mt-1.5 flex flex-wrap gap-3.5 [&_button]:min-h-8 [&_button]:text-md [&_button]:font-semibold [&_button]:text-primary [&_a]:text-primary">{actions}</div>}
      </div>
    </div>
  )
}
```

Eslatma: mavjud test `alert.querySelector("svg")` ni kutadi — ikonka `role="alert"` elementining ichida emas. Testning bu qatori «ikonka alertning ichida» degan talab edi; yangi tuzilmada ikonka alert yonida. Testni shunga moslab o'zgartir (talab o'zgardi: ikonka alert matnidan tashqarida, `aria-hidden`):

```tsx
expect(alert.parentElement?.parentElement?.querySelector("svg")).toHaveAttribute("aria-hidden", "true")
```

- [ ] **Step 4: `sonner.tsx` uslubi**

```tsx
"use client"

import { useTheme } from "next-themes"
import { Toaster as Sonner, type ToasterProps } from "sonner"
import { CheckIcon, InfoIcon, TriangleAlertIcon, XIcon, Loader2Icon } from "lucide-react"

// The toasts are the prototype's: a glass pill at the top of the screen
// with a green (or red) round icon and the message in one line.
const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      position="top-center"
      className="toaster group"
      icons={{
        success: <CheckIcon className="size-[13px]" strokeWidth={3.2} />,
        info: <InfoIcon className="size-[13px]" strokeWidth={3} />,
        warning: <TriangleAlertIcon className="size-[13px]" strokeWidth={3} />,
        error: <XIcon className="size-[13px]" strokeWidth={3.2} />,
        loading: <Loader2Icon className="size-[13px] animate-spin" />,
      }}
      style={
        {
          "--normal-bg": "var(--menu)",
          "--normal-text": "var(--foreground)",
          "--normal-border": "transparent",
          "--border-radius": "22px",
          "--width": "auto",
        } as React.CSSProperties
      }
      toastOptions={{
        classNames: {
          toast: "cn-toast w-fit! max-w-[calc(100vw-32px)] items-center gap-2 py-2.5 pr-4 pl-3 text-md! font-semibold! shadow-float! ring-[0.5px] ring-glass-edge ring-inset backdrop-blur-[24px] backdrop-saturate-[1.8]",
          icon: "m-0! grid size-[22px] place-items-center rounded-full bg-positive text-white [&_svg]:size-[13px]",
          error: "[&_[data-icon]]:bg-destructive",
          warning: "[&_[data-icon]]:bg-warning",
          info: "[&_[data-icon]]:bg-primary",
          description: "text-sm font-normal text-muted-foreground",
        },
      }}
      containerAriaLabel="Bildirishnomalar"
      // sonner's own distances from the edge (24px, 16px on a phone), plus
      // what Telegram lays over the top of a full-screen Mini App
      // (--safe-top, 0 anywhere else).
      offset={{ top: "calc(24px + var(--safe-top))" }}
      mobileOffset={{ top: "calc(16px + var(--safe-top))" }}
      {...props}
    />
  )
}

export { Toaster }
```

- [ ] **Step 5: `history-list.tsx` uslubi** (tuzilma, `data-slot`lar va «avval:/keyin:» matnlari o'zgarmaydi)

`ol` className: `"overflow-hidden rounded-group bg-card"`; `li`: `"relative px-4 py-3 text-md not-first:before:absolute not-first:before:top-0 not-first:before:right-0 not-first:before:left-4 not-first:before:h-px not-first:before:bg-border not-first:before:content-['']"`; birinchi `p`: `"flex items-start justify-between gap-2"` (amal `font-semibold`, o'ngda kim · qachon `text-xs text-muted-foreground text-right`); `dl`: `"mt-1.5 grid gap-1 text-sm text-muted-foreground"`; har o'zgarish `div`: `"min-w-0 [overflow-wrap:anywhere]"` (grid ustunlari yo'q: «Maydon: eski → yangi» bir qatorda), `dt` `inline font-medium text-foreground after:content-[':']`, `dd` `inline`; `change-new` `text-foreground`.

- [ ] **Step 6: O'tishini ko'r**

Run: `cd apps/web && pnpm exec vitest run components/refusal.test.tsx components/history-list.test.tsx components/ui/sonner.test.tsx`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/web/components/ui/sonner.tsx apps/web/components/refusal.tsx apps/web/components/refusal.test.tsx apps/web/components/history-list.tsx
git commit -m "feat(web): the toast as a glass pill, the refusal as a red card with its actions, the history as rows"
```

---

### Task 24: `StatCard`, `Bars`, `Sparkline` (`.ccard`, `.bars`, `.cchart`)

Amalga oshirishdan oldin `dataviz` skill'ini yukla (rang va shakl qoidalari; prototipning ranglari saqlanadi).

**Files:**
- Create: `apps/web/components/kit/stat-card.tsx`
- Test: `apps/web/components/kit/stat-card.test.tsx`

- [ ] **Step 1: Yiqiladigan testni yoz**

```tsx
// apps/web/components/kit/stat-card.test.tsx
import { render, screen } from "@testing-library/react"
import { CheckIcon } from "lucide-react"
import { expect, test } from "vitest"
import { Bars, Sparkline, StatCard } from "./stat-card"

test("a stat card is the way to its section, named by its title and figure", () => {
  render(<StatCard href="/tasks" icon={CheckIcon} color="#FF9500" title="Vazifalar" value="12" unit="ta faol" meta={<span>2 kechikkan</span>} chart={<Sparkline values={[1, 3, 2]} />} />)
  const card = screen.getByRole("link", { name: /Vazifalar/ })
  expect(card).toHaveAttribute("href", "/tasks")
  expect(card).toHaveTextContent("12")
  expect(card).toHaveTextContent("ta faol")
  expect(card.querySelector('[data-slot="sparkline"]')).toHaveAttribute("aria-hidden", "true")
})

test("the bars say their figures in words, tallest for the largest", () => {
  const { container } = render(
    <Bars
      label="Bosqichlar bo'yicha"
      items={[
        { label: "Yangi", value: 4, color: "#007AFF" },
        { label: "Jarayonda", value: 2, color: "#FF9500" },
      ]}
    />,
  )
  expect(screen.getByRole("img", { name: "Bosqichlar bo'yicha: Yangi 4, Jarayonda 2" })).toBeInTheDocument()
  const bars = container.querySelectorAll<HTMLElement>('[data-slot="bar"]')
  expect(bars[0].style.height).toBe("100%")
  expect(bars[1].style.height).toBe("50%")
})

test("a sparkline is one path over its values", () => {
  const { container } = render(<Sparkline values={[0, 5, 3, 8]} />)
  const paths = container.querySelectorAll("path")
  expect(paths).toHaveLength(2)
  expect(paths[1].getAttribute("d")).toMatch(/^M0.0,/)
})
```

- [ ] **Step 2: Yiqilishini ko'r**

Run: `cd apps/web && pnpm exec vitest run components/kit/stat-card.test.tsx`
Expected: FAIL — modul yo'q.

- [ ] **Step 3: `stat-card.tsx` ni yoz**

```tsx
"use client"

import type { LucideIcon } from "lucide-react"
import Link from "next/link"
import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

const W = 160
const H = 78
const PAD = 8

// Sparkline is a smooth line over a short series (the month's purchases
// day by day), filled under, drawn across the bottom of a card. It is
// decoration: the card says the figure.
export function Sparkline({ values, color = "var(--primary)", className }: { values: number[]; color?: string; className?: string }) {
  const points = values.length < 2 ? [values[0] ?? 0, values[0] ?? 0] : values
  const max = Math.max(...points)
  const min = Math.min(...points)
  const range = max - min || 1
  const pts = points.map((value, i) => [i * (W / (points.length - 1)), H - PAD - ((value - min) / range) * (H - PAD * 2.6)])
  const at = (p: number[]) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`
  let d = `M${at(pts[0])}`
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i]
    const p1 = pts[i]
    const p2 = pts[i + 1]
    const p3 = pts[i + 2] ?? p2
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6]
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6]
    d += ` C${at(c1)} ${at(c2)} ${at(p2)}`
  }
  return (
    <svg data-slot="sparkline" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden="true" className={cn("pointer-events-none absolute inset-x-0 bottom-0 block h-[78px] w-full", className)}>
      <path d={`${d} L${W},${H} L0,${H}Z`} fill={color} fillOpacity=".13" />
      <path d={d} fill="none" stroke={color} strokeWidth="2.2" vectorEffect="non-scaling-stroke" strokeLinecap="round" />
    </svg>
  )
}

// Bars are a few figures side by side (the active tasks per stage), each
// in its own color with the figure over it; the tallest is the largest.
// Together they are one image, named with every figure.
export function Bars({ items, label }: { items: { label: string; value: number; color: string }[]; label: string }) {
  const max = Math.max(1, ...items.map((item) => item.value))
  return (
    <div role="img" aria-label={`${label}: ${items.map((item) => `${item.label} ${item.value}`).join(", ")}`} data-slot="bars" className="absolute inset-x-3.5 bottom-3 flex h-[62px] items-end gap-2">
      {items.map((item) => (
        <span
          key={item.label}
          data-slot="bar"
          title={item.label}
          style={{ background: item.color, height: `${Math.max(10, (item.value / max) * 100)}%` }}
          className="relative min-h-1.5 flex-1 rounded-t-[7px] rounded-b-[4px] opacity-90"
        >
          <i className="absolute inset-x-0 -top-[17px] text-center text-[11.5px] font-semibold text-muted-foreground not-italic">{item.value}</i>
        </span>
      ))}
    </div>
  )
}

// StatCard is one of the "Umumiy holat" cards: a section's icon and name,
// a figure with its unit, a line of badges and a chart along the bottom;
// the whole card leads to the section.
export function StatCard({
  href,
  onClick,
  icon: Icon,
  color,
  title,
  value,
  unit,
  meta,
  chart,
  className,
}: {
  href?: string
  onClick?: () => void
  icon: LucideIcon
  color: string
  title: string
  value: string
  unit?: string
  meta?: ReactNode
  chart?: ReactNode
  className?: string
}) {
  const classes = cn(
    "relative flex h-48 flex-col items-stretch overflow-hidden rounded-group bg-card px-3.5 pt-3.5 text-left no-underline transition-transform duration-150 ease-out-expo outline-none active:scale-[.97] focus-visible:ring-3 focus-visible:ring-ring/50",
    className,
  )
  const content = (
    <>
      <span className="flex items-center gap-1.5 text-md font-medium">
        <span aria-hidden="true" style={{ background: color }} className="grid size-5 place-items-center rounded-full text-white">
          <Icon strokeWidth={2.8} className="size-3" />
        </span>
        {title}
      </span>
      <span data-slot="stat-value" className="mt-1.5 text-[22px] leading-tight font-bold tracking-[-0.02em] whitespace-nowrap">
        {value}
        {unit && <span className="ml-1 text-md font-semibold tracking-normal text-muted-foreground">{unit}</span>}
      </span>
      {meta && <span className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs font-semibold">{meta}</span>}
      {chart}
    </>
  )
  if (href !== undefined) {
    return (
      <Link href={href} data-slot="stat-card" className={classes}>
        {content}
      </Link>
    )
  }
  return (
    <button type="button" data-slot="stat-card" onClick={onClick} className={classes}>
      {content}
    </button>
  )
}
```

- [ ] **Step 4: O'tishini ko'r**

Run: `cd apps/web && pnpm exec vitest run components/kit/stat-card.test.tsx`
Expected: PASS (3).

- [ ] **Step 5: Commit**

```bash
git add apps/web/components/kit/stat-card.tsx apps/web/components/kit/stat-card.test.tsx
git commit -m "feat(web): the kit's stat card with bars and a sparkline"
```

---

### Task 25: `Hero` (`.hero`, `.hsub`)

**Files:**
- Create: `apps/web/components/kit/hero.tsx`
- Test: `apps/web/components/kit/hero.test.tsx`

- [ ] **Step 1: Yiqiladigan testni yoz**

```tsx
// apps/web/components/kit/hero.test.tsx
import { render, screen } from "@testing-library/react"
import { expect, test } from "vitest"
import { Hero } from "./hero"

test("a hero is the page's one figure under its label, with badges under it; with a way in it is a link", () => {
  render(<Hero href="/suppliers" label="Ta'minotchilarga qarz" value="1250000.00" unit="so'm" badges={<span>3 ta ta&apos;minotchi</span>} />)
  const hero = screen.getByRole("link", { name: /Ta'minotchilarga qarz/ })
  expect(hero).toHaveTextContent("1 250 000 so'm")
  expect(hero).toHaveTextContent("3 ta ta'minotchi")
})

test("a hero with no way in is a plain block", () => {
  render(<Hero label="Mijozlar" value="10" unit="ta" />)
  expect(screen.queryByRole("link")).not.toBeInTheDocument()
  expect(screen.queryByRole("button")).not.toBeInTheDocument()
  expect(screen.getByText("Mijozlar")).toBeInTheDocument()
})
```

- [ ] **Step 2: Yiqilishini ko'r**

Run: `cd apps/web && pnpm exec vitest run components/kit/hero.test.tsx`
Expected: FAIL — modul yo'q.

- [ ] **Step 3: `hero.tsx` ni yoz**

```tsx
"use client"

import Link from "next/link"
import type { ReactNode } from "react"
import { cn } from "@/lib/utils"
import { Amount } from "./amount"

// Hero is the figure a page opens with (the home's debt to the suppliers,
// a purchase's total, a supplier's balance): a label, the amount large and
// badges under it; the whole leads somewhere when told.
export function Hero({
  label,
  value,
  unit,
  badges,
  href,
  onClick,
  tone,
  className,
}: {
  label: string
  value: string
  unit: string
  badges?: ReactNode
  href?: string
  onClick?: () => void
  // tone colors the label: a debt is red, an advance green.
  tone?: "red" | "green"
  className?: string
}) {
  const classes = cn("block w-full rounded-[24px] px-2 pt-6 pb-7 text-center text-foreground no-underline outline-none focus-visible:ring-3 focus-visible:ring-ring/50", className)
  const content = (
    <>
      <span data-slot="hero-label" className={cn("mb-1.5 block text-md font-semibold", tone === "red" && "text-destructive", tone === "green" && "text-positive")}>
        {label}
      </span>
      <Amount value={value} unit={unit} />
      {badges && <span data-slot="hero-badges" className="mt-2.5 flex flex-wrap items-center justify-center gap-2 text-md font-semibold">{badges}</span>}
    </>
  )
  if (href !== undefined) {
    return (
      <Link href={href} data-slot="hero" className={classes}>
        {content}
      </Link>
    )
  }
  if (onClick !== undefined) {
    return (
      <button type="button" data-slot="hero" onClick={onClick} className={classes}>
        {content}
      </button>
    )
  }
  return (
    <div data-slot="hero" className={classes}>
      {content}
    </div>
  )
}
```

- [ ] **Step 4: O'tishini ko'r**

Run: `cd apps/web && pnpm exec vitest run components/kit/hero.test.tsx`
Expected: PASS (2).

- [ ] **Step 5: Commit**

```bash
git add apps/web/components/kit/hero.tsx apps/web/components/kit/hero.test.tsx
git commit -m "feat(web): the kit's hero figure"
```

---

### Task 26: `HomeBanner` (`.banner`)

**Files:**
- Create: `apps/web/components/kit/banner.tsx`
- Test: `apps/web/components/kit/banner.test.tsx`

- [ ] **Step 1: Yiqiladigan testni yoz**

```tsx
// apps/web/components/kit/banner.test.tsx
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { expect, test, vi } from "vitest"
import { HomeBanner } from "./banner"

test("the banner offers to add the app to the home screen, and can be put away", async () => {
  const add = vi.fn()
  const dismiss = vi.fn()
  render(<HomeBanner onAdd={add} onDismiss={dismiss} />)
  await userEvent.click(screen.getByRole("button", { name: /Hisob24'ni bosh ekranga qo'shing/ }))
  expect(add).toHaveBeenCalledTimes(1)
  await userEvent.click(screen.getByRole("button", { name: "Yopish" }))
  expect(dismiss).toHaveBeenCalledTimes(1)
  expect(screen.getByText("Hisob24'ni bosh ekranga qo'shing").closest('[data-slot="home-banner"]')?.querySelector("svg[data-slot='banner-art']")).toHaveAttribute("aria-hidden", "true")
})
```

- [ ] **Step 2: Yiqilishini ko'r**

Run: `cd apps/web && pnpm exec vitest run components/kit/banner.test.tsx`
Expected: FAIL — modul yo'q.

- [ ] **Step 3: `banner.tsx` ni yoz**

```tsx
"use client"

import { ChevronRightIcon, XIcon } from "lucide-react"
import { useId } from "react"

// BannerArt is the prototype's picture at the banner's right: a tilted
// gradient tile with "24" on it and a few sparkles.
function BannerArt() {
  const id = useId()
  return (
    <svg data-slot="banner-art" viewBox="0 0 140 112" aria-hidden="true" className="pointer-events-none absolute -bottom-1.5 right-1.5 h-[112px] w-[140px]">
      <defs>
        <linearGradient id={`${id}-a`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#5BE0C4" />
          <stop offset="1" stopColor="#169079" />
        </linearGradient>
        <linearGradient id={`${id}-g`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity=".6" />
          <stop offset=".55" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
      </defs>
      <g transform="rotate(-12 80 64)">
        <rect x="40" y="26" width="80" height="80" rx="23" fill="#061a1c" opacity=".35" transform="translate(5 9)" />
        <rect x="40" y="26" width="80" height="80" rx="23" fill={`url(#${id}-a)`} />
        <rect x="40" y="26" width="80" height="80" rx="23" fill={`url(#${id}-g)`} />
        <rect x="40.5" y="26.5" width="79" height="79" rx="22.5" fill="none" stroke="#fff" strokeOpacity=".5" />
        <text x="79" y="80" textAnchor="middle" fontFamily="-apple-system, Geist, system-ui, sans-serif" fontSize="38" fontWeight="800" fontStyle="italic" letterSpacing="-2" fill="#fff">
          24
        </text>
      </g>
      <path d="M24 30l2.2 5.3 5.3 2.2-5.3 2.2L24 45l-2.2-5.3-5.3-2.2 5.3-2.2z" fill="#fff" />
      <path d="M128 14l1.4 3.4 3.4 1.4-3.4 1.4-1.4 3.4-1.4-3.4-3.4-1.4 3.4-1.4z" fill="#fff" opacity=".9" />
      <path d="M30 84l1.1 2.6 2.6 1.1-2.6 1.1-1.1 2.6-1.1-2.6-2.6-1.1 2.6-1.1z" fill="#fff" opacity=".7" />
      <circle cx="132" cy="58" r="2" fill="#fff" opacity=".6" />
    </svg>
  )
}

// HomeBanner offers to add the Mini App to the phone's home screen
// (Telegram's addToHomeScreen): a brand-colored card with the offer, a
// close button and the art.
export function HomeBanner({ onAdd, onDismiss }: { onAdd: () => void; onDismiss: () => void }) {
  return (
    <div data-slot="home-banner" className="relative mb-3 min-h-[100px] overflow-hidden rounded-group bg-brand-panel text-brand-panel-foreground">
      <button type="button" onClick={onAdd} className="block min-h-[100px] w-full py-4 pr-[140px] pl-[18px] text-left outline-none focus-visible:ring-3 focus-visible:ring-white/60 focus-visible:ring-inset">
        <span className="block text-[18px] leading-tight font-bold tracking-[-0.01em]">Hisob24&apos;ni bosh ekranga qo&apos;shing</span>
        <span className="mt-1.5 inline-flex items-center gap-0.5 text-sm opacity-85">
          Bir bosishda ochiladi
          <ChevronRightIcon aria-hidden="true" strokeWidth={2.6} className="size-[15px]" />
        </span>
      </button>
      <button type="button" aria-label="Yopish" onClick={onDismiss} className="absolute top-2 right-2 z-[2] grid size-9 place-items-center outline-none focus-visible:ring-3 focus-visible:ring-white/60">
        <span className="grid size-6 place-items-center rounded-full bg-white/[.22]">
          <XIcon strokeWidth={3} className="size-[13px]" />
        </span>
      </button>
      <BannerArt />
    </div>
  )
}
```

- [ ] **Step 4: O'tishini ko'r**

Run: `cd apps/web && pnpm exec vitest run components/kit/banner.test.tsx`
Expected: PASS (1).

- [ ] **Step 5: Commit**

```bash
git add apps/web/components/kit/banner.tsx apps/web/components/kit/banner.test.tsx
git commit -m "feat(web): the home-screen banner"
```

---

### Task 27: Tab-bar ikonkalari (`t-*` belgilari)

**Files:**
- Create: `apps/web/components/kit/tab-icons.tsx`
- Test: `apps/web/components/kit/tab-icons.test.tsx`

- [ ] **Step 1: Yiqiladigan testni yoz**

```tsx
// apps/web/components/kit/tab-icons.test.tsx
import { render } from "@testing-library/react"
import { expect, test } from "vitest"
import { navKeys } from "@/lib/nav"
import { tabIcons } from "./tab-icons"

test("every section has a filled tab icon, drawn in the current color and hidden from assistive technology", () => {
  for (const key of navKeys) {
    const Icon = tabIcons[key]
    const { container, unmount } = render(<Icon />)
    const svg = container.querySelector("svg")
    expect(svg, key).toHaveAttribute("aria-hidden", "true")
    expect(svg, key).toHaveAttribute("viewBox", "0 0 28 28")
    expect(svg, key).toHaveAttribute("fill", "currentColor")
    unmount()
  }
})

test("two icons with masks on one page do not share a mask id", () => {
  const Home = tabIcons.home
  const { container } = render(
    <>
      <Home />
      <Home />
    </>,
  )
  const ids = Array.from(container.querySelectorAll("mask")).map((mask) => mask.id)
  expect(new Set(ids).size).toBe(ids.length)
})
```

- [ ] **Step 2: Yiqilishini ko'r**

Run: `cd apps/web && pnpm exec vitest run components/kit/tab-icons.test.tsx`
Expected: FAIL — modul yo'q.

- [ ] **Step 3: `tab-icons.tsx` ni yoz** (prototipning `t-*` belgilari, Geist/SF «24» belgisi bilan; sotuv (sumka) va moliya (hamyon) shu uslubda)

```tsx
import { type ComponentProps, type FC, useId } from "react"
import type { NavKey } from "@/lib/nav"

// The tab bar's icons are the prototype's filled marks, 28×28, in the
// current color; the ones with a cut-out (the home's "24", the tasks' tick,
// the box, the warehouse) mask it with an id of their own, so two of a kind
// on one page do not share one.
type Props = ComponentProps<"svg">

const frame = (props: Props) => ({ viewBox: "0 0 28 28", fill: "currentColor", "aria-hidden": true, ...props }) as Props

const Home: FC<Props> = (props) => {
  const id = useId()
  return (
    <svg {...frame(props)}>
      <mask id={id}>
        <rect width="28" height="28" fill="#fff" />
        <text x="14" y="18.6" textAnchor="middle" fontFamily="-apple-system, Geist, system-ui, sans-serif" fontSize="11.5" fontWeight="800" fontStyle="italic" letterSpacing="-.6" fill="#000">
          24
        </text>
      </mask>
      <rect x="3" y="3" width="22" height="22" rx="7" mask={`url(#${id})`} />
    </svg>
  )
}

const Customers: FC<Props> = (props) => (
  <svg {...frame(props)}>
    <circle cx="14" cy="9" r="5.2" />
    <path d="M3.8 24.5c0-5.4 4.5-9.2 10.2-9.2s10.2 3.8 10.2 9.2z" />
  </svg>
)

const Tasks: FC<Props> = (props) => {
  const id = useId()
  return (
    <svg {...frame(props)}>
      <mask id={id}>
        <rect width="28" height="28" fill="#fff" />
        <path d="M8.6 10.2l2.4 2.4 4.4-4.6M9 19h10" stroke="#000" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      </mask>
      <rect x="3.5" y="3" width="21" height="22.5" rx="6" mask={`url(#${id})`} />
    </svg>
  )
}

const Products: FC<Props> = (props) => {
  const id = useId()
  return (
    <svg {...frame(props)}>
      <mask id={id}>
        <rect width="28" height="28" fill="#fff" />
        <path d="M4 8l10 5 10-5M14 13v12" stroke="#000" strokeWidth="2" strokeLinejoin="round" fill="none" />
      </mask>
      <path d="M14 2.5l10.5 5.2v12.6L14 25.5 3.5 20.3V7.7z" mask={`url(#${id})`} />
    </svg>
  )
}

const Sales: FC<Props> = (props) => {
  const id = useId()
  return (
    <svg {...frame(props)}>
      <mask id={id}>
        <rect width="28" height="28" fill="#fff" />
        <path d="M10 11V8a4 4 0 0 1 8 0v3" stroke="#000" strokeWidth="2.2" strokeLinecap="round" fill="none" />
      </mask>
      <path d="M5.5 9.5h17l-1.3 14.2a1.5 1.5 0 0 1-1.5 1.3H8.3a1.5 1.5 0 0 1-1.5-1.3z" mask={`url(#${id})`} />
    </svg>
  )
}

const Warehouse: FC<Props> = (props) => {
  const id = useId()
  return (
    <svg {...frame(props)}>
      <mask id={id}>
        <rect width="28" height="28" fill="#fff" />
        <path d="M9 15h10M9 18.5h10M9 22h10" stroke="#000" strokeWidth="2" strokeLinecap="round" />
      </mask>
      <path d="M2.5 10.5L14 3.5l11.5 7v13.5a1.5 1.5 0 0 1-1.5 1.5H4a1.5 1.5 0 0 1-1.5-1.5z" mask={`url(#${id})`} />
    </svg>
  )
}

const Finance: FC<Props> = (props) => {
  const id = useId()
  return (
    <svg {...frame(props)}>
      <mask id={id}>
        <rect width="28" height="28" fill="#fff" />
        <rect x="17" y="13" width="6.5" height="5" rx="2" fill="#000" />
      </mask>
      <path d="M3.5 9.5A3.5 3.5 0 0 1 7 6h12.5a3 3 0 0 1 3 3v1H7.5a1 1 0 0 0 0 2h17v10a3 3 0 0 1-3 3H7a3.5 3.5 0 0 1-3.5-3.5z" mask={`url(#${id})`} />
    </svg>
  )
}

const Employees: FC<Props> = (props) => (
  <svg {...frame(props)}>
    <circle cx="10.5" cy="9.5" r="4.6" />
    <path d="M1.8 23.5c0-4.8 3.8-8.2 8.7-8.2s8.7 3.4 8.7 8.2z" />
    <circle cx="19.5" cy="8.6" r="3.6" />
    <path d="M20.4 14.3c3.6.3 6.1 3.2 6.1 7.2h-5.7c-.2-2.9-1.4-5.3-3.4-6.8.9-.3 1.9-.4 3-.4z" />
  </svg>
)

const Settings: FC<Props> = (props) => (
  <svg {...frame(props)}>
    <path
      fillRule="evenodd"
      d="M24.84,12.14 L24.84,15.86 L22.39,15.90 L21.27,18.59 L22.98,20.35 L20.35,22.98 L18.59,21.27 L15.90,22.39 L15.86,24.84 L12.14,24.84 L12.10,22.39 L9.41,21.27 L7.65,22.98 L5.02,20.35 L6.73,18.59 L5.61,15.90 L3.16,15.86 L3.16,12.14 L5.61,12.10 L6.73,9.41 L5.02,7.65 L7.65,5.02 L9.41,6.73 L12.10,5.61 L12.14,3.16 L15.86,3.16 L15.90,5.61 L18.59,6.73 L20.35,5.02 L22.98,7.65 L21.27,9.41 L22.39,12.10Z M17.6,14 a3.6,3.6 0 1,0 -7.2,0 a3.6,3.6 0 1,0 7.2,0Z"
    />
  </svg>
)

export const tabIcons: Record<NavKey, FC<Props>> = {
  home: Home,
  customers: Customers,
  tasks: Tasks,
  products: Products,
  sales: Sales,
  warehouse: Warehouse,
  finance: Finance,
  employees: Employees,
  settings: Settings,
}
```

- [ ] **Step 4: O'tishini ko'r**

Run: `cd apps/web && pnpm exec vitest run components/kit/tab-icons.test.tsx`
Expected: PASS (2).

- [ ] **Step 5: Commit**

```bash
git add apps/web/components/kit/tab-icons.tsx apps/web/components/kit/tab-icons.test.tsx
git commit -m "feat(web): the filled tab icons of the nine sections"
```

---

### Task 28: `SortableList` «Tartiblash» rejimi va tutqich uslubi (`.handle`, `.sortable .lift`)

**Files:**
- Modify: `apps/web/components/sortable-list.tsx`
- Test: `apps/web/components/sortable-list.test.tsx` (kengayadi)

- [ ] **Step 1: Testni qo'sh**

```tsx
// apps/web/components/sortable-list.test.tsx ga qo'shiladi (mavjud importlar bilan)
test("while sorting is off the list has no handles: the rows are read, not moved", () => {
  render(
    <SortableList
      label="Bosqichlar"
      sorting={false}
      items={[{ id: "1", name: "Yangi" }, { id: "2", name: "Jarayonda" }]}
      getId={(item) => item.id}
      getLabel={(item) => item.name}
      onReorder={() => {}}
      renderItem={(item, handle) => (
        <div>
          {handle}
          {item.name}
        </div>
      )}
    />,
  )
  expect(screen.getByRole("list", { name: "Bosqichlar" })).toBeInTheDocument()
  expect(screen.queryByRole("button", { name: /tartibini o'zgartirish/ })).not.toBeInTheDocument()
})
```

- [ ] **Step 2: Yiqilishini ko'r**

Run: `cd apps/web && pnpm exec vitest run components/sortable-list.test.tsx`
Expected: FAIL — `sorting` prop'i yo'q, tutqichlar baribir chiziladi.

- [ ] **Step 3: `sorting` prop'ini qo'sh va tutqichni qayta uslubla**

`SortableListProps` ga:

```tsx
  // sorting: the list is in its ordering mode («Tartiblash»): the handles
  // show and the items move. Off, the rows are plain.
  sorting?: boolean
```

`SortableList` da `sorting = true` ni destructure qil; `SortableItem` ga `sorting` ber; `useSortable({ id, disabled: disabled || !sorting })`; `handle` ni `sorting ? (...) : null` qil; `children(handle)` o'sha. Tutqich classlarini shu bilan almashtir:

```tsx
"-ml-2.5 grid h-11 w-10 shrink-0 cursor-grab touch-none place-items-center text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 active:cursor-grabbing"
```

(`buttonVariants` importi olib tashlanadi.) Ikonka: `GripVerticalIcon` → `GripIcon` (lucide'ning 6 nuqtali `grip`), `className="size-[18px]"`. Sudralayotgan element: `isDragging && "z-10 rounded-main bg-card shadow-float"`.

- [ ] **Step 4: O'tishini ko'r**

Run: `cd apps/web && pnpm exec vitest run components/sortable-list.test.tsx components/settings components/shell`
Expected: PASS (sozlamalar va menyu tartibi dialogi `sorting` bermaydi: standart `true`).

- [ ] **Step 5: Commit**

```bash
git add apps/web/components/sortable-list.tsx apps/web/components/sortable-list.test.tsx
git commit -m "feat(web): the sortable list has an ordering mode; the handle in the prototype's shape"
```

---

### Task 29: Yakuniy tekshiruv, vizual ko'rik, hisobot

**Files:**
- Create (vaqtinchalik, commit qilinmaydi): `apps/web/app/kit-preview/page.tsx`, `apps/web/e2e/_kit-preview.spec.ts`

- [ ] **Step 1: Butun tekshiruv**

Run (repo ildizida): `make lint && make test`
Expected: `go vet` + `golangci-lint` 0 issues, `pnpm lint` va `pnpm typecheck` toza; Go paketlari, api-client 1, admin 228 (o'zgarmagan), web avvalgi testlar + yangilari o'tadi.

Run: `make e2e`
Expected: admin 40, web 94 o'tadi (qobiq o'zgarmadi; faqat ranglar va dialog shakli). Dialog varaq bo'lgani uchun e2e'da dialog ichidagi tugmalar `getByRole("dialog")` ichida topiladi; muammo chiqsa (masalan, tugma varaq footer'ida ko'rinmasa), sababini `settle` / scroll bilan tekshir, testni o'zgartirmasdan.

- [ ] **Step 2: Vaqtinchalik ko'rik sahifasi**

`apps/web/app/kit-preview/page.tsx` (qobiqsiz, `"use client"`): `Group` + `Row`lar (avatar, tile icon, badge, end/endSub), `KeyValue` guruhi, `SectionHeading` + `Foot`, `PageTitle` + `PlusButton` + `BackLink`, `DetailHead` + `Tiles`, `ChoiceChips`, `Chips`, `Segmented`, `SearchBox`, `MainBar` + `MainButton` (accent / ghost / red / pending), `Dialog` (tugma bilan ochiladi: `FormRow` oilasi ichida), `AlertDialog`, `ActionSheet`, `PickerSheet` (`SelectRow`), `DateSheet` (`DateRow`), `AmountSheet`, `EmptyState` (ikonka va amal bilan), `Failed`, `ListLoading`, `Splash`, `StateScreen`, `Refusal` (amallar bilan), `HistoryList`, `StatCard` (`Bars`, `Sparkline`), `Hero`, `HomeBanner`, `tabIcons` qatori, `SortableList` (`sorting` almashadigan), `toast.success` tugmasi. Hammasi `max-w-[480px]`da emas, to'liq enda (desktop qarori).

`apps/web/e2e/_kit-preview.spec.ts`: `page.goto("/kit-preview")`, light va dark (`document.documentElement.classList.add("dark")`) da `page.screenshot({ path: "../../docs/design/screens/_kit-preview-<project>-<theme>.png", fullPage: true })`; varaqlarni ochib alohida skrinshot (`dialog`, `alert`, `action-sheet`, `picker`, `date`, `amount`). Run: `cd apps/web && pnpm exec playwright test e2e/_kit-preview.spec.ts` (375 va 1280 project'lar).

- [ ] **Step 3: Ko'rik** — skrinshotlarni prototip bilan solishtir: guruh radiusi 22px, qator 56px, ajratgich 0.5px va `--inset`, chip 36px, segmented 40px, qidiruv 44px, varaq 36px radius + tutqich + chapda yopish, alert 300px, toast pill, bo'sh holat ikonkasi, skeleton rangi; dark'da `#000` fon, `#1C1C1E` yacheyka. Farqlar classlarda tuzatiladi (testlar o'zgarmaydi), tuzatish commit'i: `style(web): …`.

- [ ] **Step 4: Vaqtinchalik fayllarni o'chir**

```bash
rm apps/web/app/kit-preview/page.tsx apps/web/e2e/_kit-preview.spec.ts docs/design/screens/_kit-preview-*.png
rmdir apps/web/app/kit-preview
git status --short   # bo'sh bo'lishi kerak
```

- [ ] **Step 5: Push va hisobot**

```bash
git push origin dev
```

Hisobot: har vazifa uchun RED (qaysi test, qanday yiqildi) → GREEN (qaysi kod bilan o'tdi); o'zgargan mavjud testlar (`refusal.test.tsx`: ikonka alert yonida — talab o'zgardi; `dialog.test.tsx`, `states.test.tsx`, `sortable-list.test.tsx` kengaydi); `make lint`, `make test`, `make e2e` sonlari; skrinshotlardan topilgan va tuzatilgan farqlar; 2-bosqichga (qobiq, profil, kirish ekranlari) tayyorlik. Keyingi bosqichga foydalanuvchi tasdig'i bilan o'tiladi.

---

## O'z-o'zini tekshirish (reja yozilgach)

- **Spec qamrovi (1-bosqich):** tokenlar (Task 1), `kit/*` to'plami jadvalidagi har qator (Task 4–12, 15–21, 24–27), `ui/*` qayta uslub (Task 2–3, 13–14, 16, 23), `states.tsx` (22), `sortable-list` (28), vizual tekshiruv va hisobot (29). `kit/history`, `kit/refusal` spec'da alohida fayl emas: mavjud fayllar qayta uslublandi (23). `ui/sheet.tsx` o'chirilishi 2-bosqichda (`MoreSheet` hali ishlatadi).
- **Nomlar:** `Group`/`Row`/`KeyValue`/`SectionHeading`/`Foot`, `PageTitle`/`BackLink`/`PlusButton`, `DetailHead`/`Tiles`/`Tile`, `Avatar`, `TileIcon`/`sectionColors`, `Badge` (`neutral|accent|red|green|warn`, `dot`), `Chips`/`Chip`/`ChoiceChips`, `Segmented`, `SearchBox` (`delay`), `MainButton`/`MainBar`, `Dialog*` (`tall`, `right`), `AlertDialog*`, `ActionSheet`/`ActionItem`, `Switch`, `FormRow`/`TextRow`/`PhoneRow`/`AmountRow`/`PickRow`/`SwitchRow`/`OptionChips`, `PickerSheet`/`MultiPickerSheet`/`SelectRow`/`MultiSelectRow`/`SearchPickerSheet`/`PickerOption`, `DateSheet`/`DateRow`/`DateTimeRow`/`monthGrid`/`addDays`/`today`, `Amount`/`splitAmount`/`groupDigits`, `AmountSheet`/`Keypad`/`nextAmount`/`amountToDecimal`, `EmptyState`/`NotFound`/`Failed`/`Loading`/`ListLoading`/`Splash`/`StateScreen`, `StatCard`/`Bars`/`Sparkline`, `Hero`, `HomeBanner`, `tabIcons`, `SortableList` (`sorting`) — keyingi vazifalar avvalgilarining nomlarini ishlatadi (18 → 11, 12, 13, 17; 19 → 9, 12, 13, 17; 21 → 12, 13, 20; 25 → 20).
- **Placeholder yo'q:** har kod qadami to'liq kod bilan; `data-slot` nomlari testlar bilan bir xil.
