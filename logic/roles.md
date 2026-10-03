# Rollar: owner va user

Bu hujjat rollarni belgilaydi: qanday rollar bor, rol qayerdan keladi, kim nima qila oladi va bu qanday tekshiriladi. Userlar, multi-user va xodimlarni boshqarish: [user.md](user.md).

> Holat: amalga oshirilgan (2026-10-03). Qoida o'zgarsa, avval shu hujjat, keyin kod o'zgartiriladi. Dizayn, bosqichlar va amalga oshirishdagi qarorlar: `docs/superpowers/specs/2026-10-03-employees-roles-sidebar-design.md`.

## 1. Rollar

| Rol | Interfeysda | Kim | Bir kompaniyada nechta |
|---|---|---|---|
| `owner` | Egasi | kompaniya egasi, uni platforma admini qo'yadi | aynan bitta |
| `user` | Xodim | owner user app ichidan qo'shgan xodim | cheklanmagan |

Boshqa rol yo'q. Eski `manager` va `staff` rollari olib tashlangan.

Platforma admini (`admins` jadvali, admin panel) bu rollardan tashqarida: u kompaniya a'zosi emas va user app'ga admin sifatida kirmaydi.

## 2. Asosiy qoidalar

1. **Rol tanlanmaydi, qo'shilgan joyiga qarab belgilanadi.** Admin paneldan qo'yilgan user `owner` bo'ladi. User app ichidan qo'shilgan user `user` bo'ladi.
2. **Har kompaniyada aynan bitta owner.** Buni baza kafolatlaydi: bir `company_id` ga bitta `owner` (unique indeks).
3. **Owner'ga tizim ichidan tegib bo'lmaydi.** User app'dan owner'ni (o'zini ham) o'chirib, ismini yoki rolini o'zgartirib bo'lmaydi. Buni faqat platforma admini qiladi.
4. **Rol kompaniyaga bog'liq.** Bir user bir kompaniyada owner, boshqasida user bo'lishi mumkin.
5. **Rol har so'rovda bazadan o'qiladi.** O'zgarish darhol kuchga kiradi.

## 3. Rol qayerdan keladi

| Amal | Kim bajaradi | Kim qaysi rolni oladi |
|---|---|---|
| Company yaratish | platforma admini | kiritilgan raqam → `owner` |
| Egasini almashtirish | platforma admini | kiritilgan raqam → `owner`, oldingi owner → `user` |
| Xodim qo'shish | kompaniya owner'i | kiritilgan raqam → `user` |

Rol faqat egasini almashtirish orqali o'zgaradi:

| O'tish | Mumkinmi | Qanday |
|---|---|---|
| `user` → `owner` | ha | admin shu raqamni owner qiladi |
| `owner` → `user` | ha | admin boshqa raqamni owner qilganda |
| `user` → o'chirilgan | ha | owner xodimni o'chiradi |
| `owner` → o'chirilgan | yo'q | avval egasi almashtiriladi, keyin yangi owner uni xodim sifatida o'chiradi |

## 4. Ruxsatlar

| Amal | owner | user |
|---|---|---|
| Tizimga kirish (SMS yoki Mini App) | ✓ | ✓ |
| Bosh sahifa | ✓ | ✓ |
| Kompaniyani almashtirish (boshqa kompaniyasi bo'lsa) | ✓ | ✓ |
| Xodimlar ro'yxatini ko'rish | ✓ | ✗ |
| Xodim qo'shish | ✓ | ✗ |
| Xodim (`user`) ismini tahrirlash | ✓ | ✗ |
| Xodim (`user`) ni o'chirish | ✓ | ✗ |
| Owner'ni o'zgartirish yoki o'chirish | ✗ | ✗ |
| Kompaniya nomi, obuna, bloklash | ✗ | ✗ |

Oxirgi ikki qator faqat platforma adminiga tegishli (admin panel).

Ruxsat har doim **tanlangan kompaniyadagi rol** bo'yicha beriladi. Olma Savdo'da owner bo'lgan user Nok Market'da `user` bo'lsa, Nok Market'ning xodimlarini ko'rmaydi.

## 5. Egasini almashtirish (admin panel)

Admin kompaniya sahifasida **Egasini almashtirish** ni bosadi va telefon bilan ismni kiritadi (`PUT /admin/companies/{id}/owner {phone, full_name}`). Hammasi bitta transaction ichida bajariladi.

| Kiritilgan raqam | Natija |
|---|---|
| tizimda yo'q | user yaratiladi va owner bo'ladi; oldingi owner → `user` |
| boshqa kompaniyada bor | o'sha user shu kompaniyada owner bo'ladi (multi-user); oldingi owner → `user` |
| shu kompaniyada `user` | owner'ga ko'tariladi, ismi kiritilgan ismga almashadi; oldingi owner → `user` |
| hozirgi owner'ning o'zi | rol o'zgarmaydi, faqat ismi yangilanadi |

- Oldingi owner kompaniyada xodim bo'lib qoladi, ismi saqlanadi. Kerak bo'lmasa, yangi owner uni Xodimlar'dan o'chiradi.
- Oldingi owner'ning ochiq sessiyasi uzilmaydi, lekin keyingi so'rovdan boshlab u `user` huquqlari bilan ishlaydi: "Xodimlar" bo'limi yo'qoladi.
- Ikki admin bir kompaniyaning egasini bir vaqtda almashtirsa, amallar navbat bilan bajariladi va oxirgisi qoladi. Ikki owner paydo bo'lmaydi.

## 6. Rol qanday tekshiriladi

- Rol `user_companies.role` da saqlanadi: `owner` yoki `user`.
- Access token'da `company_id` va `role` bor, lekin ruxsat berishda token'dagi rolga ishonilmaydi. Har so'rovda a'zolik va rol bazadan o'qiladi (obuna tekshiruvi bilan bitta so'rovda).
- Tekshiruv tartibi: token (401) → a'zolik (401) → obuna (402) → rol (403 `owner_only`). Batafsil: [user.md](user.md), 7-bo'lim.
- Kompaniya ID so'rovdan emas, token'dan olinadi. Shuning uchun owner boshqa kompaniyaga ta'sir qila olmaydi.

## 7. Interfeys

- Sidebar'dagi **Xodimlar** bo'limi faqat owner'ga ko'rinadi.
- `user` `/employees` manzilini qo'lda ochsa, bosh sahifaga qaytariladi. API baribir 403 qaytaradi.
- Xodimlar ro'yxatida owner birinchi turadi va "Egasi" belgisi bilan ko'rinadi (o'z qatorida "Siz"). Tahrirlash va o'chirish tugmalari faqat xodimlarda bor.
- Sessiyasi ochiq owner almashtirilsa, uning keyingi owner amali 403 `owner_only` oladi. User app shunda `/app/me` ni qayta so'raydi: "Xodimlar" bo'limi yo'qoladi va u bosh sahifaga qaytariladi.
- Admin panelda kompaniya a'zolari "Egasi" yoki "Xodim" roli bilan ko'rinadi.

## 8. Eski ma'lumotdan o'tish (migratsiya 00004)

Bu qoidalar kiritilganda mavjud a'zolar shunday aylantiriladi:

- har kompaniyada eng birinchi qo'shilgan owner (kompaniya yaratilganda qo'yilgan) owner bo'lib qoladi;
- qolgan hamma a'zo (`manager`, `staff` va keyin qo'shilgan owner'lar) `user` bo'ladi;
- har a'zolikning ismi userning o'sha paytdagi ismidan olinadi.

## 9. Yangi bo'lim qo'shilganda

- 4-bo'limdagi jadvalga qator qo'shiladi: bo'limni kim ko'radi, kim o'zgartiradi.
- Faqat owner'ga tegishli bo'lsa: sidebar'da `ownerOnly` belgisi va API'da owner tekshiruvi (403 `owner_only`).
- Yangi rol kerak bo'lsa, avval shu hujjat o'zgartiriladi, keyin kod.
