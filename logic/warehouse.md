# Ombor: ta'minotchilar, xaridlar, qoldiq, to'lovlar

Bu hujjat ombor bo'limi qoidalarini belgilaydi: ta'minotchi nima, xarid qanday kiritiladi va qoldiqqa qanday ta'sir qiladi, to'lov va qarz qanday hisoblanadi, kim nima qila oladi, nima qachon o'chadi. Mahsulotlar va xizmatlar: [products.md](products.md). Lokatsiyalar (har lokatsiya bitta ombor): [locations.md](locations.md). Rollar: [roles.md](roles.md).

> Holat: kelishilgan (2026-10-07), amalga oshirilmoqda. Qoida o'zgarsa, avval shu hujjat, keyin kod o'zgartiriladi. Dizayn, bosqichlar va amalga oshirishdagi qarorlar: `docs/superpowers/specs/2026-10-07-inventory-design.md`.

## 1. Tushunchalar

| Tushuncha | Ma'nosi | Bazada |
|---|---|---|
| **Ta'minotchi** | Kompaniya tovar oladigan tomon: nomi, ixtiyoriy telefoni va izohi. | `suppliers` |
| **Xarid** | Ta'minotchidan bitta lokatsiyaga (omborga) olingan tovarlar hujjati: raqami, sanasi, qatorlari, jami summasi. Statusi yo'q: saqlangan zahoti qoldiqqa tushadi. | `purchases`, `purchase_items` |
| **Qator** | Xaridning bitta mahsuloti: miqdori va narxi. | `purchase_items` |
| **Qoldiq** | Mahsulotning lokatsiyadagi miqdori. Har lokatsiya bitta ombor. | `stock` |
| **To'lov** | Ta'minotchiga berilgan pul: summasi, sanasi, izohi. Xarid bilan kiritilgani xaridga bog'langan. | `supplier_payments` |
| **Balans** | Ta'minotchi bo'yicha qarz: jonli xaridlar jami − jonli to'lovlar jami. Musbat qarz, manfiy avans. | hisoblanadi |

Hamma narsa kompaniyaga tegishli; kompaniya so'rovdan emas, access token'dan olinadi. Ta'minotchilar kompaniya bo'yicha umumiy; xarid va qoldiq lokatsiyaniki; balans kompaniya bo'yicha (hamma lokatsiya).

## 2. Kim nima qila oladi

| Amal | egasi | rolsiz xodim | rolli xodim |
|---|---|---|---|
| Ta'minotchilar ro'yxati va ta'minotchi sahifasi | ✓ | ✓ | `suppliers.view` |
| Ta'minotchi qo'shish / tahrirlash, nofaol qilish / o'chirish | ✓ | ✓ | `suppliers.create` / `suppliers.edit` / `suppliers.delete` |
| Xaridlar ro'yxati, xarid sahifasi, ta'minotchi balansi va to'lovlari, mahsulot xaridlari | ✓ | ✓ | `purchases.view` |
| Xarid qo'shish | ✓ | ✓ | `purchases.create`; formadagi takliflar uchun `suppliers.view` va `products.view` ham ([roles.md](roles.md), 4.3) |
| Xaridni tahrirlash / o'chirish | ✓ | ✓ | `purchases.edit` / `purchases.delete` |
| To'lov qo'shish / tahrirlash / o'chirish | ✓ | ✓ | `purchases.create` / `purchases.edit` / `purchases.delete` |

**Ombor** bo'limi (Xaridlar va Ta'minotchilar tablari) `purchases.view` yoki `suppliers.view` bo'lganga ko'rinadi va a'zo ko'ra oladigan birinchi tabiga ochiladi. Ruxsati yo'q xodim amalni yuborsa: 403 `forbidden`. Kompaniya tanlanmagan sessiya: 403 `company_required`.

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
- **O'chirish** yashirish (`deleted_at`), nomi bo'shaydi, sahifasi 404. Jonli xaridi bor ta'minotchi o'chirilmaydi: 409 `supplier_in_use` «Bu ta'minotchida N ta xarid bor»; xaridi yo'q, lekin jonli to'lovi bor bo'lsa «Bu ta'minotchida N ta to'lov bor». Avval ular o'chiriladi yoki ta'minotchi nofaol qilinadi.

### 3.3 Ro'yxat va sahifa

- `GET /app/suppliers?status=&search=&page=`: nom bo'yicha tartib (harf farqsiz), «Faol» (standart) va «Nofaol» tablari, qidiruv nomda (harfma-harf) va telefonda (qidiruv faqat raqam va telefon belgilaridan iborat bo'lsa, mijozlardagi kabi), sahifada 20 ta.
- **Ustunlar:** «Ta'minotchi» (nom, ostida telefon; sahifaga havola), «Qarz» (balans: qarz qizil, avans «Avans N», 0 «—»), «Qo'shgan», «Qo'shilgan». `balance` faqat `purchases.view` bo'lganga, aks holda `null` va ustun chizilmaydi.
- **Sahifa** (`/suppliers/[id]`, `GET /app/suppliers/{id}`): nom (nofaol bo'lsa belgisi), telefon, izoh, qo'shgan, qo'shilgan. `purchases.view` bo'lsa: balans kartasi («Qarz: N so'm» / «Avans: N so'm» / «Qarz yo'q»), «Jami xaridlar», «Jami to'lovlar»; «Xaridlar» (a'zoga ruxsatli lokatsiyalardagi, yangi birinchi, 20 tadan; 2+ ruxsatli lokatsiyada lokatsiya belgisi); «To'lovlar» (6-bo'lim) va «To'lov qo'shish». Amallar: «Tahrirlash», «Nofaol qilish» / «Faollashtirish», «O'chirish».

## 4. Xarid

### 4.1 Doimiy maydonlar

| Maydon | Majburiy | Qoida |
|---|---|---|
| **Raqam** | beriladi | kompaniya ichida 1 dan ketma-ket (`number`), yozuv paytida beriladi, o'chirilgan xaridniki bo'shamaydi; o'zgarmaydi |
| **Lokatsiya** | ha | joriy lokatsiya (`location_id`), a'zoga ruxsatli bo'lishi shart; keyin o'zgarmaydi ([locations.md](locations.md), 7-bo'lim) |
| **Ta'minotchi** | ha | kompaniyaning jonli ta'minotchisi; tahrirda almashtirish mumkin (bog'langan to'lov ergashadi); yangi tanlangani faol bo'lishi shart |
| **Sana** | ha | `YYYY-MM-DD`, har qanday sana (o'tgan ham, kelgusi ham); formada bugun |
| **Qatorlar** | kamida bitta | har qatorda mahsulot (`kind = product`, jonli; xaridga yangi qo'shilgani faol bo'lishi shart), miqdor (> 0, 9 xonagacha butun va 3 kasr), narx (≥ 0, 12 xonagacha butun va 2 kasr); bir mahsulot bir xaridda bir marta |
| **To'langan** | yo'q | ≥ 0, 12 xona butun va 2 kasr; standart 0; > 0 bo'lsa xaridga bog'langan to'lov (6-bo'lim) |
| **Izoh** | yo'q | 500 belgigacha |

Jami (`total`) qatorlarning miqdor × narx yig'indisi, bazada hisoblanadi (2 kasr xonasiga); har qatorning summasi ham (`amount`). Pul va miqdor JSON'da matn (`"12.500"`, `"150000.50"`); formada vergul ham qabul qilinadi.

### 4.2 Qo'shish

`POST /app/purchases {location_id, supplier_id, purchased_on, items: [{product_id, quantity, price}], paid?, note?}`. Bitta tranzaksiyada: raqam → xarid → qatorlar → jami → har qator mahsulotining shu lokatsiyadagi qoldig'i miqdorga oshadi → to'langan > 0 bo'lsa bog'langan to'lov. Kim qo'shgani saqlanadi. Hammasi yoziladi yoki hech biri.

Tekshiruv tartibi, birinchi xato qaytadi:

| Holat | Javob |
|---|---|
| lokatsiya berilmagan yoki 0 | 400 «Lokatsiyani tanlang» |
| lokatsiya a'zoga ruxsatsiz (begona, o'chirilgan, cheklov bilan yopilgan) | 403 `forbidden` |
| ta'minotchi yo'q, o'chirilgan yoki begona | 400 «Ta'minotchini tanlang» |
| ta'minotchi nofaol | 400 «Ta'minotchi nofaol» |
| sana bo'sh / noto'g'ri | 400 «Sanani kiriting» / «Sana noto'g'ri» |
| izoh uzun | 400 «Izoh 500 belgidan oshmasin» |
| qator yo'q | 400 «Kamida bitta mahsulot qo'shing» |
| qatorda mahsulot yo'q, o'chirilgan yoki begona | 400 «Mahsulotni tanlang» |
| qatorda xizmat | 400 «Xizmat xaridga kiritilmaydi» |
| qatorda nofaol mahsulot (xaridda avvaldan bo'lmagan) | 400 «Mahsulot nofaol» |
| bir mahsulot ikki qatorda | 400 ««X» ikki marta kiritilgan» |
| miqdor bo'sh, 0, manfiy yoki formati noto'g'ri | 400 ««X» miqdori noto'g'ri» |
| narx formati noto'g'ri yoki manfiy | 400 ««X» narxi noto'g'ri» |
| to'langan formati noto'g'ri yoki manfiy | 400 «To'langan summa noto'g'ri» |

Qatorlar o'z tartibida tekshiriladi; «X» mahsulot nomi.

### 4.3 Tahrirlash

`PUT /app/purchases/{id} {supplier_id, purchased_on, items, paid?, note?}`. Lokatsiya va raqam o'zgarmaydi. Qatorlar yuborilganiga butunlay almashadi; qoldiq har mahsulot uchun farq bilan yangilanadi: olib tashlangan qatorning miqdori qaytib olinadi, yangisi qo'shiladi, o'zgargani farqi bilan. Farq qoldiqni manfiy qilsa 409 `stock_insufficient` «Omborda yetarli qoldiq yo'q» (hozir faqat xarid bor, bu holat kelajakdagi sotuv uchun). Jami qayta hisoblanadi. To'langan: bog'langan to'lov summasi o'zgaradi; 0 bo'lsa to'lov yashirinadi; avval bo'lmagan bo'lsa yangisi yoziladi (sanasi xarid sanasi). Ta'minotchi almashsa bog'langan to'lov ham yangi ta'minotchiga o'tadi. O'zgarmagan ta'minotchi va xaridda avvaldan bor mahsulotlar qayta tekshirilmaydi (nofaol bo'lsa ham qoladi); eng avval xaridning o'zi (404 «Xarid topilmadi»), qolgani 4.2 tartibida. Hech narsa o'zgarmagan saqlash hech narsani yozmaydi. Ikki kishi bir vaqtda tahrirlasa, oxirgi saqlagan qoladi.

### 4.4 O'chirish

`DELETE /app/purchases/{id}`: xarid yashiriladi (`deleted_at`), qatorlari miqdori shu lokatsiya qoldig'idan olib tashlanadi (yetmasa 409 `stock_insufficient`), bog'langan to'lov yashiriladi, raqam bo'shamaydi. Tiklash yo'q.

### 4.5 Ro'yxat, sahifa, forma

- `GET /app/purchases?location_id=&supplier_id=&page=`: `location_id` berilsa shu lokatsiya (a'zoga ruxsatsiz → 403 `forbidden`, son emas → 400 «Lokatsiya noto'g'ri»), berilmasa a'zoga ruxsatli hamma lokatsiya; `supplier_id` ta'minotchi sahifasi uchun (son emas → 400 «Ta'minotchi noto'g'ri»). Tartib sana bo'yicha yangi birinchi (`purchased_on`, keyin `id`), sahifada 20 ta. Boshqa filtr yo'q.
- **Xaridlar sahifasi** joriy lokatsiya xaridlarini ko'rsatadi (vazifalar kabi); lokatsiya almashsa ro'yxat 1-sahifadan. Lokatsiyasiz a'zo: «Sizga lokatsiya biriktirilmagan», qo'shish tugmasi yo'q. Ustunlar: «Xarid» («№ 12 · Ta'minotchi», ostida sana · N ta mahsulot; sahifaga havola), «Jami», «To'langan», «Qo'shgan».
- **Xarid sahifasi** (`/purchases/[id]`, `GET /app/purchases/{id}`): «Xarid № 12»; ta'minotchi (havola), sana, lokatsiya (2+ ruxsatli lokatsiyada), jami, to'langan, izoh, qo'shgan, qo'shilgan; qatorlar jadvali (mahsulot, miqdor birligi bilan, narx, summa; jami). Ruxsatli har lokatsiyadagi xarid ochiladi (havola orqali ham), joriy lokatsiyani o'zgartirmaydi; ruxsatsiz lokatsiyadagi 404 «Xarid topilmadi».
- **Forma** (`/purchases/new`, `/purchases/[id]/edit`): ta'minotchi (nom bo'yicha qidirib tanlanadi, faqat faollar), sana, qatorlar (mahsulot nom yoki artikul bo'yicha qidirib tanlanadi, faqat faol mahsulotlar; tanlanganda narx maydoniga oxirgi xarid narxi tushadi), miqdor, narx, qator summasi, jami, to'langan («To'liq» tugmasi jamini tushiradi), izoh. Tahrirda nofaol ta'minotchi va mahsulotlar tanlangan turadi.

## 5. Qoldiq

- Har mahsulotning har lokatsiyada o'z qoldig'i (`stock`); faqat xaridlar bilan o'zgaradi: qo'shishda oshadi, tahrirda farq bilan, o'chirishda kamayadi. Manfiy bo'lmaydi (409 `stock_insufficient`).
- Mahsulotlar ro'yxatida «Qoldiq» ustuni joriy lokatsiyaniki, mahsulot sahifasida a'zoga ruxsatli har lokatsiya bo'yicha ([products.md](products.md), 5 va 6-bo'limlar).
- Qo'lda tuzatish, lokatsiyalar orasida ko'chirish va sotuv yo'q (hozircha).

## 6. To'lov va balans

- **Balans** = jonli xaridlar `total` yig'indisi − jonli to'lovlar `amount` yig'indisi (hamma lokatsiya, kompaniya bo'yicha). > 0 «Qarz», < 0 «Avans», 0 «Qarz yo'q». Avans mumkin: to'lov qarzdan oshishi mumkin.
- **To'lov qo'shish** `POST /app/suppliers/{id}/payments {amount, paid_on, note?}`: summa > 0 (bo'sh «Summani kiriting», formati noto'g'ri yoki 0 «Summa noto'g'ri»; 12 xona butun va 2 kasr), sana («Sanani kiriting», «Sana noto'g'ri»; formada bugun), izoh 500 belgigacha. Kim qo'shgani saqlanadi. Nofaol ta'minotchiga ham kiritiladi.
- **Tahrirlash / o'chirish** `PUT /app/suppliers/{id}/payments/{paymentId}` / `DELETE …`: faqat o'zi kiritilgan (xaridga bog'lanmagan) to'lov; xarid bilan kiritilgani 409 `payment_linked` «Bu to'lov xarid bilan kiritilgan: xaridni tahrirlang». O'chirish yashirish. Yo'q, o'chirilgan yoki boshqa ta'minotchining to'lovi 404 «To'lov topilmadi».
- **Ro'yxat** `GET /app/suppliers/{id}/payments?page=`: sana bo'yicha yangi birinchi (`paid_on`, keyin `id`), 20 tadan; har to'lovda summa, sana, izoh, qo'shgan, bog'langan bo'lsa xarid raqami va havolasi (o'z to'lovida tahrirlash va o'chirish tugmalari, bog'langanida yo'q).
- Xarid o'chirilsa uning bog'langan to'lovi ham yo'qoladi: balans ikkalasi bilan birga o'zgaradi.

## 7. Lokatsiya bilan bog'liqlik

- Xarid joriy lokatsiyaga tushadi, keyin o'zgarmaydi; ro'yxat joriy lokatsiyaniki; ta'minotchi va mahsulot sahifalaridagi xaridlar a'zoga ruxsatli hamma lokatsiyaniki (2+ da lokatsiya belgisi).
- Cheklangan xodim boshqa lokatsiyaning xaridlarini ko'rmaydi (ro'yxatda yo'q, ID bo'yicha 404) va u yerga xarid kirita olmaydi (403); balans esa kompaniya bo'yicha to'liq ko'rinadi (qarz lokatsiyaniki emas).
- Admin jonli xaridi bor lokatsiyani o'chira olmaydi: 409 `location_in_use` «Bu lokatsiyada N ta xarid bor» (vazifa tekshiruvidan keyin). Xaridlari o'chirilgan lokatsiya o'chiriladi (qoldiq qatorlari 0 bilan qoladi).
- Ta'minotchilar lokatsiyaga bog'liq emas.

## 8. Chekka holatlar

| Holat | Natija |
|---|---|
| Xarid o'chirildi, yangisi kiritildi | yangi raqam davom etadi (№ 3 o'chirilgan bo'lsa ham keyingisi № 4): raqam bo'shamaydi |
| Bir mahsulot ikki narxda olindi | ikki xarid: bir xaridda bir mahsulot bir marta |
| Xarid tahririda qator olib tashlandi | shu mahsulot qoldig'i qator miqdoriga kamayadi |
| Xarid tahririda ta'minotchi almashtirildi | xarid va bog'langan to'lov yangi ta'minotchiga; ikkala balans o'zgaradi |
| To'langan jamidan katta | mumkin (avans) |
| Bog'langan to'lov ta'minotchi sahifasidan o'zgartirilmoqchi | 409 `payment_linked` |
| Xaridi yoki to'lovi bor ta'minotchi o'chirilmoqchi | 409 `supplier_in_use`; nofaol qilish mumkin |
| Nofaol ta'minotchining xaridi tahrirlanmoqda | ta'minotchi o'zgartirilmasa saqlanadi; boshqasi tanlansa faol bo'lishi shart |
| Nofaol mahsulotli xarid tahrirlanmoqda | xaridda avvaldan bor mahsulot qoladi (miqdor va narxi o'zgarishi mumkin); yangi qo'shilgan mahsulot faol bo'lishi shart |
| Joriy lokatsiya o'chirildi yoki cheklov bilan yopildi | ro'yxat 403 `forbidden` → `/app/me` qayta → ruxsatli birinchisi |
| Lokatsiyasiz a'zo | ro'yxat bo'sh, qo'shish 400, har xarid 404 |
| Boshqa kompaniyaning ta'minotchisi, xaridi, to'lovi ID bo'yicha | 404 `not_found` |
| Ikki kishi bir vaqtda xarid kiritdi | navbat bilan yoziladi, raqamlar ketma-ket |
| Egasi hamma ta'minotchini nofaol qildi | xarid formasida taklif yo'q; forma buni aytadi |

## 9. Xato kodlari

| Kod | Status | Xabar |
|---|---|---|
| `validation_error` | 400 | 3.2, 4.2 va 6-bo'lim xabarlari; ro'yxatda «Sahifa raqami noto'g'ri», «Lokatsiya noto'g'ri», «Ta'minotchi noto'g'ri», «Holat noto'g'ri» |
| `company_required` | 403 | «Avval kompaniyani tanlang» |
| `forbidden` | 403 | «Bu amal uchun ruxsatingiz yo'q» (ruxsat yetmaganda; a'zoga ruxsatsiz `location_id` da ham) |
| `not_found` | 404 | «Ta'minotchi topilmadi», «Xarid topilmadi», «To'lov topilmadi» |
| `name_taken` | 409 | «Bu nomli ta'minotchi allaqachon bor» |
| `supplier_in_use` | 409 | «Bu ta'minotchida N ta xarid bor», «Bu ta'minotchida N ta to'lov bor» |
| `payment_linked` | 409 | «Bu to'lov xarid bilan kiritilgan: xaridni tahrirlang» |
| `stock_insufficient` | 409 | «Omborda yetarli qoldiq yo'q» |
| `location_in_use` | 409 | «Bu lokatsiyada N ta xarid bor» (admin panel) |
