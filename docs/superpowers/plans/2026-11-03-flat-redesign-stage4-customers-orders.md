# Tekis qayta dizayn, 4-bosqich: mijozlar va buyurtmalar — reja

> **Bajaruvchiga:** superpowers:executing-plans bilan, shu sessiyada. Qadamlar `- [ ]` bilan.

**Maqsad:** mijozlar ro'yxati va sahifasi, buyurtmalar ro'yxati (web: kanban / jadval, telefon: bosqich chiplari va kartalar) va buyurtma sahifasi prototipnikidek bo'ladi. Backend o'zgarmaydi (mijoz sotuvlari soni `GET /app/sales?customer_id=` dan, buyurtmalar soni `GET /app/orders?customer_id=` dan).

**Arxitektura:** ro'yxatlar `DataTable` (webda jadval, telefonda guruhli qatorlar) va `Toolbar` bilan; yozuv sahifalari `PageTitle` + `PageActions` + `StatCards` + sahifa ichidagi tablar (`Segmented` asosida `InPageTabs`). Kanban (sudrash) faqat webda; telefonda bosqich chiplari, tanlangan bosqich kartalari va kartadagi «⋯» (bosqichga ko'chirish menyusi).

Spec: `docs/superpowers/specs/2026-11-03-flat-redesign-design.md` (6-bo'lim: Mijozlar, Buyurtmalar).

## Vazifalar

- [x] 1. `kit/in-page-tabs.tsx`: `InPageTabs` (`Segmented` ko'rinishi, `role="tablist"`, panel `role="tabpanel"`), test.
- [x] 2. Mijozlar ro'yxati: `Toolbar` (qidiruv, tur chiplari), `DataTable` «Mijozlar»: Mijoz (avatar, nom, telefon), Turi, Qarz (qizil qarz / yashil «Avans N» / «—», `sales.view` bo'lsa), Qo'shgan, Qo'shilgan; telefonda qator (telefon · tur, o'ngda qarz); `Pager` yoki «Jami».
- [x] 3. Mijoz sahifasi: `PageTitle` (nom, «telefon · tur», avatar), `PageActions` (Tahrirlash, To'lov, Buyurtma, Qo'ng'iroq, O'chirish — ruxsat bo'yicha), `StatCards` (Balans, Buyurtmalar, Sotuvlar), `InPageTabs`: Ma'lumot (`KeyValue`), Buyurtmalar, Hisob harakati, Tarix (ruxsat bo'yicha).
- [x] 4. Buyurtmalar ro'yxati (web): «Ro'yxat» ko'rinishi `DataTable`: №, Mijoz, Turi, Bosqich (belgi), Muddat (kechikkani qizil), Mas'ul, Narx, Qoldiq; kanban avvalgidek (sudrash).
- [x] 5. Buyurtmalar (telefon): bosqich chiplari («nuqta Nom son», tanlangani to'q), tanlangan bosqich kartalari ro'yxati, kartada «⋯» (bosqichni o'zgartirish); sudrash yo'q.
- [x] 6. Buyurtma sahifasi: `PageTitle` «Buyurtma № N» (izoh: bosqich · tur · muddat), `PageActions`, bosqich tanlovi (rangli segmentlar), `StatCards` (Narx / To'langan / Qoldiq), qoldiq bo'lsa «N qabul qilish» tugmasi, `InPageTabs`: Ma'lumot, Tovarlar, To'lovlar, Tarix.
- [ ] 7. e2e (customers, orders, locations, miniapp), skrinshot, `make lint`, `make test`, `make e2e`, push.
