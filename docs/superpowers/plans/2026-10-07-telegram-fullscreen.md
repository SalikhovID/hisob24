# Telegram Mini App to'liq ekranda — reja

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** the user app's Mini App opens full screen on a phone (Bot API 8.0+) and keeps its content clear of the status bar and Telegram's floating controls.

**Architecture:** `TelegramSync` asks for fullscreen once, on phones with Bot API 8.0+. The insets come from the CSS variables telegram-web-app.js publishes; a `--safe-top` variable and `pt-safe` / `pt-safe-*` utilities pad the shell, the shell-less screens and the toasts. No JS listens to fullscreen events.

**Tech Stack:** Next.js 16, Tailwind v4 (`@utility`), Vitest + RTL, Playwright with the fake Telegram script of `e2e/miniapp.spec.ts`.

Spec: `docs/superpowers/specs/2026-10-07-telegram-fullscreen-design.md`. Commands run in `apps/web`.

---

### Task 1: the request on a phone

**Files:** Modify `types/telegram.d.ts`, `components/telegram-sync.tsx`; Test `components/telegram-sync.test.tsx`.

- [ ] **Step 1: the failing test**

```tsx
test("TelegramSync opens the Mini App full screen on a phone whose client knows it (Bot API 8.0)", async () => {
  const webApp = fakeWebApp({ platform: "ios", isVersionAtLeast: vi.fn(() => true), requestFullscreen: vi.fn() })
  window.Telegram = { WebApp: webApp }

  renderWithProviders(<TelegramSync />)

  await waitFor(() => expect(document.documentElement).toHaveAttribute("data-telegram"))
  expect(webApp.requestFullscreen).toHaveBeenCalled()
})
```

- [ ] **Step 2: run, see it fail** — `pnpm vitest run components/telegram-sync.test.tsx`: FAIL, `requestFullscreen` never called (the type gets the optional members first so the test compiles).
- [ ] **Step 3: minimal code** — in `telegram-sync.tsx` after `disableVerticalSwipes`: `webApp.requestFullscreen?.()`.
- [ ] **Step 4: run, see it pass**; all tests of the file pass.
- [ ] **Step 5: commit** — `feat(web): the Mini App opens full screen on a phone`.

### Task 2: not on a desktop client

- [ ] **Step 1: the failing test** — `platform: "tdesktop"`, same fake; `expect(webApp.requestFullscreen).not.toHaveBeenCalled()`.
- [ ] **Step 2: run, see it fail.**
- [ ] **Step 3: minimal code** — `const onPhone = (platform: string) => platform === "ios" || platform.startsWith("android")`; request only when `onPhone(webApp.platform)`.
- [ ] **Step 4: run, see it pass.**
- [ ] **Step 5: commit** — `fix(web): no full screen on a desktop Telegram`.

### Task 3: not on a client older than Bot API 8.0

- [ ] **Step 1: the failing test** — `platform: "android"`, `isVersionAtLeast: vi.fn(() => false)`; not called.
- [ ] **Step 2: run, see it fail.**
- [ ] **Step 3: minimal code** — `&& webApp.isVersionAtLeast?.("8.0")`.
- [ ] **Step 4: run, see it pass.**
- [ ] **Step 5: commit** — `fix(web): no full screen request to a client older than Bot API 8.0`.

### Task 4: the shell and the screens keep clear of the top (e2e)

**Files:** Modify `e2e/miniapp.spec.ts`, `app/globals.css`, `components/shell/app-shell.tsx`, `components/login/login-frame.tsx`, `components/login/telegram-login.tsx`, `components/expired.tsx`, `components/select-company.tsx`, `components/providers.tsx`.

- [ ] **Step 1: the failing tests** — `fakeTelegram(telegramId, platform = "android")` gains `isVersionAtLeast: () => true` and a `requestFullscreen()` that sets `isFullscreen`, writes `--tg-safe-area-inset-top: 47px` and `--tg-content-safe-area-inset-top: 46px` on `<html>` and fires `fullscreenChanged`; it records `window.__fullscreen = true`. New tests: in "a linked user": `expect((await page.getByRole("banner").boundingBox())!.y).toBeGreaterThanOrEqual(93)`; in "a Mini App whose sign-in fails": the panel's logo `y >= 133` (93 + 40); a new describe "a desktop Telegram" with `fakeTelegram(TG_ALI, "tdesktop")`: `__fullscreen` undefined and the banner at `y === 0`.
- [ ] **Step 2: run, see them fail** — `pnpm exec playwright test e2e/miniapp.spec.ts`: the banner is at 0.
- [ ] **Step 3: minimal code** — `globals.css`: `:root { --safe-top: max(env(safe-area-inset-top), calc(var(--tg-safe-area-inset-top, 0px) + var(--tg-content-safe-area-inset-top, 0px))); }`, `@utility pt-safe { padding-top: var(--safe-top); }`, `@utility pt-safe-* { padding-top: calc(--spacing(--value(integer)) + var(--safe-top)); }`; `AppShell` root `pt-safe`; `LoginFrame` header `pt-safe-10`; `Centered`, `Expired` `px-4 pb-4 pt-safe-4`; `SelectCompany` `px-4 pb-4 pt-safe-10`; `Providers` Toaster `offset` / `mobileOffset`.
- [ ] **Step 4: run, see them pass**; `pnpm vitest run` green.
- [ ] **Step 5: commit** — `feat(web): the Mini App's content keeps clear of the status bar and Telegram's controls`.

### Task 5: README, verification, push, deploy

- [ ] README Mini App line; `make lint`, `make test`, `make e2e`; push.
- [ ] Deploy: pre-deploy dump, probe before (new check `requestFullscreen` in the shell chunks: 0) and after (≥ 1), `deploy/ship.sh`, server checks; the spec gets "Production'ga deploy (2026-10-07)".
