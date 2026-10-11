# Sotuv: sotuv hujjati, mijoz to'lovi, mijoz balansi

Bu hujjat sotuv bo'limi qoidalarini belgilaydi: sotuv qanday kiritiladi va qoldiqqa qanday ta'sir qiladi, mijoz to'lovi va balansi qanday hisoblanadi, boshlang'ich qarz / avans, kim nima qila oladi, nima qachon o'chadi. Hujjatlar umumiy qoidasi, jurnal va xarid: [warehouse.md](warehouse.md). Mijozlar: [customers.md](customers.md). Valyutalar: [currencies.md](currencies.md). Kassa: [finance.md](finance.md). Rollar: [roles.md](roles.md).

> Holat: kelishilgan (2026-10-11), amalga oshirilmoqda. Qoida o'zgarsa, avval shu hujjat, keyin kod o'zgartiriladi. Dizayn, bosqichlar va amalga oshirishdagi qarorlar: `docs/superpowers/specs/2026-10-11-ledger-design.md`.

## 1. Tushunchalar

| Tushuncha | Ma'nosi | Bazada |
|---|---|---|
| **Sotuv** | Bitta lokatsiyadan (ombordan) mijozga (yoki mijozsiz, chakana) berilgan tovar va xizmatlar hujjati: raqami, vaqti, valyutasi, qatorlari, jami, to'lovlari. Statusi yo'q: saqlangan zahoti qoldiqdan chiqadi. | `transactions` (`sale`), `transaction_items`, `stock_moves` |
| **Mijoz to'lovi** | Mijozdan akkauntga kelgan pul. Sotuv bilan kiritilgani sotuvga bog'langan. | `transactions` (`customer_payment`, `linked_id`) |
| **Boshlang'ich qarz / avans** | Tizimni boshlaganda mijozning qarzi (bizga qarzdor) yoki avansi (oldindan to'lagan). | `transactions` (`customer_debt` / `customer_prepay`) |
| **Mijoz balansi** | So'mda: sotuvlar + boshlang'ich qarz − to'lovlar − boshlang'ich avans. > 0 Qarz (mijoz bizga qarzdor), < 0 Avans, 0 «Qarz yo'q». Valyuta bo'yicha tafsilot bilan. | hisoblanadi |
| **Hisob harakati** | Mijozning hamma pul hujjati vaqt bo'yicha, qarz o'zgarishi va qoldiq balans bilan. | hisoblanadi |

Sotuv va qoldiq lokatsiyaniki; mijoz, to'lov va balans kompaniya bo'yicha.

## 2. Kim nima qila oladi

| Amal | egasi | rolsiz xodim | rolli xodim |
|---|---|---|---|
| Sotuvlar ro'yxati, sotuv sahifasi, mijoz balansi va hisob harakati, mijozlar ro'yxatidagi «Qarz» ustuni | ✓ | ✓ | `sales.view` |
| Sotuv qo'shish | ✓ | ✓ | `sales.create`; formadagi takliflar uchun `products.view` va `customers.view` ham ([roles.md](roles.md), 4.3) |
| Sotuvni tahrirlash / o'chirish | ✓ | ✓ | `sales.edit` / `sales.delete` |
| Mijoz to'lovi, boshlang'ich qarz / avans qo'shish / tahrirlash / o'chirish | ✓ | ✓ | `sales.create` / `sales.edit` / `sales.delete` |

**Sotuv** bo'limi `sales.view` bo'lganga ko'rinadi. Ruxsati yo'q xodim amalni yuborsa: 403 `forbidden`. Kompaniya tanlanmagan sessiya: 403 `company_required`.

## 3. Sotuv

### 3.1 Maydonlar

| Maydon | Majburiy | Qoida |
|---|---|---|
| **Raqam** | beriladi | kompaniyaning sotuvlari ichida 1 dan (`number`), o'chirilganniki bo'shamaydi; o'zgarmaydi |
| **Lokatsiya** | ha | joriy lokatsiya (`location_id`), a'zoga ruxsatli bo'lishi shart; keyin o'zgarmaydi |
| **Mijoz** | yo'q | kompaniyaning jonli mijozi (`customer_id`); tanlanmasa chakana sotuv; tahrirda almashtirish yoki olib tashlash mumkin (bog'langan to'lovlar ergashadi) |
| **Vaqt** | ha | `at`, formada hozir; har qanday vaqt |
| **Valyuta, kurs** | yo'q | [currencies.md](currencies.md), 5-bo'lim; standart UZS |
| **Qatorlar** | kamida bitta | mahsulot **yoki xizmat** (jonli; yangi qo'shilgani faol), miqdor (> 0, 3 kasr), narx (≥ 0, 2 kasr, hujjat valyutasida); bir mahsulot bir sotuvda bir marta |
| **To'lovlar** | yo'q | qatorlar: akkaunt (faol) va summa (> 0, akkaunt valyutasida); har qator sotuvga bog'langan mijoz to'lovi bo'lib yoziladi, vaqti sotuvniki; mijozsiz sotuvda yig'indisi (hujjat valyutasiga aylantirilgan) jamiga teng bo'lishi shart |
| **Izoh** | yo'q | 500 belgigacha |

Jami (`total`) qatorlarning miqdor × narx yig'indisi, bazada hisoblanadi. `paid` = bog'langan to'lovlarning hujjat valyutasiga aylantirilgan yig'indisi. Formada mahsulot tanlanganda narx taklifi: mahsulotning sotuv narxi (`products.price`), valyutasi mos bo'lsa o'zi, aks holda hujjat kursi bilan aylantirilgan; xizmatda xizmat narxi.

### 3.2 Qo'shish

`POST /app/sales {location_id, customer_id?, at, currency_id?, rate?, items: [{product_id, quantity, price}], payments: [{bank_account_id, amount}], note?}`. Bitta tranzaksiyada: raqam → sotuv → qatorlar → jami → mahsulot qatorlari lokatsiya qoldig'idan chiqadi (harakatlar `−`; xizmat harakat yozmaydi) → qoldiq tekshiruvi → to'lovlar. Hammasi yoziladi yoki hech biri.

Tekshiruv tartibi (400, birinchi xato): lokatsiya («Lokatsiyani tanlang»; ruxsatsiz 403) → mijoz (yo'q / o'chirilgan / begona «Mijozni tanlang») → vaqt → valyuta va kurs → izoh → qatorlar («Kamida bitta mahsulot qo'shing»; «Mahsulotni tanlang», «Mahsulot nofaol», ««X» ikki marta kiritilgan», ««X» miqdori noto'g'ri», ««X» narxi noto'g'ri») → to'lovlar («Akkauntni tanlang», «Akkaunt nofaol», «Summa noto'g'ri»; mijozsiz «Mijozsiz sotuv to'liq to'langan bo'lsin»). Keyin qoldiq: 409 `stock_insufficient` ««X» uchun omborda yetarli qoldiq yo'q».

### 3.3 Tahrirlash va o'chirish

- `PUT /app/sales/{id}`: lokatsiya va raqam o'zgarmaydi; qatorlar va to'lovlar yuborilganiga butunlay almashadi (harakatlar qayta yoziladi, qoldiq tekshiriladi; bog'langan to'lovlar qayta yoziladi). Mijoz almashsa bog'langan to'lovlar yangi mijozga o'tadi; mijoz olib tashlansa to'liq to'langan bo'lishi shart. Vaqt o'zgarsa kurs qatori qayta tanlanadi. Avvaldan bor nofaol mahsulot / akkaunt qoladi. Eng avval sotuvning o'zi (404 «Sotuv topilmadi»).
- `DELETE /app/sales/{id}`: sotuv yashiriladi, harakatlari o'chiriladi (qoldiq qaytadi), bog'langan to'lovlari yashirinadi, raqam bo'shamaydi. Tiklash yo'q.

### 3.4 Ro'yxat, sahifa, forma

- `GET /app/sales?location_id=&customer_id=&page=`: `location_id` berilsa shu lokatsiya (ruxsatsiz 403), berilmasa a'zoga ruxsatli hamma lokatsiya; `customer_id` mijoz sahifasi uchun. Yangi birinchi (`at`, keyin `id`), 20 tadan.
- **Sotuvlar sahifasi** (`/sales`) joriy lokatsiyaniki; lokatsiyasiz a'zo «Sizga lokatsiya biriktirilmagan». Ustunlar: «Sotuv» («№ 3 · Mijoz nomi» yoki «№ 3 · Chakana», ostida vaqt · N ta mahsulot; havola), «Jami», «To'langan», «Qo'shgan».
- **Sotuv sahifasi** (`/sales/[id]`): «Sotuv № 3»; mijoz (havola; chakanada «Chakana»), vaqt, lokatsiya (2+ ruxsatlida), valyuta va kurs (UZS bo'lmasa), jami, to'langan, izoh, qo'shgan, qo'shilgan; qatorlar jadvali (mahsulot / xizmat, miqdor, narx, summa; jami); to'lovlar ro'yxati (akkaunt, summa). Ruxsatsiz lokatsiyadagi 404 «Sotuv topilmadi».
- **Forma** (`/sales/new`, `/sales/[id]/edit`): mijoz (`CustomerPicker`, ixtiyoriy, «Chakana sotuv» holati), vaqt, valyuta / kurs (2+ valyutada), qatorlar (mahsulot va xizmat nom yoki artikul bo'yicha, faqat faollar; narx taklifi), miqdor, narx, summa, jami; to'lovlar (akkaunt, summa, «To'liq» qolgan summani akkaunt valyutasiga aylantiradi; mijozsiz to'liq to'lov talab qilinadi va forma buni aytadi); izoh.

## 4. Qoldiq

Sotuv lokatsiya qoldig'ini kamaytiradi: saqlashda, tahrirda farq bilan, o'chirishda qaytadi ([warehouse.md](warehouse.md), 5-bo'lim). Xizmat qoldiqqa tegmaydi. Qoldiq manfiy bo'lmaydi: 409 `stock_insufficient` (mahsulot nomi bilan). Faqat joriy qoldiq tekshiriladi.

## 5. Mijoz to'lovi, boshlang'ich qarz / avans, balans

- **Balans** = jonli sotuvlar (mijozli) + boshlang'ich qarz − to'lovlar − boshlang'ich avans, hammasi so'mda har hujjat o'z kursi bilan ([currencies.md](currencies.md), 5-bo'lim). Yoniga valyuta bo'yicha tafsilot. Avans mumkin.
- **To'lov qo'shish** `POST /app/customers/{id}/payments {bank_account_id, amount, at, rate?, note?}`: akkaunt faol, summa > 0 akkaunt valyutasida, vaqt, izoh 500. Tahrirlash / o'chirish `PUT/DELETE …/payments/{paymentId}`: faqat o'zi kiritilgan (sotuvga bog'lanmagan); bog'langani 409 `payment_linked` «Bu to'lov sotuv bilan kiritilgan: sotuvni tahrirlang». Yo'q / o'chirilgan / boshqa mijozniki 404 «To'lov topilmadi».
- **Boshlang'ich qarz / avans** `POST /app/customers/{id}/openings {kind: debt|prepay, amount, currency_id?, rate?, at, note?}`, `PUT/DELETE …/openings/{openingId}`: summa > 0 hujjat valyutasida; bir mijozga bir nechta bo'lishi mumkin.
- **Hisob harakati** `GET /app/customers/{id}/statement?page=`: mijozning sotuvlari, to'lovlari, boshlang'ich qarz / avanslari vaqt bo'yicha, yangi birinchi, 20 tadan; qatorda vaqt, hujjat (tur, №, havola), summa valyutasida, so'mda, qarz o'zgarishi (+ / −), shu hujjatdan keyingi balans; o'z to'lovi va boshlang'ich qatorlarida tahrirlash / o'chirish.
- Mijoz sahifasida (`sales.view` bo'lganga): balans kartasi («Qarz: N so'm» / «Avans: N so'm» / «Qarz yo'q», valyuta bo'yicha tafsilot), «Hisob harakati», «To'lov qo'shish», «Boshlang'ich qarz / avans». Mijozlar ro'yxatida «Qarz» ustuni (`Customer.balance`, `sales.view` siz `null` va ustun chizilmaydi).
- Chakana sotuvning to'lovlari mijozsiz: akkauntga tushadi, hech kimning balansiga tegmaydi, mijoz sahifalarida ko'rinmaydi.

## 6. Lokatsiya bilan bog'liqlik

- Sotuv joriy lokatsiyaga, keyin o'zgarmaydi; ro'yxat joriy lokatsiyaniki; mijoz sahifasidagi sotuvlar a'zoga ruxsatli hamma lokatsiyaniki (2+ da lokatsiya belgisi).
- Cheklangan xodim boshqa lokatsiyaning sotuvini ko'rmaydi (ro'yxatda yo'q, ID bo'yicha 404) va u yerga sotuv kirita olmaydi (403); mijoz balansi kompaniya bo'yicha to'liq ko'rinadi.
- Admin jonli hujjati bor lokatsiyani o'chira olmaydi ([locations.md](locations.md), 3-bo'lim).

## 7. O'chirish qoidalari

- Jonli sotuvi, to'lovi yoki boshlang'ich qarz / avansi bor mijoz o'chirilmaydi: 409 `customer_in_use` «Bu mijozda N ta hujjat bor» (vazifa tekshiruvidan keyin; [customers.md](customers.md), 5-bo'lim).
- Jonli sotuv qatorida bor mahsulot yoki xizmat o'chirilmaydi: 409 `product_in_use` «Bu mahsulot N ta hujjatda bor» ([products.md](products.md)).

## 8. Chekka holatlar

| Holat | Natija |
|---|---|
| Mijozsiz sotuvda to'lov yig'indisi jamidan kam yoki ko'p | 400 «Mijozsiz sotuv to'liq to'langan bo'lsin» |
| Mijozli sotuvda to'lov jamidan ko'p | mumkin: mijoz avansi |
| To'lov USD akkauntdan, sotuv so'mda | to'lov USD'da (kursi hujjat sanasidagi); `paid` so'mga aylantirilgan; balans so'mda |
| Ikki qatorda bir mahsulot | 400 ««X» ikki marta kiritilgan» |
| Qoldiq yetmaydi (bitta qatorda ham) | 409 `stock_insufficient`, hech narsa yozilmaydi |
| Sotuv tahririda miqdor oshirildi, qoldiq yetmaydi | 409, hujjat o'zgarmaydi |
| Sotuv o'chirildi | qoldiq qaytadi, to'lovlari yo'qoladi, mijoz balansi ikkalasi bilan o'zgaradi |
| Mijoz tahrirda olib tashlandi, to'lovlar jamidan kam | 400: to'liq to'langan bo'lsin |
| Nofaol mahsulot / xizmat sotuvda avvaldan bor | tahrirda qoladi; yangi qo'shilgani faol bo'lishi shart |
| Sotuv bilan kiritilgan to'lov mijoz sahifasidan o'zgartirilmoqchi | 409 `payment_linked` |
| Ikki kishi bir vaqtda sotuv kiritdi | navbat bilan, raqamlar ketma-ket, qoldiq to'g'ri |
| Boshqa kompaniyaning sotuvi, to'lovi | 404 `not_found` |

## 9. Xato kodlari

| Kod | Status | Xabar |
|---|---|---|
| `validation_error` | 400 | 3.2 va 5-bo'lim xabarlari; ro'yxatda «Sahifa raqami noto'g'ri», «Lokatsiya noto'g'ri», «Mijoz noto'g'ri» |
| `currency_not_allowed` | 400 | «Bu valyuta kompaniyada yoqilmagan» |
| `company_required` | 403 | «Avval kompaniyani tanlang» |
| `forbidden` | 403 | «Bu amal uchun ruxsatingiz yo'q» |
| `not_found` | 404 | «Sotuv topilmadi», «To'lov topilmadi», «Mijoz topilmadi» |
| `payment_linked` | 409 | «Bu to'lov sotuv bilan kiritilgan: sotuvni tahrirlang» |
| `stock_insufficient` | 409 | ««X» uchun omborda yetarli qoldiq yo'q» |
| `customer_in_use` | 409 | «Bu mijozda N ta hujjat bor» |
