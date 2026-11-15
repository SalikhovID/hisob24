# Valyutalar va kurslar

Bu hujjat valyutalar qoidalarini belgilaydi: kompaniyada qaysi valyutalar bor, kim yoqadi, kurs qayerdan keladi va hujjatga qanday yoziladi, summalar qanday aylantiriladi va ko'rsatiladi. Hujjatlar va jurnal: [warehouse.md](warehouse.md). Kassa: [finance.md](finance.md). Sotuv: [sales.md](sales.md).

> Holat: kelishilgan (2026-10-11), amalga oshirilmoqda. Qoida o'zgarsa, avval shu hujjat, keyin kod o'zgartiriladi. Dizayn, bosqichlar va amalga oshirishdagi qarorlar: `docs/superpowers/specs/2026-10-11-ledger-design.md`. Avtomatik kurs (4-bo'lim, 2026-11-15): `docs/superpowers/specs/2026-11-15-daily-rates-design.md`.

## 1. Tushunchalar

| Tushuncha | Ma'nosi | Bazada |
|---|---|---|
| **Valyuta** | Tayyor katalog: UZS (so'm), USD, EUR, RUB. Kengaytirilmaydi. | `currencies` (1 UZS, 2 USD, 3 EUR, 4 RUB) |
| **Kompaniya valyutasi** | Kompaniyada yoqilgan valyuta. UZS hammada doim yoqilgan. | `company_currencies` |
| **Kurs qatori** | Bir lahzadagi hamma valyuta kursi so'mga nisbatan: `uzs` = 1, `usd`, `eur`, `rub` («1 USD = N so'm», 4 kasr). Standart qator (`status = 1`) sozlamalardan yoki har kungi avtomatik, hujjatning o'z qatori (`status = 2`) formada kurs o'zgartirilganda. | `currency_rates` |
| **Kurs manbai** | Kompaniyaning kursi qayerdan keladi: bank (Markaziy bank standart, Kapitalbank, Ipak Yo'li banki, Asakabank, Hamkorbank, Uzum Bank, Orient Finans Bank) yoki «Qo'lda». Admin tanlaydi. | `companies.rate_source` (`cbu`, `kapitalbank`, `ipakyuli`, `asaka`, `hamkor`, `uzum`, `ofb`, `manual`) |
| **Yaxlitlash qadami** | Bankdan olingan USD va EUR kursi shu qadamga yaxlitlanadi: 1 (yaxlitlanmaydi), 10, 100 (standart), 1000. RUB yaxlitlanmaydi. | `companies.rate_rounding` |
| **Avtomatik qator** | Har kuni 00:00 da tizim yozgan standart qator: bankdan olingan kurs yoki kechagi kurs nusxasi. Kiritgan a'zo yo'q. | `currency_rates.source` (bank kodi, `carried`, `failed`; `set_by` bo'sh) |
| **Hujjat kursi** | Har hujjat bitta kurs qatoriga havola qiladi; summalar shu qator bilan aylantiriladi. | `transactions.currency_rate_id` |
| **Standart valyuta** | UZS: har forma UZS bilan ochiladi, balanslar so'mda. Kompaniya bo'yicha o'zgartirilmaydi. | — |

## 2. Kim nima qila oladi

| Amal | admin | egasi | rolsiz xodim | rolli xodim |
|---|---|---|---|---|
| Kompaniyada valyuta yoqish / o'chirish (admin panel) | ✓ | ✗ | ✗ | ✗ |
| Kurs manbai va yaxlitlash qadamini tanlash (admin panel) | ✓ | ✗ | ✗ | ✗ |
| Joriy kurslarni va tarixni ko'rish (Sozlamalar → Valyuta kurslari) | — | ✓ | ✗ | `settings.view` |
| Kurs kiritish | — | ✓ | ✗ | `settings.edit` |
| Yoqilgan valyutalar va joriy kurslarni olish (`/app/me`, formalar uchun) | — | ✓ | ✓ | ✓ |
| Hujjatda kursni o'zgartirish | — | hujjatni yoza oladigan har kim | | |

## 3. Kompaniya valyutalari (admin panel)

- Har kompaniya UZS bilan boshlaydi: mavjud kompaniyalarga migratsiya 00014 yozadi, yangisiga kompaniya yaratilganda.
- Admin kompaniya sahifasida **Valyutalar** bo'limida USD, EUR, RUB ni yoqadi yoki o'chiradi (`PUT /admin/companies/{id}/currencies {currency_ids}`). UZS doim ro'yxatda, olib tashlanmaydi: usiz ro'yxat (bo'sh ro'yxat ham) 400 «UZS olib tashlanmaydi».
- **O'chirish** (ro'yxatdan chiqarish): shu valyutada jonli hujjat, mahsulot narxi yoki akkaunt bo'lsa 409 `currency_in_use` «Bu valyutada N ta hujjat bor» (mahsulot va akkaunt ham sanaladi: «N ta mahsulot», «N ta akkaunt»). Bo'lmasa chiqariladi; kurs tarixi qoladi.
- Kompaniyada faqat UZS bo'lsa, user app'da valyuta va kurs maydonlari umuman ko'rinmaydi; 2+ valyutada hujjat formalarida valyuta tanlovi (standart UZS) va kurs maydoni chiqadi.

## 4. Kurslar

- Egasi (yoki `settings.edit`) **Sozlamalar → Valyuta kurslari** da yoqilgan har valyutaning kursini bitta formada kiritadi (`POST /app/currency-rates {usd?, eur?, rub?}`): bitta standart qator yoziladi (`set_at` = hozir, kim kiritgani). Kurs > 0, 10 xonagacha butun va 4 kasr; yoqilmagan valyuta kursi yuborilsa 400 `currency_not_allowed`; yoqilgan valyuta kursi yuborilmasa oldingi standart qatordan olinadi (bo'lmasa 0). UZS kursi doim 1.
- **Joriy kurs** = eng oxirgi standart qator. `/app/me` da har yoqilgan valyutaning joriy kursi (`rate`; 0 bo'lsa `null`).
- **Tarix** (`GET /app/currency-rates?page=`): standart qatorlar yangi birinchi, 20 tadan: kurslar, kim (avtomatik qatorda manba: bank nomi, «Kechagi kurs» yoki «Kechagi kurs · bank javob bermadi»), qachon; sahifada kompaniyaning manbai va qadami (`rate_source`, `rate_rounding`). Qator o'zgartirilmaydi va o'chirilmaydi: yangisi kiritiladi.
- **Hujjat sanasidagi kurs.** Hujjat yozilganda uning `at` lahzasida amalda bo'lgan standart qator olinadi (`set_at <= at` bo'lgan eng oxirgisi; bo'lmasa eng birinchi standart qator). Orqa sana bilan kiritilgan hujjat o'sha kundagi kursni oladi. Hujjat tahrirlanganda vaqt o'zgarsa kurs qatori qayta tanlanadi (formada kursi o'zgartirilgan hujjatda emas: o'z qatori qoladi).
- **Hujjatning o'z kursi.** Formada taklif qilingan kurs o'zgartirilsa, hujjat uchun alohida qator (`status = 2`) yoziladi: o'zgartirilgan valyuta ustuni kiritilgan qiymat, qolganlari o'sha lahzadagi standartdan. Tarixda ko'rinmaydi. Hujjat o'chirilsa qator qoladi.
- Yoqilgan valyutaning joriy kursi 0 bo'lsa (hali kiritilmagan), shu valyutadagi hujjat formasi kursni talab qiladi: 400 «Kursni kiriting»; kiritilgani hujjatning o'z kursi bo'ladi.

### Avtomatik kurs (har kuni 00:00)

- **Har kuni 00:00 da** (Toshkent vaqti, UTC+5) har kompaniyaga bitta standart qator yoziladi (hamma kompaniyaga: nofaol va muddati o'tganiga ham):
  - **manba bank bo'lsa** — shu bankning kursi (bankda sotish kursi, Markaziy bankda rasmiy kurs). Bank javob bermasa — Markaziy bank kursi; u ham javob bermasa — **kechagi kurs nusxasi** (`source = failed`, tarixda «Kechagi kurs · bank javob bermadi»). Banklar 3 marta, 1 daqiqa oralig'ida so'raladi; bitta bank shu kechada kompaniyalar soniga qaramay bir marta so'raladi;
  - **«Qo'lda» bo'lsa** — bankka murojaat yo'q, **kechagi kurs nusxasi** (`source = carried`, «Kechagi kurs»).
- **Kechagi kurs** = shu lahzada amaldagi standart qator (oxirgi kiritilgani, bankdan olingani yoki nusxa). Kompaniyada hali hech qator bo'lmasa, hech narsa yozilmaydi.
- Bankdan olingan qatorda uchala valyuta kursi yoziladi, yoqilmagani ham: valyuta keyin yoqilsa, kursi darhol bor. Bank biror valyuta kursini bermasa, o'sha valyuta kechagi qatordan olinadi (u yerda ham yo'q bo'lsa 0).
- **Yaxlitlash.** USD va EUR kursi kompaniya qadamining eng yaqin karrasigacha (qadam 100: 12 014,37 → 12 000, 12 050 → 12 100; qadam 1 da o'zgarmaydi). RUB bankdagidek (146,19). Qo'lda kiritilgan kurs va kechagi nusxa yaxlitlanmaydi.
- **Bir kunda bir marta.** Kompaniyada shu kun 00:00 dan keyin standart qator bo'lsa (egasi qo'lda kiritgani ham), yangisi yozilmaydi. API 00:00 da ishlamay turgan bo'lsa, ishga tushganda shu kunning qatori yoziladi.
- Egasi kun ichida qo'lda kiritgan kurs keyingi 00:00 gacha amal qiladi; 00:00 da yangi avtomatik qator yoziladi («Qo'lda» manbada — o'sha kiritilgan kursning nusxasi). Kun ichida qayta urinish yo'q.
- **Manba va qadam** admin panelda, kompaniya sahifasining «Valyuta kurslari» bo'limida (`PUT /admin/companies/{id}/rate-source {source, rounding}`); o'zgartirilsa keyingi 00:00 dan amal qiladi. Yangi kompaniya: Markaziy bank, 100.

## 5. Hujjatda valyuta

- Har hujjatda `currency_id` (berilmasa UZS) va kurs. Qatorlar (narx, summa) va `total` hujjat valyutasida. So'mdagi qiymat (`total_uzs`) hujjat kurs qatori bilan hisoblanadi: `convert_amount(total, currency, UZS, kurs qatori)`, 2 kasrgacha.
- Kompaniyada yoqilmagan valyuta: 400 `currency_not_allowed` «Bu valyuta kompaniyada yoqilmagan». Valyuta keyin o'chirilsa, bor hujjatlar o'zgarmaydi (o'chirish to'siladi, 3-bo'lim).
- **To'lov** (ta'minotchiga, mijozdan, xarajat, kirim) valyutasi tanlanmaydi: akkauntniki ([finance.md](finance.md)). Kursi akkaunt valyutasi bo'yicha hujjat sanasidagi standart (formada o'zgartirish mumkin). Hujjat formasidagi «To'liq» qolgan summani akkaunt valyutasiga eng yaqin sentgacha aylantiradi, shuning uchun to'lov jamidan bir oz oshishi mumkin (50 000 so'm Dollar akkauntidan: 3,91 $ = 50 048 so'm); to'lovlar jamidan oshsa forma «Qolgan» o'rniga «Ortiqcha: 48 so'm» deydi, oshgani balansda avans bo'lib qoladi.
- **Mahsulot narxi** (`products.price`) o'z valyutasida (`products.currency_id`, standart UZS). Sotuv formasida mahsulot tanlanganda: narx valyutasi hujjat valyutasiga mos bo'lsa to'ldiriladi, aks holda hujjat kursi bilan aylantirib taklif qilinadi (2 kasr, saqlangan narx kabi: «12800.00»); foydalanuvchi o'zgartiradi. Oxirgi xarid narxi ham shunday ([products.md](products.md)).
- **Formada valyuta almashtirilsa** (sotuv, xarid, boshlang'ich qoldiq, buyurtma): qatorlardagi narxlar va buyurtma narxi, taklif qilingani ham, qo'lda yozilgani ham, joriy kurs bilan yangi valyutaga aylantiriladi (2 kasr: 1 920 000 so'm → «150.00» $); narx bo'lmagan matn va kursi yo'q valyuta aylantirilmaydi. Kurs maydoni yangi valyutaning standart kursini oladi: oldingi valyutaga yozilgan kurs o'tmaydi, kursi kiritilmagan valyutada maydon bo'sh qoladi va so'raladi (to'lov formasida akkaunt almashsa ham shunday). O'z valyutasida ochilgan hujjatning narxlari va kursi valyuta almashtirilmaguncha o'zgarmaydi.
- **Balans** (ta'minotchi, mijoz) so'mda: har hujjat o'z kursi bilan aylantiriladi; kurs farqi balansda qoladi (100 USD xarid 12 800 dan va 100 USD to'lov 13 000 dan: valyuta bo'yicha 0 USD, so'mda −20 000 avans). Yoniga valyuta bo'yicha tafsilot ishorasiz, so'z bilan: avval qarz, keyin avans («shu jumladan qarz 500 000 so'm, avans 100 $»); qoldig'i 0 bo'lgan valyuta aytilmaydi, faqat so'm qolsa tafsilot yo'q. **Akkaunt qoldig'i** faqat o'z valyutasida, aylantirilmaydi.

## 6. Ko'rinish

- So'm: «1 200 000 so'm»; boshqalari belgisi bilan: «150 $», «90 €», «1 000 ₽». Minglar bo'shliq bilan, kasr vergul bilan, 2 kasr, `.00` tashlanadi (`formatMoney(amount, currency)`).
- Jadval ustuni sarlavhasida valyuta aytilmaydi (hujjatlar aralash bo'lishi mumkin): har summa o'z belgisi bilan. So'mdagi jami («Jami, so'm») balans kartalarida.
- Kurs: «1 USD = 12 800 so'm» (kasrsiz bo'lsa kasr ko'rsatilmaydi, bo'lsa 4 tagacha).
- Valyuta tanlovi: user app formalarida (buyurtma, sotuv, xarid, boshlang'ich qoldiq — forma va dialog, mahsulot va xizmat) tablarga o'xshash radio tugmalar (`SegmentedRow`), har birida kod («UZS», «USD»); 2026-11-15 gacha ro'yxat (select) edi: kod va nom («USD — AQSH dollari»). Kurs maydoni yonida (`inputMode="decimal"`, vergul qabul qilinadi).

## 7. Chekka holatlar

| Holat | Natija |
|---|---|
| Admin USD'ni yoqdi, egasi kurs kiritmadi, xodim USD'da xarid kiritmoqda | forma kursni talab qiladi; kiritilgani hujjatning o'z kursi |
| Kurs yangilandi | avvalgi hujjatlar o'z qatorida qoladi; balans o'zgarmaydi; yangi hujjat yangi kursni oladi |
| Orqa sana bilan hujjat | o'sha sanadagi standart kurs; o'sha sanada hali kurs bo'lmasa eng birinchi standart qator |
| Hujjat sanasi tahrirda o'zgartirildi | kurs qatori qayta tanlanadi (o'z kursli hujjatda qoladi); so'mdagi qiymat o'zgarishi mumkin |
| Admin ishlatilgan valyutani o'chirmoqchi | 409 `currency_in_use` |
| Mahsulot narxi USD, sotuv so'mda | narx joriy hujjat kursi bilan so'mga aylantirib taklif qilinadi |
| Formada hujjat valyutasi almashtirildi (so'm → USD, USD → EUR) | narxlar joriy kurs bilan aylantiriladi; kurs maydoni yangi valyutaning standart kursi |
| 50 000 so'mlik xarid Dollar akkauntidan «To'liq» bilan | 3,91 $ (= 50 048 so'm); forma «Ortiqcha: 48 so'm» deydi, 48 so'm ta'minotchida avans |
| Kompaniyada faqat UZS, mahsulotda USD narx qolgan (valyuta o'chirilgan bo'lolmaydi) | bo'lmaydi: narxi bor mahsulot valyutani to'sadi |
| 00:00 da tanlangan bank (masalan Kapitalbank) javob bermadi | Markaziy bank kursi yoziladi; u ham javob bermasa kechagi kurs nusxasi («Kechagi kurs · bank javob bermadi») |
| Manba «Qo'lda» | 00:00 da kechagi kurs nusxasi («Kechagi kurs»), bankka murojaat yo'q |
| Egasi bugun ertalab kursni qo'lda kiritdi, keyin API qayta ishga tushdi | bugungi qator bor: avtomatik qator yozilmaydi; ertaga 00:00 da yangisi |
| Kompaniyada hali kurs yo'q, manba «Qo'lda» yoki bank javob bermadi | hech narsa yozilmaydi (kechagi kurs yo'q) |
| Admin EUR ni kun o'rtasida yoqdi | bugungi bankdan olingan qatorda EUR kursi bor: darhol ishlatiladi |
| Markaziy bank: USD 12 014,37, EUR 13 280,68, RUB 146,19; qadam 100 | 12 000, 13 300, 146,19 |

## 8. Xato kodlari

| Kod | Status | Xabar |
|---|---|---|
| `validation_error` | 400 | «Kursni kiriting», «Kurs noto'g'ri», «UZS olib tashlanmaydi», «Valyuta noto'g'ri», «Manba noto'g'ri», «Yaxlitlash noto'g'ri» |
| `currency_not_allowed` | 400 | «Bu valyuta kompaniyada yoqilmagan» |
| `forbidden` | 403 | «Bu amal uchun ruxsatingiz yo'q» |
| `currency_in_use` | 409 | «Bu valyutada N ta hujjat bor», «… N ta mahsulot bor», «… N ta akkaunt bor» |
