# Mijozlar: turlar, maydonlar, dropdownlar

Bu hujjat mijozlar bo'limi qoidalarini belgilaydi: mijoz nima, uning turi va maydonlari qanday sozlanadi, kim nima qila oladi, nima qachon o'chadi. Rollar: [roles.md](roles.md). Userlar va a'zolik: [user.md](user.md). Vazifalar (mijozga biriktiriladi, dropdownlarni baham ko'radi): [tasks.md](tasks.md).

> Holat: tasdiqlangan va amalga oshirilgan (2026-10-04). Qoida o'zgarsa, avval shu hujjat, keyin kod o'zgartiriladi. Dizayn, bosqichlar va amalga oshirishdagi qarorlar: `docs/superpowers/specs/2026-10-04-customers-design.md`.

## 1. Tushunchalar

| Tushuncha | Ma'nosi | Bazada |
|---|---|---|
| **Mijoz** | Kompaniyaning mijozi: telefon, turi va shu turning maydonlaridagi qiymatlar. Mijoz tizimga kirmaydi, u user emas. | `customers` |
| **Tur** | Mijozlar toifasi (masalan, Jismoniy, Yuridik). Mijoz formasini belgilaydi. | `customer_types` |
| **Maydon** | Turning bitta savoli: nomi, turi, majburiyligi. Har tur o'z maydonlariga ega. | `customer_fields` |
| **Dropdown** | Egasi tuzadigan variantlar ro'yxati. Tanlov maydonlari variantlarini undan oladi; vazifa maydonlari ham ([tasks.md](tasks.md)). | `customer_dropdowns` |
| **Variant** | Dropdown ichidagi bitta tanlov (masalan, Instagram). | `customer_dropdown_options` |
| **Qiymat** | Mijozning bitta maydonga javobi. | `customer_values` |

Hamma narsa kompaniyaga tegishli: bir kompaniya boshqasining mijozlarini, turlarini va dropdownlarini ko'rmaydi. Kompaniya so'rovdan emas, access token'dan olinadi.

## 2. Kim nima qila oladi

| Amal | owner | user |
|---|---|---|
| Mijozlar ro'yxati va mijoz sahifasini ko'rish | ✓ | ✓ |
| Mijoz qo'shish, tahrirlash, o'chirish | ✓ | ✓ |
| Turlar va dropdownlarni o'qish (forma va ro'yxat uchun) | ✓ | ✓ |
| Tur, maydon, dropdown va variantlarni sozlash | ✓ | ✗ |
| Mijozning o'zgarishlar tarixini ko'rish | ✓ | ✗ |

- "Mijozlar" bo'limi hammaga, "Sozlamalar" bo'limi faqat owner'ga ko'rinadi.
- `user` sozlash amalini yuborsa: 403 `owner_only`. Kompaniya tanlanmagan sessiya: 403 `company_required`.

## 3. Sozlamalar

### 3.1 Maydon turlari

| Tur | Interfeysda | Qiymati | Dropdown kerakmi |
|---|---|---|---|
| `string` | Matn | matn, 500 belgigacha | yo'q |
| `int` | Butun son | butun son, ±9 007 199 254 740 991 ichida | yo'q |
| `dropdown` | Dropdown (bitta tanlov) | bitta variant | ha |
| `multi_dropdown` | Dropdown (bir nechta tanlov) | bir nechta variant | ha |
| `radio` | Radio (bitta tanlov) | bitta variant, radio tugmalar bilan | ha |
| `checkbox` | Checkbox (bir nechta tanlov) | bir nechta variant, checkboxlar bilan | ha |

- Maydonning turi va dropdowni yaratilgandan keyin o'zgarmaydi. Nomi, "Majburiy" va "Takrorlanmasin" belgilari o'zgaradi.
- **Majburiy.** Maydon bo'sh bo'lsa, mijoz saqlanmaydi. Belgi keyin yoqilsa, mavjud mijozlarga tegilmaydi: ulardan qiymat keyingi saqlashda talab qilinadi.
- **Takrorlanmasin.** Faqat matn va butun son maydonida. Shu maydonda bir xil qiymatli ikkinchi faol mijoz rad etiladi (409 `value_taken`). Matnda katta-kichik harf farq qilmaydi. Faol mijozlarda takror qiymatlar bor paytda belgini yoqib bo'lmaydi (409 `duplicates_exist`).
- Nomlar: tur nomi kompaniyada, maydon nomi tur ichida, dropdown nomi kompaniyada, variant nomi dropdown ichida takrorlanmaydi (katta-kichik harf farqsiz): 409 `name_taken`. Nom 60 belgigacha.

### 3.2 Telefon

Telefon turlarda sozlanmaydi: u har mijozda bor va majburiy. Faqat O'zbekiston raqami (+998 va 9 ta raqam). Bitta kompaniyada bitta raqam bitta faol mijozniki: takror raqam 409 `phone_taken`.

### 3.3 Mijoz nomi

Mijoz nomi alohida maydon emas. Turning tartib bo'yicha birinchi matn maydoni mijoz nomi hisoblanadi (Jismoniyda "F.I.Sh.", Yuridikda "Nomi"). Shu maydon bo'sh yoki turda matn maydoni yo'q bo'lsa, mijoz telefoni bilan ataladi.

### 3.4 Tartib

Turlar, turning maydonlari va dropdownning variantlari owner belgilagan tartibda turadi (sudrab o'zgartiriladi). Yangi qo'shilgani oxiriga tushadi. Tur tugmalari, forma va ro'yxat ustunlari shu tartibda chiqadi.

### 3.5 Nofaol variant

Owner variantni nofaol qiladi: u yangi tanlovlarda chiqmaydi. Uni allaqachon tanlagan mijozlarda qiymat qoladi, ro'yxatda va mijoz sahifasida ko'rinadi. Shunday mijoz tahrirlansa, nofaol variant uning formasida saqlanib turadi. Variantni qayta faollashtirish mumkin.

### 3.6 Tayyor turlar

Har kompaniya ikki tur bilan boshlaydi (mavjud kompaniyalarga migratsiya yozadi, yangisiga kompaniya yaratilganda):

| Tur | Maydonlar |
|---|---|
| Jismoniy | "F.I.Sh." (matn, majburiy) |
| Yuridik | "Nomi" (matn, majburiy), "INN" (butun son, majburiy, takrorlanmas) |

Owner ularni o'zgartirishi va o'chirishi mumkin. Tayyor dropdown yo'q.

## 4. Mijoz

- **Qo'shish.** Tur tanlanadi, telefon va shu turning maydonlari to'ldiriladi (`POST /app/customers {type_id, phone, values}`). Kim qo'shgani saqlanadi.
- **Tahrirlash.** Telefon va qiymatlar yuborilganiga almashadi (`PUT /app/customers/{id} {phone, values}`): yuborilmagan maydonning qiymati o'chadi. Tur o'zgarmaydi. Ikki kishi bir vaqtda tahrirlasa, oxirgi saqlagan qoladi. Hech narsa o'zgarmagan saqlash hech narsani yozmaydi ("tahrirlangan" vaqti ham o'zgarmaydi).
- **O'chirish.** Mijoz yashiriladi (`deleted_at`), bazadan o'chmaydi. U ro'yxatda va qidiruvda ko'rinmaydi, sahifasi 404 beradi, raqami bo'shaydi. Tiklash yo'q. Faol vazifasi bor mijoz o'chirilmaydi (5-bo'lim).
- **Qo'shgan.** Ro'yxatda mijozni qo'shgan a'zoning shu kompaniyadagi hozirgi ismi ko'rinadi. A'zo kompaniyadan chiqarilgan (yoki hozir ismsiz) bo'lsa, qo'shgan paytdagi ismi ko'rinadi.

### 4.1 Qiymatlar

`values` da kalit maydon ID'si:

| Maydon turi | Qiymat |
|---|---|
| matn | string |
| butun son | integer |
| dropdown, radio | variant ID'si |
| ko'p tanlovli dropdown, checkbox | variant ID'lari massivi |

Bo'sh qiymat (bo'sh matn, `null`, bo'sh massiv, yuborilmagan maydon) saqlanmaydi. Matn chetidagi bo'shliqlar olib tashlanadi; nol (`0`) bo'sh emas. Ko'p tanlovda bir variant ikki marta yuborilsa, bir marta sanaladi; variantlar dropdown tartibida saqlanadi. Tekshiruv quyidagi tartibda, birinchi xato qaytadi: telefon, tur, turda yo'q maydon, keyin turning maydonlari o'z tartibida:

| Holat | Xabar (400 `validation_error`) |
|---|---|
| telefon noto'g'ri | "Telefon raqami noto'g'ri" |
| tur yo'q yoki o'chirilgan | "Mijoz turini tanlang" |
| turda yo'q maydon yuborilgan | "Bu turda bunday maydon yo'q" |
| matn maydoniga matn bo'lmagan qiymat | "«Nomi» matn bo'lishi kerak" |
| matn 500 belgidan uzun | "«Nomi» 500 belgidan oshmasin" |
| butun son emas (kasr, eksponenta, matn) yoki chegaradan tashqarida | "«INN» butun son bo'lishi kerak" |
| variant shu maydonniki emas, o'chirilgan yoki nofaol (mijozning shu maydonida allaqachon tanlangan nofaol variant bundan mustasno) | "«Manba» uchun variant noto'g'ri" |
| majburiy matn yoki son bo'sh | "«INN» maydonini to'ldiring" |
| majburiy tanlov bo'sh | "«Manba» ni tanlang" |

Takror telefon va takrorlanmas qiymat 409 qaytaradi va javobda mavjud mijozning ID'si bor (`customer_id`): forma unga havola beradi. Bu ikki tekshiruv javoblar to'g'ri bo'lgandan keyin: avval telefon, keyin takrorlanmas maydonlar o'z tartibida. Tahrirda mijozning o'z telefoni va o'z qiymati takror hisoblanmaydi. Yo'q mijozni tahrirlash nima yuborilganidan qat'i nazar 404.

## 5. O'chirish qoidalari

Hamma narsa yashiriladi, bazadan o'chmaydi. Faol mijozda ishlatilayotgan narsa o'chirilmaydi:

| Nima | Qachon o'chirilmaydi | Rad javobi (409) |
|---|---|---|
| tur | shu turda faol mijoz bor | `type_in_use`: "Bu turda N ta mijoz bor" |
| maydon | faol mijozda to'ldirilgan | `field_in_use`: "Bu maydon N ta mijozda to'ldirilgan" |
| variant | faol mijozda tanlangan; keyin faol vazifada tanlangan | `option_in_use`: "Bu variant N ta mijozda tanlangan", "Bu variant N ta vazifada tanlangan" |
| dropdown | o'chirilmagan mijoz yoki vazifa maydoniga ulangan | `dropdown_in_use`: "Bu dropdown N ta maydonda ishlatilgan" (ikkala tur birga sanaladi) |
| mijoz | faol vazifasi bor (har qanday bosqichda) | `customer_in_use`: "Bu mijozda N ta vazifa bor" |

- O'chirilgan mijozlar va vazifalar hisobga olinmaydi.
- Tur o'chirilsa, uning maydonlari ham o'chirilgan hisoblanadi.
- O'chirilgan narsaning nomi qayta ishlatilishi mumkin.
- Ishlatilgan variantni o'chirish o'rniga nofaol qilish mumkin (3.5).

## 6. Ro'yxat

- Eng yangi qo'shilgan mijoz birinchi, sahifada 20 ta.
- **Ustunlar.** "Mijoz" (nom, ostida telefon), "Turi", maydonlar, "Qo'shgan", "Qo'shilgan". Turli turlardagi bir xil nomli maydonlar bitta ustun bo'ladi. Nom maydoni alohida ustun bo'lmaydi. Tur filtri tanlansa, ustunlar shu turning maydonlari.
- **Ustun tanlovi.** Har user "Ustunlar" menyusida ustunlarni o'ziga yashiradi yoki ko'rsatadi. Tanlov brauzerda saqlanadi (kompaniya va user bo'yicha). "Mijoz" ustuni yashirilmaydi.
- **Qidiruv.** Matn maydonlarida qidiriladi (katta-kichik harf farqsiz, harfma-harf, so'z ichidan ham). Qidiruv faqat raqamlardan iborat bo'lsa (bo'shliq, `+`, `-` va qavs bilan yozilgan bo'lishi mumkin: `+998 (90) 123-45`), uning raqamlari telefonlarda va butun son maydonlarida ham qidiriladi. Harf aralash qidiruv ("Ali 5") faqat matn maydonlarida qidiriladi. Variant nomi bo'yicha qidirilmaydi.
- **Tur filtri.** "Barchasi" yoki bitta tur. Qidiruv bilan birga ishlaydi.
- **Telefon prefiksi.** `?phone=<raqamlar>` (1–9 ta raqam): telefoni `998<raqamlar>` bilan boshlanadigan mijozlar; vazifa formasidagi mijoz takliflari shu bilan olinadi. Boshqa belgi bo'lsa 400 "Telefon raqami noto'g'ri". Qolgan filtrlar bilan birga ishlaydi.
- **Sahifa.** `?page=` 1 dan boshlanadi; oxirgidan keyingi sahifa bo'sh ro'yxat va jami sonni qaytaradi.

## 7. Tarix

Mijozning har o'zgarishi yoziladi: qo'shilgani, har tahriri va o'chirilgani, kim qilgani bilan. Tahrirda o'zgargan har maydon (telefon ham) eski va yangi qiymati bilan saqlanadi: avval telefon (`+998 90 123 45 67` ko'rinishida), keyin maydonlar o'z tartibida; bo'sh qiymat bo'sh matn. Qiymatlar o'sha paytdagi nomlari bilan matn sifatida yoziladi (variantlar nomi bilan, bir nechtasi vergul bilan): maydon yoki variant keyin qayta nomlansa, tarix o'zgarmaydi. Qo'shish va o'chirish yozuvida maydonlar ro'yxati bo'sh. Hech narsa o'zgarmagan saqlash tarixga yozilmaydi.

Kim qilgani "Qo'shgan" kabi ko'rsatiladi: a'zoning hozirgi ismi, chiqarilgan bo'lsa o'sha paytdagi ismi.

Tarixni faqat owner ko'radi (`GET /app/customers/{id}/history`, oxirgisi birinchi), mijoz sahifasida. O'chirilgan mijozning tarixi bazada qoladi, lekin interfeysda va API'da ko'rinmaydi (404).

## 8. Chekka holatlar

| Holat | Natija |
|---|---|
| O'chirilgan mijozning raqami bilan yangi mijoz | qo'shiladi: unikallik faqat faol mijozlar ichida |
| Majburiy tanlov maydonining dropdownida faol variant yo'q | shu turda mijoz qo'shib bo'lmaydi, forma buni aytadi |
| Mijozda nofaol variant tanlangan, mijoz tahrirlanmoqda | variant saqlanadi; boshqa nofaol variantlar taklif qilinmaydi |
| Maydon keyin majburiy qilindi | mavjud mijozlar o'zgarmaydi; tahrirda to'ldirish talab qilinadi |
| Ikki turda bir xil nomli maydon | ro'yxatda bitta ustun; takrorlanmaslik har turda alohida |
| Owner turning barcha mijozlarini o'chirib, turni o'chiradi | tur o'chadi: o'chirilgan mijozlar to'sqinlik qilmaydi |
| Vazifasi bor mijoz o'chirilmoqchi | 409 `customer_in_use`; avval vazifalari o'chiriladi |
| Owner hamma turni o'chirdi | mijoz qo'shib bo'lmaydi; sahifa owner'ni Sozlamalarga yo'naltiradi |
| Boshqa kompaniyaning mijozi, turi yoki dropdowni ID bo'yicha so'raldi | 404 `not_found` |
| Xodim kompaniyadan chiqarildi | u qo'shgan mijozlar qoladi, "Qo'shgan" da o'sha paytdagi ismi |
| Tartib o'zgartirilayotganda ro'yxat boshqa joyda o'zgargan | 409 `order_changed`: "Ro'yxat o'zgargan. Sahifani yangilang" |

## 9. Xato kodlari

| Kod | Status | Xabar |
|---|---|---|
| `validation_error` | 400 | 4.1-bo'limdagi xabarlar; "Nomni kiriting", "Nom 60 belgidan oshmasin", "Maydon turini tanlang", "Dropdownni tanlang"; ro'yxatda "Sahifa raqami noto'g'ri", "Mijoz turi noto'g'ri" |
| `company_required` | 403 | "Avval kompaniyani tanlang" |
| `owner_only` | 403 | "Bu bo'lim faqat kompaniya egasi uchun" |
| `not_found` | 404 | "Mijoz topilmadi", "Tur topilmadi", "Maydon topilmadi", "Dropdown topilmadi", "Variant topilmadi" |
| `name_taken` | 409 | "Bu nomli tur allaqachon bor", "Bu nomli maydon allaqachon bor", "Bu nomli dropdown allaqachon bor", "Bu variant allaqachon bor" |
| `phone_taken` | 409 | "Bu raqamli mijoz allaqachon bor" (`customer_id` bilan) |
| `value_taken` | 409 | "Bu «INN» boshqa mijozda bor" (`customer_id` bilan) |
| `duplicates_exist` | 409 | "Bu maydonda takrorlangan qiymatlar bor" |
| `type_in_use`, `field_in_use`, `option_in_use`, `dropdown_in_use`, `customer_in_use` | 409 | 5-bo'limdagi xabarlar |
| `order_changed` | 409 | "Ro'yxat o'zgargan. Sahifani yangilang" |
