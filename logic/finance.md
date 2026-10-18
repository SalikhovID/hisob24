# Moliya: kassa (akkauntlar), xarajat va kirim, o'tkazma va konvertatsiya

Bu hujjat moliya bo'limi qoidalarini belgilaydi: akkaunt (kassa, hisob raqam) nima, kim qo'shadi, qoldig'i qanday hisoblanadi, kassa hujjatlari (boshlang'ich qoldiq, xarajat, kirim, o'tkazma, konvertatsiya) qanday yoziladi, kategoriyalar qanday sozlanadi. Hujjatlar umumiy qoidasi va jurnal: [warehouse.md](warehouse.md), 1-bo'lim. Valyutalar va kurslar: [currencies.md](currencies.md). Rollar: [roles.md](roles.md).

> Holat: kelishilgan (2026-10-11), amalga oshirilmoqda. Qoida o'zgarsa, avval shu hujjat, keyin kod o'zgartiriladi. Dizayn, bosqichlar va amalga oshirishdagi qarorlar: `docs/superpowers/specs/2026-10-11-ledger-design.md`.

## 1. Tushunchalar

| Tushuncha | Ma'nosi | Bazada |
|---|---|---|
| **Akkaunt** | Kompaniyaning pul turadigan joyi: kassa (naqd), bank hisobi, karta. Nomi, valyutasi, faol holati. Kompaniya bo'yicha umumiy, lokatsiyaga bog'liq emas. | `bank_accounts` |
| **Tayyor akkaunt** | Har kompaniya boshlaydigan «Naqd» (UZS) akkaunti. | migratsiya 00015 (mavjud kompaniyalar), `company.Create` (yangisi) |
| **Akkaunt qoldig'i** | Akkauntdagi pul, o'z valyutasida: kirgan hujjatlar yig'indisi − chiqqan hujjatlar yig'indisi. Manfiy bo'lishi mumkin (tekshirilmaydi). | hisoblanadi |
| **Kassa boshlang'ich qoldig'i** | Tizimni boshlaganda akkauntda bor pul. | `transactions` (`cash_opening`) |
| **Xarajat / kirim** | Akkauntdan chiqqan pul (kategoriya bilan) / tashqaridan kirgan pul (sotuv va mijoz to'lovidan tashqari). | `transactions` (`expense` / `income`) |
| **O'tkazma** | Bir akkauntdan boshqasiga shu valyutada. | `transactions` (`money_transfer`) |
| **Konvertatsiya** | Bir akkauntdan boshqa valyutali akkauntga: chiqqan summa va kirgan summa alohida. | `transactions` (`conversion`, `total`, `to_total`) |
| **Kategoriya** | Xarajat yoki kirim turi (Ijara, Kommunal, Boshqa kirim): nomi, turi, tartibi, faol holati. | `finance_categories` |
| **Hisob harakati** | Akkauntning hamma hujjati vaqt bo'yicha, har qatorda ± summa va qoldiq. | hisoblanadi |

Ta'minotchiga to'lov va mijozdan to'lov ham akkaunt orqali o'tadi ([warehouse.md](warehouse.md), 6-bo'lim; [sales.md](sales.md), 5-bo'lim): to'lov valyutasi akkauntniki.

## 2. Kim nima qila oladi

| Amal | admin | egasi | rolsiz xodim | rolli xodim |
|---|---|---|---|---|
| Akkaunt qo'shish, nomini / valyutasini o'zgartirish, nofaol qilish, o'chirish (admin panel) | ✓ | ✗ | ✗ | ✗ |
| Akkauntlar ro'yxati (formalar uchun, `/app/me`) | — | ✓ | ✓ | ✓ |
| Kassa: akkaunt qoldiqlari va hisob harakati | — | ✓ | ✓ | `finance.view` |
| Kassa boshlang'ich qoldig'i, xarajat, kirim, o'tkazma, konvertatsiya qo'shish | — | ✓ | ✓ | `finance.create` |
| Ularni tahrirlash / o'chirish | — | ✓ | ✓ | `finance.edit` / `finance.delete` |
| Kategoriyalarni sozlash (Sozlamalar → Moliya kategoriyalari) | — | ✓ | ✗ | `settings.*` |
| Kategoriyalarni o'qish (forma uchun) | — | ✓ | ✓ | ✓ |

**Moliya** bo'limi (Kassa, Xarajatlar, O'tkazmalar tablari) `finance.view` bo'lganga ko'rinadi. Ruxsati yo'q xodim amalni yuborsa: 403 `forbidden`. Kompaniya tanlanmagan sessiya: 403 `company_required`.

## 3. Akkauntlar (admin panel)

- Admin kompaniya sahifasida **Kassa** bo'limida qo'shadi (`POST /admin/companies/{id}/accounts {name, currency_id}`), o'zgartiradi (`PATCH …/{accountId} {name?, currency_id?, is_active?}`) va o'chiradi (`DELETE …/{accountId}`). Nom 1–60 belgi, chetidagi bo'shliqlar olib tashlanadi, kompaniyaning jonli akkauntlari ichida takrorlanmaydi (katta-kichik harf farqsiz): 409 `name_taken`. Valyuta kompaniyada yoqilgan bo'lishi shart (400 `currency_not_allowed`).
- Ro'yxat ID tartibida; har akkauntda valyutasi, holati, jonli hujjatlari soni.
- **Valyutani o'zgartirish** faqat jonli hujjati bo'lmagan akkauntda (409 `account_in_use` «Bu akkauntda N ta hujjat bor»).
- **Nofaol** akkaunt formalarda taklif qilinmaydi (bor hujjatlarida qoladi), qoldig'i va hisob harakati ko'rinadi; qayta faollashtiriladi. Kompaniyada kamida bitta faol akkaunt qoladi: oxirgisini nofaol qilish yoki o'chirish 409 `last_account` «Kompaniyada kamida bitta faol akkaunt qolsin».
- **O'chirish** yashirish (`deleted_at`), nomi bo'shaydi. Jonli hujjati bor akkaunt o'chirilmaydi: 409 `account_in_use`; nofaol qilish mumkin.

## 4. Akkaunt qoldig'i va hisob harakati

- Qoldiq akkaunt valyutasida, aylantirilmaydi: `+` kassa boshlang'ich qoldig'i, kirim, mijoz to'lovi, o'tkazma (maqsad), konvertatsiya (maqsad, `to_total`); `−` xarajat, ta'minotchiga to'lov, o'tkazma (manba), konvertatsiya (manba, `total`). O'chirilgan hujjatlar sanalmaydi. Manfiy bo'lishi mumkin: pul chiqishi tekshirilmaydi (ogohlantirish yo'q).
- **Kassa** tabi (`/accounts`, `GET /app/accounts`): akkauntlar ID tartibida: nom, valyuta, qoldiq, nofaol belgisi. Nofaollar oxirida.
- **Akkaunt sahifasi** (`/accounts/[id]`): qoldiq kartasi; **hisob harakati** (`GET /app/accounts/{id}/statement?page=`; begona akkaunt 404 «Akkaunt topilmadi»): akkauntga tegadigan hamma jonli hujjat vaqt bo'yicha (`doc_at`, keyin `id`), yangi birinchi, 20 tadan; qatorda vaqt, hujjat turi va raqami (havola), `party_name` (ta'minotchi yoki mijoz nomi — nomi bo'lmasa telefoni — yoki kategoriya yoki boshqa akkaunt; kassa boshlang'ich qoldig'ida bo'sh), `linked_id` / `linked_number` (xarid yoki sotuv bilan kiritilgan to'lovda), ± summa (`delta`), shu hujjatdan keyingi qoldiq (`balance`). Tugmalar: «Boshlang'ich qoldiq», «Xarajat», «Kirim», «O'tkazma», «Konvertatsiya» (`finance.create`).

## 5. Kassa hujjatlari

Umumiy maydonlar: akkaunt (kompaniyaning faol akkaunti; nofaol / yo'q / begona: 400 «Akkauntni tanlang», nofaol «Akkaunt nofaol»; tahrirda avvaldan bor nofaol akkaunt qoladi), vaqt (`at`, standart hozir; «Vaqtni kiriting», «Vaqt noto'g'ri»), summa (> 0, akkaunt valyutasida; «Summani kiriting», «Summa noto'g'ri»), izoh (500 belgigacha). Kurs maydoni yo'q: hujjat sanasidagi standart kurs qatoriga bog'lanadi ([currencies.md](currencies.md), 4-bo'lim), akkaunt qoldiqlari o'z valyutasida bo'lgani uchun kurs hech narsaga ta'sir qilmaydi. Kim qo'shgani saqlanadi. Raqam har turda alohida («Xarajat № 7», «Kirim № 2», «O'tkazma № 1», «Konvertatsiya № 1»; kassa boshlang'ich qoldig'i raqamlanadi, ko'rsatilmaydi).

| Hujjat | API | Maydonlar | Qoida |
|---|---|---|---|
| **Kassa boshlang'ich qoldig'i** | `POST /app/cash-openings`, `GET/PUT/DELETE /app/cash-openings/{id}`, `GET /app/cash-openings?account_id=&page=` | akkaunt, summa, vaqt, izoh | akkauntga `+`; bir akkauntga bir nechta bo'lishi mumkin |
| **Xarajat** | `POST /app/expenses {kind: expense, …}`, `GET /app/expenses?kind=&account_id=&category_id=&from=&to=&page=`, `GET/PUT/DELETE /app/expenses/{id}` | akkaunt, kategoriya (turi xarajat; faol; «Kategoriyani tanlang», nofaol «Kategoriya nofaol», turi mos emas «Kategoriya turi mos emas»), summa, vaqt, izoh | akkauntdan `−` |
| **Kirim** | o'sha, `kind: income` | kategoriya turi kirim | akkauntga `+` |
| **O'tkazma** | `POST /app/money-transfers`, `GET /app/money-transfers?account_id=&page=` (o'tkazma va konvertatsiya birga, `kind` bilan), `GET/PUT/DELETE …/{id}` | manba akkaunt, maqsad akkaunt (kompaniyaniki, «Maqsad akkauntni tanlang»; nofaol «Maqsad akkaunt nofaol»; boshqa; «Maqsad akkaunt boshqa bo'lsin»), summa, vaqt, izoh | ikkala akkaunt bir valyutada (400 «Valyutalar farq qilsa konvertatsiya kiriting»); manbadan `−`, maqsadga `+` |
| **Konvertatsiya** | `POST /app/conversions`, `GET /app/conversions?account_id=&page=`, `GET/PUT/DELETE …/{id}` | manba akkaunt va summa (manba valyutasida), maqsad akkaunt va summa (maqsad valyutasida), vaqt, izoh | valyutalar farq qilsin (400 «Bir xil valyutada o'tkazma kiriting»); manbadan `total`, maqsadga `to_total`; kurs ma'lumot uchun: so'm chiqsa `total / to_total`, aks holda `to_total / total` (so'm kirsa so'm / valyuta; ikkalasi boshqa valyutada bo'lsa kirgan / chiqqan), 4 kasr |

- Tekshiruv tartibi (400, birinchi xato): (xarajat / kirimda tur: «Turni tanlang», «Tur noto'g'ri») → akkaunt → (maqsad akkaunt) → kategoriya → vaqt → summa (→ maqsad summa) → izoh. Tahrirda eng avval hujjatning o'zi (404 «Hujjat topilmadi»); tur o'zgarmaydi («Tur o'zgartirilmaydi»); avvaldan hujjatdagi nofaol akkaunt (manba yoki maqsad, rollari almashsa ham) va nofaol kategoriya qoladi.
- **Tahrirlash**: hamma maydon almashadi (akkaunt ham); raqam o'zgarmaydi. **O'chirish** yashirish; raqam bo'shamaydi; tiklash yo'q.
- **Xarajatlar** tabi (`/expenses`): Xarajat / Kirim tablari (`?kind=`, standart xarajat; boshqasi 400 «Tur noto'g'ri»), akkaunt va kategoriya filtri, kun oralig'i (`from`, `to`, `YYYY-MM-DD`; userning timezone'ida kun boshidan `to` kunining oxirigacha; noto'g'ri yoki teskari 400 «Sana noto'g'ri»), yangi birinchi; ustunlar «Hujjat» («№ 7 · Kategoriya», ostida vaqt · akkaunt), «Summa», «Qo'shgan»; qator amallari tahrirlash / o'chirish (dialog).
- **O'tkazmalar** tabi (`/money-transfers`): o'tkazma va konvertatsiya bitta ro'yxatda (tur belgisi), yangi birinchi; ustunlar «Hujjat» («O'tkazma № 1», ostida vaqt), «Qayerdan» (akkaunt, summa), «Qayerga» (akkaunt, summa), «Qo'shgan».

## 6. Kategoriyalar (Sozlamalar)

- `GET /app/finance-categories?kind=` (hamma a'zoga, forma uchun), `POST /app/finance-categories {name, kind}`, `PUT …/{id} {name}`, `PATCH …/{id} {is_active}`, `DELETE …/{id}`, `PUT /app/finance-categories/order {ids}` (buyurtma turlari naqshi: `settings.*`).
- Nom 1–60 belgi, tur ichida takrorlanmaydi (harf farqsiz): 409 `name_taken` «Bu nomli kategoriya allaqachon bor». Tur (xarajat / kirim) keyin o'zgarmaydi.
- **Nofaol** kategoriya formada taklif qilinmaydi, hujjatlarida qoladi. **O'chirish** yashirish; jonli hujjati bor kategoriya o'chirilmaydi: 409 `category_in_use` «Bu kategoriyada N ta hujjat bor».
- Tayyor kategoriya yo'q: har kompaniya bo'sh boshlaydi; kategoriyasiz xarajat kiritib bo'lmaydi (forma Sozlamalarga yo'naltiradi).
- Sozlamalarda **Moliya kategoriyalari** tabi: Xarajat / Kirim bo'limlari, qo'shish, nomini o'zgartirish, nofaol qilish, o'chirish, sudrab tartiblash (`SortableList`, 409 `order_changed`).

## 7. Chekka holatlar

| Holat | Natija |
|---|---|
| Admin akkauntni nofaol qildi | formalarda chiqmaydi; qoldig'i va hujjatlari ko'rinadi; to'lovlar boshqa akkauntga |
| Yagona faol akkaunt nofaol qilinmoqchi | 409 `last_account` |
| Akkaunt valyutasi o'zgartirilmoqchi, hujjati bor | 409 `account_in_use` |
| Xarajat summasi qoldiqdan katta | qabul qilinadi, qoldiq manfiy |
| Bir akkauntdan o'ziga o'tkazma | 400 «Maqsad akkaunt boshqa bo'lsin» |
| USD va UZS akkaunt orasida o'tkazma | 400: konvertatsiya kiritiladi |
| Konvertatsiya tahririda summalar o'zgardi | ikkala akkaunt qoldig'i qayta hisoblanadi |
| Ta'minotchiga to'lov USD akkauntdan | to'lov USD'da, kursi hujjat sanasidagi standart; ta'minotchi balansi so'mda shu kurs bilan |
| Kategoriya nofaol, xarajat tahrirlanmoqda | kategoriya o'zgartirilmasa qoladi |
| Boshqa kompaniyaning akkaunti, kategoriyasi, hujjati ID bo'yicha | 404 `not_found` |

## 8. Xato kodlari

| Kod | Status | Xabar |
|---|---|---|
| `validation_error` | 400 | 5-bo'lim xabarlari; «Nomni kiriting», «Nom 60 belgidan oshmasin», «Turni tanlang»; ro'yxatda «Sahifa raqami noto'g'ri», «Akkaunt noto'g'ri», «Kategoriya noto'g'ri», «Sana noto'g'ri» |
| `currency_not_allowed` | 400 | «Bu valyuta kompaniyada yoqilmagan» |
| `company_required` | 403 | «Avval kompaniyani tanlang» |
| `forbidden` | 403 | «Bu amal uchun ruxsatingiz yo'q» |
| `not_found` | 404 | «Akkaunt topilmadi», «Kategoriya topilmadi», «Hujjat topilmadi» |
| `name_taken` | 409 | «Bu nomli akkaunt allaqachon bor», «Bu nomli kategoriya allaqachon bor» |
| `account_in_use` | 409 | «Bu akkauntda N ta hujjat bor» |
| `last_account` | 409 | «Kompaniyada kamida bitta faol akkaunt qolsin» |
| `category_in_use` | 409 | «Bu kategoriyada N ta hujjat bor» |
| `order_changed` | 409 | «Ro'yxat o'zgargan. Sahifani yangilang» |
