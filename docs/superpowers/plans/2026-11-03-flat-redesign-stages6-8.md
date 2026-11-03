# Tekis qayta dizayn, 6–8-bosqichlar: sotuv va moliya, xodimlar va sozlamalar, yakun — reja

> **Bajaruvchiga:** superpowers:executing-plans bilan, shu sessiyada. Qadamlar `- [ ]` bilan.

**Maqsad:** qolgan asosiy ro'yxatlar webda prototip jadvali bo'ladi (sotuvlar, xarajatlar, xodimlar), kassa sahifasi so'mdagi jami kartasi bilan ochiladi; ishlatilmay qolgan kod olib tashlanadi, dizayn hujjati yangi skrinshotlar bilan yangilanadi.

**Arxitektura:** `DataTable` (webda jadval) + `phone` prop'i (telefonda kun guruhlari yoki qatorlar avvalgidek), `Hero` (kassa jami). Backend o'zgarmaydi (kurslar `/app/me` da).

Spec: `docs/superpowers/specs/2026-11-03-flat-redesign-design.md` (6-bo'lim: Sotuv, Moliya, Xodimlar, Sozlamalar; 8-bosqich).

## 6-bosqich: sotuv va moliya

- [x] 1. Sotuvlar ro'yxati: webda jadval (№, Vaqt, Mijoz yoki «Chakana», Kim, Jami, To'lov), telefonda kun guruhlari.
- [x] 2. Xarajatlar / kirimlar: webda jadval (№, Vaqt, Kategoriya, Akkaunt, Kim, Summa; qator bosilsa amallar), telefonda kun guruhlari.
- [x] 3. Kassa: «Jami, so'mda» kartasi — akkauntlar qoldig'i `/app/me` dagi kurslar bilan so'mga, kurslar izohda, kursi yo'q valyuta alohida.
- [x] 4. e2e, `make lint`, `make test`, `make e2e` (push 8-bosqich bilan birga).

## 7-bosqich: xodimlar va sozlamalar

- [x] 1. Xodimlar: webda jadval (Xodim, Rol, Lokatsiyalar — ikki va undan ko'p bo'lsa), qator bosilsa xodim varag'i; telefonda qatorlar.
- [x] 2. Sozlamalar: ro'yxat + alohida sahifalar avvalgidek (kit darajasidagi tekis ko'rinish); `Split` master-detail o'rniga — qaror spec'da.
- [x] 3. e2e, `make lint`, `make test`, `make e2e` (push 8-bosqich bilan birga).

## 8-bosqich: yakun

- [x] 1. Ishlatilmay qolgan kod: `components/avatar.tsx` (va testi), `Split`, `SumBar`, `isMenuPath`, `BalanceCard`; ishlatilmagan shisha tokenlari.
- [x] 1a. Yozuv sahifalari (5-bosqichdan): `PageTitle` + `PageActions` (mahsulot, ta'minotchi, akkaunt, xarid, sotuv, ko'chirish, inventarizatsiya, boshlang'ich qoldiq), hujjat qatorlari webda jadval, ta'minotchi balansi kartalari.
- [x] 2. `docs/design/README.md`: tekis dizayn bo'limi, `screens-v3/` skrinshotlari (telefon va web, yorug' va qorong'i).
- [x] 2a. Haqiqiy stack smoke (vaqtinchalik baza, API + `next dev`, ikkala ko'rinish).
- [ ] 3. `make lint`, `make test`, `make e2e`, push; yakuniy hisobot.
