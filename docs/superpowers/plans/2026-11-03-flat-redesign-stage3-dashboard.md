# Tekis qayta dizayn, 3-bosqich: bosh sahifa — reja

> **Bajaruvchiga:** superpowers:executing-plans bilan, shu sessiyada. Qadamlar `- [ ]` bilan.

**Maqsad:** bosh sahifa prototipnikidek bo'ladi: sarlavha, «Kassadagi pul» hero, 5 ta tezkor tugma, 4 ta karta (faol buyurtmalar bosqich chizig'i bilan, mijozlar qarzi, oy sotuvlari, kam qolgan tovarlar), «Yaqin muddatlar», banner va obuna izohi. Buning uchun `GET /app/dashboard` yangi bloklarni beradi.

**Arxitektura:** backend'da `internal/dashboard` servisiga `cash`, `debtors`, `low_stock` bloklari qo'shiladi, `suppliers`, `customers`, `purchases`, `orders_money` olib tashlanadi. sqlc so'rovlari `internal/db/queries/dashboard.sql` da. `openapi.yaml` → `make api-client`. Web'da `components/dashboard.tsx` va `components/home/*` qayta yoziladi (kit: `Hero`, `Tiles`, `StatCards` / `StageBar`, `Group` / `Row`, `Badge`). Eski `home/overview.tsx` va `kit/stat-card.tsx` (sparkline, bars) boshqa joyda ishlatilmasa olib tashlanadi.

Spec: `docs/superpowers/specs/2026-11-03-flat-redesign-design.md` (6- va 7-bo'limlar).

## Vazifalar

- [x] 1. Hujjatlar: `logic/roles.md` (bosh sahifa bloklari va ruxsatlari), `logic/warehouse.md` (kam qolgan tovar qoidasi), `openapi.yaml` (`Dashboard`: `cash`, `debtors`, `low_stock`, `orders`, `sales`).
- [x] 2. sqlc: `DashboardCash` (jonli akkauntlar qoldig'i valyuta bo'yicha, `ListAccountBalances` qoidasi, akkauntlar soni), `DashboardDebtors` (mijozning valyutadagi musbat balanslari yig'indisi, qarzdor mijozlar soni), `DashboardLowStock` (lokatsiya(lar)da harakati bor jonli faol mahsulotlar, xizmat emas, qoldig'i ≤ 3, nom bo'yicha; soni va birinchi 5 nomi); `DashboardSuppliers`, `DashboardCustomersByDay` olib tashlanadi. `make sqlc`.
- [x] 3. Servis (`internal/dashboard`), pgtest bilan: har blok o'z ruxsati bilan, ruxsatsizi `nil`; lokatsiya qoidasi avvalgidek (berilgani yoki hamma ruxsatlisi).
- [x] 4. Handler (`internal/app/dashboard.go`): JSON, `null` bloklar; contract testi.
- [x] 5. `make api-client`; MSW `GET /app/dashboard` mock'i yangi bloklar bilan.
- [x] 6. `HomeHead`: webda h1 «Salom, Ism», ostida «Kompaniya · Lokatsiya»; telefonda katta kompaniya nomi, ostida «Ism · Rol · Lokatsiya ▾» (lokatsiya qismi tugma: ikki va undan ko'p lokatsiyada varaq), h1 telefonda faqat ekran o'quvchisiga.
- [x] 7. `HomeHero`: «Kassadagi pul» (`finance.view`): UZS katta, izohda boshqa valyutalar va «N ta akkaunt», «Kassa →».
- [x] 8. `QuickTiles`: Buyurtma, Sotuv, Xarid, Xarajat (shu yerda xarajat dialogi), Mijoz — ruxsatlilari, hammasi bitta qatorda.
- [x] 9. `HomeCards`: Faol buyurtmalar (`StageBar`), Mijozlar qarzi, «<Oy> sotuvlari», Kam qolgan tovarlar.
- [x] 10. `UpcomingOrders`: «Yaqin muddatlar» va «Hammasi»; qator: avatar, mijoz, «№ N · muddat · qoldiq», bosqich belgisi; bo'sh va lokatsiyasiz holatlar avvalgidek.
- [x] 11. Ishlatilmay qolgan kod (`Overview`, `kit/stat-card.tsx`, eski hero) olib tashlanadi; e2e (`home.spec`, yordamchilar: telefonda profilga yo'l «Sozlama» orqali, `expectSignedIn`).
- [x] 12. Skrinshot, `make lint`, `make test`, `make e2e`, push.
