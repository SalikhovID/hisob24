# Mahsulotlar va xizmatlar: maydonlar, birliklar, kategoriyalar, nofaol holat, qoldiq ko'rinishi

Bu hujjat mahsulotlar bo'limi qoidalarini belgilaydi: mahsulot va xizmat nima, qaysi maydonlari bor, kim nima qila oladi, ro'yxat va sahifa nimani ko'rsatadi, nima qachon o'chadi. Ombor (ta'minotchilar, xaridlar, qoldiq, to'lovlar): [warehouse.md](warehouse.md). Rollar: [roles.md](roles.md). Lokatsiyalar (har lokatsiya bitta ombor): [locations.md](locations.md).

> Holat: 2026-10-07 dagi qoidalar amalga oshirilgan (`docs/superpowers/specs/2026-10-07-inventory-design.md`); 2026-10-11 da narx valyutasi, jurnaldan qoldiq, harakatlar va sotuv bilan yangilangan, amalga oshirilmoqda (`docs/superpowers/specs/2026-10-11-ledger-design.md`); 2026-11-16 da mahsulot kategoriyalari qo'shilgan (3.4), amalga oshirilgan (`docs/superpowers/specs/2026-11-16-product-categories-design.md`). Qoida o'zgarsa, avval shu hujjat, keyin kod o'zgartiriladi.

## 1. Tushunchalar

| Tushuncha | Ma'nosi | Bazada |
|---|---|---|
| **Mahsulot** | Kompaniya ta'minotchidan oladigan va omborda saqlaydigan tovar: nomi, o'lchov birligi, ixtiyoriy sotuv narxi, artikuli va izohi. | `products` (`kind = 'product'`) |
| **Xizmat** | Kompaniya ko'rsatadigan xizmat: nomi, ixtiyoriy narxi va izohi. Omborda turmaydi, xaridga kirmaydi, sotuvga kiradi ([sales.md](sales.md)). | `products` (`kind = 'service'`) |
| **Birlik** | Mahsulot o'lchanadigan birlik, tayyor ro'yxatdan (3.2). | `products.unit` |
| **Artikul** | Mahsulotning kodi yoki shtrix-kodi: ixtiyoriy, kompaniyada takrorlanmas. | `products.sku` |
| **Kategoriya** | Mahsulotlar guruhi (Ichimliklar, Shirinliklar): nomi va tartibi, kompaniya Sozlamalarda yuritadi (3.4). Mahsulotda bitta yoki yo'q, xizmatda yo'q. | `product_categories`, `products.category_id` |
| **Nofaol** | Endi ishlatilmaydigan mahsulot yoki xizmat: xarid takliflarida chiqmaydi, o'zi va ma'lumotlari qoladi. | `products.is_active` |
| **Qoldiq** | Mahsulotning lokatsiyadagi (ombordagi) miqdori: ombor jurnalidagi harakatlar yig'indisi ([warehouse.md](warehouse.md), 5-bo'lim). | hisoblanadi (`stock_moves`) |
| **Harakat** | Mahsulotning jurnaldagi bitta kirim yoki chiqimi (xarid, sotuv, buyurtma, ko'chirish, inventarizatsiya, boshlang'ich qoldiq). | `stock_moves` |
| **Oxirgi xarid narxi** | Mahsulotning eng yangi jonli xarid yoki boshlang'ich qoldiq qatoridagi narxi, valyutasi bilan. | hisoblanadi |
| **Narx valyutasi** | Mahsulot yoki xizmat narxining valyutasi, standart UZS ([currencies.md](currencies.md)). | `products.currency_id` |

Hamma narsa kompaniyaga tegishli: bir kompaniya boshqasining mahsulotlarini ko'rmaydi. Kompaniya so'rovdan emas, access token'dan olinadi. Mahsulotlar va xizmatlar lokatsiyaga bog'liq emas (kompaniya bo'yicha umumiy); lokatsiyaga bog'liq narsa faqat qoldiq.

## 2. Kim nima qila oladi

| Amal | egasi | rolsiz xodim | rolli xodim |
|---|---|---|---|
| Ro'yxatlar va mahsulot sahifasini ko'rish | ✓ | ✓ | `products.view` |
| Qo'shish | ✓ | ✓ | `products.create` |
| Tahrirlash, nofaol qilish, faollashtirish | ✓ | ✓ | `products.edit` |
| O'chirish | ✓ | ✓ | `products.delete` |
| Mahsulot sahifasida uning xaridlarini ko'rish | ✓ | ✓ | `purchases.view` |
| Mahsulot kategoriyalarini sozlash (Sozlamalar → Mahsulot kategoriyalari: qo'shish, nomini o'zgartirish, tartiblash, o'chirish) | ✓ | ✗ | `settings.*` |
| Kategoriyalar ro'yxatini o'qish (forma va filtr uchun) | ✓ | ✓ | ✓ |

Rolsiz xodim standart to'plam bilan ishlaydi ([roles.md](roles.md), 4.2): mahsulotlar bo'limida hammasini qila oladi. **Mahsulotlar** bo'limi (Mahsulotlar va Xizmatlar tablari) `products.view` bo'lganga ko'rinadi. Ruxsati yo'q xodim amalni yuborsa: 403 `forbidden`. Kompaniya tanlanmagan sessiya: 403 `company_required`.

## 3. Maydonlar

### 3.1 Mahsulot va xizmat

| Maydon | Mahsulot | Xizmat | Qoida |
|---|---|---|---|
| **Nomi** | majburiy | majburiy | matn, chetidagi bo'shliqlar olib tashlanadi, 1–120 belgi; mahsulotlar ichida va xizmatlar ichida alohida takrorlanmaydi (katta-kichik harf farqsiz): 409 `name_taken` |
| **Birlik** | majburiy | yo'q | tayyor ro'yxatdan (3.2); xizmatga berilsa 400 |
| **Narx** | ixtiyoriy | ixtiyoriy | 12 xonagacha butun va 2 kasr xonasi (`"150000.50"`), manfiy emas, valyutasi bilan (`currency_id`, standart UZS; kompaniyada yoqilgan bo'lishi shart: 400 `currency_not_allowed`; tanlov faqat 2+ valyutada ko'rinadi). Mahsulotda sotuv narxi, xizmatda xizmat narxi: sotuv formasida narx taklifi ([sales.md](sales.md), 3.1). Xarid narxi bu yerda emas, xaridning o'zida ([warehouse.md](warehouse.md), 4-bo'lim) |
| **Artikul** | ixtiyoriy | yo'q | matn, 60 belgigacha, kompaniyaning jonli mahsulotlari ichida takrorlanmaydi (harf farqsiz): 409 `sku_taken`; xizmatga berilsa 400 |
| **Kategoriya** | ixtiyoriy | yo'q | `category_id`: kompaniyaning jonli kategoriyasi (3.4), boshqasi 400 «Kategoriya noto'g'ri»; berilmasa yoki `null` bo'lsa kategoriyasiz; xizmatga berilsa 400 «Xizmatga kategoriya berilmaydi» |
| **Izoh** | ixtiyoriy | ixtiyoriy | matn, 500 belgigacha |

Tur (mahsulot yoki xizmat) yaratilganda belgilanadi va keyin o'zgarmaydi. Bo'sh ixtiyoriy maydon (bo'sh matn) saqlanmaydi (`null`). Pul JSON'da matn (`"150000.50"`), tekshiruv `^\d{1,12}(\.\d{1,2})?$`; formada vergul ham qabul qilinadi va nuqtaga aylanadi.

### 3.2 Birliklar

Tayyor ro'yxat, sozlanmaydi: `dona`, `kg`, `g`, `l`, `ml`, `m`, `m2` (interfeysda m²), `quti`, `juft`, `komplekt`. Ro'yxatda yo'q birlik: 400 «Birlikni tanlang». Miqdor har birlikda kasr bo'lishi mumkin (3 kasr xonagacha): 1,5 dona ham qabul qilinadi.

### 3.3 Nofaol holat

- Mahsulot yoki xizmat nofaol qilinadi va qayta faollashtiriladi (`PATCH /app/products/{id} {is_active}`, `products.edit`).
- Nofaol mahsulot xarid formasining takliflarida chiqmaydi; avval kiritilgan xaridlarda qoladi (xarid tahrirlanganda ham: xaridda avvaldan bor mahsulot qayta tekshirilmaydi). Qoldig'i, oxirgi xarid narxi va xaridlari ko'rinaveradi.
- Ro'yxatda nofaollar alohida tabda («Nofaol»); sahifasida «Nofaol» belgisi va «Faollashtirish».
- Nomi va artikuli band bo'lib qoladi: nofaol ham jonli yozuv.

### 3.4 Kategoriyalar

- **Sozlamalar → «Mahsulot kategoriyalari»** (`/settings/product-categories`, `settings.view`): kategoriyalar sozlamadagi tartibda. «+» qo'shadi, oxiriga (`settings.create`). Qatorning amallari: «Nomini o'zgartirish» (`settings.edit`) va «O'chirish» (`settings.delete`). «Tartiblash» sudrab tartiblaydi (`settings.edit`, 409 `order_changed`).
- **API:**
  - `GET /app/product-categories`: har a'zoga (forma va filtr uchun), `[{id, name}]` tartibda;
  - `POST /app/product-categories {name}`;
  - `PATCH /app/product-categories/{id} {name}`;
  - `PUT /app/product-categories/order {ids}`;
  - `DELETE /app/product-categories/{id}`.
- **Nom:** chetidagi bo'shliqlarsiz, 1–60 belgi («Nomni kiriting», «Nom 60 belgidan oshmasin»). Kompaniyada takrorlanmaydi, harf farqsiz: 409 `name_taken` «Bu nomli kategoriya allaqachon bor». Nom o'zgarsa mahsulotlar yangi nom bilan ko'rinadi.
- **Nofaol holat yo'q.**
- **O'chirish** yashirish (`deleted_at`), nomi bo'shaydi. Jonli mahsuloti (faol yoki nofaol) bor kategoriya o'chirilmaydi: 409 `category_in_use` «Bu kategoriyada N ta mahsulot bor». O'chirilgan mahsulotlar sanalmaydi. Avval mahsulotlar boshqa kategoriyaga o'tkaziladi yoki kategoriyasiz qilinadi.
- **Ixtiyoriy:** yangi mahsulot formasida boshida «Kategoriyasiz» turadi. Tayyor kategoriya yo'q: yangi kompaniya bo'sh boshlaydi.
- **«Asosiy».** Kategoriyalar paydo bo'lganda (migratsiya 00024) jonli mahsuloti bor har kompaniyada «Asosiy» kategoriyasi yaratildi. Jonli mahsulotlari, nofaollari ham, unga biriktirildi. Bu oddiy kategoriya: nomi o'zgaradi, tartiblanadi, bo'shasa o'chiriladi.
- **Qayerda ko'rinadi:**
  - mahsulot formasi: «Kategoriya» qatori, «Kategoriyasiz» tanlovi bilan;
  - mahsulot sahifasi (6-bo'lim);
  - mahsulotlar ro'yxati: filtr va webdagi ustun (5-bo'lim);
  - ombor «Qoldiq» jadvali ([warehouse.md](warehouse.md), 5-bo'lim);
  - hujjat formalaridagi mahsulot tanlovi (xarid, sotuv, ko'chirish, inventarizatsiya, boshlang'ich qoldiq, buyurtma tovari): kompaniyada kategoriya bo'lsa chiplar chiqadi, «Hammasi» va kategoriyalar sozlamadagi tartibda. Har ochilishda «Hammasi» turadi. Kategoriya tanlansa faqat shu kategoriyadagi mahsulotlar chiqadi, xizmatlar chiqmaydi. Qidiruv shu tanlov ichida ishlaydi.

## 4. Mahsulot va xizmat

- **Qo'shish.** `POST /app/products {kind, name, unit?, sku?, price?, currency_id?, category_id?, note?}`. Kim qo'shgani saqlanadi.
- **Tahrirlash.** `PUT /app/products/{id} {name, unit?, sku?, price?, currency_id?, category_id?, note?}`: maydonlar yuborilganiga almashadi, yuborilmagan ixtiyoriy maydon bo'shaydi. Tur o'zgarmaydi. Birlik o'zgarsa eski xaridlardagi miqdorlar o'zgarmaydi (raqam o'sha, birlik yangisi). Ikki kishi bir vaqtda tahrirlasa, oxirgi saqlagan qoladi.
- **O'chirish.** Yashiriladi (`deleted_at`), bazadan o'chmaydi; nomi va artikuli bo'shaydi; sahifasi 404. Tiklash yo'q. Jonli hujjat qatorida (xarid, sotuv, buyurtma, ko'chirish, inventarizatsiya, boshlang'ich qoldiq) bor mahsulot yoki xizmat o'chirilmaydi: 409 `product_in_use` «Bu mahsulot N ta hujjatda bor» (o'chirilgan hujjatlar sanalmaydi); uni nofaol qilish mumkin.
- **Qo'shgan.** Mijozlardagi kabi: a'zoning shu kompaniyadagi hozirgi ismi, chiqarilgan bo'lsa qo'shgan paytdagi ismi.

Tekshiruv tartibi (400 `validation_error`, birinchi xato qaytadi): tur («Turni tanlang»), nom («Nomni kiriting», «Nom 120 belgidan oshmasin»), birlik (mahsulotda «Birlikni tanlang»; xizmatda berilsa «Xizmatga birlik berilmaydi»), artikul («Artikul 60 belgidan oshmasin»; xizmatda berilsa «Xizmatga artikul berilmaydi»), kategoriya (xizmatda berilsa «Xizmatga kategoriya berilmaydi»), narx («Narx noto'g'ri»), izoh («Izoh 500 belgidan oshmasin»). Keyin bazadagi tekshiruvlar: narx valyutasi («Valyuta noto'g'ri», `currency_not_allowed`), kategoriya («Kategoriya noto'g'ri»: kompaniyaning jonli kategoriyasi emas). Keyin takrorlar: nom (409 `name_taken`), artikul (409 `sku_taken`). Tahrirda eng avval yozuvning o'zi (404 «Mahsulot topilmadi»).

## 5. Ro'yxat

- `GET /app/products?kind=&status=&category_id=&search=&page=&location_id=`. Mahsulotlar va xizmatlar alohida ro'yxat (`kind`: `product` yoki `service`, berilmasa `product`). Nom bo'yicha tartib (katta-kichik harf farqsiz), sahifada 20 ta.
- **Holat tablari:** «Faol» (`status=active`, standart) va «Nofaol» (`status=inactive`).
- **Qidiruv:** nomda (katta-kichik harf farqsiz, harfma-harf, so'z ichidan ham); mahsulotda artikulda ham.
- **Kategoriya filtri** (faqat mahsulotlarda, 3.4):
  - `category_id` kategoriyaning `id` si bo'lsa, shu kategoriyadagi mahsulotlar; `none` bo'lsa kategoriyasizlar; berilmasa hammasi;
  - boshqa qiymat 400 «Kategoriya noto'g'ri»; begona yoki o'chirilgan kategoriya bo'sh ro'yxat beradi;
  - interfeysda «Kategoriya» chipi varaq ochadi: «Hamma kategoriyalar», kategoriyalar sozlamadagi tartibda, oxirida «Kategoriyasiz». Manzilda `?category=`;
  - holat chiplaridagi sonlar kategoriyaga qaramaydi.
- **Ustunlar** (webdagi jadval):
  - mahsulotlar: «Nomi» (ostida artikul; mahsulot sahifasiga havola), «Kategoriya» (bo'sh bo'lsa «—»), «Qoldiq» (joriy lokatsiya), «Oxirgi xarid narxi», «Sotuv narxi», «Holat»;
  - xizmatlar: «Nomi», «Sotuv narxi», «Holat». Qator bosilsa amallar varag'i (tahrirlash, nofaol qilish, o'chirish); xizmatning alohida sahifasi yo'q.
- **Telefonda** mahsulot qatori: nom, ostida birlik · artikul · qoldiq, o'ngda narx. Kategoriya qatorda yo'q, filtr chipida bor.
- **Qoldiq ustuni** `location_id` lokatsiyaniki (topbar tanlovchisidagi joriy lokatsiya, [locations.md](locations.md) 4-bo'lim): a'zoga ruxsatsiz lokatsiya 403 `forbidden`, son bo'lmasa 400 «Lokatsiya noto'g'ri»; `location_id` berilmasa a'zoga ruxsatli lokatsiyalar yig'indisi. Lokatsiyasiz a'zoda 0. Xizmatda qoldiq yo'q (`null`).
- **Sahifa.** `?page=` 1 dan boshlanadi; oxirgidan keyingi sahifa bo'sh ro'yxat va jami sonni qaytaradi; son bo'lmasa 400 «Sahifa raqami noto'g'ri».

## 6. Mahsulot sahifasi

`GET /app/products/{id}`; `/products/[id]`. Sarlavhada nom (nofaol bo'lsa «Nofaol» belgisi), ostida «birlik · artikul». «Ma'lumot»: kategoriya, birlik, narx (valyutasi bilan), oxirgi xarid narxi (valyutasi bilan), artikul, izoh, qo'shgan, qo'shilgan (bo'shi «—»). «Qoldiq»: a'zoga ruxsatli har lokatsiya nomi va miqdori (0 ham). «Xaridlar» (`purchases.view` bo'lganga, `GET /app/products/{id}/purchases?page=`): shu mahsulot kirgan jonli xaridlar, a'zoga ruxsatli lokatsiyalardagi, yangi birinchi, 20 tadan: raqam, vaqt, ta'minotchi, miqdor, narx, summa, 2+ ruxsatli lokatsiyada lokatsiya. «Harakatlar» (`stock.view` bo'lganga, `GET /app/products/{id}/moves?location_id=&page=`): mahsulotning ombor jurnalidagi harakatlari, a'zoga ruxsatli lokatsiyalardagi (yoki `location_id` lokatsiyaniki), yangi birinchi, 20 tadan: vaqt, hujjat (tur va raqami, buyurtmada nomi; havola), lokatsiya, kontragent (ta'minotchi; sotuv va buyurtmada mijoz) yoki boshqa lokatsiya, ± miqdor ([warehouse.md](warehouse.md), 5-bo'lim; [orders.md](orders.md), 4.3). Amallar: «Tahrirlash», «Nofaol qilish» / «Faollashtirish», «O'chirish» (rad javobi toast'da). Xizmatning sahifasi yo'q: uning amallari ro'yxat qatorida.

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
| Mahsuloti bor kategoriya o'chirilmoqchi | 409 `category_in_use`; avval mahsulotlar boshqa kategoriyaga o'tkaziladi yoki kategoriyasiz qilinadi |
| Faqat o'chirilgan mahsulotlari bor kategoriya o'chirilmoqchi | o'chiriladi |
| O'chirilgan yoki boshqa kompaniyaning kategoriyasi mahsulotga | 400 «Kategoriya noto'g'ri» |
| Xizmatga kategoriya yuborildi | 400 «Xizmatga kategoriya berilmaydi» |
| Mahsulot tahririda `category_id` yuborilmadi | mahsulot kategoriyasiz bo'ladi (PUT hamma maydonni almashtiradi) |
| O'chirilgan kategoriyaning nomi bilan yangisi | qo'shiladi |

## 8. Xato kodlari

| Kod | Status | Xabar |
|---|---|---|
| `validation_error` | 400 | 4-bo'lim xabarlari; ro'yxatda «Sahifa raqami noto'g'ri», «Lokatsiya noto'g'ri», «Tur noto'g'ri», «Holat noto'g'ri», «Kategoriya noto'g'ri»; kategoriya nomida «Nomni kiriting», «Nom 60 belgidan oshmasin» |
| `company_required` | 403 | «Avval kompaniyani tanlang» |
| `forbidden` | 403 | «Bu amal uchun ruxsatingiz yo'q» |
| `not_found` | 404 | «Mahsulot topilmadi» (xizmat ham shu yo'lda, shu xabar), «Kategoriya topilmadi» |
| `name_taken` | 409 | «Bu nomli mahsulot allaqachon bor», «Bu nomli xizmat allaqachon bor», «Bu nomli kategoriya allaqachon bor» |
| `sku_taken` | 409 | «Bu artikulli mahsulot allaqachon bor» |
| `product_in_use` | 409 | «Bu mahsulot N ta hujjatda bor» |
| `category_in_use` | 409 | «Bu kategoriyada N ta mahsulot bor» |
| `order_changed` | 409 | «Ro'yxat o'zgargan. Sahifani yangilang» (kategoriyalarni tartiblash) |
