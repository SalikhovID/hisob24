# Rollar: owner, user va kompaniya rollari

Bu hujjat rollarni belgilaydi: qanday rollar bor, rol qayerdan keladi, kim nima qila oladi va bu qanday tekshiriladi. Userlar, multi-user va xodimlarni boshqarish: [user.md](user.md). Mijozlar bo'limi: [customers.md](customers.md). Vazifalar bo'limi: [tasks.md](tasks.md). Lokatsiyalar va xodimning lokatsiya cheklovi: [locations.md](locations.md). Mahsulotlar va xizmatlar: [products.md](products.md). Ombor (ta'minotchilar, xaridlar, to'lovlar): [warehouse.md](warehouse.md).

> Holat: `owner` / `user` qoidalari amalga oshirilgan (2026-10-03, `docs/superpowers/specs/2026-10-03-employees-roles-sidebar-design.md`). Kompaniya rollari (ruxsat matritsasi) va tor ekrandagi pastki tab-bar 2026-10-06 da kelishilgan va amalga oshirilgan: `docs/superpowers/specs/2026-10-06-roles-bottom-nav-design.md`. Xodimning lokatsiya cheklovi (4-bo'limdagi qatorlar, 6 va 7-bo'limlar; 2026-10-07) `docs/superpowers/specs/2026-10-07-locations-design.md` bilan amalga oshirilmoqda. Mahsulotlar, Ombor bo'limlari va menyu tartibi (4.1, 4.2, 4.3 va 8-bo'limlar; 2026-10-07) `docs/superpowers/specs/2026-10-07-inventory-design.md` bilan amalga oshirilmoqda. Qoida o'zgarsa, avval shu hujjat, keyin kod o'zgartiriladi.

## 1. Rollar

Ikki qatlam bor: a'zolik roli va kompaniya roli.

**A'zolik roli** (`user_companies.role`) userning kompaniyadagi o'rnini aytadi:

| Rol | Interfeysda | Kim | Bir kompaniyada nechta |
|---|---|---|---|
| `owner` | Egasi | kompaniya egasi, uni platforma admini qo'yadi | aynan bitta |
| `user` | Xodim | egasi (yoki shunga ruxsatli xodim) user app ichidan qo'shgan xodim | cheklanmagan |

Boshqa a'zolik roli yo'q. Eski `manager` va `staff` rollari olib tashlangan.

**Kompaniya roli** (`roles` jadvali, `user_companies.role_id`) egasi tuzadigan nom va ruxsatlar to'plami (masalan, "Sotuvchi": mijozlar hammasi, vazifalar ko'rish va qo'shish). U faqat `user` a'zolikka biriktiriladi:

| Xodim | Interfeysda | Ruxsati |
|---|---|---|
| rolsiz (`role_id IS NULL`) | Xodim | standart: Mijozlar va Vazifalar (4.2) |
| rolli | rol nomi | faqat rolda belgilangan ruxsatlar |

Egasiga rol berilmaydi: u hamma narsani qila oladi. Rollar kompaniyaga tegishli: bir kompaniya boshqasining rollarini ko'rmaydi va ishlatmaydi.

Platforma admini (`admins` jadvali, admin panel) bu rollardan tashqarida: u kompaniya a'zosi emas va user app'ga admin sifatida kirmaydi.

## 2. Asosiy qoidalar

1. **A'zolik roli tanlanmaydi, qo'shilgan joyiga qarab belgilanadi.** Admin paneldan qo'yilgan user `owner` bo'ladi. User app ichidan qo'shilgan user `user` bo'ladi.
2. **Har kompaniyada aynan bitta owner.** Buni baza kafolatlaydi: bir `company_id` ga bitta `owner` (unique indeks).
3. **Owner'ga tizim ichidan tegib bo'lmaydi.** User app'dan owner'ni (o'zini ham) o'chirib, ismini yoki rolini o'zgartirib, unga kompaniya roli biriktirib bo'lmaydi. Egasini faqat platforma admini almashtiradi; egasiga kompaniya rolini hech kim bermaydi (baza CHECK).
4. **Rol kompaniyaga bog'liq.** Bir user bir kompaniyada owner, boshqasida user bo'lishi mumkin; kompaniya roli ham shu kompaniyadagi a'zolikniki.
5. **Rol va ruxsat har so'rovda bazadan o'qiladi.** Egasining almashishi, rolning biriktirilishi yoki rol ruxsatlarining o'zgarishi keyingi so'rovdanoq kuchga kiradi.
6. **Kompaniya rollarini faqat egasi boshqaradi.** Rol yaratish, o'zgartirish, o'chirish va xodimga biriktirish egasiniki; bu ruxsat sifatida berilmaydi. Aks holda xodim o'ziga yoki hamkasbiga keng rol berib, huquqini oshirib olardi.
7. **Ruxsat yetmasa, tugma ko'rinmaydi va API rad etadi.** Interfeys ruxsatsiz amalni ko'rsatmaydi, lekin himoya API'da: 403.

## 3. Rol qayerdan keladi

| Amal | Kim bajaradi | Natija |
|---|---|---|
| Company yaratish | platforma admini | kiritilgan raqam → `owner` |
| Egasini almashtirish | platforma admini | kiritilgan raqam → `owner` (kompaniya roli bo'lsa, olib tashlanadi), oldingi owner → rolsiz `user` |
| Xodim qo'shish | egasi yoki `employees.create` ruxsatli xodim | kiritilgan raqam → rolsiz `user` |
| Rol biriktirish | egasi | `user` → shu rol bilan; `null` → yana rolsiz |

A'zolik roli faqat egasini almashtirish orqali o'zgaradi:

| O'tish | Mumkinmi | Qanday |
|---|---|---|
| `user` → `owner` | ha | admin shu raqamni owner qiladi |
| `owner` → `user` | ha | admin boshqa raqamni owner qilganda |
| `user` → o'chirilgan | ha | egasi (yoki `employees.delete` ruxsatli xodim) xodimni o'chiradi |
| `owner` → o'chirilgan | yo'q | avval egasi almashtiriladi, keyin yangi owner uni xodim sifatida o'chiradi |

## 4. Ruxsatlar

### 4.1 Katalog

Ruxsat `bo'lim.amal` ko'rinishida, 30 ta:

| Bo'lim | `view` Ko'rish | `create` Qo'shish | `edit` Tahrirlash | `delete` O'chirish | `history` Tarix |
|---|---|---|---|---|---|
| `customers` Mijozlar | ro'yxat, mijoz sahifasi, telefon takliflari | mijoz qo'shish | mijozni tahrirlash | mijozni o'chirish | mijoz tarixini ko'rish |
| `tasks` Vazifalar | ro'yxat, kanban, vazifa sahifasi | vazifa qo'shish | vazifani tahrirlash, bosqichini o'zgartirish (sudrash ham) | vazifani o'chirish | vazifa tarixini ko'rish |
| `products` Mahsulotlar | mahsulotlar va xizmatlar ro'yxati, mahsulot sahifasi, xarid formasidagi mahsulot takliflari | mahsulot yoki xizmat qo'shish | tahrirlash, nofaol qilish, faollashtirish | o'chirish | — |
| `suppliers` Ta'minotchilar | ro'yxat, ta'minotchi sahifasi, xarid formasidagi ta'minotchi takliflari | ta'minotchi qo'shish | tahrirlash, nofaol qilish, faollashtirish | o'chirish | — |
| `purchases` Xaridlar | xaridlar ro'yxati, xarid sahifasi, ta'minotchi balansi va to'lovlari, mahsulot sahifasidagi xaridlar | xarid va to'lov qo'shish | xarid va to'lovni tahrirlash | xarid va to'lovni o'chirish | — |
| `employees` Xodimlar | xodimlar ro'yxati (rollari bilan) | xodim qo'shish | xodim ismini o'zgartirish | xodimni o'chirish | — |
| `settings` Sozlamalar | Sozlamalar sahifasi | tur, maydon, dropdown, variant, bosqich qo'shish | nomini, belgilarini va tartibini o'zgartirish; variantni nofaol qilish | o'chirish | — |

- Bo'limning `view` ruxsati bo'lsa, u menyuda ko'rinadi. Bosh sahifa hammaga.
- **Amal `view`siz bo'lmaydi:** rolda biror bo'limning `create`, `edit`, `delete` yoki `history` ruxsati bo'lsa, shu bo'limning `view` ruxsati ham bo'lishi shart. API bunday rolni rad etadi (400 "«Mijozlar» bo'limida avval «Ko'rish» ni belgilang"), forma esa amal belgilanganda "Ko'rish" ni o'zi belgilaydi, "Ko'rish" olib tashlansa bo'limni tozalaydi.
- Katalogda yo'q kalit: 400 "Ruxsat noto'g'ri". Takror kalit bir marta sanaladi.
- Katalogdan tashqarida: a'zolar ro'yxati (`GET /app/members`), turlar, dropdownlar, bosqichlar va vazifa turlarini o'qish (formalar uchun) hamma a'zoga ochiq; rollarni boshqarish va biriktirish faqat egasiga. Xodimni lokatsiya bilan cheklash ham faqat egasiga ([locations.md](locations.md), 5-bo'lim): cheklov ruxsat emas, a'zolikning o'z xususiyati; `tasks.*` va `purchases.*` ruxsatlari a'zoning ruxsatli lokatsiyalari ichida amal qiladi ([warehouse.md](warehouse.md), 7-bo'lim). Menyu tartibi (`PUT /app/me/nav`) har a'zoning o'ziniki (8-bo'lim).

### 4.2 Kim nimaga ega

| Kim | Ruxsati |
|---|---|
| egasi | katalogning hammasi; qo'shimcha rollarni boshqarish va biriktirish |
| rolsiz xodim | `customers.view`, `customers.create`, `customers.edit`, `customers.delete`, `tasks.view`, `tasks.create`, `tasks.edit`, `tasks.delete` (2026-10-03 dagi qoida) va `products.*`, `suppliers.*`, `purchases.*` ning to'rttala amali (2026-10-07) |
| rolli xodim | faqat rolda belgilanganlar; standart to'plam qo'shilmaydi |

Amallar bo'yicha:

| Amal | owner | rolsiz `user` | rolli `user` |
|---|---|---|---|
| Tizimga kirish (SMS yoki Mini App) | ✓ | ✓ | ✓ |
| Bosh sahifa | ✓ | ✓ | ✓ |
| Kompaniyani almashtirish (boshqa kompaniyasi bo'lsa) | ✓ | ✓ | ✓ |
| A'zolar ro'yxati (mas'ul tanlash uchun), turlar, dropdownlar, bosqichlarni o'qish | ✓ | ✓ | ✓ |
| Mijozlarni ko'rish, qo'shish, tahrirlash, o'chirish | ✓ | ✓ | `customers.*` |
| Mijozning o'zgarishlar tarixini ko'rish | ✓ | ✗ | `customers.history` |
| Vazifalarni ko'rish, qo'shish, tahrirlash, ko'chirish, o'chirish | ✓ | ✓ | `tasks.*` |
| Vazifaning o'zgarishlar tarixini ko'rish | ✓ | ✗ | `tasks.history` |
| Mahsulot va xizmatlarni ko'rish, qo'shish, tahrirlash, nofaol qilish, o'chirish ([products.md](products.md)) | ✓ | ✓ | `products.*` |
| Ta'minotchilarni ko'rish, qo'shish, tahrirlash, nofaol qilish, o'chirish ([warehouse.md](warehouse.md)) | ✓ | ✓ | `suppliers.*` |
| Xaridlar va to'lovlarni ko'rish, qo'shish, tahrirlash, o'chirish; ta'minotchi balansi | ✓ | ✓ | `purchases.*` |
| Menyu tartibini sozlash (8-bo'lim) | ✓ | ✓ | ✓ |
| Xodimlar ro'yxatini ko'rish, xodim qo'shish, ismini o'zgartirish, o'chirish | ✓ | ✗ | `employees.*` |
| Mijoz turlari, maydonlar, dropdownlar, bosqichlar, vazifa turlarini sozlash | ✓ | ✗ | `settings.*` |
| Rollarni ko'rish, yaratish, o'zgartirish, o'chirish; xodimga rol biriktirish | ✓ | ✗ | ✗ |
| Xodimni lokatsiya bilan cheklash ([locations.md](locations.md)) | ✓ | ✗ | ✗ |
| Owner'ni o'zgartirish yoki o'chirish | ✗ | ✗ | ✗ |
| Kompaniya nomi, obuna, bloklash | ✗ | ✗ | ✗ |

Oxirgi ikki qator faqat platforma adminiga tegishli (admin panel).

"Xodimlar ro'yxatini ko'rish" Xodimlar bo'limi va `GET /app/employees` haqida. A'zolar ro'yxati (`GET /app/members`) esa har a'zoga, faqat tanlash uchun: unda ism, telefon va a'zolik roli bor, boshqaruv amallari yo'q.

Ruxsat har doim **tanlangan kompaniyadagi a'zolik** bo'yicha beriladi. Olma Savdo'da owner bo'lgan user Nok Market'da rolli `user` bo'lsa, Nok Market'da faqat o'sha rol ruxsatlari bilan ishlaydi.

### 4.3 Ikki bo'limga tegadigan amallar

| Amal | Kerak bo'lgan ruxsat |
|---|---|
| Vazifani yangi mijoz bilan qo'shish (`POST /app/tasks`, `customer` da `id` yo'q) | `tasks.create` **va** `customers.create`; ikkinchisi bo'lmasa 403 `forbidden` |
| Vazifa qo'shishda mavjud mijozni telefon takliflaridan tanlash (`GET /app/customers?phone=`) | `customers.view` |
| Mijoz sahifasida uning vazifalarini ko'rish (`GET /app/tasks?customer_id=`) | `tasks.view` |
| Xarid qo'shish yoki tahrirlash (`POST` / `PUT /app/purchases`) | `purchases.create` / `purchases.edit`; formadagi ta'minotchi va mahsulot takliflari uchun `suppliers.view` **va** `products.view` |
| Ta'minotchi sahifasida balans, xaridlar va to'lovlar; mahsulot sahifasida xaridlar | `purchases.view` |

Interfeys: `customers.create` bo'lmasa vazifa formasida "yangi mijoz" qismi yo'q; `customers.view` bo'lmasa takliflar so'ralmaydi; ikkalasi ham bo'lmasa "Vazifa qo'shish" tugmasi ko'rinmaydi. Mijoz sahifasidagi "Vazifalar" bo'limi `tasks.view` bo'lsa chiqadi. Vazifa va mijoz orasidagi havolalar qoladi: ruxsatsiz sahifa ochilsa, bosh sahifaga qaytariladi. «Xarid qo'shish» tugmasi uchala ruxsat bo'lsa ko'rinadi; ta'minotchi va mahsulot sahifalaridagi xarid va to'lov bo'limlari `purchases.view` bo'lsa chiqadi.

## 5. Kompaniya rollari

Egasi **Sozlamalar → Rollar** da rollarni tuzadi va **Xodimlar** da biriktiradi.

| Amal | Qoida |
|---|---|
| Yaratish (`POST /app/roles {name, permissions}`) | nom 1–60 belgi, chetidagi bo'shliqlar olib tashlanadi, kompaniyada takrorlanmaydi (katta-kichik harf farqsiz): 409 `name_taken`; ruxsatlar katalogdan (4.1); bo'sh ro'yxat mumkin (bunday xodim faqat Bosh sahifani ko'radi) |
| O'zgartirish (`PUT /app/roles/{id} {name, permissions}`) | nom va ruxsatlar yuborilganiga butunlay almashadi; shu rolli xodimlarga keyingi so'rovdanoq ta'sir qiladi |
| O'chirish (`DELETE /app/roles/{id}`) | biror xodimga biriktirilgan rol o'chirilmaydi: 409 `role_in_use` "Bu rol N ta xodimga biriktirilgan"; aks holda bazadan o'chadi (unga hech narsa havola qilmaydi), nomi darhol bo'shaydi |
| Biriktirish (`PUT /app/employees/{phone}/role {role_id}`) | `role_id` shu kompaniyaning roli bo'lishi shart (yo'q yoki begona bo'lsa 404 "Rol topilmadi"); `null` rolni olib tashlaydi, xodim rolsiz bo'ladi; egasiga 409 `cannot_change_owner`; a'zo bo'lmagan raqam 404 "Xodim topilmadi" |

- Ro'yxat (`GET /app/roles`) nom bo'yicha; har rolda biriktirilgan xodimlar soni bor.
- Xodim o'chirilsa, a'zolik bilan biriktiruvi ketadi; rol qoladi. Qayta qo'shilgan xodim rolsiz.
- Egasi almashtirilganda yangi egasining kompaniya roli olib tashlanadi (egasiga rol bo'lmaydi); eski egasi rolsiz xodim bo'ladi.
- Rol biriktirilgan yoki o'zgargan xodimning ochiq sessiyasi uzilmaydi; keyingi so'rovdan yangi ruxsat bilan ishlaydi (7-bo'lim).
- Tayyor rol yo'q: har kompaniya rolsiz boshlaydi.

## 6. Egasini almashtirish (admin panel)

Admin kompaniya sahifasida **Egasini almashtirish** ni bosadi va telefon bilan ismni kiritadi (`PUT /admin/companies/{id}/owner {phone, full_name}`). Hammasi bitta transaction ichida bajariladi.

| Kiritilgan raqam | Natija |
|---|---|
| tizimda yo'q | user yaratiladi va owner bo'ladi; oldingi owner → `user` |
| boshqa kompaniyada bor | o'sha user shu kompaniyada owner bo'ladi (multi-user); oldingi owner → `user` |
| shu kompaniyada `user` | owner'ga ko'tariladi, ismi kiritilgan ismga almashadi, kompaniya roli va lokatsiya cheklovi bo'lsa olib tashlanadi; oldingi owner → `user` |
| hozirgi owner'ning o'zi | rol o'zgarmaydi, faqat ismi yangilanadi |

- Oldingi owner kompaniyada rolsiz xodim bo'lib qoladi, ismi saqlanadi. Kerak bo'lmasa, yangi owner uni Xodimlar'dan o'chiradi.
- Oldingi owner'ning ochiq sessiyasi uzilmaydi, lekin keyingi so'rovdan boshlab u rolsiz `user` huquqlari bilan ishlaydi: "Xodimlar" va "Sozlamalar" bo'limlari yo'qoladi.
- Ikki admin bir kompaniyaning egasini bir vaqtda almashtirsa, amallar navbat bilan bajariladi va oxirgisi qoladi. Ikki owner paydo bo'lmaydi.

## 7. Rol va ruxsat qanday tekshiriladi

- A'zolik roli `user_companies.role` da (`owner` yoki `user`), kompaniya roli `user_companies.role_id` da (`roles` jadvaliga kompaniya bo'yicha FK), ruxsatlar `roles.permissions` da (`bo'lim.amal` kalitlari ro'yxati).
- Access token'da `company_id` va `role` bor, lekin ruxsat berishda token'ga ishonilmaydi. Har so'rovda a'zolik, obuna, rol va ruxsatlar bazadan bitta so'rovda o'qiladi.
- Amaldagi ruxsat: owner → hammasi; `user`, rolsiz → standart (4.2); `user`, rolli → rolniki.
- Tekshiruv tartibi: token (401) → a'zolik (401) → obuna (402) → kompaniya tanlangan (403 `company_required`) → ruxsat (403 `forbidden`). Rollarni boshqarish va biriktirish: owner (403 `owner_only`). Batafsil: [user.md](user.md), 7-bo'lim.
- Kompaniya ID so'rovdan emas, token'dan olinadi. Shuning uchun hech kim boshqa kompaniyaga ta'sir qila olmaydi; begona kompaniyaning roli biriktirilsa, baza (FK) ham rad etadi.
- `/app/me` javobida `permissions` bor: tanlangan kompaniyadagi amaldagi ruxsatlar. Interfeys menyu va tugmalarni shundan quradi; kompaniya tanlanmagan bo'lsa ro'yxat bo'sh.
- `/app/me` javobida `locations` ham bor: a'zoning tanlangan kompaniyadagi ruxsatli lokatsiyalari ([locations.md](locations.md), 4-bo'lim); ular ham har so'rovda bazadan o'qiladi.

## 8. Interfeys

- Bo'limlar ruxsat bo'yicha: **Mijozlar** `customers.view`, **Vazifalar** `tasks.view`, **Mahsulotlar** `products.view` (Mahsulotlar va Xizmatlar tablari), **Ombor** `purchases.view` yoki `suppliers.view` (Xaridlar va Ta'minotchilar tablari; ruxsatli birinchi tabiga ochiladi), **Xodimlar** `employees.view`, **Sozlamalar** `settings.view` bo'lganga ko'rinadi; **Bosh sahifa** hammaga. Keng ekranda (768px dan) bo'limlar chapdagi sidebar'da, tor ekranda (telefon, Telegram Mini App) pastdagi tab-bar'da; chapdan chiqadigan menyu yo'q.
- **Menyu tartibi** a'zoniki. Standart tartib: Bosh sahifa, Mijozlar, Vazifalar, Mahsulotlar, Ombor, Xodimlar, Sozlamalar. A'zo «Menyuni sozlash» dialogida (tab-bar'dagi «Yana» pastida va topbar profil menyusida) bo'limlarni sudrab tartiblaydi; tartib a'zolikda saqlanadi (`user_companies.nav_order`, `PUT /app/me/nav {sections}`, `/app/me` da `nav_order`; `null` standart) va shu kompaniyada har qurilmada bir xil. Sidebar va tab-bar bir tartibda. Tab-bar'da a'zoning bo'limlari 5 tagacha bo'lsa hammasi, 6 va undan ko'p bo'lsa birinchi 4 tasi va **«Yana»** (pastdan chiqadigan ro'yxat, qolgan bo'limlar; joriy sahifa ulardan birida bo'lsa «Yana» belgilangan). Ruxsati yo'qolgan bo'lim tartibda e'tiborga olinmaydi, ruxsati keyin ochilgan bo'lim standart tartibda oxiriga tushadi. Kalitlar: `home`, `customers`, `tasks`, `products`, `warehouse`, `employees`, `settings`; boshqasi 400 «Bo'lim noto'g'ri», takror bir marta.
- Ruxsat bo'lmagan amalning tugmasi chizilmaydi (qo'shish, tahrirlash, o'chirish, bosqichni ko'chirish, tarix). Bo'lim manzili qo'lda ochilsa, bosh sahifaga qaytariladi. API baribir 403 qaytaradi.
- **Rollar** Sozlamalarning alohida tabi, faqat egasiga ko'rinadi: ro'yxat (nom, bo'limlari, nechta xodimda), rol sahifasida nom va ruxsat matritsasi (bo'limlar × amallar), "Saqlash". Yangi rol `/settings/roles/new` da.
- **Xodimlar** ro'yxatida "Rol" ustuni: owner "Egasi", rolli xodim rol nomi, rolsiz "Xodim". Egasi har xodim qatorida rolni almashtiradi (dialog: "Rolsiz" yoki rollardan biri). `employees.*` ruxsatli xodim ro'yxatni va o'z amallarini ko'radi, rol tugmasini ko'rmaydi.
- Bosh sahifadagi kompaniya kartasida ham rol nomi (yoki "Egasi" / "Xodim").
- Xodimlar ro'yxatida owner birinchi turadi va "Egasi" belgisi bilan ko'rinadi (o'z qatorida "Siz"). Tahrirlash va o'chirish tugmalari faqat xodimlarda bor.
- Sessiyasi ochiq paytda ruxsati o'zgargan xodimning keyingi rad etilgan so'rovi (403 `forbidden` yoki `owner_only`) `/app/me` ni qayta so'ratadi: menyu yangilanadi, ruxsati yo'qolgan sahifadan bosh sahifaga qaytariladi.
- Mijoz va vazifa sahifalaridagi "Tarix" bo'limi egasiga va tegishli `history` ruxsatiga chiqadi ([customers.md](customers.md), 7-bo'lim; [tasks.md](tasks.md), 7-bo'lim).
- Admin panelda kompaniya a'zolari "Egasi" yoki "Xodim" roli bilan ko'rinadi; kompaniya rollari admin panelda ko'rsatilmaydi va boshqarilmaydi.

## 9. Chekka holatlar

| Holat | Natija |
|---|---|
| Egasiga rol biriktirilmoqchi | 409 `cannot_change_owner` |
| Boshqa kompaniyaning roli biriktirilmoqchi | 404 "Rol topilmadi" (baza FK ham rad etadi) |
| Rolli xodim egasi qilindi (admin) | rol olib tashlanadi, u egasi sifatida hamma narsani qila oladi |
| Rolli xodim o'chirildi, keyin qayta qo'shildi | rolsiz qaytadi |
| Rol o'chirilmoqchi, lekin xodimlarda bor | 409 `role_in_use`; avval xodimlardan olinadi |
| Rolning ruxsatlari kamaytirildi, xodim sahifada turibdi | keyingi so'rovi 403 `forbidden`; app `/app/me` ni qayta so'raydi, bo'lim yo'qolsa bosh sahifaga |
| `employees.delete` ruxsatli xodim o'zini o'chiradi | o'chadi: keyingi so'rovdan kompaniyaga kira olmaydi ([user.md](user.md), 6-bo'lim) |
| `employees.edit` ruxsatli xodim egasining ismini o'zgartirmoqchi | 409 `cannot_change_owner` (avvalgidek) |
| Bo'sh ruxsatli rol | xodim faqat Bosh sahifani ko'radi, kompaniyani almashtira oladi |
| `tasks.create` bor, `customers.view` va `customers.create` yo'q | vazifa qo'shib bo'lmaydi: tugma ko'rinmaydi, API mijozni talab qiladi |
| Kompaniyasi tanlanmagan token bilan ruxsatli API | 403 `company_required`; rollar API 403 `owner_only` |
| Obunasi tugagan kompaniyada ruxsatli API | 402 `subscription_expired` |
| Ikki sessiya bitta rolni bir vaqtda o'zgartiradi | oxirgi saqlagan qoladi |
| Bir xil nomli rol (katta-kichik harf farqi bilan) | 409 `name_taken` |

## 10. Xato kodlari

| Kod | Status | Xabar |
|---|---|---|
| `validation_error` | 400 | "Nomni kiriting", "Nom 60 belgidan oshmasin", "Ruxsat noto'g'ri", "«Mijozlar» bo'limida avval «Ko'rish» ni belgilang" |
| `company_required` | 403 | "Avval kompaniyani tanlang" |
| `forbidden` | 403 | "Bu amal uchun ruxsatingiz yo'q" |
| `owner_only` | 403 | "Bu bo'lim faqat kompaniya egasi uchun" |
| `not_found` | 404 | "Rol topilmadi", "Xodim topilmadi" |
| `name_taken` | 409 | "Bu nomli rol allaqachon bor" |
| `role_in_use` | 409 | "Bu rol N ta xodimga biriktirilgan" |
| `cannot_change_owner` | 409 | "Kompaniya egasini o'zgartirib yoki o'chirib bo'lmaydi" |

## 11. Eski ma'lumotdan o'tish

Migratsiya 00004 (2026-10-03), `owner` / `user` kiritilganda:

- har kompaniyada eng birinchi qo'shilgan owner (kompaniya yaratilganda qo'yilgan) owner bo'lib qoladi;
- qolgan hamma a'zo (`manager`, `staff` va keyin qo'shilgan owner'lar) `user` bo'ladi;
- har a'zolikning ismi userning o'sha paytdagi ismidan olinadi.

Migratsiya 00009 (2026-10-06), kompaniya rollari kiritilganda: `roles` jadvali va `user_companies.role_id` qo'shiladi; mavjud a'zolar rolsiz qoladi, hech kimning huquqi o'zgarmaydi.

## 12. Yangi bo'lim qo'shilganda

- Katalogga (4.1) bo'lim va amallari qo'shiladi: backend `internal/access`, frontend `lib/permissions.ts`, `openapi.yaml` dagi `Permission` enum.
- 4.2 jadvaliga qator qo'shiladi; rolsiz xodimga kerak bo'lsa, standart to'plamga ham.
- Menyuda `permission: "<bo'lim>.view"`, API'da `requirePermission`. Faqat egasiga tegishli bo'lsa (rollar kabi): API'da `requireOwner` (403 `owner_only`), interfeysda `useOwner`.
- Menyuda bo'limning kaliti (`lib/nav.ts`, `NavItem.key`) va standart tartibdagi o'rni; `PUT /app/me/nav` kalitlari shu ro'yxatdan (backend `internal/access` yoki `internal/user` dagi kalitlar ro'yxati).
- Yangi a'zolik roli kerak bo'lsa, avval shu hujjat o'zgartiriladi, keyin kod.
