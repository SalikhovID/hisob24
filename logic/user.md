# User: kim, qanday qo'shiladi, qanday kiradi

Bu hujjat user bilan bog'liq qoidalarni belgilaydi: user nima, tizimga qanday tushadi, bir nechta kompaniyada qanday ishlaydi, ismi va kirish huquqi qanday boshqariladi. Rollar va ruxsatlar: [roles.md](roles.md). Lokatsiyalar va xodimning lokatsiya cheklovi: [locations.md](locations.md).

> Holat: amalga oshirilgan (2026-10-03). 2026-10-06 da kompaniya rollari bilan yangilangan qoidalar (kim xodim qo'shadi, ismini o'zgartiradi va o'chiradi; tekshiruv tartibidagi `company_required` va `forbidden`) amalga oshirilgan: `docs/superpowers/specs/2026-10-06-roles-bottom-nav-design.md`. Qoida o'zgarsa, avval shu hujjat, keyin kod o'zgartiriladi. Dizayn, bosqichlar va amalga oshirishdagi qarorlar: `docs/superpowers/specs/2026-10-03-employees-roles-sidebar-design.md`. A'zolikdagi menyu tartibi (1 va 6-bo'limlar; 2026-10-07) `docs/superpowers/specs/2026-10-07-inventory-design.md` bilan amalga oshirilmoqda.

## 1. Tushunchalar

| Tushuncha | Ma'nosi | Bazada |
|---|---|---|
| **User** | Bitta telefon raqami. Platformada bitta raqam = bitta user, nechta kompaniyada ishlashidan qat'i nazar. | `users.phone` (`998901234567` ko'rinishida) |
| **A'zolik** | Userning bitta kompaniyadagi o'rni: roli, kompaniya roli (bo'lsa), shu kompaniyadagi ismi, lokatsiya cheklovi ([locations.md](locations.md)) va menyu tartibi ([roles.md](roles.md), 8-bo'lim). | `user_companies` (`user_phone`, `company_id`, `role`, `role_id`, `full_name`, `all_locations`, `nav_order`), `member_locations` |
| **Egasi (owner)** | Kompaniyaning yagona egasi. Uni platforma admini qo'ygan. | `role = 'owner'` |
| **Xodim** | `user` rolidagi a'zo. Uni kompaniya egasi (yoki `employees.create` ruxsatli xodim) qo'shgan. Egasi unga kompaniya rolini biriktirishi mumkin ([roles.md](roles.md), 5-bo'lim); rolsiz xodim standart ruxsat bilan ishlaydi. | `role = 'user'`, `role_id` |
| **Multi-user** | Bir nechta kompaniyaga a'zo user. | bir nechta `user_companies` qatori |

Telefon har joyda bir xil normallashtiriladi (`user.NormalizePhone`): `+`, bo'shliq, `-` va qavslar olib tashlanadi, 9 xonali raqam oldiga `998` qo'shiladi.

User yozuvi (`users`) o'chirilmaydi. O'chadigan narsa faqat a'zolik.

## 2. User tizimga qanday tushadi

| # | Yo'l | Kim bajaradi | Qayerda | Natija |
|---|---|---|---|---|
| 1 | Company yaratish | platforma admini | admin panel → Kompaniyalar → Yangi | raqam shu kompaniyaning **owner**'i |
| 2 | Egasini almashtirish | platforma admini | admin panel → kompaniya sahifasi | raqam yangi **owner**, oldingisi `user` |
| 3 | Xodim qo'shish | kompaniya egasi yoki `employees.create` ruxsatli xodim | user app → Xodimlar | raqam shu kompaniyaning rolsiz **user**'i |

Boshqa yo'l yo'q: o'zi ro'yxatdan o'tish, taklif va rozilik oqimi yo'q.

Uchala yo'lda ham qoida bir xil:

- raqam tizimda yo'q bo'lsa, user yaratiladi;
- raqam tizimda bor bo'lsa, o'sha userga yangi a'zolik qo'shiladi (multi-user, 4-bo'lim);
- user va a'zolik bitta transaction ichida yoziladi, a'zoliksiz yangi user qolmaydi.

## 3. Xodim qo'shish (user app)

Egasi (yoki `employees.create` ruxsatli xodim, [roles.md](roles.md) 4-bo'lim) **Xodimlar → Xodim qo'shish** da telefon va ismni kiritadi (`POST /app/employees {phone, full_name}`).

Kompaniya so'rovdan emas, qo'shuvchining access token'idan olinadi. U faqat hozir tanlangan kompaniyasiga qo'sha oladi.

| Kiritilgan raqam | Natija |
|---|---|
| tizimda yo'q | yangi user, a'zolik `user`, ism kiritilgan ism |
| boshqa kompaniyada bor | o'sha user, yangi a'zolik `user`, ism kiritilgan ism (multi-user) |
| shu kompaniyada allaqachon bor (owner yoki user) | 409 `already_member`, hech narsa o'zgarmaydi |
| noto'g'ri raqam yoki bo'sh ism | 400 `validation_error` |

Tafsilotlar:

- Qo'shilgan har doim rolsiz `user` bo'ladi. User app'dan owner qo'shib bo'lmaydi. Kompaniya rolini keyin egasi **Xodimlar** da biriktiradi ([roles.md](roles.md), 5-bo'lim). Qo'shilgan xodim hamma lokatsiyada ishlaydi; egasi keyin **Xodimlar** da cheklashi mumkin ([locations.md](locations.md), 5-bo'lim).
- Javob raqam tizimda oldin bo'lgan-bo'lmaganiga bog'liq emas: ikkala holatda ham 201 va owner kiritgan ism qaytadi. Shuning uchun owner begona kompaniyadagi ismni ko'rmaydi va raqam Hisob24'da bor-yo'qligini bila olmaydi.
- Qo'shilgan odamga SMS yoki bot xabari yuborilmaydi, undan rozilik so'ralmaydi. Owner unga o'zi aytadi: `app.hisob24.uz` ga o'z raqami bilan kiradi (SMS kod) yoki botdagi Mini App'ni ochadi.
- Xodimlar soniga limit yo'q.

## 4. Multi-user

Bir user bir nechta kompaniyaga a'zo bo'lishi mumkin. Bu shunday yuzaga keladi:

- owner boshqa kompaniyada bor raqamni xodim qilib qo'shadi;
- admin mavjud raqamni yangi kompaniyaning owner'i qiladi (yaratishda yoki almashtirishda).

Rol va ism **har kompaniyada alohida**:

| Raqam | Kompaniya | Rol | Ism |
|---|---|---|---|
| 998901234567 | Olma Savdo | owner | Ali Valiyev |
| 998901234567 | Nok Market | user | Ali (hisobchi) |

Qanday ishlaydi:

- **Login.** Bitta kompaniyasi bor user to'g'ridan-to'g'ri o'sha kompaniyaga kiradi. Ikki va undan ko'p bo'lsa, `/select-company` sahifasida tanlaydi.
- **Sessiya.** Bitta sessiya bir vaqtda bitta kompaniyada ishlaydi (access token'da `company_id`). Almashtirish: profil menyusi → "Kompaniyani almashtirish" (`POST /app/auth/switch-company`).
- **Sessiya ochiq paytda qo'shilsa.** Yangi kompaniya keyingi `/app/me` javobida ro'yxatda paydo bo'ladi, qayta kirish shart emas. Hozir ishlayotgan kompaniyasi o'zgarmaydi.
- **Izolyatsiya.** Kompaniya faqat o'z a'zolarini va ularning o'zidagi ismini ko'radi. User qaysi boshqa kompaniyalarda ishlashi faqat uning o'ziga ko'rinadi.
- **Mustaqillik.** Bir kompaniyadan chiqarish, ismni o'zgartirish yoki obunaning tugashi boshqa kompaniyadagi a'zolikka ta'sir qilmaydi.

## 5. Ism

Ism a'zolikda saqlanadi (`user_companies.full_name`): har kompaniya o'z a'zosini o'zi nomlaydi.

| Kimning ismi | Kim o'zgartiradi | Qayerda |
|---|---|---|
| xodim (`user`) | shu kompaniya egasi yoki `employees.edit` ruxsatli xodim | user app → Xodimlar → tahrirlash (`PATCH /app/employees/{phone} {full_name}`) |
| owner | platforma admini | admin panel → Egasini almashtirish (o'sha raqam + yangi ism) |

- User app'dagi "Salom, …" va profil menyusi tanlangan kompaniyadagi ismni ko'rsatadi.
- `users.full_name` user birinchi marta qo'shilgandagi ismni saqlaydi va keyin o'zgarmaydi. U faqat kompaniya hali tanlanmagan holatda zaxira sifatida ishlatiladi.
- Telefon raqami tahrirlanmaydi: boshqa raqam boshqa user. Raqami o'zgargan xodim o'chiriladi va yangi raqam bilan qo'shiladi.

## 6. Xodimni o'chirish

Egasi (yoki `employees.delete` ruxsatli xodim) **Xodimlar** ro'yxatida `user` rolidagi xodimni o'chiradi (`DELETE /app/employees/{phone}`). O'chadigan narsa shu kompaniyadagi a'zolik.

| Nima | Holati |
|---|---|
| shu kompaniyadagi a'zolik | o'chadi |
| kompaniya roli biriktiruvi | a'zolik bilan ketadi; rolning o'zi qoladi |
| lokatsiya cheklovi | a'zolik bilan ketadi |
| menyu tartibi | a'zolik bilan ketadi; qayta qo'shilsa standart |
| `users` yozuvi | qoladi |
| boshqa kompaniyalardagi a'zoliklar | qoladi |
| botga ulangan raqam (`telegram_contacts`) | qoladi |

O'chirilgan xodim uchun oqibat:

| Holat | Nima bo'ladi |
|---|---|
| shu kompaniyada ochiq sessiyasi bor | keyingi so'rovdayoq kirish yopiladi, access token muddati kutilmaydi |
| boshqa kompaniyasi bor | `/select-company` ga tushadi va qolgan kompaniyalarida ishlayveradi |
| boshqa kompaniyasi yo'q | sessiya tugaydi, `/login` ga tushadi |
| qayta kirmoqchi bo'lsa (kompaniyasi yo'q) | SMS kod kelmaydi, Mini App "Hisob24'ga kirish huquqingiz yo'q" deydi |

Owner'ni (o'zini ham) o'chirib bo'lmaydi: 409 `cannot_change_owner`. Ruxsatli xodim o'zini o'chirsa, o'chadi va yuqoridagi oqibatlar unga ham tegishli.

O'chirilgan xodimni keyin qayta qo'shish mumkin. U kiritilgan ism bilan oddiy xodim bo'lib qaytadi: rolsiz, hamma lokatsiyada.

## 7. Kirish huquqi

Tizimga **kamida bitta kompaniyaga a'zo** user kira oladi.

| Joy | A'zoligi bor | A'zoligi yo'q |
|---|---|---|
| SMS kod so'rash | kod yuboriladi | javob bir xil (200), SMS ketmaydi |
| Kodni tasdiqlash | token beriladi | 401 `invalid_code` |
| Mini App | avtomatik kiradi | 403 `no_access` (raqami ko'rsatiladi) |
| User bot (raqam yuborilganda) | "✅ Akkauntingiz ulandi" | "Raqamingiz saqlandi" |
| Refresh | yangi token | sessiya tugaydi (401 `invalid_refresh_token`) |

Kompaniya ichidagi har bir so'rovda quyidagilar shu tartibda tekshiriladi, a'zolik va rol bazadan o'qiladi:

1. Access token yaroqlimi. Aks holda 401 `unauthorized`.
2. User token'dagi kompaniyaga hali ham a'zomi. Aks holda 401 `unauthorized`: client o'zi refresh qiladi va kompaniyasiz token oladi yoki sessiya tugaydi.
3. Kompaniya obunasi faolmi. Aks holda 402 `subscription_expired`.
4. Amal kompaniya ichida bo'lsa, token'da kompaniya tanlanganmi. Aks holda 403 `company_required`.
5. Amal ruxsat talab qilsa, userning shu kompaniyadagi amaldagi ruxsatlari (egasi: hammasi; xodim: roli bo'yicha yoki standart) uni qamrab oladimi. Aks holda 403 `forbidden`. Rollarni boshqarish va biriktirish faqat egasiniki: 403 `owner_only` ([roles.md](roles.md), 7-bo'lim).

Kompaniya hali tanlanmagan token (multi-user login'dan keyin) 2 va 3-qadamdan o'tadi, lekin kompaniya ichidagi amallarni bajara olmaydi (`company_required`; rollar API'da `owner_only`).

## 8. Chekka holatlar

| Holat | Natija |
|---|---|
| Owner o'z raqamini xodim qilib qo'shadi | 409 `already_member` |
| Owner mavjud xodimni yana qo'shadi | 409 `already_member`, ismi o'zgarmaydi |
| Ikki kompaniya bir raqamni bir vaqtda qo'shadi | ikkalasi ham muvaffaqiyatli: bitta user, ikki a'zolik |
| O'chirilgan xodim qayta qo'shiladi | yangi a'zolik, kiritilgan ism bilan |
| Xodim boshqa kompaniyada owner | bu kompaniyada baribir `user`, rollar aralashmaydi |
| Admin xodimning raqamini shu kompaniyaga owner qiladi | xodim owner'ga ko'tariladi, eski owner `user` bo'ladi |
| Kompaniyasi tanlanmagan token bilan Xodimlar API | 403 `company_required` |
| Xodim ruxsati yo'q amalni yuboradi (masalan, rolsiz xodim Xodimlar API'ni) | 403 `forbidden` ([roles.md](roles.md)) |
| Obunasi tugagan kompaniyada Xodimlar API | 402 `subscription_expired`; user app `/expired` sahifasiga o'tadi |
| Raqam botga ulangan, lekin hech qayerda a'zo emas | Mini App `no_access` deydi; biror kompaniyaga qo'shilgach avtomatik kiradi |

## 9. Xato kodlari

| Kod | Status | Xabar |
|---|---|---|
| `validation_error` | 400 | "Telefon raqami noto'g'ri" yoki "Ismni kiriting" |
| `company_required` | 403 | "Avval kompaniyani tanlang" |
| `forbidden` | 403 | "Bu amal uchun ruxsatingiz yo'q" |
| `owner_only` | 403 | "Bu bo'lim faqat kompaniya egasi uchun" |
| `not_found` | 404 | "Xodim topilmadi", "Rol topilmadi" |
| `already_member` | 409 | "Bu raqam kompaniyangizga allaqachon qo'shilgan" |
| `cannot_change_owner` | 409 | "Kompaniya egasini o'zgartirib yoki o'chirib bo'lmaydi" |
