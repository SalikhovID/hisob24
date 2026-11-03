# Tekis qayta dizayn, 5-bosqich: mahsulotlar va ombor — reja

> **Bajaruvchiga:** superpowers:executing-plans bilan, shu sessiyada. Qadamlar `- [ ]` bilan.

**Maqsad:** mahsulotlar ro'yxati va sahifasi, ombor tablari (yangi «Qoldiq» jadvali bilan), hujjat ro'yxatlari, hujjat sahifalari va formalari, ta'minotchilar prototipnikidek bo'ladi.

**Arxitektura:** backend'ga `GET /app/stock/summary?q=&page=` (`stock.view`) qo'shiladi: sqlc so'rovi (mahsulotlar sahifasi + lokatsiyalar bo'yicha qoldiq + oxirgi xarid narxi), `internal/warehouse` servisi, `internal/app` handler, `openapi.yaml` → `make api-client`, MSW mock. Web'da ombor bo'limi `SectionTabs` bilan (Qoldiq birinchi), `/warehouse` hub o'rniga «Qoldiq» jadvali; ro'yxatlar `DataTable` + `Toolbar`, hujjat sahifalari `PageTitle` + `PageActions` + `KeyValue` + qatorlar jadvali, formalar `SumBar` bilan.

Spec: `docs/superpowers/specs/2026-11-03-flat-redesign-design.md` (6-bo'lim: Mahsulotlar, Ombor; 7-bo'lim: `GET /app/stock/summary`). Qoida: `logic/warehouse.md` 5-bo'lim («Qoldiq» jadvali).

## Vazifalar

- [x] 1. Backend: `openapi.yaml` (`/app/stock/summary`, `StockSummaryPage`, `StockSummaryItem`), router testi RED; sqlc `ListStockSummary` / `CountStockSummary`; servis (pgtest): qidiruv, sahifa, ruxsatli lokatsiyalar, oxirgi narx, qiymat, lokatsiyasiz a'zo; handler va integration test; `make api-client`; MSW mock.
- [x] 2. Ombor bo'limi: `nav.ts` tablari Qoldiq birinchi; `/warehouse` = «Qoldiq» sahifasi (`stock.view` bo'lmasa birinchi ruxsatli tabga); `DataTable` (Mahsulot, har lokatsiya, Jami, Qiymati), telefonda qator.
- [x] 3. Mahsulotlar ro'yxati: `SectionTabs` (Mahsulotlar / Xizmatlar), `Toolbar` (qidiruv, «Nofaollar ham»), `DataTable` (Nomi + artikul, Qoldiq · lokatsiya, Oxirgi xarid narxi, Sotuv narxi, Holat).
- [x] 4. (8-bosqichda bajarildi) Mahsulot sahifasi: `PageTitle` + `PageActions`, `KeyValue`, qoldiq lokatsiyalar bo'yicha, harakatlar va xaridlar jadvallari.
- [x] 5. Hujjat ro'yxatlari (xaridlar, ko'chirishlar, inventarizatsiya, boshlang'ich qoldiq): `DataTable`; ta'minotchilar ro'yxati va sahifasi.
- [x] 6. (8-bosqichda) Hujjat sahifalari: `PageTitle` + `PageActions`, `KeyValue`, qatorlar jadvali; formalarda `SumBar` qo'llanmadi (spec 8-bosqich qarorlari).
- [x] 7. e2e, skrinshot, `make lint`, `make test`, `make e2e`, push.
