# Buyurtmalar: bosqichlar, turlar, maydonlar, mas'ul

Bu hujjat buyurtmalar bo'limi qoidalarini belgilaydi: buyurtma nima, u qaysi bosqichda turadi, turi va maydonlari qanday sozlanadi, mijozga qanday biriktiriladi, kim nima qila oladi, nima qachon o'chadi. Rollar: [roles.md](roles.md). Mijozlar, turlar, maydonlar va dropdownlarning umumiy qoidalari: [customers.md](customers.md). Lokatsiyalar (buyurtma qaysi filialda turadi, kim ko'radi): [locations.md](locations.md).

> Holat: amalga oshirilgan (2026-10-06). 2 va 4-bo'limlardagi rolli xodim qoidasi (2026-10-06) kompaniya rollari bilan amalga oshirilgan: `docs/superpowers/specs/2026-10-06-roles-bottom-nav-design.md`. Qoida o'zgarsa, avval shu hujjat, keyin kod o'zgartiriladi. Dizayn, bosqichlar va amalga oshirishdagi qarorlar: `docs/superpowers/specs/2026-10-06-tasks-design.md`. Lokatsiya qoidalari (1, 3.3, 4, 4.1, 4.2, 6, 8, 9-bo'limlar; 2026-10-07) `docs/superpowers/specs/2026-10-07-locations-design.md` bilan amalga oshirilmoqda. 2026-10-18 dan bo'lim «Buyurtmalar» deb ataladi (ilgari «Vazifalar»; kodda `order`, `/app/orders`, `orders.*`): `docs/superpowers/specs/2026-10-18-orders-rename-design.md`. 2026-10-18 dan buyurtmada narx, to'lovlar, tovarlar va FIFO tan narxi (1, 2, 3.3, 4, 4.1, 4.3, 4.4, 6, 7, 8, 9-bo'limlar): `docs/superpowers/specs/2026-10-18-order-money-design.md`.

## 1. Tushunchalar

| Tushuncha | Ma'nosi | Bazada |
|---|---|---|
| **Buyurtma** | Kompaniya xodimlari bajaradigan ish: nomi, muddati, mijozi, bosqichi, turi va shu turning maydonlaridagi qiymatlar; ixtiyoriy mas'ul. | `orders` |
| **Bosqich** | Buyurtmaning holati va kanban ustuni (masalan, Yangi, Jarayonda, Bajarildi). Nomi, rangi, tartibi va "Yakuniy" belgisi bor. | `order_stages` |
| **Tur** | Buyurtmalar toifasi (masalan, Ta'mir, Yetkazib berish). Buyurtma formasining o'zgaruvchan qismini belgilaydi. | `order_types` |
| **Maydon** | Turning bitta savoli: nomi, turi, majburiyligi. Har tur o'z maydonlariga ega. | `order_fields` |
| **Dropdown, Variant** | Mijozlardagi bilan bir xil ro'yxatlar: buyurtma maydonlari ham variantlarini ulardan oladi. | `customer_dropdowns`, `customer_dropdown_options` |
| **Qiymat** | Buyurtmaning bitta maydonga javobi. | `order_values` |
| **Mas'ul** | Buyurtma biriktirilgan kompaniya a'zosi (egasi yoki xodim). Ixtiyoriy. | `orders.assignee_phone` |
| **Lokatsiya** | Buyurtma turadigan filial ([locations.md](locations.md)). Yaratishda joriy lokatsiya, keyin o'zgarmaydi. | `orders.location_id` |
| **Narx** | Buyurtmaning puli, valyutasi va kursi bilan; mijoz qarziga yoziladi. Ixtiyoriy (0 = narx yo'q). | `transactions` (`kind = 'order'`, `order_id`, `total`) |
| **To'lov** | Buyurtma uchun mijozdan akkauntga kelgan pul: formadagi avans va keyingi to'lovlar; buyurtma hujjatiga bog'langan. | `transactions` (`customer_payment`, `linked_id`) |
| **Tovar qatori** | Buyurtmaga biriktirilgan mahsulot (qoldiqdan chiqadi) yoki xizmat, miqdori bilan; narxga ta'sir qilmaydi. | `transaction_items`, `stock_moves` |
| **Tan narxi** | Biriktirilgan mahsulotlarning FIFO bilan jurnaldan hisoblangan tan narxi, so'mda (4.4). | hisoblanadi |

Hamma narsa kompaniyaga tegishli; kompaniya so'rovdan emas, access token'dan olinadi. Bosqichlar kompaniyaniki, turga bog'liq emas: har turdagi buyurtma har bosqichda turishi mumkin. Lokatsiya buyurtmaniki: a'zo joriy lokatsiya buyurtmalarini ko'radi ([locations.md](locations.md), 6-bo'lim).

## 2. Kim nima qila oladi

| Amal | owner | user |
|---|---|---|
| Buyurtmalar ro'yxati, kanban va buyurtma sahifasini ko'rish | ✓ | ✓ |
| Buyurtma qo'shish, tahrirlash, bosqichini o'zgartirish, o'chirish (kim qo'shgani va kimga biriktirilganidan qat'i nazar) | ✓ | ✓ |
| Buyurtmaning narxi, tovarlari va to'lovlarini kiritish / o'zgartirish (4.3) | ✓ | ✓ |
| Buyurtma tovarlarining tan narxi va foydani ko'rish (4.4) | ✓ | ✓ |
| Bosqichlar, turlar va dropdownlarni o'qish (forma va ro'yxat uchun) | ✓ | ✓ |
| A'zolar ro'yxatini o'qish (mas'ul tanlash uchun, `GET /app/members`) | ✓ | ✓ |
| Bosqich, tur va maydonlarni sozlash | ✓ | ✗ |
| Buyurtmaning o'zgarishlar tarixini ko'rish | ✓ | ✗ |

Jadvaldagi `user` rolsiz xodim. Kompaniya roli biriktirilgan xodim ([roles.md](roles.md), 4-bo'lim) har amalni rolning ruxsati bilan qiladi: `orders.view` (ro'yxat, kanban, buyurtma sahifasi), `orders.create`, `orders.edit` (tahrirlash va bosqichni o'zgartirish), `orders.delete`, `orders.history`; sozlash `settings.*`. Yangi mijoz bilan buyurtma qo'shish `customers.create` ni ham talab qiladi, mavjud mijozni takliflardan tanlash `customers.view` ni (4-bo'lim). Narx, tovarlar va to'lovlar `orders.create` / `orders.edit` bilan; tovar takliflari uchun `products.view` ham kerak; tan narxi va foyda `purchases.view` bilan (4.3, 4.4).

- "Buyurtmalar" bo'limi `orders.view` bo'lganga (egasi va rolsiz xodimga ham), sozlamalar egasiga va `settings.view` ruxsatli xodimga ko'rinadi.
- Ruxsati yo'q xodim amalni yuborsa: 403 `forbidden`. Kompaniya tanlanmagan sessiya: 403 `company_required`.

## 3. Sozlamalar

### 3.1 Bosqichlar

- Bosqichning nomi (60 belgigacha, kompaniyada takrorlanmaydi, katta-kichik harf farqsiz: 409 `name_taken`), rangi va "Yakuniy" belgisi bor. Hammasi keyin o'zgartiriladi.
- **Rang** to'qqiz tayyor rangdan biri: `slate`, `red`, `orange`, `amber`, `green`, `teal`, `blue`, `violet`, `pink`. Rang kanban sarlavhasida va bosqich belgisida ko'rinadi. Rang berilmasa yoki ro'yxatda bo'lmasa: "Rangni tanlang".
- **Yakuniy** bosqichdagi buyurtma bajarilgan hisoblanadi: muddati o'tgan deb belgilanmaydi, nisbiy muddat ko'rsatilmaydi. Yakuniy bosqich bir nechta bo'lishi mumkin, bo'lmasligi ham.
- **Tartib** owner belgilaydi (sudrab); kanban ustunlari va "Bosqich" tanlovlari shu tartibda. Yangi bosqich oxiriga tushadi. Qo'shishda bosqich berilmasa, formada tartib bo'yicha birinchisi tanlangan keladi (API'da bosqich majburiy).
- Buyurtmasi bor bosqich o'chirilmaydi (5-bo'lim). O'chirilgan nom qayta ishlatilishi mumkin.

### 3.2 Turlar va maydonlar

Mijoz turlaridagi qoidalar ([customers.md](customers.md), 3.1, 3.4) bilan bir xil, ikki farq bilan:

- **"Takrorlanmasin" yo'q.** Buyurtma maydoni faqat nom, tur (olti tur: matn, butun son, dropdown, ko'p tanlovli dropdown, radio, checkbox), dropdown (tanlov turlarida) va "Majburiy" belgisiga ega.
- **Nom maydoni yo'q.** Buyurtmaning nomi doimiy maydon (3.3); turning birinchi matn maydoni alohida ma'noga ega emas.

Tur nomi kompaniyada, maydon nomi tur ichida takrorlanmaydi. Maydonning turi va dropdowni yaratilgandan keyin o'zgarmaydi. "Majburiy" keyin yoqilsa, mavjud buyurtmalarga tegilmaydi: qiymat keyingi saqlashda talab qilinadi. Nofaol variant mijozlardagidek: yangi tanlovlarda chiqmaydi, tanlagan buyurtmada qoladi.

### 3.3 Doimiy maydonlar

Har buyurtmada bor, turlarda sozlanmaydi va maydon qilib qo'shilmaydi:

| Maydon | Majburiy | Qoida |
|---|---|---|
| **Nomi** | ha | matn, chetidagi bo'shliqlar olib tashlanadi, 200 belgigacha |
| **Muddat** | ha | sana (`YYYY-MM-DD`), vaqtsiz; o'tgan sana ham qabul qilinadi |
| **Mijoz** | ha | kompaniyaning faol mijozi; yaratishda biriktiriladi, keyin o'zgarmaydi |
| **Bosqich** | ha | kompaniyaning bosqichi |
| **Lokatsiya** | ha | kompaniyaning jonli lokatsiyasi, a'zoga ruxsatli; yaratishda joriy lokatsiya, keyin o'zgarmaydi; formada maydon yo'q ([locations.md](locations.md), 6-bo'lim) |
| **Mas'ul** | yo'q | kompaniya a'zosi, buyurtma lokatsiyasida ishlaydigan (4.2) |
| **Narx** | yo'q | ≥ 0, 12 xonagacha butun va 2 kasr, valyutasi va kursi bilan ([currencies.md](currencies.md), 5-bo'lim); 0 = narx yo'q (4.3) |

### 3.4 Tayyor sozlamalar

Har kompaniya quyidagilar bilan boshlaydi (mavjud kompaniyalarga migratsiya yozadi, yangisiga kompaniya yaratilganda):

| Bosqich | Rang | Yakuniy |
|---|---|---|
| Yangi | `blue` | yo'q |
| Jarayonda | `amber` | yo'q |
| Bajarildi | `green` | ha |

va bitta tur: "Buyurtma" (maydonsiz). Owner ularni o'zgartirishi va o'chirishi mumkin. 2026-10-18 gacha tayyor tur "Vazifa" edi: migratsiya 00020 kompaniyaning jonli "Vazifa" turini "Buyurtma" deb ataydi, agar kompaniyada jonli "Buyurtma" (har qanday registrda) bo'lmasa; o'chirilgan tur nomi o'zgarmaydi.

## 4. Buyurtma

- **Qo'shish.** `POST /app/orders {type_id, location_id, title, deadline, stage_id, assignee_phone?, values, customer, amount?, currency_id?, rate?, items?, payments?}` (narx, valyuta va kurs, tovar qatorlari, avans: 4.3). Buyurtma `location_id` lokatsiyasiga (joriy lokatsiya) tushadi; a'zoga ruxsatsiz lokatsiya 403 `forbidden` ([locations.md](locations.md), 6-bo'lim). `customer` yo mavjud mijoz (`{id}`), yo yangi mijoz (`{type_id, phone, values}`, [customers.md](customers.md) 4-bo'lim qoidalari bilan). Yangi mijoz buyurtma bilan bitta tranzaksiyada yaratiladi: ikkisi birga yoziladi yoki hech biri; mijozning o'z tarixiga "qo'shildi" yoziladi. Kim qo'shgani saqlanadi. Yangi mijoz bilan qo'shish `orders.create` dan tashqari `customers.create` ruxsatini ham talab qiladi (ikkinchisi bo'lmasa 403 `forbidden`); mavjud mijozni telefon takliflaridan tanlash uchun `customers.view` kerak. Ruxsati yo'q qism formada ko'rinmaydi ([roles.md](roles.md), 4.3).
- **Tahrirlash.** `PUT /app/orders/{id} {title, deadline, stage_id, assignee_phone, values, amount?, currency_id?, rate?, items?}`: yuborilganiga almashadi, yuborilmagan maydonning qiymati o'chadi (narx 0 bo'ladi, qatorlar bo'shaydi). Mijoz, tur va lokatsiya o'zgarmaydi; to'lovlar bu yerda emas (4.3). Ikki kishi bir vaqtda tahrirlasa, oxirgi saqlagan qoladi. Hech narsa o'zgarmagan saqlash hech narsani yozmaydi.
- **Ko'chirish.** `PATCH /app/orders/{id}/stage {stage_id}`: faqat bosqich o'zgaradi (kanban'da sudrash, kartadagi va buyurtma sahifasidagi "Bosqich" tanlovi). Tarixga "Bosqich" o'zgarishi yoziladi.
- **O'chirish.** Buyurtma yashiriladi (`deleted_at`), bazadan o'chmaydi: ro'yxatda, kanban'da, mijoz sahifasida ko'rinmaydi, sahifasi 404. Tiklash yo'q. Buyurtma hujjati ham yashiriladi: tovarlari qoldiqqa qaytadi, to'lovlari yo'qoladi, mijoz balansi shunga yarasha o'zgaradi (4.3).
- **Qo'shgan.** Mijozlardagi "Qo'shgan" kabi: a'zoning hozirgi ismi, chiqarilgan bo'lsa qo'shgan paytdagi ismi.

### 4.1 Tekshiruv

`values` mijozlardagidek ([customers.md](customers.md), 4.1): kalit maydon ID'si, bo'sh qiymat saqlanmaydi, xabarlari bir xil. A'zoga ruxsatsiz lokatsiya (`location_id` begona, o'chirilgan yoki cheklov bilan yopilgan) hammasidan oldin 403 `forbidden`. Tekshiruv quyidagi tartibda, birinchi xato qaytadi (400 `validation_error`):

| Holat | Xabar |
|---|---|
| nom bo'sh | "Buyurtma nomini kiriting" |
| nom 200 belgidan uzun | "Buyurtma nomi 200 belgidan oshmasin" |
| muddat bo'sh | "Muddatni kiriting" |
| muddat `YYYY-MM-DD` emas yoki bunday sana yo'q | "Muddat noto'g'ri" |
| lokatsiya berilmagan (`location_id` yo'q yoki 0) | "Lokatsiyani tanlang" |
| tur yo'q yoki o'chirilgan | "Buyurtma turini tanlang" |
| bosqich yo'q yoki o'chirilgan | "Bosqichni tanlang" |
| mas'ul kompaniya a'zosi emas (tahrirda faqat o'zgargan bo'lsa tekshiriladi) | "Mas'ul kompaniya a'zosi emas" |
| mas'ul buyurtma lokatsiyasida ishlamaydi (tahrirda faqat o'zgargan bo'lsa) | "Mas'ul bu lokatsiyada ishlamaydi" |
| turda yo'q maydon yuborilgan; maydon qiymatlari | mijozlardagi xabarlar |
| mijoz berilmagan, yo'q, o'chirilgan yoki boshqa kompaniyaniki | "Mijozni tanlang" |
| yangi mijozda xato | mijoz xabarlari; takror telefon va takrorlanmas qiymat 409 (`customer_id` bilan) |
| narx formati noto'g'ri yoki manfiy | "Narx noto'g'ri" |
| valyuta yoqilmagan / kurs yo'q yoki noto'g'ri | `currency_not_allowed` / "Kursni kiriting" / "Kurs noto'g'ri" ([currencies.md](currencies.md)) |
| tovar qatorida xato | sotuv xabarlari: "Mahsulotni tanlang", "Mahsulot nofaol", "«X» ikki marta kiritilgan", "«X» miqdori noto'g'ri" ([sales.md](sales.md), 3.2) |
| avans qatorida xato | "Akkauntni tanlang", "Akkaunt nofaol", "To'lov summasi noto'g'ri" |

Keyin qoldiq: 409 `stock_insufficient` "«X» uchun omborda yetarli qoldiq yo'q", hech narsa yozilmaydi. Tahrirda eng avval buyurtmaning o'zi (404 "Buyurtma topilmadi"), qolgani shu tartibda (mijoz tekshirilmaydi: u o'zgarmaydi; avans yo'q). Mavjud mijoz bilan qo'shishda mijozning maydonlari tekshirilmaydi: keyin majburiy qilingan bo'sh maydon buyurtmaga to'sqinlik qilmaydi.

### 4.2 Mas'ul

- Qo'shishda va tahrirda mas'ul kompaniyaning hozirgi a'zolaridan tanlanadi (egasi ham). Tanlanmasa buyurtma mas'ulsiz.
- A'zoning o'sha paytdagi ismi buyurtmada saqlanadi. Ko'rsatishda a'zoning hozirgi ismi, chiqarilgan bo'lsa saqlangan ismi.
- A'zo kompaniyadan chiqarilsa, unga biriktirilgan buyurtmalar o'zgarmaydi: mas'ul sifatida saqlangan ismi ko'rinadi. Shunday buyurtma tahrirlansa, formada u "Ism (chiqarilgan)" varianti bilan tanlangan turadi; o'zgartirilmasa saqlanadi, boshqasi tanlansa yangi mas'ul a'zo bo'lishi shart. Qayta qo'shilsa yana a'zo sifatida ko'rinadi.
- "Mas'ul" filtri faqat hozirgi a'zolarni taklif qiladi.
- Mas'ul buyurtma lokatsiyasida ishlaydigan a'zo bo'lishi shart (egasi va cheklanmagan xodim har lokatsiyada; [locations.md](locations.md), 5 va 6-bo'limlar): forma faqat shularni taklif qiladi (`GET /app/members` dagi `locations`). Tahrirda hozirgi mas'ul u yerda ishlamasa "Ism (bu lokatsiyada ishlamaydi)" varianti bilan tanlangan turadi; o'zgartirilmasa saqlanadi, boshqasi tanlansa yangi mas'ul shu lokatsiyada bo'lishi shart. Xodim cheklanganda unga biriktirilgan buyurtmalar o'zgarmaydi.

### 4.3 Narx, to'lovlar, tovarlar

Buyurtmaning puli va tovarlari jurnalda bitta hujjat (`transactions`, `kind = 'order'`, `order_id` buyurtmaga; [warehouse.md](warehouse.md), 1-bo'lim): `total` = narx, qatorlari = tovarlar, harakatlari = tovar chiqimi, to'lovlari = unga bog'langan mijoz to'lovlari (`customer_payment`, `linked_id`).

- **Hujjat qachon.** Kerak bo'lganda: qo'shishda narx > 0, yoki qator bor, yoki avans bor; tahrirda hujjat yo'q bo'lsa va narx > 0 yoki qator bo'lsa; sahifadan to'lov qo'shilganda. Yaratilgach qoladi (keyin narx 0 va qatorsiz bo'lsa ham). Vaqti (`doc_at`) yaratilgan daqiqa (soniyalarsiz: formalar har hujjatni daqiqagacha sanalaydi, shunda sahifadan shu daqiqada kiritilgan to'lov hisob harakatida buyurtmadan keyin turadi), keyin o'zgarmaydi; kurs qatori shu lahzadagi standart, formada o'zgartirilsa hujjatning o'z qatori ([currencies.md](currencies.md), 4-bo'lim); raqami ko'rsatilmaydi. Hujjatsiz buyurtma API'da `amount: "0.00"`, `paid: "0.00"`.
- **Narx** (`amount`, `currency_id`, `rate`): hujjat valyutasida; so'mdagi qiymat (`amount_uzs`) hujjat kursi bilan. Mijoz qarziga yoziladi.
- **Tovarlar** (`items[]: {product_id, quantity}`): mahsulot yoki xizmat (jonli; yangi qo'shilgani faol, avvaldan bor nofaol qoladi), bir hujjatda bir marta, miqdor > 0 (3 kasr); qatorlar bo'sh bo'lishi mumkin; narxi yo'q: tovar buyurtma narxiga ta'sir qilmaydi. Mahsulot qatori saqlangan zahoti buyurtma lokatsiyasi qoldig'idan chiqadi (sotuvdagidek; xizmat qoldiqqa tegmaydi); qoldiq yetmasa 409 `stock_insufficient`, hech narsa yozilmaydi. Tahrirda qatorlar yuborilganiga butunlay almashadi, harakatlar qayta yoziladi (eski va yangi mahsulotlar tekshiriladi).
- **Avans** (`payments[]: {bank_account_id, amount}`, faqat qo'shishda): sotuvdagi to'lov qatorlari ([sales.md](sales.md), 3.1): akkaunt faol, summa > 0 akkaunt valyutasida, vaqti hujjatniki, kursi akkaunt valyutasining shu sanadagi standarti.
- **Keyingi to'lovlar** buyurtma sahifasidan: `POST /app/orders/{id}/payments {bank_account_id, amount, at, rate?, note?}` ([sales.md](sales.md), 5-bo'limdagi mijoz to'lovi qoidalari), `PUT/DELETE /app/orders/{id}/payments/{paymentId}`: faqat shu buyurtmaga bog'langan to'lov (boshqasi 404 "To'lov topilmadi"). To'lov mijozniki (`customer_id` buyurtma mijozi) va buyurtmaga bog'langan (`linked_id`); mijoz sahifasidan o'zgartirilmaydi: 409 `payment_linked` "Bu to'lov buyurtma bilan kiritilgan: buyurtmani oching". Ruxsat `orders.edit`.
- **To'langan** (`paid`) = bog'langan jonli to'lovlarning hujjat valyutasiga aylantirilgan yig'indisi (har to'lov o'z kursi bilan); **qolgan** = narx − to'langan, manfiysi mijoz avansi.
- **Mijoz balansi** ([sales.md](sales.md), 5-bo'lim): buyurtma narxi sotuv kabi qarzga qo'shiladi, to'lovlari ayiriladi: 5 000 $ buyurtma, 400 $ avans, keyin 300 $ to'lov → mijoz qarzi 4 300 $ (so'mda har hujjat o'z kursi bilan). Hisob harakatida buyurtma qatori "Buyurtma · nomi" (buyurtma sahifasiga havola), to'lovi "To'lov · nomi"; narxi 0 hujjat hisob harakatida ko'rinmaydi.
- **Sahifada:** pul kartasi (Narx, To'langan, Qolgan; narxsiz va to'lovsiz bo'lsa yo'q), "To'lov" plitkasi (`orders.edit`), "Mahsulotlar" ro'yxati (nom, miqdor birligi bilan), "To'lovlar" ro'yxati (akkaunt, vaqt, summa; qatorda tahrirlash / o'chirish, `orders.edit`). Qo'shish formasida "Narx" (2+ valyutada valyuta va kurs), "Mahsulotlar" (mahsulot yoki xizmat nom yoki artikul bo'yicha, faqat faollar; `products.view` bo'lmasa bo'lim yo'q), "Avans" (akkaunt va summa, "To'liq"); tahrir formasida narx va mahsulotlar, to'lovlar yo'q.
- Lokatsiya va mahsulot o'chirish, akkaunt va valyuta cheklovlari (`*_in_use`) buyurtma hujjatini va to'lovlarini ham sanaydi ([warehouse.md](warehouse.md), [finance.md](finance.md), [currencies.md](currencies.md)). Mahsulot sahifasidagi "Harakatlar"da buyurtma chiqimi "Buyurtma · nomi" bilan, kontragent mijoz nomi ([products.md](products.md), 6-bo'lim). Bosh sahifada "Buyurtmalar" kartasi: oy ichida yaratilgan narxli buyurtmalar so'mdagi yig'indisi va soni (`orders.view`).

### 4.4 Tan narxi (FIFO)

Buyurtma tovarlarining tan narxi jurnaldan FIFO bilan hisoblanadi ([warehouse.md](warehouse.md), 10-bo'lim), so'mda, saqlanmaydi: `GET /app/orders/{id}` da har mahsulot qatorida `cost_uzs`, jami `cost_uzs` va `profit_uzs` = so'mdagi narx − tan narx (narx 0 bo'lsa `null`); xizmat qatorida 0. Faqat `purchases.view` bo'lganga, aks holda `null` va sahifada ko'rinmaydi. Sahifada "Mahsulotlar" ostida "Tan narxi: N so'm" va "Foyda: M so'm" (yashil) yoki "Zarar: M so'm" (qizil). Foyda / zarar hisoboti keyingi versiyada.

## 5. O'chirish qoidalari

Hamma narsa yashiriladi, bazadan o'chmaydi. Faol buyurtmada ishlatilayotgan narsa o'chirilmaydi:

| Nima | Qachon o'chirilmaydi | Rad javobi (409) |
|---|---|---|
| bosqich | shu bosqichda faol buyurtma bor | `stage_in_use`: "Bu bosqichda N ta buyurtma bor" |
| tur | shu turda faol buyurtma bor | `type_in_use`: "Bu turda N ta buyurtma bor" |
| maydon | faol buyurtmada to'ldirilgan | `field_in_use`: "Bu maydon N ta buyurtmada to'ldirilgan" |
| mijoz | faol buyurtmasi bor (har qanday bosqichda) | `customer_in_use`: "Bu mijozda N ta buyurtma bor" |
| variant | faol buyurtmada tanlangan (mijozlardan keyin tekshiriladi) | `option_in_use`: "Bu variant N ta buyurtmada tanlangan" |
| dropdown | o'chirilmagan mijoz yoki buyurtma maydoniga ulangan | `dropdown_in_use` (ikkala maydon turi birga sanaladi) |

- O'chirilgan buyurtmalar hisobga olinmaydi.
- Tur o'chirilsa, uning maydonlari ham o'chirilgan hisoblanadi. O'chirilgan nom qayta ishlatilishi mumkin.

## 6. Ro'yxat va kanban

- **Lokatsiya:** ro'yxat va kanban joriy lokatsiya buyurtmalarini ko'rsatadi (`GET /app/orders?location_id=`); boshqa lokatsiyaniki ko'rinmaydi. `location_id` berilmasa a'zoga ruxsatli hamma lokatsiya (mijoz sahifasi). Ruxsatsiz `location_id` 403 `forbidden`, son bo'lmasa 400 "Lokatsiya noto'g'ri" ([locations.md](locations.md), 6-bo'lim). Buyurtma sahifasida 2+ ruxsatli lokatsiyada "Lokatsiya" fakti; sahifa joriy lokatsiyani o'zgartirmaydi.
- **Tartib:** muddati yaqini birinchi (`deadline`, keyin `id`), ro'yxatda ham, kanban bosqichi ichida ham. Sahifada 20 ta.
- **Filtrlar** (`GET /app/orders`): `location_id`, `type_id`, `stage_id`, `assignee` (a'zo telefoni), `customer_id`, `search`, `page`. Birga ishlaydi.
- **Qidiruv:** buyurtma nomida, buyurtmaning matn maydonlarida va mijozning matn maydonlarida (katta-kichik harf farqsiz, harfma-harf). Faqat raqamlardan iborat qidiruv mijoz telefonida va butun son maydonlarida (buyurtma va mijoz) ham qidiriladi. Variant nomi bo'yicha qidirilmaydi.
- **Ikki ko'rinish:** ro'yxat (jadval, telefonda kartochka) va kanban. Birinchi kirishda kanban; tanlov manzilda (`?view=`) va brauzerda eslanadi.
- **Ro'yxat ustunlari:** "Buyurtma" (nom), "Mijoz" (nom va telefon, mijoz sahifasiga havola), "Turi", "Bosqich", "Muddat", "Mas'ul", turlarning maydonlari (bir xil nomlilar bitta ustun, [customers.md](customers.md) 6-bo'lim), "Qo'shgan", "Qo'shilgan". Har user "Ustunlar" menyusida ustunlarni o'ziga yashiradi ("Buyurtma" yashirilmaydi); tanlov brauzerda saqlanadi.
- **Kanban:** bosqichlar tartibda yonma-yon, har birida shu bosqich buyurtmalari 20 tadan ("Yana" bilan davomi) va jami soni; tur, qidiruv va mas'ul filtrlari kanban'ga ham tegishli. Karta sudrab boshqa bosqichga tashlanadi (sichqoncha, barmoq); har kartada "Bosqich" menyusi ham bor (klaviatura, barmoq). Har bosqich sarlavhasida "+" shu bosqich tanlangan qo'shish formasini ochadi. Yakuniy bosqich ustuni yig'ilgan turadi (sarlavha va soni), bosilsa ochiladi; holati brauzerda eslanadi.
- **Pul:** narxi bor buyurtmaning kartasida va qatorida qo'shimcha qator: "5 000 $ · qolgan 4 300 $" (to'liq to'langanda "5 000 $ · to'langan", ortiqcha to'langanda "· avans N"); narxsiz buyurtmada yo'q (4.3).
- **Muddat ko'rinishi:** `dd.mm.yyyy` va nisbiy matn: "Bugun", "N kun qoldi", "N kun kechikdi" (brauzerning lokal sanasidan). Muddati o'tgan va yakuniy bo'lmagan buyurtma qizil. Yakuniy bosqichda faqat sana.
- **Mijoz sahifasi:** mijozning a'zoga ruxsatli hamma lokatsiyadagi buyurtmalari (nom, bosqich, muddat; 2+ lokatsiyada lokatsiya belgisi) o'sha tartibda, 20 tadan.
- **Manzillar:** ro'yxat va kanban `/orders`, buyurtma sahifasi `/orders/{id}`, turlar `/settings/order-types`. 2026-10-18 gacha ular `/tasks…` va `/settings/task-types…` edi: eski manzil yangisiga doimiy yo'naltiriladi (308, so'rov parametrlari bilan); sozlamalarning eski `?tab=tasks` manzili buyurtma turlarini ochadi.

## 7. Tarix

Buyurtmaning har o'zgarishi yoziladi: qo'shilgani, har tahriri va ko'chirilgani, o'chirilgani, kim qilgani bilan. Tahrirda va ko'chirishda o'zgargan har narsa eski va yangi qiymati bilan: "Nomi", "Muddat" (`dd.mm.yyyy`), "Bosqich" (nomi), "Mas'ul" (ismi, bo'shi bo'sh matn), keyin maydonlar o'z tartibida (variantlar nomi bilan), keyin "Narx" (pul matni: "5 000 $", "1 200 000 so'm"; narxsiz bo'sh matn) va "Mahsulotlar" ("Kabel × 2 m, Montaj × 1"; bo'shi bo'sh matn). To'lovlar tarixga yozilmaydi: ular jurnal hujjatlari (4.3). Qiymatlar o'sha paytdagi nomlari bilan matn sifatida yoziladi: keyin qayta nomlansa, tarix o'zgarmaydi. Qo'shish va o'chirish yozuvida o'zgarishlar ro'yxati bo'sh. Hech narsa o'zgarmagan saqlash tarixga yozilmaydi.

Tarixni egasi va `orders.history` ruxsatli xodim ko'radi (`GET /app/orders/{id}/history`, oxirgisi birinchi), buyurtma sahifasida; rolsiz xodim ko'rmaydi. O'chirilgan buyurtmaning tarixi bazada qoladi, lekin API'da ko'rinmaydi (404).

## 8. Chekka holatlar

| Holat | Natija |
|---|---|
| Buyurtma qo'shilayotganda yozilgan telefon mavjud mijozniki, lekin taklifdan tanlanmagan | 409 `phone_taken` (`customer_id` bilan): forma "Shu mijozni biriktirish" ni taklif qiladi |
| Owner hamma bosqichni o'chirdi | buyurtma qo'shib bo'lmaydi; sahifa egasini (va `settings.view` ruxsatli xodimni) Sozlamalarga yo'naltiradi, boshqa xodimga aytadi |
| Owner hamma buyurtma turini o'chirdi | buyurtma qo'shib bo'lmaydi (mijozlardagi kabi) |
| Owner hamma mijoz turini o'chirdi | buyurtma faqat mavjud mijoz bilan qo'shiladi; forma yangi mijoz qismini yashirib, buni aytadi |
| Bosqich ochiq kanban'da turganda boshqa joyda o'chirildi, karta unga tashlandi | 400 "Bosqichni tanlang": karta qaytadi, bosqichlar qayta so'raladi |
| Mas'ul kompaniyadan chiqarildi | buyurtma unda qoladi, ismi saqlanganidan (4.2) |
| Buyurtmaning mijozi | o'chirilmaydi (`customer_in_use`), shuning uchun har buyurtmaning mijozi bor |
| Yakuniy bosqichdagi buyurtma muddati o'tgan | qizil emas, nisbiy matnsiz |
| Tartib o'zgartirilayotganda ro'yxat boshqa joyda o'zgargan | 409 `order_changed` |
| Boshqa kompaniyaning buyurtmasi, bosqichi yoki turi ID bo'yicha so'raldi | 404 `not_found` |
| A'zoga ruxsatsiz lokatsiyadagi buyurtma ID bo'yicha so'raldi (havola orqali) | 404 `not_found` |
| Joriy lokatsiya o'chirildi yoki cheklov bilan yopildi | ro'yxat 403 `forbidden`; `/app/me` qayta so'raladi, tanlovchi ruxsatli birinchisiga tushadi |
| A'zoda ruxsatli lokatsiya yo'q | ro'yxat bo'sh, qo'shish 400; sahifa "Sizga lokatsiya biriktirilmagan" deydi |
| Buyurtma tovarining qoldig'i yetmaydi | 409 `stock_insufficient`, buyurtma yozilmaydi (tahrirda o'zgarmaydi) |
| Avans narxdan ko'p, yoki to'lovlar jamidan oshdi | mumkin: mijoz avansi (qolgan manfiy) |
| Narxsiz buyurtmaga tovar biriktirildi | hujjat narxi 0: balansga ta'sir qilmaydi, hisob harakatida ko'rinmaydi, tovar qoldiqdan chiqadi |
| Buyurtma bilan kiritilgan to'lov mijoz sahifasidan o'zgartirilmoqchi | 409 `payment_linked` |
| Buyurtma o'chirildi | tovarlari qoldiqqa qaytadi, to'lovlari yo'qoladi, mijoz balansi o'zgaradi |
| Mahsulotning xaridi yo'q, tan narxi so'raldi | tan narxi 0 (oxirgi ma'lum xarid narxi yo'q) |

## 9. Xato kodlari

| Kod | Status | Xabar |
|---|---|---|
| `validation_error` | 400 | 4.1-bo'lim xabarlari ("Lokatsiyani tanlang", "Mas'ul bu lokatsiyada ishlamaydi", "Narx noto'g'ri", "Kursni kiriting", tovar va to'lov qatorlari xabarlari ham); to'lovda "Akkauntni tanlang", "Summa noto'g'ri", "Vaqtni kiriting"; "Nomni kiriting", "Nom 60 belgidan oshmasin", "Rangni tanlang", "Maydon turini tanlang", "Dropdownni tanlang"; ro'yxatda "Sahifa raqami noto'g'ri", "Buyurtma turi noto'g'ri", "Bosqich noto'g'ri", "Mijoz noto'g'ri", "Lokatsiya noto'g'ri" |
| `company_required` | 403 | "Avval kompaniyani tanlang" |
| `forbidden` | 403 | "Bu amal uchun ruxsatingiz yo'q" (ruxsat yetmaganda; a'zoga ruxsatsiz `location_id` da ham) |
| `not_found` | 404 | "Buyurtma topilmadi", "Bosqich topilmadi", "Tur topilmadi", "Maydon topilmadi", "To'lov topilmadi" |
| `currency_not_allowed` | 400 | "Bu valyuta kompaniyada yoqilmagan" |
| `stock_insufficient` | 409 | "«X» uchun omborda yetarli qoldiq yo'q" |
| `payment_linked` | 409 | "Bu to'lov buyurtma bilan kiritilgan: buyurtmani oching" (mijoz sahifasidan) |
| `name_taken` | 409 | "Bu nomli bosqich allaqachon bor", "Bu nomli tur allaqachon bor", "Bu nomli maydon allaqachon bor" |
| `phone_taken`, `value_taken` | 409 | yangi mijoz bilan qo'shishda, mijozlardagi xabarlar (`customer_id` bilan) |
| `stage_in_use`, `type_in_use`, `field_in_use`, `customer_in_use`, `option_in_use`, `dropdown_in_use` | 409 | 5-bo'limdagi xabarlar |
| `order_changed` | 409 | "Ro'yxat o'zgargan. Sahifani yangilang" |
