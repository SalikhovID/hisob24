# Ombor: jurnal, ta'minotchilar, xaridlar, qoldiq, ko'chirish, inventarizatsiya, to'lovlar

Bu hujjat ombor bo'limi qoidalarini belgilaydi: hujjat va jurnal nima, ta'minotchi nima, xarid qanday kiritiladi va qoldiqqa qanday ta'sir qiladi, qoldiq qanday hisoblanadi, ko'chirish, inventarizatsiya va boshlang'ich qoldiq qanday yoziladi, to'lov va qarz qanday hisoblanadi, kim nima qila oladi, nima qachon o'chadi. Mahsulotlar va xizmatlar: [products.md](products.md). Sotuv va mijoz balansi: [sales.md](sales.md). Valyutalar va kurslar: [currencies.md](currencies.md). Kassa (akkauntlar): [finance.md](finance.md). Lokatsiyalar (har lokatsiya bitta ombor): [locations.md](locations.md). Rollar: [roles.md](roles.md).

> Holat: 2026-10-07 dagi qoidalar amalga oshirilgan; 2026-10-11 da jurnal (transaction uslubi), vaqt, valyuta, akkaunt orqali to'lov, ko'chirish, inventarizatsiya, boshlang'ich qoldiqlar va hisob harakati bilan yangilangan, amalga oshirilmoqda. Qoida o'zgarsa, avval shu hujjat, keyin kod o'zgartiriladi. Dizayn, bosqichlar va amalga oshirishdagi qarorlar: `docs/superpowers/specs/2026-10-11-ledger-design.md` (avvalgisi: `docs/superpowers/specs/2026-10-07-inventory-design.md`).

## 1. Tushunchalar

| Tushuncha | Ma'nosi | Bazada |
|---|---|---|
| **Hujjat** | Jurnaldagi bitta yozuv: turi (xarid, sotuv, ko'chirish, inventarizatsiya, boshlang'ich qoldiq, to'lov, boshlang'ich qarz / avans, kassa hujjatlari), turi ichida raqami, vaqti, lokatsiyasi va / yoki kontragenti va / yoki akkaunti, valyutasi va kursi, jami, izohi, kim qo'shgani. Statusi yo'q: saqlangan zahoti amalda. tw-dobroe `transactions` namunasi. | `transactions` (`kind`, `number`, `doc_at`, `location_id`, `to_location_id`, `supplier_id`, `customer_id`, `bank_account_id`, `to_bank_account_id`, `category_id`, `linked_id`, `currency_id`, `currency_rate_id`, `total`, `to_total`) |
| **Qator** | Hujjatning bitta mahsuloti: miqdori, narxi (xarid, sotuv, boshlang'ich qoldiqda), inventarizatsiyada sanalgan va tizim miqdori. | `transaction_items` |
| **Harakat** | Ombor jurnali qatori: hujjat, lokatsiya, mahsulot, imzoli miqdor (kirim `+`, chiqim `−`). Servis hujjatdan hosil qiladi. | `stock_moves` |
| **Qoldiq** | Mahsulotning lokatsiyadagi miqdori = shu lokatsiya va mahsulot harakatlarining yig'indisi. Alohida saqlanmaydi, so'rovda hisoblanadi. | hisoblanadi (`SUM(stock_moves.quantity)`) |
| **Ta'minotchi** | Kompaniya tovar oladigan tomon: nomi, ixtiyoriy telefoni va izohi. | `suppliers` |
| **Xarid** | Ta'minotchidan bitta lokatsiyaga olingan tovarlar hujjati. | `transactions` (`purchase`) |
| **Ko'chirish** | Bir lokatsiyadan boshqasiga tovar o'tkazish hujjati. | `transactions` (`transfer`) |
| **Inventarizatsiya** | Lokatsiyada sanab chiqish hujjati: har mahsulotda tizim qoldig'i (hujjat lahzasida), sanalgan miqdor va farq; farq qoldiqni to'g'rilaydi. | `transactions` (`inventory`), `transaction_items.expected` |
| **Boshlang'ich qoldiq** | Tizimni boshlaganda lokatsiyada bor tovarlar hujjati (miqdor va narx bilan). | `transactions` (`opening_stock`) |
| **To'lov** | Ta'minotchiga akkauntdan berilgan pul: akkaunt, summa (akkaunt valyutasida), vaqt, izoh. Xarid bilan kiritilgani xaridga bog'langan. | `transactions` (`supplier_payment`, `linked_id`) |
| **Boshlang'ich qarz / avans** | Tizimni boshlaganda ta'minotchiga bo'lgan qarz yoki unga berilgan avans. | `transactions` (`supplier_debt` / `supplier_prepay`) |
| **Balans** | Ta'minotchi bo'yicha qarz, so'mda: xaridlar + boshlang'ich qarz − to'lovlar − boshlang'ich avans (har hujjat o'z kursi bilan). Musbat qarz, manfiy avans. Valyuta bo'yicha tafsilot bilan. | hisoblanadi |
| **Hisob harakati** | Ta'minotchining hamma pul hujjati vaqt bo'yicha, qarz o'zgarishi va qoldiq balans bilan. | hisoblanadi |

Hamma narsa kompaniyaga tegishli; kompaniya so'rovdan emas, access token'dan olinadi. Ta'minotchilar, akkauntlar va balanslar kompaniya bo'yicha umumiy; tovar hujjatlari va qoldiq lokatsiyaniki.

### 1.1 Hujjatlarning umumiy qoidalari

- **Raqam** har kompaniyada har tur bo'yicha 1 dan ketma-ket (`number`, `UNIQUE (company_id, kind, number)`), yozuv paytida beriladi, o'chirilganniki bo'shamaydi, o'zgarmaydi. Sarlavhada: «Xarid № 12», «Ko'chirish № 2», «Inventarizatsiya № 1», «Boshlang'ich qoldiq № 1»; to'lov va boshlang'ich qarz / avans raqami ko'rsatilmaydi.
- **Vaqt** (`at`): sana va vaqt, formada standart hozir, har qanday vaqt (o'tgan ham, kelgusi ham). Bazada UTC, ko'rsatish va kun filtrlari userning timezone'i bilan (standart Asia/Tashkent, +5; [user.md](user.md)). Ro'yxatlar yangi birinchi (`at`, keyin `id`).
- **Valyuta va kurs**: [currencies.md](currencies.md). Qatorlar va jami hujjat valyutasida; so'mdagi qiymat hujjat kurs qatori bilan.
- **Yozuv** bitta tranzaksiyada, kompaniya qulfi ostida (mijoz, buyurtma, katalog yozuvlari bilan bir navbat): raqam, qoldiq va balanslar poygasiz. Hammasi yoziladi yoki hech biri.
- **Tahrir**: raqam va lokatsiya o'zgarmaydi; qatorlar va to'lovlar yuborilganiga butunlay almashadi; harakatlar qayta yoziladi. Ikki kishi bir vaqtda tahrirlasa, oxirgi saqlagan qoladi. Tarix yo'q.
- **O'chirish** yashirish (`deleted_at`): hujjat harakatlari o'chiriladi (qoldiq qaytadi), bog'langan to'lovlari yashirinadi, qatorlari qoladi, raqam bo'shamaydi. Tiklash yo'q.
- **Kim qo'shgani** saqlanadi (mijozlardagi kabi).

## 2. Kim nima qila oladi

| Amal | egasi | rolsiz xodim | rolli xodim |
|---|---|---|---|
| Ta'minotchilar ro'yxati va ta'minotchi sahifasi | ✓ | ✓ | `suppliers.view` |
| Ta'minotchi qo'shish / tahrirlash, nofaol qilish / o'chirish | ✓ | ✓ | `suppliers.create` / `suppliers.edit` / `suppliers.delete` |
| Xaridlar ro'yxati, xarid sahifasi, ta'minotchi balansi, hisob harakati, mahsulot xaridlari | ✓ | ✓ | `purchases.view` |
| Xarid qo'shish | ✓ | ✓ | `purchases.create`; formadagi takliflar uchun `suppliers.view` va `products.view` ham ([roles.md](roles.md), 4.3) |
| Xaridni tahrirlash / o'chirish | ✓ | ✓ | `purchases.edit` / `purchases.delete` |
| Ta'minotchi to'lovi, boshlang'ich qarz / avans qo'shish / tahrirlash / o'chirish | ✓ | ✓ | `purchases.create` / `purchases.edit` / `purchases.delete` |
| Ko'chirishlar, inventarizatsiyalar, boshlang'ich qoldiqlar ro'yxati va sahifasi, mahsulot harakatlari, lokatsiya qoldig'i ro'yxati | ✓ | ✓ | `stock.view` |
| Ko'chirish, inventarizatsiya, boshlang'ich qoldiq qo'shish | ✓ | ✓ | `stock.create`; takliflar uchun `products.view` |
| Ularni tahrirlash / o'chirish | ✓ | ✓ | `stock.edit` / `stock.delete` |

**Ombor** bo'limi (Xaridlar, Ko'chirishlar, Inventarizatsiya, Boshlang'ich qoldiq, Ta'minotchilar tablari) `purchases.view`, `stock.view` yoki `suppliers.view` bo'lganga ko'rinadi va a'zo ko'ra oladigan birinchi tabiga ochiladi. Ruxsati yo'q xodim amalni yuborsa: 403 `forbidden`. Kompaniya tanlanmagan sessiya: 403 `company_required`.

## 3. Ta'minotchi

### 3.1 Maydonlar

| Maydon | Qoida |
|---|---|
| **Nomi** | majburiy, 1–120 belgi, chetidagi bo'shliqlar olib tashlanadi, kompaniyaning jonli ta'minotchilari ichida takrorlanmaydi (katta-kichik harf farqsiz): 409 `name_taken` |
| **Telefon** | ixtiyoriy; `user.NormalizePhone` bilan normallashtiriladi, faqat O'zbekiston raqami (+998 va 9 ta raqam): aks holda 400 «Telefon raqami noto'g'ri»; takrorlanishi mumkin |
| **Izoh** | ixtiyoriy, 500 belgigacha |

### 3.2 Amallar

- Qo'shish `POST /app/suppliers {name, phone?, note?}`; tahrirlash `PUT /app/suppliers/{id}` (yuborilmagan ixtiyoriy maydon bo'shaydi); nofaol qilish / faollashtirish `PATCH /app/suppliers/{id} {is_active}`; o'chirish `DELETE /app/suppliers/{id}`. Kim qo'shgani saqlanadi.
- Tekshiruv tartibi (400): nom («Nomni kiriting», «Nom 120 belgidan oshmasin»), telefon, izoh («Izoh 500 belgidan oshmasin»); keyin takror nom (409). Tahrirda eng avval yozuvning o'zi (404 «Ta'minotchi topilmadi»).
- **Nofaol** ta'minotchi xarid formasining takliflarida chiqmaydi; xaridlarida qoladi (xarid tahrirlanganda ta'minotchi o'zgartirilmasa qayta tekshirilmaydi); balansi ko'rinadi va unga to'lov kiritiladi (qarz yopiladi); nomi band.
- **O'chirish** yashirish (`deleted_at`), nomi bo'shaydi, sahifasi 404. Jonli hujjati (xarid, to'lov, boshlang'ich qarz / avans) bor ta'minotchi o'chirilmaydi: 409 `supplier_in_use` «Bu ta'minotchida N ta hujjat bor». Avval ular o'chiriladi yoki ta'minotchi nofaol qilinadi.

### 3.3 Ro'yxat va sahifa

- `GET /app/suppliers?status=&search=&page=`: nom bo'yicha tartib (harf farqsiz), «Faol» (standart) va «Nofaol» tablari, qidiruv nomda (harfma-harf) va telefonda (qidiruv faqat raqam va telefon belgilaridan iborat bo'lsa), sahifada 20 ta.
- **Ustunlar:** «Ta'minotchi» (nom, ostida telefon; sahifaga havola), «Qarz» (balans so'mda: qarz qizil, avans «Avans N», 0 «—»), «Qo'shgan», «Qo'shilgan». `balance` faqat `purchases.view` bo'lganga, aks holda `null` va ustun chizilmaydi.
- **Sahifa** (`/suppliers/[id]`, `GET /app/suppliers/{id}`): nom (nofaol bo'lsa belgisi), telefon, izoh, qo'shgan, qo'shilgan. `purchases.view` bo'lsa: balans kartasi («Qarz: N so'm» / «Avans: N so'm» / «Qarz yo'q»; valyuta bo'yicha tafsilot: «shu jumladan 100 $, 500 000 so'm»), «Jami xaridlar», «Jami to'lovlar» (so'mda); **«Hisob harakati»** (6-bo'lim); «To'lov qo'shish», «Boshlang'ich qarz / avans». Amallar: «Tahrirlash», «Nofaol qilish» / «Faollashtirish», «O'chirish».

## 4. Xarid

### 4.1 Maydonlar

| Maydon | Majburiy | Qoida |
|---|---|---|
| **Raqam** | beriladi | 1.1-bo'lim |
| **Lokatsiya** | ha | joriy lokatsiya (`location_id`), a'zoga ruxsatli bo'lishi shart; keyin o'zgarmaydi ([locations.md](locations.md), 7-bo'lim) |
| **Ta'minotchi** | ha | kompaniyaning jonli ta'minotchisi; tahrirda almashtirish mumkin (bog'langan to'lovlar ergashadi); yangi tanlangani faol bo'lishi shart |
| **Vaqt** | ha | `at`, 1.1-bo'lim; formada hozir |
| **Valyuta, kurs** | yo'q | [currencies.md](currencies.md), 5-bo'lim; standart UZS |
| **Qatorlar** | kamida bitta | har qatorda mahsulot (`kind = product`, jonli; xaridga yangi qo'shilgani faol bo'lishi shart), miqdor (> 0, 9 xonagacha butun va 3 kasr), narx (≥ 0, 12 xonagacha butun va 2 kasr, hujjat valyutasida); bir mahsulot bir xaridda bir marta |
| **To'lovlar** | yo'q | qatorlar: akkaunt (kompaniyaning faol akkaunti, [finance.md](finance.md)) va summa (> 0, 12 xona butun va 2 kasr, akkaunt valyutasida); har qator xaridga bog'langan to'lov bo'lib yoziladi (6-bo'lim), vaqti xaridniki, kursi akkaunt valyutasi bo'yicha hujjat sanasidagi standart; bir akkaunt bir nechta qatorda bo'lishi mumkin |
| **Izoh** | yo'q | 500 belgigacha |

Jami (`total`) qatorlarning miqdor × narx yig'indisi, bazada hisoblanadi (2 kasr xonasiga); har qatorning summasi ham (`amount`). `paid` = bog'langan to'lovlarning hujjat valyutasiga aylantirilgan yig'indisi (har to'lov o'z kursi bilan). Pul va miqdor JSON'da matn (`"12.500"`, `"150000.50"`); formada vergul ham qabul qilinadi.

### 4.2 Qo'shish

`POST /app/purchases {location_id, supplier_id, at, currency_id?, rate?, items: [{product_id, quantity, price}], payments: [{bank_account_id, amount}], note?}`. Bitta tranzaksiyada: raqam → xarid → qatorlar → jami → har qator mahsulotining shu lokatsiyadagi harakati (`+`) → bog'langan to'lovlar. Hammasi yoziladi yoki hech biri.

Tekshiruv tartibi, birinchi xato qaytadi:

| Holat | Javob |
|---|---|
| lokatsiya berilmagan yoki 0 | 400 «Lokatsiyani tanlang» |
| lokatsiya a'zoga ruxsatsiz (begona, o'chirilgan, cheklov bilan yopilgan) | 403 `forbidden` |
| ta'minotchi yo'q, o'chirilgan yoki begona | 400 «Ta'minotchini tanlang» |
| ta'minotchi nofaol | 400 «Ta'minotchi nofaol» |
| vaqt bo'sh / noto'g'ri | 400 «Vaqtni kiriting» / «Vaqt noto'g'ri» |
| valyuta yoqilmagan / kurs yo'q yoki noto'g'ri | 400 `currency_not_allowed` / «Kursni kiriting» / «Kurs noto'g'ri» |
| izoh uzun | 400 «Izoh 500 belgidan oshmasin» |
| qator yo'q | 400 «Kamida bitta mahsulot qo'shing» |
| qatorda mahsulot yo'q, o'chirilgan yoki begona | 400 «Mahsulotni tanlang» |
| qatorda xizmat | 400 «Xizmat xaridga kiritilmaydi» |
| qatorda nofaol mahsulot (xaridda avvaldan bo'lmagan) | 400 «Mahsulot nofaol» |
| bir mahsulot ikki qatorda | 400 ««X» ikki marta kiritilgan» |
| miqdor bo'sh, 0, manfiy yoki formati noto'g'ri | 400 ««X» miqdori noto'g'ri» |
| narx formati noto'g'ri yoki manfiy | 400 ««X» narxi noto'g'ri» |
| to'lov qatorida akkaunt yo'q, o'chirilgan, begona / nofaol | 400 «Akkauntni tanlang» / «Akkaunt nofaol» |
| to'lov summasi bo'sh, 0, manfiy yoki formati noto'g'ri | 400 «To'lov summasi noto'g'ri» |

Qatorlar o'z tartibida tekshiriladi; «X» mahsulot nomi.

### 4.3 Tahrirlash

`PUT /app/purchases/{id} {supplier_id, at, currency_id?, rate?, items, payments, note?}`. Lokatsiya va raqam o'zgarmaydi. Qatorlar yuborilganiga butunlay almashadi; harakatlar qayta yoziladi; qoldiq manfiy bo'lsa 409 `stock_insufficient` (xarid miqdori kamaytirilgan, lekin tovar sotilgan bo'lsa). Jami qayta hisoblanadi. To'lovlar yuborilganiga butunlay almashadi (eskilari yashirinadi, yangilari yoziladi). Ta'minotchi almashsa bog'langan to'lovlar ham yangi ta'minotchiga o'tadi. Vaqt o'zgarsa kurs qatori qayta tanlanadi (o'z kursli hujjatda qoladi). O'zgarmagan ta'minotchi va xaridda avvaldan bor mahsulotlar / akkauntlar qayta tekshirilmaydi (nofaol bo'lsa ham qoladi); eng avval xaridning o'zi (404 «Xarid topilmadi»), qolgani 4.2 tartibida.

### 4.4 O'chirish

`DELETE /app/purchases/{id}`: 1.1-bo'lim; harakatlar o'chirilganda qoldiq manfiy bo'lsa 409 `stock_insufficient`.

### 4.5 Ro'yxat, sahifa, forma

- `GET /app/purchases?location_id=&supplier_id=&page=`: `location_id` berilsa shu lokatsiya (a'zoga ruxsatsiz → 403 `forbidden`, son emas → 400 «Lokatsiya noto'g'ri»), berilmasa a'zoga ruxsatli hamma lokatsiya; `supplier_id` ta'minotchi uchun. Tartib yangi birinchi (`at`, keyin `id`), sahifada 20 ta.
- **Xaridlar sahifasi** joriy lokatsiya xaridlarini ko'rsatadi; lokatsiya almashsa ro'yxat 1-sahifadan. Lokatsiyasiz a'zo: «Sizga lokatsiya biriktirilmagan», qo'shish tugmasi yo'q. Ustunlar: «Xarid» («№ 12 · Ta'minotchi», ostida vaqt · N ta mahsulot; sahifaga havola), «Jami» (hujjat valyutasida, belgisi bilan), «To'langan», «Qo'shgan».
- **Xarid sahifasi** (`/purchases/[id]`, `GET /app/purchases/{id}`): «Xarid № 12»; ta'minotchi (havola), vaqt, lokatsiya (2+ ruxsatli lokatsiyada), valyuta va kurs (UZS bo'lmasa), jami, to'langan, izoh, qo'shgan, qo'shilgan; qatorlar jadvali (mahsulot, miqdor birligi bilan, narx, summa; jami); to'lovlar ro'yxati (akkaunt, summa). Ruxsatli har lokatsiyadagi xarid ochiladi, joriy lokatsiyani o'zgartirmaydi; ruxsatsiz lokatsiyadagi 404 «Xarid topilmadi».
- **Forma** (`/purchases/new`, `/purchases/[id]/edit`): ta'minotchi (nom bo'yicha qidirib, faqat faollar), vaqt (hozir), valyuta / kurs (kompaniyada 2+ valyuta bo'lsa), qatorlar (mahsulot nom yoki artikul bo'yicha, faqat faollar; tanlanganda narx maydoniga oxirgi xarid narxi: valyutasi mos bo'lsa o'zi, aks holda hujjat kursi bilan aylantirilgan), miqdor, narx, qator summasi, jami; to'lovlar (akkaunt, summa, «To'liq» tugmasi qolgan summani akkaunt valyutasiga aylantiradi; «Qator qo'shish»), izoh. Tahrirda nofaol ta'minotchi, mahsulot va akkaunt tanlangan turadi.

## 5. Qoldiq va ombor jurnali

- **Qoldiq** = lokatsiya va mahsulot bo'yicha harakatlar yig'indisi (`stock_moves`), so'rovda hisoblanadi; alohida jadval yo'q. Harakatlarni hujjatlar yozadi: xarid va boshlang'ich qoldiq `+`; sotuv `−` ([sales.md](sales.md)); ko'chirish manbadan `−`, maqsadga `+`; inventarizatsiya farq (`sanalgan − tizim`, 0 bo'lsa yozilmaydi). Hujjat tahrirlanganda harakatlari qayta yoziladi, o'chirilganda o'chiriladi.
- **Manfiy bo'lmaydi.** Har yozuvdan keyin tegilgan mahsulotlarning lokatsiya qoldig'i tekshiriladi; manfiy bo'lsa 409 `stock_insufficient` ««X» uchun omborda yetarli qoldiq yo'q» va hech narsa yozilmaydi. Faqat joriy qoldiq tekshiriladi: orqa vaqt bilan kiritilgan hujjat oraliq tarixiy qoldiqni tekshirmaydi.
- **Lahzadagi qoldiq**: `at` lahzasigacha bo'lgan hujjatlarning harakatlari yig'indisi (teng vaqtda avval yozilgani oldin); inventarizatsiya shundan foydalanadi. `GET /app/stock?location_id=&at=&exclude_id=` (`stock.view`): lokatsiyada `at` lahzasida qoldig'i 0 dan farqli mahsulotlar (sahifasiz); `exclude_id` berilsa shu hujjatning harakatlari hisobga olinmaydi (tahrirlanayotgan inventarizatsiyaning o'zi).
- Mahsulotlar ro'yxatida «Qoldiq» ustuni joriy lokatsiyaniki, mahsulot sahifasida a'zoga ruxsatli har lokatsiya bo'yicha va **«Harakatlar»** (`GET /app/products/{id}/moves?location_id=&page=`, `stock.view`): mahsulotning harakatlari yangi birinchi, 20 tadan: vaqt, hujjat (tur, №, havola), lokatsiya, kontragent yoki boshqa lokatsiya, ± miqdor ([products.md](products.md), 5 va 6-bo'limlar).

### 5.1 Ko'chirish

- `POST /app/transfers {location_id, to_location_id, at, items: [{product_id, quantity}], note?}`: manba lokatsiya joriy (a'zoga ruxsatli; 400 «Lokatsiyani tanlang» / 403), maqsad kompaniyaning istalgan jonli lokatsiyasi (manbadan boshqa: 400 «Maqsad lokatsiya boshqa bo'lsin»; yo'q / o'chirilgan / begona 400 «Maqsad lokatsiyani tanlang»), vaqt, qatorlar (mahsulot, miqdor; narx yo'q), izoh. Saqlangan zahoti manbadan chiqadi va maqsadga tushadi (status yo'q). Manbada yetmasa 409 `stock_insufficient`.
- Tahrir (`PUT /app/transfers/{id}`): manba va raqam o'zgarmaydi; maqsad, vaqt, qatorlar, izoh almashadi; harakatlar qayta yoziladi (ikkala lokatsiyada tekshiruv). O'chirish: harakatlar o'chiriladi (maqsaddan qaytadi; maqsadda tovar sotilgan bo'lsa 409 `stock_insufficient`).
- Ro'yxat `GET /app/transfers?location_id=&page=`: lokatsiya manba **yoki** maqsad bo'lgan ko'chirishlar (yo'nalish belgisi: «Chiqim» / «Kirim»); `location_id` berilmasa a'zoga ruxsatli lokatsiyalar (manba yoki maqsad ruxsatli). Sahifa: «Ko'chirish № 2»; qayerdan, qayerga, vaqt, qatorlar (mahsulot, miqdor), izoh, qo'shgan. Ko'rish uchun manba yoki maqsad ruxsatli bo'lsa yetarli; tahrir va o'chirish uchun manba ruxsatli bo'lishi shart (aks holda 403 `forbidden`).

### 5.2 Inventarizatsiya

- `POST /app/inventories {location_id, at, items: [{product_id, counted}], note?}`: lokatsiya joriy, vaqt, qatorlar (mahsulot, sanalgan miqdor ≥ 0, 3 kasr; bir mahsulot bir marta), izoh. Server har qator uchun **tizim qoldig'ini** (`expected`) hujjat lahzasidagi qoldiqdan hisoblaydi (shu hujjatsiz), farqni (`difference = counted − expected`) yozadi va farq 0 bo'lmagan qatorlar uchun harakat yozadi (ortiqcha `+`, kam `−`). Farqi 0 qator hujjatda qoladi.
- Forma: mahsulot tanlab qo'shish (qatorda hujjat vaqtidagi tizim qoldig'i `GET /app/stock?location_id=&at=` dan ko'rsatiladi — tahrirda `exclude_id` bilan, hujjatning o'z harakatlarisiz; foydalanuvchi sanalganni kiritadi, farq hisoblanadi) va **«Hammasini qo'shish»** (lokatsiyada qoldig'i 0 dan farqli hamma mahsulot, sanalgan maydoni tizim qoldig'i bilan to'ldirilgan). Vaqt o'zgartirilsa tizim qoldiqlari qayta so'raladi.
- Tahrir: vaqt, qatorlar, izoh almashadi; tizim qoldig'i hujjat lahzasiga qarab **qayta hisoblanadi** (keyin kiritilgan yoki orqa sanali hujjatlar hisobga olinadi), farq va harakatlar qayta yoziladi. O'chirish: harakatlar o'chiriladi.
- Ro'yxat `GET /app/inventories?location_id=&page=`; sahifa: «Inventarizatsiya № 1»; lokatsiya, vaqt, qatorlar (mahsulot, tizim, sanalgan, farq: ortiqcha yashil, kam qizil), izoh, qo'shgan.

### 5.3 Boshlang'ich qoldiq

- `POST /app/opening-stock {location_id, at, currency_id?, rate?, items: [{product_id, quantity, price}], note?}`: xarid kabi (ta'minotchisiz va to'lovsiz): qatorlar mahsulot, miqdor (> 0), narx (≥ 0, hujjat valyutasida). Lokatsiya qoldig'iga `+`. Bir lokatsiyaga bir nechta bo'lishi mumkin. Qatorining narxi oxirgi xarid narxi sifatida ham hisobga olinadi ([products.md](products.md)).
- Tahrir va o'chirish xaridnikidek (manfiy qoldiq 409). Ro'yxat `GET /app/opening-stock?location_id=&page=`; sahifa: «Boshlang'ich qoldiq № 1»; lokatsiya, vaqt, valyuta, jami, qatorlar (mahsulot, miqdor, narx, summa), izoh, qo'shgan.

## 6. To'lov, boshlang'ich qarz / avans, balans, hisob harakati

- **Balans** = jonli xaridlar + boshlang'ich qarz − to'lovlar − boshlang'ich avans, hammasi so'mda, har hujjat o'z kursi bilan ([currencies.md](currencies.md), 5-bo'lim; kurs farqi balansda qoladi). > 0 «Qarz», < 0 «Avans», 0 «Qarz yo'q». Yoniga valyuta bo'yicha tafsilot (shu formula har valyutada, aylantirmasdan). Avans mumkin.
- **To'lov qo'shish** `POST /app/suppliers/{id}/payments {bank_account_id, amount, at, rate?, note?}`: akkaunt (kompaniyaning faol akkaunti: «Akkauntni tanlang», «Akkaunt nofaol»), summa > 0 akkaunt valyutasida («Summani kiriting», «Summa noto'g'ri»), vaqt («Vaqtni kiriting», «Vaqt noto'g'ri»; formada hozir), kurs (akkaunt valyutasi bo'yicha hujjat sanasidagi standart; o'zgartirish mumkin), izoh 500 belgigacha. Kim qo'shgani saqlanadi. Nofaol ta'minotchiga ham kiritiladi. Akkaunt qoldig'idan chiqadi ([finance.md](finance.md)).
- **Tahrirlash / o'chirish** `PUT /app/suppliers/{id}/payments/{paymentId}` / `DELETE …`: faqat o'zi kiritilgan (xaridga bog'lanmagan) to'lov; xarid bilan kiritilgani 409 `payment_linked` «Bu to'lov xarid bilan kiritilgan: xaridni tahrirlang». O'chirish yashirish. Yo'q, o'chirilgan yoki boshqa ta'minotchining to'lovi 404 «To'lov topilmadi».
- **Boshlang'ich qarz / avans** `POST /app/suppliers/{id}/openings {kind: debt|prepay, amount, currency_id?, rate?, at, note?}`, `PUT/DELETE …/openings/{openingId}`: summa > 0 hujjat valyutasida; qarz balansga `+`, avans `−`; bir ta'minotchiga bir nechta bo'lishi mumkin.
- **Hisob harakati** `GET /app/suppliers/{id}/statement?page=`: ta'minotchining xaridlari, to'lovlari, boshlang'ich qarz / avanslari vaqt bo'yicha (`at`, keyin `id`), yangi birinchi, 20 tadan; qatorda vaqt, hujjat (tur, №, havola; bog'langan to'lovda xarid raqami), summa valyutasida, so'mda, qarz o'zgarishi (+ / −), shu hujjatdan keyingi balans (so'mda); o'z to'lovi va boshlang'ich qatorlarida tahrirlash / o'chirish, bog'langan to'lovda yo'q.
- Xarid o'chirilsa uning bog'langan to'lovlari ham yo'qoladi: balans va akkaunt qoldig'i birga o'zgaradi.

## 7. Lokatsiya bilan bog'liqlik

- Xarid, boshlang'ich qoldiq va inventarizatsiya joriy lokatsiyaga tushadi, ko'chirish joriy lokatsiyadan chiqadi; keyin o'zgarmaydi. Ro'yxatlar joriy lokatsiyaniki (ko'chirishda maqsad ham); ta'minotchi va mahsulot sahifalaridagi hujjatlar a'zoga ruxsatli hamma lokatsiyaniki (2+ da lokatsiya belgisi).
- Cheklangan xodim boshqa lokatsiyaning hujjatlarini ko'rmaydi (ro'yxatda yo'q, ID bo'yicha 404) va u yerga hujjat kirita olmaydi (403); maqsadi uning lokatsiyasi bo'lgan ko'chirishni ko'radi, tahrirlay olmaydi; balans esa kompaniya bo'yicha to'liq ko'rinadi.
- Admin jonli hujjati bor lokatsiyani o'chira olmaydi: 409 `location_in_use` «Bu lokatsiyada N ta hujjat bor» (buyurtma tekshiruvidan keyin; ko'chirishda manba yoki maqsad). Hujjatlari o'chirilgan lokatsiya o'chiriladi.
- Ta'minotchilar va akkauntlar lokatsiyaga bog'liq emas.

## 8. Chekka holatlar

| Holat | Natija |
|---|---|
| Xarid o'chirildi, yangisi kiritildi | yangi raqam davom etadi (№ 3 o'chirilgan bo'lsa ham keyingisi № 4) |
| Bir mahsulot ikki narxda olindi | ikki xarid: bir xaridda bir mahsulot bir marta |
| Xarid tahririda qator olib tashlandi, tovar allaqachon sotilgan | 409 `stock_insufficient`, xarid o'zgarmaydi |
| Xarid tahririda ta'minotchi almashtirildi | xarid va bog'langan to'lovlar yangi ta'minotchiga; ikkala balans o'zgaradi |
| To'lovlar yig'indisi jamidan katta | mumkin (avans) |
| To'lov USD akkauntdan, xarid so'mda | to'lov USD'da; `paid` so'mga aylantirilgan; balans so'mda |
| Bog'langan to'lov ta'minotchi sahifasidan o'zgartirilmoqchi | 409 `payment_linked` |
| Hujjati bor ta'minotchi o'chirilmoqchi | 409 `supplier_in_use`; nofaol qilish mumkin |
| Nofaol ta'minotchining xaridi tahrirlanmoqda | ta'minotchi o'zgartirilmasa saqlanadi; boshqasi tanlansa faol bo'lishi shart |
| Nofaol mahsulotli xarid tahrirlanmoqda | avvaldan bor mahsulot qoladi; yangi qo'shilgani faol bo'lishi shart |
| Ko'chirish maqsadi = manba | 400 «Maqsad lokatsiya boshqa bo'lsin» |
| Ko'chirish o'chirilmoqda, maqsadda tovar sotilgan | 409 `stock_insufficient` |
| Inventarizatsiya orqa vaqt bilan | tizim qoldig'i o'sha lahzadagi; farq hozirgi qoldiqqa qo'llanadi |
| Inventarizatsiyadan keyin orqa sanali xarid kiritildi | inventarizatsiya o'zgarmaydi; tahrirlansa tizim qoldig'i qayta hisoblanadi va farq o'zgaradi |
| Inventarizatsiyada farq 0 | qator saqlanadi, harakat yozilmaydi |
| Joriy lokatsiya o'chirildi yoki cheklov bilan yopildi | ro'yxat 403 `forbidden` → `/app/me` qayta → ruxsatli birinchisi |
| Lokatsiyasiz a'zo | ro'yxatlar bo'sh, qo'shish 400, har hujjat 404 |
| Boshqa kompaniyaning ta'minotchisi, hujjati, to'lovi ID bo'yicha | 404 `not_found` |
| Ikki kishi bir vaqtda hujjat kiritdi | navbat bilan yoziladi, raqamlar ketma-ket, qoldiq to'g'ri |
| Egasi hamma ta'minotchini nofaol qildi | xarid formasida taklif yo'q; forma buni aytadi |
| Kompaniyada faqat UZS | formalarda valyuta va kurs maydonlari yo'q, to'lov akkaunti «Naqd» |

## 9. Xato kodlari

| Kod | Status | Xabar |
|---|---|---|
| `validation_error` | 400 | 3.2, 4.2, 5 va 6-bo'lim xabarlari; ro'yxatda «Sahifa raqami noto'g'ri», «Lokatsiya noto'g'ri», «Ta'minotchi noto'g'ri», «Holat noto'g'ri», «Vaqt noto'g'ri» |
| `currency_not_allowed` | 400 | «Bu valyuta kompaniyada yoqilmagan» |
| `company_required` | 403 | «Avval kompaniyani tanlang» |
| `forbidden` | 403 | «Bu amal uchun ruxsatingiz yo'q» (ruxsat yetmaganda; a'zoga ruxsatsiz `location_id` da ham; ko'chirishni manbasiz tahrirlashda) |
| `not_found` | 404 | «Ta'minotchi topilmadi», «Xarid topilmadi», «Ko'chirish topilmadi», «Inventarizatsiya topilmadi», «Hujjat topilmadi», «To'lov topilmadi» |
| `name_taken` | 409 | «Bu nomli ta'minotchi allaqachon bor» |
| `supplier_in_use` | 409 | «Bu ta'minotchida N ta hujjat bor» |
| `payment_linked` | 409 | «Bu to'lov xarid bilan kiritilgan: xaridni tahrirlang» |
| `stock_insufficient` | 409 | ««X» uchun omborda yetarli qoldiq yo'q» |
| `location_in_use` | 409 | «Bu lokatsiyada N ta hujjat bor» (admin panel) |
