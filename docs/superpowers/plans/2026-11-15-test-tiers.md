# Test bosqichlari — amalga oshirish rejasi

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Testlar faqat kerak bo'lganda yursin. TDD siklida faqat yozilayotgan test, commit'da modulning o'z testi, push oldidan o'zgargan tomon. To'liq gate faqat so'ralganda. E2e uchun bitta oldindan ishga tushiriladigan server bo'lsin.

**Architecture:** Qoidalar `CLAUDE.md` da (yangi «Testlar qachon yuradi» bo'limi). E2e dev serverining buyrug'i va env'i har app'ning `e2e:server` skriptiga ko'chadi. `playwright.config.ts` shu skriptni chaqiradi, shuning uchun qo'lda ishga tushirilgan server va Playwright bir xil serverni ishlatadi (`reuseExistingServer`).

**Tech Stack:** pnpm scripts, Playwright `webServer`, Next.js 16 dev server.

Dizayn: `docs/superpowers/specs/2026-11-15-test-tiers-design.md`.

---

### Task 1: web'da `e2e:server`

**Files:**
- Modify: `apps/web/package.json` (`scripts`)
- Modify: `apps/web/playwright.config.ts` (`webServer`)

- [ ] **Step 1: RED.** Skript hali yo'qligini ko'rsatish.

Run: `cd apps/web && pnpm run e2e:server`
Expected: `ERR_PNPM_NO_SCRIPT  Missing script: e2e:server`

- [ ] **Step 2: Skript.** `"test:e2e": "playwright test"` dan keyin:

```json
    "test:e2e": "playwright test",
    "e2e:server": "NEXT_DIST_DIR=.next-e2e HIDE_DEV_INDICATOR=1 API_URL=http://127.0.0.1:9 next dev -p 3102"
```

- [ ] **Step 3: Config.** `webServer` shunday bo'ladi (env bloki skriptga ko'chdi):

```ts
  webServer: {
    // The command and its env live in package.json's e2e:server, so a server
    // started by hand for a session (pnpm --filter @hisob24/web e2e:server)
    // is the one Playwright would start, and reuseExistingServer takes it.
    command: "pnpm run e2e:server",
    url: `http://localhost:${port}/login`,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
```

- [ ] **Step 4: GREEN, server yo'qligida.** 3102-port bo'sh ekanini tekshiring (`lsof -tiTCP:3102 -sTCP:LISTEN` hech narsa chiqarmaydi). Keyin:

Run: `pnpm exec playwright test e2e/login.spec.ts --project=mobile -g "signs in with an SMS code"`
Expected: `1 passed`. Run'dan keyin `lsof -tiTCP:3102 -sTCP:LISTEN` yana bo'sh.

- [ ] **Step 5: GREEN, oldindan ishga tushirilgan serverda.** `pnpm --filter @hisob24/web e2e:server` ni fonda ishga tushiring. `/login` 200 qaytarguncha kuting. Server jarayonining env'ini tekshiring: `ps eww -p <next-server pid>` da `NEXT_DIST_DIR=.next-e2e`, `HIDE_DEV_INDICATOR=1` va `API_URL=http://127.0.0.1:9` bor. Keyin Step 4 dagi testni qayta yurgizing.

Expected: `1 passed`, ~5 s. Server o'sha PID bilan ishlashda davom etadi, ya'ni Playwright uni qayta ishlatdi.

- [ ] **Step 6: Commit**

```bash
git add apps/web/package.json apps/web/playwright.config.ts
git commit -m "test(web): the e2e dev server starts from one e2e:server script"
```

### Task 2: admin'da `e2e:server`

**Files:**
- Modify: `apps/admin/package.json` (`scripts`)
- Modify: `apps/admin/playwright.config.ts` (`webServer`)

- [ ] **Step 1: RED.**

Run: `cd apps/admin && pnpm run e2e:server`
Expected: `ERR_PNPM_NO_SCRIPT  Missing script: e2e:server`

- [ ] **Step 2: Skript.**

```json
    "test:e2e": "playwright test",
    "e2e:server": "NEXT_DIST_DIR=.next-e2e ADMIN_BOT_USERNAME=hisob24_admin_bot API_URL=http://127.0.0.1:9 next dev -p 3101"
```

- [ ] **Step 3: Config.**

```ts
  webServer: {
    // The command and its env live in package.json's e2e:server, so a server
    // started by hand for a session (pnpm --filter @hisob24/admin e2e:server)
    // is the one Playwright would start, and reuseExistingServer takes it.
    command: "pnpm run e2e:server",
    url: `http://localhost:${port}/login`,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
```

- [ ] **Step 4: GREEN, server yo'qligida.** 3101-port bo'sh bo'lsin.

Run: `pnpm exec playwright test e2e/login.spec.ts --project=mobile -g "signs in with the bot's code"`
Expected: `1 passed`. Run'dan keyin 3101-port bo'sh.

- [ ] **Step 5: GREEN, oldindan ishga tushirilgan serverda.** `pnpm --filter @hisob24/admin e2e:server` ni fonda ishga tushiring. `ps eww` da `NEXT_DIST_DIR=.next-e2e`, `ADMIN_BOT_USERNAME=hisob24_admin_bot` va `API_URL=http://127.0.0.1:9` bo'lsin. Keyin o'sha testni yurgizing.

Expected: `1 passed`, server o'sha PID bilan ishlashda davom etadi.

- [ ] **Step 6: Commit**

```bash
git add apps/admin/package.json apps/admin/playwright.config.ts
git commit -m "test(admin): the e2e dev server starts from one e2e:server script"
```

### Task 3: CLAUDE.md va README

**Files:**
- Modify: `CLAUDE.md`: TDD 4-qadami, yangi «Testlar qachon yuradi» bo'limi («Git» dan oldin), «Git», «Ish tartibi», «Buyruqlar»
- Modify: `README.md`: «Buyruqlar» jadvali, `make e2e` qatoridan keyin

- [ ] **Step 1: TDD 4-qadami.** «Shuningdek, oldingi testlarning hammasi ham o'tishini tekshir.» gapi «Shuningdek, o'zgargan modullarning o'z test fayllari ham o'tishini tekshir. To'liq suite har siklda emas, push oldidan yuradi (pastdagi «Testlar qachon yuradi»).» ga almashtiriladi.

- [ ] **Step 2: «Testlar qachon yuradi» bo'limi.** Dizaynning «Qachon nima yuradi» jadvali va «Qo'shimcha qoidalar» qisqa ko'rinishda yoziladi. Bo'limda shular bo'lishi kerak:
  - qachon nima yurishi, to'rt qator: RED/GREEN, har commit, push oldidan (tomonlar bo'yicha), faqat so'ralganda;
  - e2e faqat jsdom tekshira olmaydigan narsaga yozilishi;
  - flaky e2e uchun `--last-failed`;
  - deploy push gate'ni qayta yurgizmasligi;
  - hisobotdagi «to'liq e2e yurmagan» qatori va umumiy kod ro'yxati;
  - `e2e:server` dan qanday foydalanish;
  - dizayn hujjatiga havola.

- [ ] **Step 3: «Git».** Eski «Faqat `main`» qatori va `git push origin main` olib tashlanadi. O'rniga: ish `dev` da qilinadi, `dev` test serverga, `main` prod'ga chiqadi. Push: `git push origin dev`. Prod'ga o'tkazishda `main` da `git merge --ff-only dev`, keyin `git push origin main`. Push qatori: «ish yoki bosqich oxirida, push gate o'tgandan keyin, hisobotdan oldin».

- [ ] **Step 4: «Ish tartibi».** «Har bosqich oxirida build va testlar tekshiriladi» o'rniga «Har bosqich oxirida push gate yuradi».

- [ ] **Step 5: «Buyruqlar».** Ikki qator qo'shiladi:

```bash
make test-go / test-web, make lint-go / lint-web   # bitta tomon: push gate shularni ishlatadi
pnpm --filter @hisob24/web e2e:server   # e2e dev server (3102), fonda; Playwright uni qayta ishlatadi. Admin: @hisob24/admin (3101)
```

- [ ] **Step 6: README.** `make e2e` qatoridan keyin:

```markdown
| `pnpm --filter @hisob24/web e2e:server` | e2e uchun dev server (3102-port, `.next-e2e`, API MSW bilan). Fonda ishga tushirilsa, `make e2e` va `playwright test` shu serverni ishlatadi. Admin uchun: `@hisob24/admin` (3101-port) |
```

- [ ] **Step 7: Commit**

```bash
git add CLAUDE.md README.md docs/superpowers/plans/2026-11-15-test-tiers.md
git commit -m "docs: tests run by tier, the full gate only on request"
```

### Task 4: Memory

- [ ] `stages-without-stopping.md` dagi «at each stage end still run `make lint`, unit tests, Go tests and e2e, then push» gapi almashtiriladi: endi bosqich oxirida CLAUDE.md'dagi push gate yuradi, to'liq gate faqat so'ralganda. `MEMORY.md` dagi indeks qatori ham shunga moslanadi.

### Task 5: Push gate va push

- [ ] O'zgargan tomon `apps/*`, shuning uchun push gate'da quyidagilar yuradi: `make lint-web`, `make test-web` va o'zgargan qism, ya'ni e2e infratuzilmasining spec'lari. Bular ikkala app'ning `e2e/login.spec.ts` fayli, ikkala project'da, oldindan ishga tushirilgan serverlarda.
- [ ] `git push origin dev`.
- [ ] Fondagi e2e serverlar to'xtatiladi, 3101 va 3102 portlar bo'sh.
- [ ] Deploy kerak emas: `next build` va server image'lari bu o'zgarishdan ta'sirlanmaydi.
