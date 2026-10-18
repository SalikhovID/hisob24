# Lokatsiyalar: filiallar, joriy lokatsiya, xodim cheklovi

Bu hujjat lokatsiyalar qoidalarini belgilaydi: lokatsiya nima, kim qo'shadi, a'zo qaysi lokatsiyada ishlaydi, xodim qanday cheklanadi va bu buyurtmalarga qanday ta'sir qiladi. Buyurtmalar: [orders.md](orders.md). Rollar: [roles.md](roles.md). Userlar va xodimlar: [user.md](user.md). Ombor (xarid va qoldiq lokatsiyaniki): [warehouse.md](warehouse.md).

> Holat: amalga oshirilgan (2026-10-07). Qoida o'zgarsa, avval shu hujjat, keyin kod o'zgartiriladi. Dizayn, bosqichlar va amalga oshirishdagi qarorlar: `docs/superpowers/specs/2026-10-07-locations-design.md`. Ombor bilan bog'liq qoidalar (1, 3, 4, 7–9-bo'limlar; 2026-10-07) `docs/superpowers/specs/2026-10-07-inventory-design.md` bilan amalga oshirilgan; jurnal, sotuv va ko'chirish bilan yangilangan qoidalar (1, 3, 7-bo'limlar; 2026-10-11) `docs/superpowers/specs/2026-10-11-ledger-design.md` bilan amalga oshirilmoqda.

## 1. Tushunchalar

| Tushuncha | Ma'nosi | Bazada |
|---|---|---|
| **Lokatsiya** | Kompaniyaning filiali: nomi bor. Buyurtma aynan bitta lokatsiyada turadi. | `locations` |
| **Tayyor lokatsiya** | Har kompaniya boshlaydigan "Asosiy" lokatsiya. | migratsiya 00010 (mavjud kompaniyalar), `company.Create` (yangisi) |
| **Joriy lokatsiya** | A'zo hozir ishlayotgan lokatsiya: buyurtmalar ro'yxati, kanban va yangi buyurtma shuniki; ombor hujjatlari (xarid, sotuv, ko'chirish manbasi, inventarizatsiya, boshlang'ich qoldiq) ro'yxatlari va yangi hujjat, mahsulotlar ro'yxatidagi qoldiq ham. Brauzerda eslanadi, serverga har buyurtma va hujjat so'rovida `location_id` bilan aytiladi. | brauzer (`location:<kompaniya>:<telefon>`) |
| **Cheklov** | Xodim ishlay oladigan lokatsiyalar to'plami. Standart: hammasi. | `user_companies.all_locations`, `member_locations` |
| **Ruxsatli lokatsiyalar** | A'zoning jonli (o'chirilmagan) lokatsiyalari: egasi va cheklanmagan xodimda kompaniyaning hammasi, cheklanganda belgilanganlari. | har so'rovda `GetCompanyAccess`; `/app/me` da `locations` |

Lokatsiya buyurtmalarga va omborga tegadi: buyurtma, xarid, sotuv, inventarizatsiya va boshlang'ich qoldiq bitta lokatsiyada turadi, ko'chirish ikkitasiga tegadi, qoldiq lokatsiyaniki ([warehouse.md](warehouse.md); 7-bo'lim). Mijozlar, xodimlar, rollar, sozlamalar (mijoz va buyurtma turlari, maydonlar, dropdownlar, bosqichlar, moliya kategoriyalari), mahsulotlar, ta'minotchilar, akkauntlar (kassa) va pul hujjatlari kompaniya bo'yicha umumiy.

## 2. Kim nima qila oladi

| Amal | admin | egasi | xodim |
|---|---|---|---|
| Lokatsiya qo'shish, nomini o'zgartirish, o'chirish (admin panel) | ✓ | ✗ | ✗ |
| O'ziga ruxsatli lokatsiyalarni ko'rish (`/app/me`) | — | ✓ | ✓ |
| Joriy lokatsiyani almashtirish (2+ ruxsatli bo'lsa) | — | ✓ | ✓ |
| Xodimni lokatsiya bilan cheklash (`PUT /app/employees/{phone}/locations`) | ✗ | ✓ | ✗ |
| Xodimlar ro'yxatida lokatsiyalarini ko'rish | ✗ | ✓ | `employees.view` |

- Cheklov ruxsat emas ([roles.md](roles.md), 4-bo'lim): rol kabi faqat egasi belgilaydi (403 `owner_only`), `employees.edit` ruxsatli xodim ham emas, aks holda o'ziga lokatsiya ochib olardi.
- Egasi har doim hamma lokatsiyada (baza CHECK: `role <> 'owner' OR all_locations`).

## 3. Lokatsiyalar (admin panel)

- Har kompaniya **"Asosiy"** lokatsiya bilan boshlaydi: mavjud kompaniyalarga migratsiya 00010 yozadi (ularning hamma buyurtmalari unga tushadi), yangisiga kompaniya yaratilganda.
- Admin kompaniya sahifasida **Lokatsiyalar** bo'limida qo'shadi (`POST /admin/companies/{id}/locations {name}`), nomini o'zgartiradi (`PATCH …/{locationId} {name}`) va o'chiradi (`DELETE …/{locationId}`). Nom 1–60 belgi, chetidagi bo'shliqlar olib tashlanadi, kompaniyada takrorlanmaydi (katta-kichik harf farqsiz): 409 `name_taken`.
- Ro'yxat ID tartibida (qo'shilish tartibi), har lokatsiyada faol buyurtmalar soni.
- **O'chirish** yashirish (`deleted_at`), bazadan o'chmaydi; nomi bo'shaydi. O'chirilmaydi: kompaniyaning yagona lokatsiyasi (409 `last_location`), faol buyurtmasi bor lokatsiya (409 `location_in_use` "Bu lokatsiyada N ta buyurtma bor"; o'chirilgan buyurtmalar sanalmaydi), jonli hujjati bor lokatsiya (xarid, sotuv, inventarizatsiya, boshlang'ich qoldiq, manbasi yoki maqsadi shu bo'lgan ko'chirish; 409 `location_in_use` "Bu lokatsiyada N ta hujjat bor"; o'chirilgan hujjatlar sanalmaydi). Shu tartibda tekshiriladi. Xodim cheklovlari to'sqinlik qilmaydi (5-bo'lim).
- Egasi user app'dan lokatsiya qo'sha olmaydi.

## 4. Joriy lokatsiya va tanlovchi

- A'zoning ruxsatli lokatsiyalari `/app/me` javobida (`locations`, ID tartibida; kompaniya tanlanmagan bo'lsa bo'sh).
- Joriy lokatsiya brauzerda eslanadi (kompaniya va user bo'yicha). Eslangani ruxsatli bo'lmasa (o'chirilgan, cheklov bilan yopilgan) ruxsatli birinchisi. Ruxsatli lokatsiya bo'lmasa joriy lokatsiya yo'q.
- **Tanlovchi** topbar'da (har sahifada), faqat ruxsatli lokatsiya 2+ bo'lsa. 1 ta bo'lsa (kompaniyada 1 ta yoki xodim 1 tasi bilan cheklangan) hech narsa ko'rinmaydi. Almashtirish bir zumda: token o'zgarmaydi; buyurtmalar ro'yxati 1-sahifadan, tur / bosqich / qidiruv / mas'ul filtrlari qoladi; xaridlar ro'yxati ham 1-sahifadan, mahsulotlar ro'yxatidagi "Qoldiq" ustuni yangi lokatsiyaniki.
- Server joriy lokatsiyani so'rovning `location_id` idan oladi va a'zoning ruxsatli to'plamida tekshiradi; token'da lokatsiya yo'q.

## 5. Xodim cheklovi

- Xodim qo'shilganda hamma lokatsiyada (`all_locations = true`). Keyin qo'shilgan lokatsiya ham unga o'zi ochiladi.
- Egasi **Xodimlar** da xodimning lokatsiyalarini belgilaydi (`PUT /app/employees/{phone}/locations {location_ids}`): `null` hammasi; ro'yxat kamida bitta (bo'sh 400 "Kamida bitta lokatsiyani tanlang"), har biri kompaniyaning jonli lokatsiyasi (aks holda 404 "Lokatsiya topilmadi"), takror bir marta. Egasiga 409 `cannot_change_owner`, a'zo bo'lmagan raqam 404 "Xodim topilmadi". Keyingi so'rovdanoq kuchga kiradi.
- Cheklangan xodimga keyin qo'shilgan lokatsiya ochilmaydi: egasi qo'shadi.
- Cheklanayotgan xodim boshqa lokatsiyalarda buyurtmalarga mas'ul bo'lsa, **buyurtmalar unda qoladi** (u ko'rmaydi); dialog "Boshqa lokatsiyalarda N ta buyurtmaga mas'ul" deb ogohlantiradi. "Mas'ul" filtrida u ko'rinaveradi.
- Lokatsiya o'chirilsa cheklovlarga tegilmaydi: ruxsatli to'plam jonli lokatsiyalardan hisoblanadi. Cheklangan xodimning hamma lokatsiyasi o'chirilgan bo'lsa u **lokatsiyasiz**: buyurtmalarni ko'rmaydi va qo'sha olmaydi, "Buyurtmalar" sahifasi "Sizga lokatsiya biriktirilmagan" deydi; Xodimlar ro'yxatida "—"; egasi yangisini beradi. Cheklov hech qachon o'z-o'zidan kengaymaydi.
- Egasi almashtirilganda yangi egasining cheklovi olib tashlanadi (egasi hammasida); eski egasi xodim sifatida hammasida qoladi. Xodim o'chirilsa cheklovi a'zolik bilan ketadi; qayta qo'shilsa hammasida.
- Xodimlar ro'yxatida "Lokatsiyalar" ustuni (kompaniyada 2+ lokatsiya bo'lsa): "Barchasi", nomlar yoki "—". Dialog faqat egasiga va faqat xodim qatorlarida: "Barcha lokatsiyalar" belgisi yoki lokatsiyalar ro'yxati.

## 6. Buyurtmalar va lokatsiya

- **Qo'shish.** Buyurtma joriy lokatsiyaga tushadi (`POST /app/orders` da `location_id`); formada lokatsiya maydoni yo'q. Keyin o'zgarmaydi (mijoz va tur kabi). `location_id` berilmasa 400 "Lokatsiyani tanlang"; a'zoga ruxsatsiz (begona, o'chirilgan, cheklov bilan yopilgan) bo'lsa 403 `forbidden`.
- **Mas'ul** buyurtma lokatsiyasida ishlaydigan a'zo bo'lishi shart (egasi va cheklanmagan xodim har lokatsiyada): aks holda 400 "Mas'ul bu lokatsiyada ishlamaydi". Forma faqat shularni taklif qiladi (`GET /app/members` har a'zoning lokatsiyalarini aytadi). Tahrirda hozirgi mas'ul u yerda ishlamasa "Ism (bu lokatsiyada ishlamaydi)" varianti bilan tanlangan turadi; o'zgartirilmasa qoladi, boshqasi tanlansa yangi mas'ul shu lokatsiyada bo'lishi shart.
- **Ro'yxat va kanban** joriy lokatsiya buyurtmalarini ko'rsatadi (`GET /app/orders?location_id=`). Boshqa lokatsiyaning buyurtmalari ko'rinmaydi. `location_id` ruxsatsiz bo'lsa 403 `forbidden`: client `/app/me` ni qayta so'raydi, tanlovchi ruxsatli birinchisiga tushadi. Son bo'lmasa 400 "Lokatsiya noto'g'ri".
- **`location_id` berilmasa** ruxsatli hamma lokatsiya buyurtmalari: mijoz sahifasidagi "Buyurtmalar" bo'limi (2+ lokatsiyada har buyurtmada "Lokatsiya" belgisi) va cheklash dialogidagi sanoq shundan foydalanadi.
- **Buyurtma sahifasi** ruxsatli har lokatsiyadagi buyurtmani ochadi (havola orqali ham), joriy lokatsiyani o'zgartirmaydi; 2+ ruxsatli lokatsiyada "Lokatsiya" fakti. Tahrirlash, ko'chirish, o'chirish, tarix ham shunday.
- Ruxsatsiz lokatsiyadagi buyurtma ID bo'yicha 404 "Buyurtma topilmadi" (begona kompaniyaniki kabi).
- Lokatsiyasiz a'zo (5-bo'lim): ro'yxat bo'sh, har buyurtma 404, qo'shish 400.
- Lokatsiya tarixga yozilmaydi: o'zgarmaydi.

## 7. Ombor hujjatlari, sotuv va lokatsiya

Har lokatsiya bitta ombor ([warehouse.md](warehouse.md), [sales.md](sales.md)):

- **Xarid, sotuv, inventarizatsiya, boshlang'ich qoldiq** joriy lokatsiyaga tushadi, **ko'chirish** joriy lokatsiyadan chiqadi (`POST` da `location_id`); keyin o'zgarmaydi (buyurtma kabi). `location_id` berilmasa 400 "Lokatsiyani tanlang"; a'zoga ruxsatsiz (begona, o'chirilgan, cheklov bilan yopilgan) bo'lsa 403 `forbidden`. Ko'chirishning maqsadi (`to_location_id`) kompaniyaning istalgan jonli lokatsiyasi, a'zoga ruxsatli bo'lishi shart emas.
- **Qoldiq** lokatsiyaniki: ombor jurnalidagi shu lokatsiya harakatlarining yig'indisi. Mahsulotlar ro'yxatidagi "Qoldiq" ustuni joriy lokatsiyaniki (`GET /app/products?location_id=`; ruxsatsiz 403, son bo'lmasa 400 "Lokatsiya noto'g'ri"; berilmasa ruxsatli lokatsiyalar yig'indisi), mahsulot sahifasida ruxsatli har lokatsiya bo'yicha.
- **Ro'yxatlar** joriy lokatsiyaniki (`GET /app/purchases`, `/app/sales`, `/app/transfers`, `/app/inventories`, `/app/opening-stock` da `?location_id=`; ruxsatsiz 403, son bo'lmasa 400); ko'chirishlar ro'yxatida manbasi **yoki** maqsadi shu lokatsiya bo'lganlar. `location_id` berilmasa ruxsatli hamma lokatsiya: ta'minotchi, mijoz va mahsulot sahifalaridagi hujjatlar (2+ ruxsatli lokatsiyada "Lokatsiya" belgisi). Ruxsatsiz lokatsiyadagi hujjat ID bo'yicha 404 (ko'chirishda manba ham, maqsad ham ruxsatsiz bo'lsa). Hujjat sahifasi ruxsatli har lokatsiyadagi hujjatni ochadi (havola orqali ham), 2+ ruxsatli lokatsiyada "Lokatsiya" fakti bilan, joriy lokatsiyani o'zgartirmaydi. Maqsadi ruxsatli, manbasi ruxsatsiz ko'chirish ko'rinadi, tahrirlanmaydi va o'chirilmaydi (403).
- **Ta'minotchi va mijoz balansi, kassa** kompaniya bo'yicha (hamma lokatsiya): cheklangan xodim ham to'liq ko'radi; qarz va akkaunt lokatsiyaniki emas.
- **Lokatsiyasiz a'zo** (5-bo'lim): hujjat ro'yxatlari bo'sh, qo'shish 400, har hujjat 404, qoldiq ustuni 0; sahifalar "Sizga lokatsiya biriktirilmagan" deydi.
- Jonli hujjati bor lokatsiya o'chirilmaydi (3-bo'lim); hujjatlari o'chirilgan lokatsiya o'chiriladi (uning harakatlari ham o'chirilgan bo'ladi).

## 8. Chekka holatlar

| Holat | Natija |
|---|---|
| Kompaniyada 1 ta lokatsiya | tanlovchi yo'q; hamma narsa avvalgidek, buyurtmalar "Asosiy"da |
| Xodim 3 tadan 1 tasi bilan cheklangan | tanlovchi yo'q, faqat o'sha lokatsiya buyurtmalari |
| Eslangan joriy lokatsiya o'chirildi yoki yopildi | keyingi so'rov 403 `forbidden` → `/app/me` qayta → ruxsatli birinchisi |
| Admin xodimning yagona ruxsatli lokatsiyasini o'chirdi | o'chadi; xodim lokatsiyasiz, egasi tuzatadi (5-bo'lim) |
| Cheklanayotgan xodim boshqa lokatsiyada mas'ul | buyurtma unda qoladi, dialog ogohlantiradi |
| Cheklangan xodim boshqa lokatsiya buyurtmasiga mas'ul qilinmoqchi | 400 "Mas'ul bu lokatsiyada ishlamaydi"; formada u taklif qilinmaydi |
| Havola orqali boshqa (ruxsatli) lokatsiya buyurtmasi ochildi | ochiladi, "Lokatsiya" fakti bilan; tanlovchi o'zgarmaydi |
| Havola orqali ruxsatsiz lokatsiya buyurtmasi ochildi | 404 "Buyurtma topilmadi" |
| Egasi almashtirildi | yangi egasi hammasida (cheklovi o'chadi), eski egasi xodim sifatida hammasida |
| Yagona lokatsiya o'chirilmoqchi | 409 `last_location` |
| Faol buyurtmasi bor lokatsiya o'chirilmoqchi | 409 `location_in_use` "Bu lokatsiyada N ta buyurtma bor" |
| O'chirilgan lokatsiya nomi qayta ishlatilmoqchi | mumkin |
| Begona kompaniyaning lokatsiyasi | ro'yxat va qo'shishda 403 `forbidden`; cheklovda 404 "Lokatsiya topilmadi" |
| Jonli xaridi bor lokatsiya o'chirilmoqchi | 409 `location_in_use` "Bu lokatsiyada N ta xarid bor" |
| Havola orqali ruxsatsiz lokatsiya xaridi ochildi | 404 "Xarid topilmadi" |
| Cheklangan xodim boshqa lokatsiyaga xarid kiritmoqchi | 403 `forbidden`; ta'minotchi balansini esa to'liq ko'radi |

## 9. Xato kodlari

| Kod | Status | Xabar |
|---|---|---|
| `validation_error` | 400 | "Nomni kiriting", "Nom 60 belgidan oshmasin", "Kamida bitta lokatsiyani tanlang", "Lokatsiyani tanlang", "Lokatsiya noto'g'ri", "Mas'ul bu lokatsiyada ishlamaydi" |
| `forbidden` | 403 | "Bu amal uchun ruxsatingiz yo'q" (ruxsatsiz lokatsiya bilan buyurtma so'rovi) |
| `owner_only` | 403 | "Bu bo'lim faqat kompaniya egasi uchun" (cheklovni xodim belgilamoqchi) |
| `not_found` | 404 | "Lokatsiya topilmadi", "Xodim topilmadi", "Kompaniya topilmadi", "Buyurtma topilmadi", "Xarid topilmadi" |
| `name_taken` | 409 | "Bu nomli lokatsiya allaqachon bor" |
| `last_location` | 409 | "Kompaniyaning yagona lokatsiyasi o'chirilmaydi" |
| `location_in_use` | 409 | "Bu lokatsiyada N ta buyurtma bor", "Bu lokatsiyada N ta xarid bor" |
| `cannot_change_owner` | 409 | "Kompaniya egasini o'zgartirib yoki o'chirib bo'lmaydi" |
