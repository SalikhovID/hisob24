# Lokatsiyalar: filiallar, joriy lokatsiya, xodim cheklovi

Bu hujjat lokatsiyalar qoidalarini belgilaydi: lokatsiya nima, kim qo'shadi, a'zo qaysi lokatsiyada ishlaydi, xodim qanday cheklanadi va bu vazifalarga qanday ta'sir qiladi. Vazifalar: [tasks.md](tasks.md). Rollar: [roles.md](roles.md). Userlar va xodimlar: [user.md](user.md).

> Holat: kelishilgan (2026-10-07), amalga oshirilmoqda. Qoida o'zgarsa, avval shu hujjat, keyin kod o'zgartiriladi. Dizayn, bosqichlar va amalga oshirishdagi qarorlar: `docs/superpowers/specs/2026-10-07-locations-design.md`.

## 1. Tushunchalar

| Tushuncha | Ma'nosi | Bazada |
|---|---|---|
| **Lokatsiya** | Kompaniyaning filiali: nomi bor. Vazifa aynan bitta lokatsiyada turadi. | `locations` |
| **Tayyor lokatsiya** | Har kompaniya boshlaydigan "Asosiy" lokatsiya. | migratsiya 00010 (mavjud kompaniyalar), `company.Create` (yangisi) |
| **Joriy lokatsiya** | A'zo hozir ishlayotgan lokatsiya: vazifalar ro'yxati, kanban va yangi vazifa shuniki. Brauzerda eslanadi, serverga har vazifa so'rovida `location_id` bilan aytiladi. | brauzer (`location:<kompaniya>:<telefon>`) |
| **Cheklov** | Xodim ishlay oladigan lokatsiyalar to'plami. Standart: hammasi. | `user_companies.all_locations`, `member_locations` |
| **Ruxsatli lokatsiyalar** | A'zoning jonli (o'chirilmagan) lokatsiyalari: egasi va cheklanmagan xodimda kompaniyaning hammasi, cheklanganda belgilanganlari. | har so'rovda `GetCompanyAccess`; `/app/me` da `locations` |

Lokatsiya faqat vazifalarga tegadi. Mijozlar, xodimlar, rollar, sozlamalar (mijoz va vazifa turlari, maydonlar, dropdownlar, bosqichlar) kompaniya bo'yicha umumiy.

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

- Har kompaniya **"Asosiy"** lokatsiya bilan boshlaydi: mavjud kompaniyalarga migratsiya 00010 yozadi (ularning hamma vazifalari unga tushadi), yangisiga kompaniya yaratilganda.
- Admin kompaniya sahifasida **Lokatsiyalar** bo'limida qo'shadi (`POST /admin/companies/{id}/locations {name}`), nomini o'zgartiradi (`PATCH …/{locationId} {name}`) va o'chiradi (`DELETE …/{locationId}`). Nom 1–60 belgi, chetidagi bo'shliqlar olib tashlanadi, kompaniyada takrorlanmaydi (katta-kichik harf farqsiz): 409 `name_taken`.
- Ro'yxat ID tartibida (qo'shilish tartibi), har lokatsiyada faol vazifalar soni.
- **O'chirish** yashirish (`deleted_at`), bazadan o'chmaydi; nomi bo'shaydi. O'chirilmaydi: kompaniyaning yagona lokatsiyasi (409 `last_location`), faol vazifasi bor lokatsiya (409 `location_in_use`; o'chirilgan vazifalar sanalmaydi). Shu tartibda tekshiriladi. Xodim cheklovlari to'sqinlik qilmaydi (5-bo'lim).
- Egasi user app'dan lokatsiya qo'sha olmaydi.

## 4. Joriy lokatsiya va tanlovchi

- A'zoning ruxsatli lokatsiyalari `/app/me` javobida (`locations`, ID tartibida; kompaniya tanlanmagan bo'lsa bo'sh).
- Joriy lokatsiya brauzerda eslanadi (kompaniya va user bo'yicha). Eslangani ruxsatli bo'lmasa (o'chirilgan, cheklov bilan yopilgan) ruxsatli birinchisi. Ruxsatli lokatsiya bo'lmasa joriy lokatsiya yo'q.
- **Tanlovchi** topbar'da (har sahifada), faqat ruxsatli lokatsiya 2+ bo'lsa. 1 ta bo'lsa (kompaniyada 1 ta yoki xodim 1 tasi bilan cheklangan) hech narsa ko'rinmaydi. Almashtirish bir zumda: token o'zgarmaydi; vazifalar ro'yxati 1-sahifadan, tur / bosqich / qidiruv / mas'ul filtrlari qoladi.
- Server joriy lokatsiyani so'rovning `location_id` idan oladi va a'zoning ruxsatli to'plamida tekshiradi; token'da lokatsiya yo'q.

## 5. Xodim cheklovi

- Xodim qo'shilganda hamma lokatsiyada (`all_locations = true`). Keyin qo'shilgan lokatsiya ham unga o'zi ochiladi.
- Egasi **Xodimlar** da xodimning lokatsiyalarini belgilaydi (`PUT /app/employees/{phone}/locations {location_ids}`): `null` hammasi; ro'yxat kamida bitta (bo'sh 400 "Kamida bitta lokatsiyani tanlang"), har biri kompaniyaning jonli lokatsiyasi (aks holda 404 "Lokatsiya topilmadi"), takror bir marta. Egasiga 409 `cannot_change_owner`, a'zo bo'lmagan raqam 404 "Xodim topilmadi". Keyingi so'rovdanoq kuchga kiradi.
- Cheklangan xodimga keyin qo'shilgan lokatsiya ochilmaydi: egasi qo'shadi.
- Cheklanayotgan xodim boshqa lokatsiyalarda vazifalarga mas'ul bo'lsa, **vazifalar unda qoladi** (u ko'rmaydi); dialog "Boshqa lokatsiyalarda N ta vazifaga mas'ul" deb ogohlantiradi. "Mas'ul" filtrida u ko'rinaveradi.
- Lokatsiya o'chirilsa cheklovlarga tegilmaydi: ruxsatli to'plam jonli lokatsiyalardan hisoblanadi. Cheklangan xodimning hamma lokatsiyasi o'chirilgan bo'lsa u **lokatsiyasiz**: vazifalarni ko'rmaydi va qo'sha olmaydi, "Vazifalar" sahifasi "Sizga lokatsiya biriktirilmagan" deydi; Xodimlar ro'yxatida "—"; egasi yangisini beradi. Cheklov hech qachon o'z-o'zidan kengaymaydi.
- Egasi almashtirilganda yangi egasining cheklovi olib tashlanadi (egasi hammasida); eski egasi xodim sifatida hammasida qoladi. Xodim o'chirilsa cheklovi a'zolik bilan ketadi; qayta qo'shilsa hammasida.
- Xodimlar ro'yxatida "Lokatsiyalar" ustuni (kompaniyada 2+ lokatsiya bo'lsa): "Barchasi", nomlar yoki "—". Dialog faqat egasiga va faqat xodim qatorlarida: "Barcha lokatsiyalar" belgisi yoki lokatsiyalar ro'yxati.

## 6. Vazifalar va lokatsiya

- **Qo'shish.** Vazifa joriy lokatsiyaga tushadi (`POST /app/tasks` da `location_id`); formada lokatsiya maydoni yo'q. Keyin o'zgarmaydi (mijoz va tur kabi). `location_id` berilmasa 400 "Lokatsiyani tanlang"; a'zoga ruxsatsiz (begona, o'chirilgan, cheklov bilan yopilgan) bo'lsa 403 `forbidden`.
- **Mas'ul** vazifa lokatsiyasida ishlaydigan a'zo bo'lishi shart (egasi va cheklanmagan xodim har lokatsiyada): aks holda 400 "Mas'ul bu lokatsiyada ishlamaydi". Forma faqat shularni taklif qiladi (`GET /app/members` har a'zoning lokatsiyalarini aytadi). Tahrirda hozirgi mas'ul u yerda ishlamasa "Ism (bu lokatsiyada ishlamaydi)" varianti bilan tanlangan turadi; o'zgartirilmasa qoladi, boshqasi tanlansa yangi mas'ul shu lokatsiyada bo'lishi shart.
- **Ro'yxat va kanban** joriy lokatsiya vazifalarini ko'rsatadi (`GET /app/tasks?location_id=`). Boshqa lokatsiyaning vazifalari ko'rinmaydi. `location_id` ruxsatsiz bo'lsa 403 `forbidden`: client `/app/me` ni qayta so'raydi, tanlovchi ruxsatli birinchisiga tushadi. Son bo'lmasa 400 "Lokatsiya noto'g'ri".
- **`location_id` berilmasa** ruxsatli hamma lokatsiya vazifalari: mijoz sahifasidagi "Vazifalar" bo'limi (2+ lokatsiyada har vazifada "Lokatsiya" belgisi) va cheklash dialogidagi sanoq shundan foydalanadi.
- **Vazifa sahifasi** ruxsatli har lokatsiyadagi vazifani ochadi (havola orqali ham), joriy lokatsiyani o'zgartirmaydi; 2+ ruxsatli lokatsiyada "Lokatsiya" fakti. Tahrirlash, ko'chirish, o'chirish, tarix ham shunday.
- Ruxsatsiz lokatsiyadagi vazifa ID bo'yicha 404 "Vazifa topilmadi" (begona kompaniyaniki kabi).
- Lokatsiyasiz a'zo (5-bo'lim): ro'yxat bo'sh, har vazifa 404, qo'shish 400.
- Lokatsiya tarixga yozilmaydi: o'zgarmaydi.

## 7. Chekka holatlar

| Holat | Natija |
|---|---|
| Kompaniyada 1 ta lokatsiya | tanlovchi yo'q; hamma narsa avvalgidek, vazifalar "Asosiy"da |
| Xodim 3 tadan 1 tasi bilan cheklangan | tanlovchi yo'q, faqat o'sha lokatsiya vazifalari |
| Eslangan joriy lokatsiya o'chirildi yoki yopildi | keyingi so'rov 403 `forbidden` → `/app/me` qayta → ruxsatli birinchisi |
| Admin xodimning yagona ruxsatli lokatsiyasini o'chirdi | o'chadi; xodim lokatsiyasiz, egasi tuzatadi (5-bo'lim) |
| Cheklanayotgan xodim boshqa lokatsiyada mas'ul | vazifa unda qoladi, dialog ogohlantiradi |
| Cheklangan xodim boshqa lokatsiya vazifasiga mas'ul qilinmoqchi | 400 "Mas'ul bu lokatsiyada ishlamaydi"; formada u taklif qilinmaydi |
| Havola orqali boshqa (ruxsatli) lokatsiya vazifasi ochildi | ochiladi, "Lokatsiya" fakti bilan; tanlovchi o'zgarmaydi |
| Havola orqali ruxsatsiz lokatsiya vazifasi ochildi | 404 "Vazifa topilmadi" |
| Egasi almashtirildi | yangi egasi hammasida (cheklovi o'chadi), eski egasi xodim sifatida hammasida |
| Yagona lokatsiya o'chirilmoqchi | 409 `last_location` |
| Faol vazifasi bor lokatsiya o'chirilmoqchi | 409 `location_in_use` "Bu lokatsiyada N ta vazifa bor" |
| O'chirilgan lokatsiya nomi qayta ishlatilmoqchi | mumkin |
| Begona kompaniyaning lokatsiyasi | ro'yxat va qo'shishda 403 `forbidden`; cheklovda 404 "Lokatsiya topilmadi" |

## 8. Xato kodlari

| Kod | Status | Xabar |
|---|---|---|
| `validation_error` | 400 | "Nomni kiriting", "Nom 60 belgidan oshmasin", "Kamida bitta lokatsiyani tanlang", "Lokatsiyani tanlang", "Lokatsiya noto'g'ri", "Mas'ul bu lokatsiyada ishlamaydi" |
| `forbidden` | 403 | "Bu amal uchun ruxsatingiz yo'q" (ruxsatsiz lokatsiya bilan vazifa so'rovi) |
| `owner_only` | 403 | "Bu bo'lim faqat kompaniya egasi uchun" (cheklovni xodim belgilamoqchi) |
| `not_found` | 404 | "Lokatsiya topilmadi", "Xodim topilmadi", "Kompaniya topilmadi", "Vazifa topilmadi" |
| `name_taken` | 409 | "Bu nomli lokatsiya allaqachon bor" |
| `last_location` | 409 | "Kompaniyaning yagona lokatsiyasi o'chirilmaydi" |
| `location_in_use` | 409 | "Bu lokatsiyada N ta vazifa bor" |
| `cannot_change_owner` | 409 | "Kompaniya egasini o'zgartirib yoki o'chirib bo'lmaydi" |
