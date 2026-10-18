# Buyurtmada nom o'rniga raqam («Buyurtma № N») — dizayn

Sana: 2026-10-18 (kechqurun). Holat: foydalanuvchi reja sifatida tasdiqlagan (savol-javob bilan), amalga oshirilmoqda (`dev` branch).

## Kontekst

Foydalanuvchining so'zlari (qo'shish formasining skrinshoti bilan): «buyurtma yaratishda `nomi` degan inputni olib tashla».

Buyurtma (`orders.title TEXT NOT NULL`) qo'shish va tahrirlash formasida «Nomi» majburiy maydon edi; nom karta va qator sarlavhasi, sahifa sarlavhasi, hisob harakati / mahsulot harakatlari / akkaunt harakati qatorlari («Buyurtma · nomi», «To'lov · nomi»), bosh sahifadagi «Yaqin muddatlar», tarix («Nomi» o'zgarishi), qidiruv (nomda), o'chirish va bosqich dialoglarining matnlarida ishlatilardi. Qoidalar: [`logic/orders.md`](../../../logic/orders.md).

`docs/SPEC.md` da yo'q ish, foydalanuvchi so'rovi bilan.

## Foydalanuvchi qarorlari (2026-10-18)

| # | Savol | Qaror |
|---|---|---|
| 1 | Nomsiz buyurtma qanday ataladi | **«Buyurtma № N»**: kompaniya bo'yicha raqam, «Sotuv № 1» / «Xarid № 2» kabi; tur hozirgidek alohida (kartada belgi, sahifada «Tur · Mijoz») |
| 2 | Mavjud nomlar | **O'chiriladi**: har buyurtma yaratilish tartibida raqam oladi, `title` ustuni ketadi |

Qarorlardan kelib chiqib belgilanganlar: «Nomi» tahrir formasidan ham ketadi (raqam o'zgarmaydi); tarixda «Nomi» o'zgarishi endi yozilmaydi (eski yozuvlar qanday bo'lsa shunday ko'rinadi); qidiruvda nom o'rniga raqam (faqat raqamlardan iborat qidiruv buyurtma raqamiga aynan mos keladi; telefon va matn maydonlari avvalgidek); API'da `title` o'rniga `number`, «Buyurtma № N» matni web'da yasaladi («Sotuv № N» kabi).

## Qoidalar

- **Raqam.** `orders.number INT NOT NULL`, `UNIQUE (company_id, number)`. Qo'shishda kompaniyaning eng katta raqamidan bir ortiq (o'chirilganlar ham sanaladi: raqam ikki marta berilmaydi), kompaniya qulfi ostida (`LockCompanyCustomers`, `order.Service.write` ichida: ikki buyurtma bir vaqtda ikki raqam oladi). Keyin o'zgarmaydi. Jurnal hujjatining raqami (`transactions.number`, ko'rsatilmaydi) bunga aloqasiz.
- **Ko'rinish.** Hamma joyda «Buyurtma № N» (`№` + oddiy bo'shliq, «Sotuv № 1» kabi; web'da `orderName(number)`): karta va qator sarlavhasi, sahifa sarlavhasi (tavsifi «Tur · Mijoz» qoladi), bosh sahifa «Yaqin muddatlar», mijoz sahifasidagi buyurtmalar, bosqich menyusi va kanban e'lonlari («Buyurtma № 3» «Jarayonda» bosqichiga ko'chirildi), o'chirish dialogi, buyurtma to'lov dialogining sarlavhasi. Hisob harakatida buyurtma qatori «Buyurtma № N» (oldin «Buyurtma · nomi»), buyurtmaga bog'langan to'lov «To'lov · Buyurtma № N»; mahsulot harakatlarida «Buyurtma № N»; akkaunt harakatida «To'lov · Buyurtma № N».
- **Forma.** Qo'shish va tahrirda «Nomi» qatori yo'q; body'da `title` yo'q (yuborilsa e'tiborsiz). 4.1 tekshiruv tartibidan nom chiqadi; «Buyurtma nomini kiriting» / «… 200 belgidan oshmasin» xabarlari yo'q.
- **Tarix.** «Nomi» o'zgarishi yozilmaydi; qolgani avvalgidek.
- **Qidiruv.** Matn: buyurtmaning matn maydonlari va mijozning matn maydonlari (nom yo'q). Raqam: mijoz telefoni (qism), maydonlarning raqamlari (qism) va buyurtma raqami (aynan): «12» → «Buyurtma № 12». Placeholder «Raqami, mijoz yoki telefon».
- **Mavjud ma'lumot.** Migratsiya 00022 har kompaniya buyurtmalarini `id` tartibida 1 dan raqamlaydi (o'chirilganlar ham) va `title` ustunini o'chiradi: nomlar yo'qoladi. Down ustunni bo'sh (`''`) qaytaradi, nomlar qaytmaydi.

## API (`backend/openapi.yaml` → `make api-client`)

- `Order.number` (integer, required); `Order.title` yo'q. `OrderCreate` / `OrderUpdate` da `title` yo'q.
- `StatementRow`, `ProductMove`, `AccountStatementRow`: `order_title` → `order_number` (integer | null).
- `DashboardOrders.upcoming[]` `Order` bo'lgani uchun o'zi o'zgaradi.

## Baza

- `00022_order_numbers.sql`: `orders.number INT` qo'shiladi, `row_number() OVER (PARTITION BY company_id ORDER BY id)` bilan to'ldiriladi, `NOT NULL`, `UNIQUE (company_id, number)`; `title` o'chiriladi. Down: `title TEXT NOT NULL DEFAULT ''` qaytadi, `number` ketadi.
- `NextOrderNumber(company_id)`: `COALESCE(max(number), 0) + 1` (o'chirilganlar bilan), kompaniya qulfi ostida chaqiriladi.

## Bosqichlar

0. Hujjatlar (shu spec, `logic/orders.md`, `2026-10-18-order-money-design.md`, `CLAUDE.md`).
1. Baza va so'rovlar: migratsiya + test; `orders.sql` (`CreateOrder` raqam bilan, `NextOrderNumber`, `number` ustuni, qidiruv raqam bo'yicha, `UpdateOrder` nomsiz), `statements.sql` / `stock_moves.sql` / `cash.sql` `order_number`; `make sqlc`.
2. Go: `internal/order` (`Number`, `Input` nomsiz, `orderTitle` ketadi, `diff` «Nomi»siz, `Create` raqam oladi), `internal/warehouse` (`OrderNumber`), `internal/app` (JSON `number`, `order_number`), `openapi.yaml`, `make api-client`.
3. Web lib va mocklar: `orderName`, sxema nomsiz, `OrderRow.number`, `nextOrderNumber`, qidiruv, `order_number`.
4. Web komponentlar va e2e: forma nomsiz, sarlavhalar `orderName`, statement / harakatlar matnlari, placeholder; testlar va e2e.
5. Yakuniy ko'rik: lint, test, e2e, mutatsiya tekshiruvi, haqiqiy stack smoke (00022 lokal DB nusxasida), push.
