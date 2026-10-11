# Valyutalar va kurslar

Bu hujjat valyutalar qoidalarini belgilaydi: kompaniyada qaysi valyutalar bor, kim yoqadi, kurs qayerdan keladi va hujjatga qanday yoziladi, summalar qanday aylantiriladi va ko'rsatiladi. Hujjatlar va jurnal: [warehouse.md](warehouse.md). Kassa: [finance.md](finance.md). Sotuv: [sales.md](sales.md).

> Holat: kelishilgan (2026-10-11), amalga oshirilmoqda. Qoida o'zgarsa, avval shu hujjat, keyin kod o'zgartiriladi. Dizayn, bosqichlar va amalga oshirishdagi qarorlar: `docs/superpowers/specs/2026-10-11-ledger-design.md`.

## 1. Tushunchalar

| Tushuncha | Ma'nosi | Bazada |
|---|---|---|
| **Valyuta** | Tayyor katalog: UZS (so'm), USD, EUR, RUB. Kengaytirilmaydi. | `currencies` (1 UZS, 2 USD, 3 EUR, 4 RUB) |
| **Kompaniya valyutasi** | Kompaniyada yoqilgan valyuta. UZS hammada doim yoqilgan. | `company_currencies` |
| **Kurs qatori** | Bir lahzadagi hamma valyuta kursi so'mga nisbatan: `uzs` = 1, `usd`, `eur`, `rub` («1 USD = N so'm», 4 kasr). Standart qator (`status = 1`) sozlamalardan, hujjatning o'z qatori (`status = 2`) formada kurs o'zgartirilganda. | `currency_rates` |
| **Hujjat kursi** | Har hujjat bitta kurs qatoriga havola qiladi; summalar shu qator bilan aylantiriladi. | `transactions.currency_rate_id` |
| **Standart valyuta** | UZS: har forma UZS bilan ochiladi, balanslar so'mda. Kompaniya bo'yicha o'zgartirilmaydi. | — |

## 2. Kim nima qila oladi

| Amal | admin | egasi | rolsiz xodim | rolli xodim |
|---|---|---|---|---|
| Kompaniyada valyuta yoqish / o'chirish (admin panel) | ✓ | ✗ | ✗ | ✗ |
| Joriy kurslarni va tarixni ko'rish (Sozlamalar → Valyuta kurslari) | — | ✓ | ✗ | `settings.view` |
| Kurs kiritish | — | ✓ | ✗ | `settings.edit` |
| Yoqilgan valyutalar va joriy kurslarni olish (`/app/me`, formalar uchun) | — | ✓ | ✓ | ✓ |
| Hujjatda kursni o'zgartirish | — | hujjatni yoza oladigan har kim | | |

## 3. Kompaniya valyutalari (admin panel)

- Har kompaniya UZS bilan boshlaydi: mavjud kompaniyalarga migratsiya 00014 yozadi, yangisiga kompaniya yaratilganda.
- Admin kompaniya sahifasida **Valyutalar** bo'limida USD, EUR, RUB ni yoqadi yoki o'chiradi (`PUT /admin/companies/{id}/currencies {currency_ids}`). UZS doim ro'yxatda, olib tashlanmaydi (400 «UZS olib tashlanmaydi»).
- **O'chirish** (ro'yxatdan chiqarish): shu valyutada jonli hujjat, mahsulot narxi yoki akkaunt bo'lsa 409 `currency_in_use` «Bu valyutada N ta hujjat bor» (mahsulot va akkaunt ham sanaladi: «N ta mahsulot», «N ta akkaunt»). Bo'lmasa chiqariladi; kurs tarixi qoladi.
- Kompaniyada faqat UZS bo'lsa, user app'da valyuta va kurs maydonlari umuman ko'rinmaydi; 2+ valyutada hujjat formalarida valyuta tanlovi (standart UZS) va kurs maydoni chiqadi.

## 4. Kurslar

- Egasi (yoki `settings.edit`) **Sozlamalar → Valyuta kurslari** da yoqilgan har valyutaning kursini bitta formada kiritadi (`POST /app/currency-rates {usd?, eur?, rub?}`): bitta standart qator yoziladi (`set_at` = hozir, kim kiritgani). Kurs > 0, 10 xonagacha butun va 4 kasr; yoqilmagan valyuta kursi yuborilsa 400 `currency_not_allowed`; yoqilgan valyuta kursi yuborilmasa oldingi standart qatordan olinadi (bo'lmasa 0). UZS kursi doim 1.
- **Joriy kurs** = eng oxirgi standart qator. `/app/me` da har yoqilgan valyutaning joriy kursi (`rate`; 0 bo'lsa `null`).
- **Tarix** (`GET /app/currency-rates?page=`): standart qatorlar yangi birinchi, 20 tadan: kurslar, kim, qachon. Qator o'zgartirilmaydi va o'chirilmaydi: yangisi kiritiladi.
- **Hujjat sanasidagi kurs.** Hujjat yozilganda uning `at` lahzasida amalda bo'lgan standart qator olinadi (`set_at <= at` bo'lgan eng oxirgisi; bo'lmasa eng birinchi standart qator). Orqa sana bilan kiritilgan hujjat o'sha kundagi kursni oladi. Hujjat tahrirlanganda vaqt o'zgarsa kurs qatori qayta tanlanadi (formada kursi o'zgartirilgan hujjatda emas: o'z qatori qoladi).
- **Hujjatning o'z kursi.** Formada taklif qilingan kurs o'zgartirilsa, hujjat uchun alohida qator (`status = 2`) yoziladi: o'zgartirilgan valyuta ustuni kiritilgan qiymat, qolganlari o'sha lahzadagi standartdan. Tarixda ko'rinmaydi. Hujjat o'chirilsa qator qoladi.
- Yoqilgan valyutaning joriy kursi 0 bo'lsa (hali kiritilmagan), shu valyutadagi hujjat formasi kursni talab qiladi: 400 «Kursni kiriting»; kiritilgani hujjatning o'z kursi bo'ladi.

## 5. Hujjatda valyuta

- Har hujjatda `currency_id` (berilmasa UZS) va kurs. Qatorlar (narx, summa) va `total` hujjat valyutasida. So'mdagi qiymat (`total_uzs`) hujjat kurs qatori bilan hisoblanadi: `convert_amount(total, currency, UZS, kurs qatori)`, 2 kasrgacha.
- Kompaniyada yoqilmagan valyuta: 400 `currency_not_allowed` «Bu valyuta kompaniyada yoqilmagan». Valyuta keyin o'chirilsa, bor hujjatlar o'zgarmaydi (o'chirish to'siladi, 3-bo'lim).
- **To'lov** (ta'minotchiga, mijozdan, xarajat, kirim) valyutasi tanlanmaydi: akkauntniki ([finance.md](finance.md)). Kursi akkaunt valyutasi bo'yicha hujjat sanasidagi standart (formada o'zgartirish mumkin).
- **Mahsulot narxi** (`products.price`) o'z valyutasida (`products.currency_id`, standart UZS). Sotuv formasida mahsulot tanlanganda: narx valyutasi hujjat valyutasiga mos bo'lsa to'ldiriladi, aks holda hujjat kursi bilan aylantirib taklif qilinadi (2 kasr); foydalanuvchi o'zgartiradi. Oxirgi xarid narxi ham shunday ([products.md](products.md)).
- **Balans** (ta'minotchi, mijoz) so'mda: har hujjat o'z kursi bilan aylantiriladi; kurs farqi balansda qoladi (100 USD xarid 12 800 dan va 100 USD to'lov 13 000 dan: valyuta bo'yicha 0 USD, so'mda −20 000 avans). Yoniga valyuta bo'yicha tafsilot («shu jumladan 100 USD, 500 000 so'm»). **Akkaunt qoldig'i** faqat o'z valyutasida, aylantirilmaydi.

## 6. Ko'rinish

- So'm: «1 200 000 so'm»; boshqalari belgisi bilan: «150 $», «90 €», «1 000 ₽». Minglar bo'shliq bilan, kasr vergul bilan, 2 kasr, `.00` tashlanadi (`formatMoney(amount, currency)`).
- Jadval ustuni sarlavhasida valyuta aytilmaydi (hujjatlar aralash bo'lishi mumkin): har summa o'z belgisi bilan. So'mdagi jami («Jami, so'm») balans kartalarida.
- Kurs: «1 USD = 12 800 so'm» (kasrsiz bo'lsa kasr ko'rsatilmaydi, bo'lsa 4 tagacha).
- Valyuta tanlovi `SelectField`: kod va nom («USD — AQSH dollari»); kurs maydoni yonida (`inputMode="decimal"`, vergul qabul qilinadi).

## 7. Chekka holatlar

| Holat | Natija |
|---|---|
| Admin USD'ni yoqdi, egasi kurs kiritmadi, xodim USD'da xarid kiritmoqda | forma kursni talab qiladi; kiritilgani hujjatning o'z kursi |
| Kurs yangilandi | avvalgi hujjatlar o'z qatorida qoladi; balans o'zgarmaydi; yangi hujjat yangi kursni oladi |
| Orqa sana bilan hujjat | o'sha sanadagi standart kurs; o'sha sanada hali kurs bo'lmasa eng birinchi standart qator |
| Hujjat sanasi tahrirda o'zgartirildi | kurs qatori qayta tanlanadi (o'z kursli hujjatda qoladi); so'mdagi qiymat o'zgarishi mumkin |
| Admin ishlatilgan valyutani o'chirmoqchi | 409 `currency_in_use` |
| Mahsulot narxi USD, sotuv so'mda | narx joriy hujjat kursi bilan so'mga aylantirib taklif qilinadi |
| Kompaniyada faqat UZS, mahsulotda USD narx qolgan (valyuta o'chirilgan bo'lolmaydi) | bo'lmaydi: narxi bor mahsulot valyutani to'sadi |

## 8. Xato kodlari

| Kod | Status | Xabar |
|---|---|---|
| `validation_error` | 400 | «Kursni kiriting», «Kurs noto'g'ri», «UZS olib tashlanmaydi», «Valyuta noto'g'ri» |
| `currency_not_allowed` | 400 | «Bu valyuta kompaniyada yoqilmagan» |
| `forbidden` | 403 | «Bu amal uchun ruxsatingiz yo'q» |
| `currency_in_use` | 409 | «Bu valyutada N ta hujjat bor», «… N ta mahsulot bor», «… N ta akkaunt bor» |
