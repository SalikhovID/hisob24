# Testlar qachon yuradi (test bosqichlari) — dizayn

Sana: 2026-11-15. Holat: foydalanuvchi tasdiqlagan (savol-javob bilan), amalga oshirilmoqda (`dev` branch).

## Kontekst

Foydalanuvchining so'zlari: «ishlash strukturasini o'zgartiramiz har bir ishdan oldin testlar yurgazish uzoq vaqt olyapti».

Oxirgi uch ish sessiyasining o'lchovi (2026-11-03 flat redesign, 2026-11-10 pul maskasi va klaviatura, 2026-11-11 maydon cheti). Har Bash chaqiruvining davomiyligi sessiya logidan olingan, fondagi run'lar kirmagan:

| Qayerda | Necha marta | Vaqt |
|---|---|---|
| Ish davomida e2e spec'lar (bittasi 10–55 s) | 99 | ~64 daq |
| Har GREEN'dan keyin butun web vitest (64–86 s) | 41 | ~46 daq |
| Qisman vitest (fayl, papka) | 178 | ~44 daq |
| `make test`, `make lint`, to'liq e2e | 51 (+14 fonda) | ~51 daq (+ fon) |

Jami ~3.5 soat. Bir martalik o'lchovlar (2026-11-15):

- **Go.** `go test -count=1 ./...` 1 daq 40 s ishladi: 27 paket, `app` 84 s, `db` 73 s. Vaqtning asosiy qismi Postgres'da o'tadi, CPU 14%.
- **Vitest.** Web: 192 fayl, 1356 test, 64 s (jsdom 192 marta yaratiladi, jami 153 s CPU). Admin: 40 fayl, 12 s.
- **To'liq e2e.** Web: 92 test × 2 project, `--workers=2` da (mashina 8 GB RAM) 5.7–6.7 daq. Deyarli har to'liq run'da bitta flaky test `--last-failed` bilan qayta yurgan. Admin: 46 test, 25–41 s.
- **Bitta e2e test.** Playwright serverni o'zi ko'targanda 11.6 s ketadi. Oldindan ishga tushirilgan serverda 5.0–5.3 s, birinchi marta 7.1 s (sahifa kompilyatsiyasi bilan).
- **`vitest related`.** Umumiy faylda tez emas: `lib/format.ts` 102 faylni yurgizadi (48 s), `components/kit/form-row.tsx` 72 faylni (38 s), `components/orders/order-dialog.tsx` esa 8 faylni (12 s). Shuning uchun commit'da `related` emas, modulning o'z test fayli yuradi.

## Foydalanuvchi qarorlari (2026-11-15)

| # | Savol | Qaror |
|---|---|---|
| 1 | Nimani o'zgartiramiz | Sikldagi to'liq vitest, ish davomidagi e2e va push oldidagi to'liq gate. Suite'larning o'zini tezlashtirish (vitest pool, Go `-p 4`, production build ustida e2e) **qilinmaydi** |
| 2 | To'liq gate qaysi deploydan oldin majburiy | **Faqat so'ralganda.** Hech qayerda majburiy emas, prod ham push gate bilan chiqadi |
| 3 | Qanday joriy qilinadi | Qoidalar (CLAUDE.md, memory) va `e2e:server` skriptlari (env bitta joyda). GitHub Actions **qo'shilmaydi** |

## Qoidalar

### Qachon nima yuradi

| Qachon | Nima yuradi | Taxminiy vaqt |
|---|---|---|
| RED va GREEN | Faqat yozilayotgan test. Bu bitta vitest fayl (`pnpm exec vitest run <fayl>`), bitta Go test (`go test ./internal/<paket> -run <Test>`) yoki bitta e2e test (`pnpm exec playwright test <spec> -g "<nom>" --project=<mobile\|desktop>`, oldindan ishga tushirilgan serverda) | soniyalar |
| Har commit (GREEN'dan keyin) | Shu siklning testi va o'zgargan modullarning o'z test fayllari (masalan `form-row.tsx` → `form-row.test.tsx`). Modulning o'z test fayli bo'lmasa, faqat siklning testi yuradi. Go'da o'zgargan paketlar (`go test ./internal/<paket>/...`) | 5–20 s |
| Push oldidan (ish oxirida bir marta) | Faqat o'zgargan tomon (pastda) | web ~3–5 daq, backend ~1–3 daq |
| Faqat foydalanuvchi so'raganda | To'liq gate: `make lint && make test && make e2e` | ~10–12 daq |

Push oldidan qaysi tomon tekshiriladi:

- **`apps/*` yoki `packages/*` o'zgargan bo'lsa:** `make lint-web` (eslint va typecheck, hamma workspace), `make test-web` (api-client, web va admin vitest), keyin o'sha bo'limning e2e spec'lari ikkala project'da.
- **`backend/` o'zgargan bo'lsa:** `make lint-go` va `make test-go`. Go keshi o'zgarmagan paketlarni o'tkazib yuboradi, shuning uchun `-count=1` yozilmaydi. O'zgargan kod va migratsiya (embed) keshni o'zi bekor qiladi.
- **`backend/openapi.yaml` o'zgargan bo'lsa:** `make api-client`, keyin ikkala tomon.
- **Faqat hujjatlar o'zgargan bo'lsa** (`docs/`, `logic/`, `*.md`): hech narsa yurmaydi.

### Qo'shimcha qoidalar

- **E2e test** faqat jsdom tekshira olmaydigan narsaga yoziladi: o'lcham va joylashuv, haqiqiy CSS, klaviatura va viewport, sahifalar orasidagi oqim. Qolgani vitest va React Testing Library bilan tekshiriladi.
- **Push gate'dagi e2e spec'lar.** Bular shu ishda o'zgargan sahifa va komponentlarni qamrab olgan `apps/<app>/e2e/*.spec.ts` fayllari. Faqat backend o'zgargan bo'lsa e2e yurmaydi, chunki e2e'da API MSW bilan mock qilingan. Qaysi spec'lar yurgani hisobotda yoziladi.
- **Flaky e2e.** Yiqilgan e2e bir marta `--last-failed` bilan qayta yurgiziladi. Yana yiqilsa, bu haqiqiy xato deb tekshiriladi. Qayta yurgizilganda o'tgan test hisobotda flaky deb yoziladi.
- **`53300`.** To'liq Go run'da shu xato chiqsa, sabab Postgres ulanish chegarasi: `go test -p 4` bilan qayta yurgiziladi. Bu avvalgi qoida.
- **Deploy.** Push gate shu HEAD'da o'tgan bo'lsa, deploy oldidan qayta yurgizilmaydi; bunga deploy pre-flight'idagi `lint-web` va `pnpm test` ham kiradi. Deployning o'z tekshiruvlari o'zgarmaydi: server pre-flight, dump, toza `git archive` build va probe.
- **Hisobot.** Har xatti-harakat uchun RED → GREEN ko'rsatiladi, bu o'zgarmaydi. Qo'shimcha ravishda push gate'da nima yurgani yoziladi. Bir nechta sahifa ishlatadigan kodga tegilgan bo'lsa, bitta qator qo'shiladi: «to'liq e2e yurmagan; o'zgargan umumiy kod: …». Umumiy kodga misollar: `components/kit`, `components/ui`, `components/shell`, `lib/`, `app/globals.css`, `app/layout.tsx`, `packages/api-client`, `backend/internal/db`, `backend/migrations`. To'liq gate kerakmi, buni foydalanuvchi hal qiladi.
- **TDD'ning o'zi o'zgarmaydi.** Avval test yoziladi, RED ko'rsatiladi, keyin GREEN. Har GREEN'dan keyin commit qilinadi. Test o'chirilmaydi va `skip` qilinmaydi.

### Oldindan ishga tushirilgan e2e server

- **`apps/web/package.json`:** `"e2e:server": "NEXT_DIST_DIR=.next-e2e HIDE_DEV_INDICATOR=1 API_URL=http://127.0.0.1:9 next dev -p 3102"`.
- **`apps/admin/package.json`:** `"e2e:server": "NEXT_DIST_DIR=.next-e2e ADMIN_BOT_USERNAME=hisob24_admin_bot API_URL=http://127.0.0.1:9 next dev -p 3101"`.
- **Ikkala `playwright.config.ts`:** `webServer.command: "pnpm run e2e:server"`, `webServer.env` bloki olib tashlanadi, env endi skriptda turadi. `url`, `reuseExistingServer` va `timeout` o'zgarmaydi.
- **Qanday ishlatiladi.** Sessiyada birinchi e2e kerak bo'lganda `pnpm --filter @hisob24/web e2e:server` (yoki `@hisob24/admin`) fonda ishga tushiriladi. Sessiya oxirida u to'xtatiladi va 3102 / 3101 portlar bo'shaydi. Playwright uni `reuseExistingServer` orqali o'zi topadi, `make e2e` ham shu serverni ishlatadi. Server yo'q bo'lsa, Playwright avvalgidek uni o'zi ko'taradi va run tugagach to'xtatadi.

### Hujjatlar

- **`CLAUDE.md`:**
  - TDD 4-qadami: «oldingi testlarning hammasi» o'rniga «o'zgargan modullarning test fayllari».
  - Yangi «Testlar qachon yuradi» bo'limi (yuqoridagi jadval va qoidalar).
  - Git bo'limidagi push qoidasi va «Ish tartibi»dagi bosqich oxiri tekshiruvi push gate'ga almashtiriladi.
  - Git bo'limidagi eski «faqat `main`» qatori amaldagi tartibga moslanadi: ish `dev` da qilinadi va `dev` test serverga chiqadi. `main` prod'ga chiqadi, prod'ga o'tkazishda `git merge --ff-only dev` va `git push origin main` ishlatiladi.
  - «Buyruqlar» ga `e2e:server` qo'shiladi.
- **`README.md`:** buyruqlar jadvalida `make e2e` qatorining yoniga `e2e:server` qatori qo'shiladi.
- **Memory:** `stages-without-stopping` dagi bosqich oxiri tekshiruvi push gate'ga almashtiriladi.

## Tekshiruv

Bu test infratuzilmasining sozlamasi, production kod emas. Shuning uchun unit test yozilmaydi, ishlashi quyidagicha isbotlanadi:

1. **O'zgarishdan oldin.** `pnpm --filter @hisob24/web run e2e:server` skript yo'qligi sababli yiqiladi.
2. **Server yo'qligida.** `e2e/login.spec.ts` dagi bitta test Playwright skript orqali ko'targan serverda o'tadi, run'dan keyin 3102-port bo'sh qoladi. Admin uchun ham xuddi shunday (3101-port).
3. **Oldindan ishga tushirilgan serverda.** `e2e:server` fonda ishga tushiriladi va o'sha test unda o'tadi (~5 s). Server to'xtatilgach port bo'shaydi.
4. **Lint.** `make lint-web` o'tadi.

To'liq `make e2e` yurgizilmaydi, chunki yangi qoida bo'yicha u faqat so'ralganda ishlaydi.

## Tegilmaydigan narsalar

- **Makefile.** Mavjud `lint-web`, `test-web`, `lint-go`, `test-go` va `e2e` maqsadlari yetadi.
- **Testlarning o'zi.** Vitest config, Go testlar va `make e2e` tarkibi o'zgarmaydi.
- **Deploy.** Deploy skriptlari o'zgarmaydi: pre-flight, dump, toza build va probe.
