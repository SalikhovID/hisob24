# Mahsulotlar va xizmatlar: maydonlar, birliklar, nofaol holat, qoldiq ko'rinishi

Bu hujjat mahsulotlar bo'limi qoidalarini belgilaydi: mahsulot va xizmat nima, qaysi maydonlari bor, kim nima qila oladi, ro'yxat va sahifa nimani ko'rsatadi, nima qachon o'chadi. Ombor (ta'minotchilar, xaridlar, qoldiq, to'lovlar): [warehouse.md](warehouse.md). Rollar: [roles.md](roles.md). Lokatsiyalar (har lokatsiya bitta ombor): [locations.md](locations.md).

> Holat: kelishilgan (2026-10-07), amalga oshirilmoqda. Qoida o'zgarsa, avval shu hujjat, keyin kod o'zgartiriladi. Dizayn, bosqichlar va amalga oshirishdagi qarorlar: `docs/superpowers/specs/2026-10-07-inventory-design.md`.

## 1. Tushunchalar

| Tushuncha | Ma'nosi | Bazada |
|---|---|---|
| **Mahsulot** | Kompaniya ta'minotchidan oladigan va omborda saqlaydigan tovar: nomi, o'lchov birligi, ixtiyoriy sotuv narxi, artikuli va izohi. | `products` (`kind = 'product'`) |
| **Xizmat** | Kompaniya ko'rsatadigan xizmat: nomi, ixtiyoriy narxi va izohi. Omborda turmaydi, xaridga kirmaydi. | `products` (`kind = 'service'`) |
| **Birlik** | Mahsulot o'lchanadigan birlik, tayyor ro'yxatdan (3.2). | `products.unit` |
| **Artikul** | Mahsulotning kodi yoki shtrix-kodi: ixtiyoriy, kompaniyada takrorlanmas. | `products.sku` |
| **Nofaol** | Endi ishlatilmaydigan mahsulot yoki xizmat: xarid takliflarida chiqmaydi, o'zi va ma'lumotlari qoladi. | `products.is_active` |
| **Qoldiq** | Mahsulotning lokatsiyadagi (ombordagi) miqdori ([warehouse.md](warehouse.md), 5-bo'lim). | `stock` |
| **Oxirgi xarid narxi** | Mahsulotning oxirgi jonli xarid qatoridagi narxi. | hisoblanadi |

Hamma narsa kompaniyaga tegishli: bir kompaniya boshqasining mahsulotlarini ko'rmaydi. Kompaniya so'rovdan emas, access token'dan olinadi. Mahsulotlar va xizmatlar lokatsiyaga bog'liq emas (kompaniya bo'yicha umumiy); lokatsiyaga bog'liq narsa faqat qoldiq.

## 2. Kim nima qila oladi

| Amal | egasi | rolsiz xodim | rolli xodim |
|---|---|---|---|
| Ro'yxatlar va mahsulot sahifasini ko'rish | ✓ | ✓ | `products.view` |
| Qo'shish | ✓ | ✓ | `products.create` |
| Tahrirlash, nofaol qilish, faollashtirish | ✓ | ✓ | `products.edit` |
| O'chirish | ✓ | ✓ | `products.delete` |
| Mahsulot sahifasida uning xaridlarini ko'rish | ✓ | ✓ | `purchases.view` |

Rolsiz xodim standart to'plam bilan ishlaydi ([roles.md](roles.md), 4.2): mahsulotlar bo'limida hammasini qila oladi. **Mahsulotlar** bo'limi (Mahsulotlar va Xizmatlar tablari) `products.view` bo'lganga ko'rinadi. Ruxsati yo'q xodim amalni yuborsa: 403 `forbidden`. Kompaniya tanlanmagan sessiya: 403 `company_required`.

## 3. Maydonlar

### 3.1 Mahsulot va xizmat

| Maydon | Mahsulot | Xizmat | Qoida |
|---|---|---|---|
| **Nomi** | majburiy | majburiy | matn, chetidagi bo'shliqlar olib tashlanadi, 1–120 belgi; mahsulotlar ichida va xizmatlar ichida alohida takrorlanmaydi (katta-kichik harf farqsiz): 409 `name_taken` |
| **Birlik** | majburiy | yo'q | tayyor ro'yxatdan (3.2); xizmatga berilsa 400 |
| **Narx** | ixtiyoriy | ixtiyoriy | so'm: 12 xonagacha butun va 2 kasr xonasi (`"150000.50"`), manfiy emas. Mahsulotda sotuv narxi, xizmatda xizmat narxi. Xarid narxi bu yerda emas, xaridning o'zida ([warehouse.md](warehouse.md), 4-bo'lim) |
| **Artikul** | ixtiyoriy | yo'q | matn, 60 belgigacha, kompaniyaning jonli mahsulotlari ichida takrorlanmaydi (harf farqsiz): 409 `sku_taken`; xizmatga berilsa 400 |
| **Izoh** | ixtiyoriy | ixtiyoriy | matn, 500 belgigacha |

Tur (mahsulot yoki xizmat) yaratilganda belgilanadi va keyin o'zgarmaydi. Bo'sh ixtiyoriy maydon (bo'sh matn) saqlanmaydi (`null`). Pul JSON'da matn (`"150000.50"`), tekshiruv `^\d{1,12}(\.\d{1,2})?$`; formada vergul ham qabul qilinadi va nuqtaga aylanadi.

### 3.2 Birliklar

Tayyor ro'yxat, sozlanmaydi: `dona`, `kg`, `g`, `l`, `ml`, `m`, `m2` (interfeysda m²), `quti`, `juft`, `komplekt`. Ro'yxatda yo'q birlik: 400 «Birlikni tanlang». Miqdor har birlikda kasr bo'lishi mumkin (3 kasr xonagacha): 1,5 dona ham qabul qilinadi.

### 3.3 Nofaol holat

- Mahsulot yoki xizmat nofaol qilinadi va qayta faollashtiriladi (`PATCH /app/products/{id} {is_active}`, `products.edit`).
- Nofaol mahsulot xarid formasining takliflarida chiqmaydi; avval kiritilgan xaridlarda qoladi (xarid tahrirlanganda ham: xaridda avvaldan bor mahsulot qayta tekshirilmaydi). Qoldig'i, oxirgi xarid narxi va xaridlari ko'rinaveradi.
- Ro'yxatda nofaollar alohida tabda («Nofaol»); sahifasida «Nofaol» belgisi va «Faollashtirish».
- Nomi va artikuli band bo'lib qoladi: nofaol ham jonli yozuv.

## 4. Mahsulot va xizmat

- **Qo'shish.** `POST /app/products {kind, name, unit?, sku?, price?, note?}`. Kim qo'shgani saqlanadi.
- **Tahrirlash.** `PUT /app/products/{id} {name, unit?, sku?, price?, note?}`: maydonlar yuborilganiga almashadi, yuborilmagan ixtiyoriy maydon bo'shaydi. Tur o'zgarmaydi. Birlik o'zgarsa eski xaridlardagi miqdorlar o'zgarmaydi (raqam o'sha, birlik yangisi). Ikki kishi bir vaqtda tahrirlasa, oxirgi saqlagan qoladi.
- **O'chirish.** Yashiriladi (`deleted_at`), bazadan o'chmaydi; nomi va artikuli bo'shaydi; sahifasi 404. Tiklash yo'q. Jonli xarid qatorida bor mahsulot o'chirilmaydi: 409 `product_in_use` «Bu mahsulot N ta xaridda bor» (o'chirilgan xaridlar sanalmaydi); uni nofaol qilish mumkin. Xizmat erkin o'chiriladi.
- **Qo'shgan.** Mijozlardagi kabi: a'zoning shu kompaniyadagi hozirgi ismi, chiqarilgan bo'lsa qo'shgan paytdagi ismi.

Tekshiruv tartibi (400 `validation_error`, birinchi xato qaytadi): tur («Turni tanlang»), nom («Nomni kiriting», «Nom 120 belgidan oshmasin»), birlik (mahsulotda «Birlikni tanlang»; xizmatda berilsa «Xizmatga birlik berilmaydi»), artikul («Artikul 60 belgidan oshmasin»; xizmatda berilsa «Xizmatga artikul berilmaydi»), narx («Narx noto'g'ri»), izoh («Izoh 500 belgidan oshmasin»). Keyin takrorlar: nom (409 `name_taken`), artikul (409 `sku_taken`). Tahrirda eng avval yozuvning o'zi (404 «Mahsulot topilmadi»).

## 5. Ro'yxat

- `GET /app/products?kind=&status=&search=&page=&location_id=`. Mahsulotlar va xizmatlar alohida ro'yxat (`kind`: `product` yoki `service`, berilmasa `product`). Nom bo'yicha tartib (katta-kichik harf farqsiz), sahifada 20 ta.
- **Holat tablari:** «Faol» (`status=active`, standart) va «Nofaol» (`status=inactive`).
- **Qidiruv:** nomda (katta-kichik harf farqsiz, harfma-harf, so'z ichidan ham); mahsulotda artikulda ham.
- **Ustunlar.** Mahsulotlar: «Mahsulot» (nom, ostida artikul, bo'lmasa birlik; mahsulot sahifasiga havola), «Birlik», «Narx», «Qoldiq» (joriy lokatsiya), «Qo'shgan», «Qo'shilgan». Xizmatlar: «Xizmat», «Narx», «Qo'shgan», «Qo'shilgan» va qator amallari (tahrirlash, nofaol qilish, o'chirish); xizmatning alohida sahifasi yo'q.
- **Qoldiq ustuni** `location_id` lokatsiyaniki (topbar tanlovchisidagi joriy lokatsiya, [locations.md](locations.md) 4-bo'lim): a'zoga ruxsatsiz lokatsiya 403 `forbidden`, son bo'lmasa 400 «Lokatsiya noto'g'ri»; `location_id` berilmasa a'zoga ruxsatli lokatsiyalar yig'indisi. Lokatsiyasiz a'zoda 0. Xizmatda qoldiq yo'q (`null`).
- **Sahifa.** `?page=` 1 dan boshlanadi; oxirgidan keyingi sahifa bo'sh ro'yxat va jami sonni qaytaradi; son bo'lmasa 400 «Sahifa raqami noto'g'ri».

## 6. Mahsulot sahifasi

`GET /app/products/{id}`; `/products/[id]`. Sarlavhada nom (nofaol bo'lsa «Nofaol» belgisi), ostida «birlik · artikul». «Ma'lumot»: birlik, narx, oxirgi xarid narxi, artikul, izoh, qo'shgan, qo'shilgan (bo'shi «—»). «Qoldiq»: a'zoga ruxsatli har lokatsiya nomi va miqdori (0 ham). «Xaridlar» (`purchases.view` bo'lganga, `GET /app/products/{id}/purchases?page=`): shu mahsulot kirgan jonli xaridlar, a'zoga ruxsatli lokatsiyalardagi, yangi birinchi, 20 tadan: raqam, sana, ta'minotchi, miqdor, narx, summa, 2+ ruxsatli lokatsiyada lokatsiya. Amallar: «Tahrirlash», «Nofaol qilish» / «Faollashtirish», «O'chirish» (rad javobi toast'da). Xizmatning sahifasi yo'q: uning amallari ro'yxat qatorida.

## 7. Chekka holatlar

| Holat | Natija |
|---|---|
| Mahsulot va xizmat bir xil nomda | mumkin: takrorlanmaslik har tur ichida |
| O'chirilgan mahsulotning nomi yoki artikuli bilan yangisi | qo'shiladi |
| Nofaol mahsulotning nomi bilan yangisi | 409 `name_taken`: nofaol ham jonli |
| Xaridi bor mahsulot o'chirilmoqchi | 409 `product_in_use`; avval xaridlari o'chiriladi yoki mahsulot nofaol qilinadi |
| Xaridi bor mahsulot nofaol qilindi | xaridlarda qoladi, takliflarda chiqmaydi, qoldig'i ko'rinadi |
| Mahsulotning birligi o'zgartirildi | eski xaridlar va qoldiq miqdori o'zgarmaydi, birlik yangisi bilan ko'rsatiladi |
| Xizmatga birlik yoki artikul yuborildi | 400 |
| Xizmat xaridga qo'shilmoqchi | 400 «Xizmat xaridga kiritilmaydi» ([warehouse.md](warehouse.md), 4.2) |
| Egasi hamma mahsulotni nofaol qildi | xarid formasida taklif yo'q; forma buni aytadi |
| Boshqa kompaniyaning mahsuloti ID bo'yicha | 404 `not_found` |
| Ruxsatsiz `location_id` bilan ro'yxat | 403 `forbidden` |

## 8. Xato kodlari

| Kod | Status | Xabar |
|---|---|---|
| `validation_error` | 400 | 4-bo'lim xabarlari; ro'yxatda «Sahifa raqami noto'g'ri», «Lokatsiya noto'g'ri», «Tur noto'g'ri», «Holat noto'g'ri» |
| `company_required` | 403 | «Avval kompaniyani tanlang» |
| `forbidden` | 403 | «Bu amal uchun ruxsatingiz yo'q» |
| `not_found` | 404 | «Mahsulot topilmadi» (xizmat ham shu yo'lda, shu xabar) |
| `name_taken` | 409 | «Bu nomli mahsulot allaqachon bor», «Bu nomli xizmat allaqachon bor» |
| `sku_taken` | 409 | «Bu artikulli mahsulot allaqachon bor» |
| `product_in_use` | 409 | «Bu mahsulot N ta xaridda bor» |
