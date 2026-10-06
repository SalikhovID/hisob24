# Vazifalar: bosqichlar, turlar, maydonlar, mas'ul

Bu hujjat vazifalar bo'limi qoidalarini belgilaydi: vazifa nima, u qaysi bosqichda turadi, turi va maydonlari qanday sozlanadi, mijozga qanday biriktiriladi, kim nima qila oladi, nima qachon o'chadi. Rollar: [roles.md](roles.md). Mijozlar, turlar, maydonlar va dropdownlarning umumiy qoidalari: [customers.md](customers.md).

> Holat: amalga oshirilgan (2026-10-06). Qoida o'zgarsa, avval shu hujjat, keyin kod o'zgartiriladi. Dizayn, bosqichlar va amalga oshirishdagi qarorlar: `docs/superpowers/specs/2026-10-06-tasks-design.md`.

## 1. Tushunchalar

| Tushuncha | Ma'nosi | Bazada |
|---|---|---|
| **Vazifa** | Kompaniya xodimlari bajaradigan ish: nomi, muddati, mijozi, bosqichi, turi va shu turning maydonlaridagi qiymatlar; ixtiyoriy mas'ul. | `tasks` |
| **Bosqich** | Vazifaning holati va kanban ustuni (masalan, Yangi, Jarayonda, Bajarildi). Nomi, rangi, tartibi va "Yakuniy" belgisi bor. | `task_stages` |
| **Tur** | Vazifalar toifasi (masalan, Buyurtma, Shikoyat). Vazifa formasining o'zgaruvchan qismini belgilaydi. | `task_types` |
| **Maydon** | Turning bitta savoli: nomi, turi, majburiyligi. Har tur o'z maydonlariga ega. | `task_fields` |
| **Dropdown, Variant** | Mijozlardagi bilan bir xil ro'yxatlar: vazifa maydonlari ham variantlarini ulardan oladi. | `customer_dropdowns`, `customer_dropdown_options` |
| **Qiymat** | Vazifaning bitta maydonga javobi. | `task_values` |
| **Mas'ul** | Vazifa biriktirilgan kompaniya a'zosi (egasi yoki xodim). Ixtiyoriy. | `tasks.assignee_phone` |

Hamma narsa kompaniyaga tegishli; kompaniya so'rovdan emas, access token'dan olinadi. Bosqichlar kompaniyaniki, turga bog'liq emas: har turdagi vazifa har bosqichda turishi mumkin.

## 2. Kim nima qila oladi

| Amal | owner | user |
|---|---|---|
| Vazifalar ro'yxati, kanban va vazifa sahifasini ko'rish | ✓ | ✓ |
| Vazifa qo'shish, tahrirlash, bosqichini o'zgartirish, o'chirish (kim qo'shgani va kimga biriktirilganidan qat'i nazar) | ✓ | ✓ |
| Bosqichlar, turlar va dropdownlarni o'qish (forma va ro'yxat uchun) | ✓ | ✓ |
| A'zolar ro'yxatini o'qish (mas'ul tanlash uchun, `GET /app/members`) | ✓ | ✓ |
| Bosqich, tur va maydonlarni sozlash | ✓ | ✗ |
| Vazifaning o'zgarishlar tarixini ko'rish | ✓ | ✗ |

- "Vazifalar" bo'limi hammaga, sozlamalar faqat owner'ga ko'rinadi.
- `user` sozlash amalini yuborsa: 403 `owner_only`. Kompaniya tanlanmagan sessiya: 403 `company_required`.

## 3. Sozlamalar

### 3.1 Bosqichlar

- Bosqichning nomi (60 belgigacha, kompaniyada takrorlanmaydi, katta-kichik harf farqsiz: 409 `name_taken`), rangi va "Yakuniy" belgisi bor. Hammasi keyin o'zgartiriladi.
- **Rang** to'qqiz tayyor rangdan biri: `slate`, `red`, `orange`, `amber`, `green`, `teal`, `blue`, `violet`, `pink`. Rang kanban sarlavhasida va bosqich belgisida ko'rinadi. Rang berilmasa yoki ro'yxatda bo'lmasa: "Rangni tanlang".
- **Yakuniy** bosqichdagi vazifa bajarilgan hisoblanadi: muddati o'tgan deb belgilanmaydi, nisbiy muddat ko'rsatilmaydi. Yakuniy bosqich bir nechta bo'lishi mumkin, bo'lmasligi ham.
- **Tartib** owner belgilaydi (sudrab); kanban ustunlari va "Bosqich" tanlovlari shu tartibda. Yangi bosqich oxiriga tushadi. Qo'shishda bosqich berilmasa, formada tartib bo'yicha birinchisi tanlangan keladi (API'da bosqich majburiy).
- Vazifasi bor bosqich o'chirilmaydi (5-bo'lim). O'chirilgan nom qayta ishlatilishi mumkin.

### 3.2 Turlar va maydonlar

Mijoz turlaridagi qoidalar ([customers.md](customers.md), 3.1, 3.4) bilan bir xil, ikki farq bilan:

- **"Takrorlanmasin" yo'q.** Vazifa maydoni faqat nom, tur (olti tur: matn, butun son, dropdown, ko'p tanlovli dropdown, radio, checkbox), dropdown (tanlov turlarida) va "Majburiy" belgisiga ega.
- **Nom maydoni yo'q.** Vazifaning nomi doimiy maydon (3.3); turning birinchi matn maydoni alohida ma'noga ega emas.

Tur nomi kompaniyada, maydon nomi tur ichida takrorlanmaydi. Maydonning turi va dropdowni yaratilgandan keyin o'zgarmaydi. "Majburiy" keyin yoqilsa, mavjud vazifalarga tegilmaydi: qiymat keyingi saqlashda talab qilinadi. Nofaol variant mijozlardagidek: yangi tanlovlarda chiqmaydi, tanlagan vazifada qoladi.

### 3.3 Doimiy maydonlar

Har vazifada bor, turlarda sozlanmaydi va maydon qilib qo'shilmaydi:

| Maydon | Majburiy | Qoida |
|---|---|---|
| **Nomi** | ha | matn, chetidagi bo'shliqlar olib tashlanadi, 200 belgigacha |
| **Muddat** | ha | sana (`YYYY-MM-DD`), vaqtsiz; o'tgan sana ham qabul qilinadi |
| **Mijoz** | ha | kompaniyaning faol mijozi; yaratishda biriktiriladi, keyin o'zgarmaydi |
| **Bosqich** | ha | kompaniyaning bosqichi |
| **Mas'ul** | yo'q | kompaniya a'zosi (4.2) |

### 3.4 Tayyor sozlamalar

Har kompaniya quyidagilar bilan boshlaydi (mavjud kompaniyalarga migratsiya yozadi, yangisiga kompaniya yaratilganda):

| Bosqich | Rang | Yakuniy |
|---|---|---|
| Yangi | `blue` | yo'q |
| Jarayonda | `amber` | yo'q |
| Bajarildi | `green` | ha |

va bitta tur: "Vazifa" (maydonsiz). Owner ularni o'zgartirishi va o'chirishi mumkin.

## 4. Vazifa

- **Qo'shish.** `POST /app/tasks {type_id, title, deadline, stage_id, assignee_phone?, values, customer}`. `customer` yo mavjud mijoz (`{id}`), yo yangi mijoz (`{type_id, phone, values}`, [customers.md](customers.md) 4-bo'lim qoidalari bilan). Yangi mijoz vazifa bilan bitta tranzaksiyada yaratiladi: ikkisi birga yoziladi yoki hech biri; mijozning o'z tarixiga "qo'shildi" yoziladi. Kim qo'shgani saqlanadi.
- **Tahrirlash.** `PUT /app/tasks/{id} {title, deadline, stage_id, assignee_phone, values}`: yuborilganiga almashadi, yuborilmagan maydonning qiymati o'chadi. Mijoz va tur o'zgarmaydi. Ikki kishi bir vaqtda tahrirlasa, oxirgi saqlagan qoladi. Hech narsa o'zgarmagan saqlash hech narsani yozmaydi.
- **Ko'chirish.** `PATCH /app/tasks/{id}/stage {stage_id}`: faqat bosqich o'zgaradi (kanban'da sudrash, kartadagi va vazifa sahifasidagi "Bosqich" tanlovi). Tarixga "Bosqich" o'zgarishi yoziladi.
- **O'chirish.** Vazifa yashiriladi (`deleted_at`), bazadan o'chmaydi: ro'yxatda, kanban'da, mijoz sahifasida ko'rinmaydi, sahifasi 404. Tiklash yo'q.
- **Qo'shgan.** Mijozlardagi "Qo'shgan" kabi: a'zoning hozirgi ismi, chiqarilgan bo'lsa qo'shgan paytdagi ismi.

### 4.1 Tekshiruv

`values` mijozlardagidek ([customers.md](customers.md), 4.1): kalit maydon ID'si, bo'sh qiymat saqlanmaydi, xabarlari bir xil. Tekshiruv quyidagi tartibda, birinchi xato qaytadi (400 `validation_error`):

| Holat | Xabar |
|---|---|
| nom bo'sh | "Vazifa nomini kiriting" |
| nom 200 belgidan uzun | "Vazifa nomi 200 belgidan oshmasin" |
| muddat bo'sh | "Muddatni kiriting" |
| muddat `YYYY-MM-DD` emas yoki bunday sana yo'q | "Muddat noto'g'ri" |
| tur yo'q yoki o'chirilgan | "Vazifa turini tanlang" |
| bosqich yo'q yoki o'chirilgan | "Bosqichni tanlang" |
| mas'ul kompaniya a'zosi emas (tahrirda faqat o'zgargan bo'lsa tekshiriladi) | "Mas'ul kompaniya a'zosi emas" |
| turda yo'q maydon yuborilgan; maydon qiymatlari | mijozlardagi xabarlar |
| mijoz berilmagan, yo'q, o'chirilgan yoki boshqa kompaniyaniki | "Mijozni tanlang" |
| yangi mijozda xato | mijoz xabarlari; takror telefon va takrorlanmas qiymat 409 (`customer_id` bilan) |

Tahrirda eng avval vazifaning o'zi (404 "Vazifa topilmadi"), qolgani shu tartibda (mijoz tekshirilmaydi: u o'zgarmaydi). Mavjud mijoz bilan qo'shishda mijozning maydonlari tekshirilmaydi: keyin majburiy qilingan bo'sh maydon vazifaga to'sqinlik qilmaydi.

### 4.2 Mas'ul

- Qo'shishda va tahrirda mas'ul kompaniyaning hozirgi a'zolaridan tanlanadi (egasi ham). Tanlanmasa vazifa mas'ulsiz.
- A'zoning o'sha paytdagi ismi vazifada saqlanadi. Ko'rsatishda a'zoning hozirgi ismi, chiqarilgan bo'lsa saqlangan ismi.
- A'zo kompaniyadan chiqarilsa, unga biriktirilgan vazifalar o'zgarmaydi: mas'ul sifatida saqlangan ismi ko'rinadi. Shunday vazifa tahrirlansa, formada u "Ism (chiqarilgan)" varianti bilan tanlangan turadi; o'zgartirilmasa saqlanadi, boshqasi tanlansa yangi mas'ul a'zo bo'lishi shart. Qayta qo'shilsa yana a'zo sifatida ko'rinadi.
- "Mas'ul" filtri faqat hozirgi a'zolarni taklif qiladi.

## 5. O'chirish qoidalari

Hamma narsa yashiriladi, bazadan o'chmaydi. Faol vazifada ishlatilayotgan narsa o'chirilmaydi:

| Nima | Qachon o'chirilmaydi | Rad javobi (409) |
|---|---|---|
| bosqich | shu bosqichda faol vazifa bor | `stage_in_use`: "Bu bosqichda N ta vazifa bor" |
| tur | shu turda faol vazifa bor | `type_in_use`: "Bu turda N ta vazifa bor" |
| maydon | faol vazifada to'ldirilgan | `field_in_use`: "Bu maydon N ta vazifada to'ldirilgan" |
| mijoz | faol vazifasi bor (har qanday bosqichda) | `customer_in_use`: "Bu mijozda N ta vazifa bor" |
| variant | faol vazifada tanlangan (mijozlardan keyin tekshiriladi) | `option_in_use`: "Bu variant N ta vazifada tanlangan" |
| dropdown | o'chirilmagan mijoz yoki vazifa maydoniga ulangan | `dropdown_in_use` (ikkala maydon turi birga sanaladi) |

- O'chirilgan vazifalar hisobga olinmaydi.
- Tur o'chirilsa, uning maydonlari ham o'chirilgan hisoblanadi. O'chirilgan nom qayta ishlatilishi mumkin.

## 6. Ro'yxat va kanban

- **Tartib:** muddati yaqini birinchi (`deadline`, keyin `id`), ro'yxatda ham, kanban bosqichi ichida ham. Sahifada 20 ta.
- **Filtrlar** (`GET /app/tasks`): `type_id`, `stage_id`, `assignee` (a'zo telefoni), `customer_id`, `search`, `page`. Birga ishlaydi.
- **Qidiruv:** vazifa nomida, vazifaning matn maydonlarida va mijozning matn maydonlarida (katta-kichik harf farqsiz, harfma-harf). Faqat raqamlardan iborat qidiruv mijoz telefonida va butun son maydonlarida (vazifa va mijoz) ham qidiriladi. Variant nomi bo'yicha qidirilmaydi.
- **Ikki ko'rinish:** ro'yxat (jadval, telefonda kartochka) va kanban. Birinchi kirishda kanban; tanlov manzilda (`?view=`) va brauzerda eslanadi.
- **Ro'yxat ustunlari:** "Vazifa" (nom), "Mijoz" (nom va telefon, mijoz sahifasiga havola), "Turi", "Bosqich", "Muddat", "Mas'ul", turlarning maydonlari (bir xil nomlilar bitta ustun, [customers.md](customers.md) 6-bo'lim), "Qo'shgan", "Qo'shilgan". Har user "Ustunlar" menyusida ustunlarni o'ziga yashiradi ("Vazifa" yashirilmaydi); tanlov brauzerda saqlanadi.
- **Kanban:** bosqichlar tartibda yonma-yon, har birida shu bosqich vazifalari 20 tadan ("Yana" bilan davomi) va jami soni; tur, qidiruv va mas'ul filtrlari kanban'ga ham tegishli. Karta sudrab boshqa bosqichga tashlanadi (sichqoncha, barmoq); har kartada "Bosqich" menyusi ham bor (klaviatura, barmoq). Har bosqich sarlavhasida "+" shu bosqich tanlangan qo'shish formasini ochadi. Yakuniy bosqich ustuni yig'ilgan turadi (sarlavha va soni), bosilsa ochiladi; holati brauzerda eslanadi.
- **Muddat ko'rinishi:** `dd.mm.yyyy` va nisbiy matn: "Bugun", "N kun qoldi", "N kun kechikdi" (brauzerning lokal sanasidan). Muddati o'tgan va yakuniy bo'lmagan vazifa qizil. Yakuniy bosqichda faqat sana.
- **Mijoz sahifasi:** mijozning vazifalari (nom, bosqich, muddat) o'sha tartibda, 20 tadan.

## 7. Tarix

Vazifaning har o'zgarishi yoziladi: qo'shilgani, har tahriri va ko'chirilgani, o'chirilgani, kim qilgani bilan. Tahrirda va ko'chirishda o'zgargan har narsa eski va yangi qiymati bilan: "Nomi", "Muddat" (`dd.mm.yyyy`), "Bosqich" (nomi), "Mas'ul" (ismi, bo'shi bo'sh matn), keyin maydonlar o'z tartibida (variantlar nomi bilan). Qiymatlar o'sha paytdagi nomlari bilan matn sifatida yoziladi: keyin qayta nomlansa, tarix o'zgarmaydi. Qo'shish va o'chirish yozuvida o'zgarishlar ro'yxati bo'sh. Hech narsa o'zgarmagan saqlash tarixga yozilmaydi.

Tarixni faqat owner ko'radi (`GET /app/tasks/{id}/history`, oxirgisi birinchi), vazifa sahifasida. O'chirilgan vazifaning tarixi bazada qoladi, lekin API'da ko'rinmaydi (404).

## 8. Chekka holatlar

| Holat | Natija |
|---|---|
| Vazifa qo'shilayotganda yozilgan telefon mavjud mijozniki, lekin taklifdan tanlanmagan | 409 `phone_taken` (`customer_id` bilan): forma "Shu mijozni biriktirish" ni taklif qiladi |
| Owner hamma bosqichni o'chirdi | vazifa qo'shib bo'lmaydi; sahifa owner'ni Sozlamalarga yo'naltiradi, xodimga aytadi |
| Owner hamma vazifa turini o'chirdi | vazifa qo'shib bo'lmaydi (mijozlardagi kabi) |
| Owner hamma mijoz turini o'chirdi | vazifa faqat mavjud mijoz bilan qo'shiladi; forma yangi mijoz qismini yashirib, buni aytadi |
| Bosqich ochiq kanban'da turganda boshqa joyda o'chirildi, karta unga tashlandi | 400 "Bosqichni tanlang": karta qaytadi, bosqichlar qayta so'raladi |
| Mas'ul kompaniyadan chiqarildi | vazifa unda qoladi, ismi saqlanganidan (4.2) |
| Vazifaning mijozi | o'chirilmaydi (`customer_in_use`), shuning uchun har vazifaning mijozi bor |
| Yakuniy bosqichdagi vazifa muddati o'tgan | qizil emas, nisbiy matnsiz |
| Tartib o'zgartirilayotganda ro'yxat boshqa joyda o'zgargan | 409 `order_changed` |
| Boshqa kompaniyaning vazifasi, bosqichi yoki turi ID bo'yicha so'raldi | 404 `not_found` |

## 9. Xato kodlari

| Kod | Status | Xabar |
|---|---|---|
| `validation_error` | 400 | 4.1-bo'lim xabarlari; "Nomni kiriting", "Nom 60 belgidan oshmasin", "Rangni tanlang", "Maydon turini tanlang", "Dropdownni tanlang"; ro'yxatda "Sahifa raqami noto'g'ri", "Vazifa turi noto'g'ri", "Bosqich noto'g'ri", "Mijoz noto'g'ri" |
| `company_required` | 403 | "Avval kompaniyani tanlang" |
| `owner_only` | 403 | "Bu bo'lim faqat kompaniya egasi uchun" |
| `not_found` | 404 | "Vazifa topilmadi", "Bosqich topilmadi", "Tur topilmadi", "Maydon topilmadi" |
| `name_taken` | 409 | "Bu nomli bosqich allaqachon bor", "Bu nomli tur allaqachon bor", "Bu nomli maydon allaqachon bor" |
| `phone_taken`, `value_taken` | 409 | yangi mijoz bilan qo'shishda, mijozlardagi xabarlar (`customer_id` bilan) |
| `stage_in_use`, `type_in_use`, `field_in_use`, `customer_in_use`, `option_in_use`, `dropdown_in_use` | 409 | 5-bo'limdagi xabarlar |
| `order_changed` | 409 | "Ro'yxat o'zgargan. Sahifani yangilang" |
