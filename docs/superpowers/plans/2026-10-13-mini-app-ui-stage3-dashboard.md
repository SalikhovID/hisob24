# Mini App UI, 3-bosqich: dashboard API va bosh sahifa vidjetlari — reja

> Spec: `docs/superpowers/specs/2026-10-13-mini-app-ui-design.md` («Bosh sahifa va `GET /app/dashboard`»). Har vazifa TDD: test (RED, to'g'ri sabab bilan) → kod (GREEN) → commit. Bosqich oxirida `make lint`, `make test`, `make e2e`, push, hisobot.

**Maqsad:** prototipning bosh sahifasi: hero (ta'minotchilarga qarz, aks holda faol vazifalar, aks holda mijozlar), tezkor amallar plitkalari, «Umumiy holat» kartalari (vazifalar bosqichlar bo'yicha, xaridlar yoki mijozlar grafigi, sotuv), «Yaqin muddatlar» (5 ta faol vazifa), ularning ma'lumoti bitta yangi so'rovdan: `GET /app/dashboard`.

## Qarorlar

1. **Summalar so'mda.** `logic/currencies.md` (4-bo'lim): balans so'mda, har hujjat o'z kurs qatori bilan aylantiriladi (`convert_amount(total, currency_id, 1, cr)`, ta'minotchilar ro'yxatidagi `balance` bilan bir formula). Shuning uchun spec qoralamasidagi `BalanceLine[]` o'rniga bitta so'm summasi (ikki kasr xonali satr).
2. **Begona lokatsiya 403 `forbidden`**, son bo'lmasa 400 «Lokatsiya noto'g'ri» (`logic/locations.md`, 4-bo'lim: ro'yxatlar qoidasi; client 403 da `/app/me` ni qayta so'raydi). Spec qoralamasidagi 404 o'rniga. `location_id` berilmasa a'zoga ruxsatli hamma lokatsiya (lokatsiyasiz a'zoda nollar va bo'sh ro'yxat).
3. **Bloklar va ruxsatlar** (`requireCompany`; har blok o'z ruxsati bilan, ruxsatsizi `null`):
   - `suppliers` (`purchases.view`): `{ debt, debtors, advance }` — kompaniyaning jonli ta'minotchilari bo'yicha so'mdagi balanslar: musbatlari yig'indisi, ularning soni, manfiylari yig'indisi (musbat son sifatida). Lokatsiyaga bog'liq emas (ta'minotchi balansi hamma lokatsiyaniki, `logic/locations.md` 98-qator).
   - `customers` (`customers.view`): `{ total, added_this_month, by_day }` — jonli mijozlar soni, shu oy qo'shilganlari, `by_day[i]` = oyning `i+1`-kuni oxirigacha qo'shilgan jonli mijozlar soni (bugungacha, uzunligi = bugungi kun raqami). Lokatsiyaga bog'liq emas.
   - `tasks` (`tasks.view`): `{ active, late, by_stage, upcoming }` — lokatsiya(lar)dagi yakuniy bo'lmagan bosqichdagi vazifalar soni, ulardan muddati bugundan oldingilari, har yakuniy bo'lmagan bosqich (tartibi bilan, 0 lilari ham) `{ stage_id, count }`, eng yaqin muddatli 5 tasi (`Task`, ro'yxatdagidek, muddat, keyin ID bo'yicha).
   - `purchases` (`purchases.view`) va `sales` (`sales.view`): `{ month_total, month_count, by_day }` — lokatsiya(lar)dagi shu oyning jonli xaridlari / sotuvlari: so'mdagi jami, soni, `by_day[i]` = oyning `i+1`-kuni oxirigacha yig'ilgan so'm (kumulyativ, bugungacha).
   - «Bugun» va «shu oy» bazaning sanasi (`CURRENT_DATE`, billing kabi); hujjat kuni `doc_at::date`, mijoz kuni `created_at::date`.
4. **Hero** prototipdagidek bitta: `suppliers` bo'lsa «Ta'minotchilarga qarz» (summa, «N ta ta'minotchi» qizil yoki «Qarz yo'q» yashil, avans bo'lsa yashil «Avans …»; bosilsa `/suppliers`), aks holda `tasks` bo'lsa «Faol vazifalar» (son, «N ta kechikkan» yoki «Hammasi vaqtida», lokatsiya nomi; bosilsa `/tasks`), aks holda `customers` bo'lsa «Mijozlar» soni, aks holda hero yo'q.
5. **Tezkor plitkalar:** Vazifa, Mijoz, Sotuv, Xarid, To'lov dan ruxsatli birinchi 4 tasi (`Tiles`). Vazifa: `tasks.create` + `customers.view` + lokatsiya → vazifa qo'shish dialogi; Mijoz: `customers.create` → mijoz qo'shish dialogi; Sotuv: `sales.create` + lokatsiya → `/sales/new`; Xarid: `purchases.create` + `suppliers.view` + lokatsiya → `/purchases/new`; To'lov: `purchases.create` + `suppliers.view` → ta'minotchi tanlash varag'i (`SearchPickerSheet`), keyin shu ta'minotchiga to'lov dialogi (mavjud `PaymentDialog`). Dialoglar mavjud komponentlar (4–5-bosqichda ko'rinishi yangilanadi).
6. **«Umumiy holat»** (`SectionHeading` + 2 ustunli, desktopda 4 ustunli kartalar, `StatCard`): Vazifalar (`tasks` va lokatsiya bo'lsa: «N ta faol», kechikkan badge'i, bosqichlar `Bars`, bosqich rangida), Xaridlar (`purchases`: oy jami ixcham «4,6 mln so'm», «N ta» badge, oy nomi, `Sparkline`) yoki Mijozlar (`purchases` yo'q, `customers` bor: soni, «+N oktabr», `Sparkline`), Sotuv (`sales`: xaridlar kabi). Kartalar bo'limga olib boradi.
7. **«Yaqin muddatlar»** (`tasks`): sarlavha havola (`/tasks?view=list`), o'ngda «Jami: N» (faol); 5 qator (vazifa ikonkasi bosqich rangida, nomi, mijoz · mas'ul qisqa ismi, o'ngda `dd.mm` va «Bugun» / «N kun qoldi» / «N kun kechikdi» qizil), «Barcha vazifalar» havola qatori. Bo'sh: «Faol vazifa yo'q» + ruxsat bo'lsa «Vazifa qo'shish». Lokatsiyasiz a'zo: «Sizga lokatsiya biriktirilmagan».
8. **Grafiklar** (`dataviz` skill): bitta seriya, urg'u rangi, o'q yo'q (karta ichidagi trend belgisi), `role="img"` va matnli nom («Oktabr bo'yicha xaridlar: 4,6 mln so'm»), son kartaning o'zida matn bilan: rang yagona tashuvchi emas.
9. Ma'lumot `useDashboard(companyId, locationId)` bilan (TanStack Query, kalit `["dashboard", companyId, locationId]`); hujjat, vazifa, mijoz, to'lov qo'shilgan / o'zgargan mutatsiyalar dashboard kalitini ham eskirtiradi (`invalidateQueries({ queryKey: ["dashboard"] })`).

## Vazifalar

1. `backend/internal/db/queries/dashboard.sql` + `make sqlc`: `DashboardSuppliers` (debt, debtors, advance), `DashboardCustomers` (total, added_this_month), `DashboardCustomersByDay` (oyning har kuni oxiridagi son), `DashboardTasks` (active, late), `DashboardTasksByStage`, `DashboardMoney` (kind, lokatsiyalar: jami, soni), `DashboardMoneyByDay` (kunlik so'm). `ListActiveTasks` (`tasks.sql`, 5 ta, muddat bo'yicha). Testlar: `internal/dashboard` integratsiya (pgtest).
2. `backend/internal/task`: `Upcoming(ctx, scope, locationID, limit)` (`ListActiveTasks` + javoblar, `List` kabi `Task`). Testlar: `tasks_test.go`.
3. `backend/internal/dashboard`: `Service.Get(ctx, scope, perms, locationID)` → `Dashboard` (ruxsatsiz blok `nil`, `by_day` to'ldirish, kumulyativ yig'ish Go'da). Testlar: table-driven (ruxsatlar × bloklar), pgtest bilan haqiqiy hisoblar (kurs bilan aylantirish, o'chirilgan hujjat va ta'minotchi, boshqa lokatsiya, boshqa kompaniya, oy chegarasi).
4. `backend/internal/app/dashboard.go`: `GET /app/dashboard` (`requireCompany`), `location_id` tekshiruvi, JSON. Testlar: handler (ruxsatlar → `null`, 400, 403, berilmagan lokatsiya), `cmd/api` simlash.
5. `backend/openapi.yaml`: `Dashboard`, `DashboardSuppliers`, `DashboardCustomers`, `DashboardTasks`, `DashboardStageCount`, `DashboardMoney`; contract testi (`internal/httpx/openapi_test.go`) yangi marshrutni talab qiladi. `make api-client`.
6. `apps/web/mocks/dashboard.ts` (mock db'dan hisob) + `handlers.ts`; `mocks/handlers.test.ts`. `lib/queries.ts` `useDashboard`, mutatsiyalarda eskirtirish. Testlar: hook va mock.
7. `components/home/hero.tsx` (`HomeHero`): ruxsat bo'yicha tanlov. Testlar.
8. `components/home/quick-tiles.tsx`: plitkalar va ularning amallari (dialoglar, sahifalar, To'lov varag'i). Testlar.
9. `components/home/overview.tsx`: «Umumiy holat» kartalari (`StatCard`, `Bars`, `Sparkline`, ixcham summa `compactAmount`). Testlar.
10. `components/home/upcoming-tasks.tsx`: «Yaqin muddatlar». Testlar.
11. `components/dashboard.tsx`: bloklarni joylash, yuklanish (`Skeleton` kartalar), xato (`Failed`). Testlar: `dashboard.test.tsx` kengaytiriladi.
12. E2E: `e2e/home.spec.ts` (egasi: hero qarz, plitkalar, kartalar, yaqin muddatlar va bosish; rolli xodim: faqat vazifalar; Mini App'da ham), mavjud spec'lardagi bosh sahifa kutishlari.
13. Hujjatlar: spec'ga 3-bosqich qarorlari; `logic/` ga dashboard qoidasi kerak bo'lsa (bosh sahifa ko'rinishi: qaysi blok kimga) `logic/roles.md` 8-bo'limiga bir band.
