# User Mini App (@hisob24bot) — dizayn

Sana: 2026-10-03. Holat: foydalanuvchi tasdiqlagan, amalga oshirilgan (reja: `docs/superpowers/plans/2026-10-03-user-mini-app.md`).

## Maqsad

Foydalanuvchining so'zlari (2026-10-03): "mini app mana bunday ishlashi kerak, uni ochganda agar u userni tizimga ruxsati bo'lsa hech qanday loginlarsiz ishlatib ketishi kerak, agar ruxsati bo'lmasa ogohlantiruvchi yozuvni o'zi turishi kerak. agar hali phone number jonatmagan bo'lsa unda shu haqida bildirishimiz kerak … (barcha kelajakdagi qo'shimchalar telegram mini app UIga ham mos bo'lishi kerak)".

Bu spec'dan tashqari yangi funksiya: spec bo'yicha user app'ga faqat SMS bilan kiriladi, user bot esa faqat raqamni ulaydi. Foydalanuvchi uni alohida so'radi va dizaynni tasdiqladi.

## Tanlangan yondashuv: bitta app, ikki xil auth

`app.hisob24.uz` (`apps/web`) ikkala muhitda ishlaydi:
- **brauzerda** hozirgidek SMS kod bilan;
- **Telegram ichida** (`initData` bor) avtomatik.

Sahifalar umumiy, shuning uchun har bir kelajakdagi funksiya ikkala muhitda o'zi ishlaydi. Telegram'ga xos qism kichik qatlam: mavzu ranglari, logout'ni yashirish. Admin panel ham aynan shunday qurilgan (brauzerda OTP, Mini App'da `initData`).

Rad etilgan variantlar:
- Shu app'ni alohida subdomain'da ochish: foyda yo'q, lekin cookie, nginx va CSRF origin'lari ikki barobar ko'payadi.
- Alohida Mini App ilovasi: har bir funksiyani ikki marta yozish kerak bo'ladi.

## Mini App ochilganda

1. `/login` sahifasi `window.Telegram.WebApp.initData` ni kutadi (admin'dagidek 1 soniyagacha). Topilsa, "Telegram orqali kirilmoqda…" ko'rsatib, `POST /app/auth/telegram {initData}` yuboradi.
2. Natijalar:
   - **200**: access token xotiraga yoziladi. Keyin cookie saqlanganini tekshiradi (pastga qarang) va `company_id` bo'lsa `/`, `null` bo'lsa `/select-company` ga o'tadi. Muddati o'tgan yoki bloklangan company'lar uchun hozirgi oqim (`/expired`, "Faol kompaniya yo'q") ishlaydi.
   - **403 `no_access`** (raqam botga yuborilgan, lekin `users` da yo'q): "Hisob24'ga kirish huquqingiz yo'q" sarlavhasi, API matni (raqam bilan) va "Yopish" tugmasi (`WebApp.close()`).
   - **403 `phone_not_shared`** (bu Telegram akkaunt botga raqam yubormagan): "Telefon raqamingiz ulanmagan" va **"Raqamni yuborish"** tugmasi.
     - Tugma `WebApp.requestContact()` ni chaqiradi. Telegram kontaktni botga xabar sifatida yuboradi va user bot uni `telegram_contacts` ga saqlaydi.
     - Ulashilgach Mini App `/app/auth/telegram` ni qayta chaqiradi: 1, 2 va 3 soniyadan keyin.
     - Raqam baribir yetib kelmasa: "Raqam hali yetib kelmadi" va "Qayta urinish" tugmasi.
     - Foydalanuvchi rad etsa yoki Telegram `requestContact` ni qo'llamasa: "Botga /start yozib, raqamingizni yuboring" ko'rsatmasi.
   - **401 `invalid_init_data`** yoki tarmoq xatosi: SMS formasi ochiladi, tepasida xabar turadi (admin'dagidek).
3. Cookie tekshiruvi: login'dan keyin `POST /app/auth/refresh` chaqiriladi.
   - Muvaffaqiyatli bo'lsa, sessiya saqlangan.
   - 401 bo'lsa, "Kirib bo'lmadi" xabari va "Yopish" ko'rsatiladi. Busiz `proxy.ts` sahifani `/login` ga qaytarardi va oqim siklga tushardi (admin'dagi `no_cookie` holati).
4. Brauzerda (`initData` yo'q) hozirgi SMS login o'zgarmaydi.

"Ruxsat bor" degani: Telegram ID → `telegram_contacts.chat_id` → telefon → shu telefon `users` jadvalida bor (admin uni biror company'ga qo'shgan).

## Backend

- **`POST /app/auth/telegram {initData}`** (`auth.UserAuth.LoginWithTelegram`, bitta transaction):
  1. `ValidateInitData(initData, USER_BOT_TOKEN, 24h, now)`. Xato bo'lsa → 401 `invalid_init_data` "Telegram ma'lumoti yaroqsiz. Mini App'ni qaytadan oching".
  2. `telegram_contacts` da `chat_id = user.id` bo'yicha qidiriladi. Yo'q bo'lsa → 403 `phone_not_shared` "Telefon raqamingiz botga ulanmagan".
  3. Telefon `users` da yo'q bo'lsa → 403 `no_access` "Hisob24'ga kirish huquqingiz yo'q. Raqamingiz: +998 90 123 45 67. Kompaniyangiz administratoriga murojaat qiling."
  4. Aks holda SMS verify'dagi kabi token beriladi: access JWT (`aud=app`) va refresh token. Faqat bitta company bo'lsa, u avtomatik tanlanadi.

  `USER_BOT_TOKEN` bo'sh bo'lsa, endpoint 401 `invalid_init_data` qaytaradi.
- **Telegram Web uchun cookie.** Telegram Web Mini App'ni iframe'da ochadi va u yerda `SameSite=Lax` cookie saqlanmaydi.
  - Migratsiya 00003: `refresh_tokens.source TEXT NOT NULL DEFAULT 'sms' CHECK (source IN ('sms','telegram'))`.
  - Telegram login'dan chiqqan refresh token `telegram` deb belgilanadi. Refresh va switch-company yangi token'ga manbani ko'chiradi.
  - Cookie manbaga qarab qo'yiladi:
    - `telegram` va `COOKIE_SECURE=true` → `SameSite=None; Secure; Partitioned`;
    - qolgan hollarda hozirgidek `Lax`.
  - Har safar cookie'ning bir varianti qo'yiladi va ikkinchisi o'chiriladi (`Max-Age=0`), shunda ikkala variant bir vaqtda turib qolmaydi. Logout ikkalasini ham o'chiradi.
  - `SameSite=None` CSRF xavfini oshiradi, uni mavjud `CrossOriginGuard` (`Sec-Fetch-Site`/`Origin`) yopadi.
- **Yangi env `WEB_APP_URL`** (masalan `https://app.hisob24.uz`), ixtiyoriy:
  - user bot ishga tushganda default menu tugmasi web_app "Hisob24" → `WEB_APP_URL` (`setChatMenuButton`). http bo'lsa yoki bo'sh bo'lsa, ogohlantirish yoziladi va tugma qo'yilmaydi;
  - `CrossOriginGuard` uchun ishonchli origin. Bu `Sec-Fetch-Site` siz eski brauzerlar cheklovini ham yopadi.
- `openapi.yaml` ga endpoint, xato kodlari va `WEB_APP_URL` ta'siri qo'shiladi. Router/openapi contract testi buni majburlaydi.
- Spec'dagi user bot matnlari o'zgarmaydi.

## Frontend (`apps/web`)

- **Telegram skripti:** layout'da `telegram-web-app.js` (`beforeInteractive`), admin'dagidek.
- **`lib/telegram.ts`:** `waitForWebApp()`, `useMiniApp()` va Telegram turlari admin'dan nusxa qilinadi. Umumiy paketga chiqarish keyinroq, kerak bo'lsa.
- **`TelegramSync`:**
  - `html[data-telegram]`;
  - `themeParams` → `--tg-theme-*` CSS o'zgaruvchilari, shadcn tokenlariga ulanadi;
  - `colorScheme` → mavzu;
  - `ready()` va `expand()`.
- **LoginScreen holatlari:** `form` (SMS) | `checking` | `phone_not_shared` | `no_access` | `no_cookie`.
- **Mini App ichida yashiriladi:** "Chiqish" (dashboard, `/select-company`, `/expired`) va mavzu tugmasi. Mini App'ni yopish chiqish hisoblanadi, qayta ochilsa avtomatik kiradi.

## Bot sozlamasi (deploy paytida)

- Default menu tugmasi API orqali "Hisob24" → `WEB_APP_URL` bo'ladi. BotFather'da qo'lda qo'yilgan "Admin" tugmasi shunda almashadi.
- Foydalanuvchining chat'idagi eski "Hisob24 → tg.hisob24.uz" chat bo'yicha tugmasi `type: default` ga qaytariladi (bir martalik amal).
- Eski tizimning boshqa userlarida eski tugma qolishi mumkin: eski baza o'chgan, ularni topib bo'lmaydi. U `tg.hisob24.uz` → `app.hisob24.uz` yo'naltirishi orqali xuddi shu Mini App'ni ochadi.

## Testlar (TDD)

- **Go:**
  - `LoginWithTelegram`: user bot tokeni bilan imzolangan `initData`; kontakt yo'q; raqam `users` da yo'q; bitta va bir nechta company; token'ning `source` i.
  - Refresh va switch `source` ni saqlashi.
  - Handler: status/kod/xabarlar va cookie atributlari (`telegram` → `None`+`Partitioned`, ikkinchi variant o'chiriladi).
  - Config: `WEB_APP_URL`.
  - User bot: menu tugmasi setup (fake client).
  - Contract testi: openapi = router.
- **Vitest:** LoginScreen'ning har bir holati; `requestContact` muvaffaqiyatli, rad etilgan va qo'llanmaydigan hollar; qayta urinishlar (fake timers); `TelegramSync`; Mini App'da logout yashirinishi.
- **Playwright** (375px va desktop, soxta Telegram skripti va MSW bilan): avto-kirish; ruxsat yo'q; raqam yuborilmagan → "Raqamni yuborish" → kirish.

## Chegara

- Telegram BackButton/MainButton, push-xabarlar va kontaktni Mini App'ning o'zidan saqlash qilinmaydi (kontaktni doim bot saqlaydi).
- Admin panel o'zgarmaydi.

## Amalga oshirishdagi aniqliklar

- **Cookie javobi:** https'da har bir sign-in, refresh va switch javobi avval boshqa variantni o'chiradi, keyin o'zinikini qo'yadi. Logout va tugagan sessiya ikkalasini o'chiradi. http'da (`start.sh`) doim bitta `Lax` cookie.
- **Bo'sh bot tokeni:** `ValidateInitData` bo'sh tokenni allaqachon rad etadi. Bot o'chiq bo'lsa ham `initData` ni soxtalashtirib bo'lmaydi; himoya testi va mutatsiya bilan tekshirildi.
- **E2E:** soxta `requestContact` mock'dagi `/__mock/contacts` (faqat testda) orqali kontaktni bog'laydi. Bu Telegram → bot → `telegram_contacts` yo'lining o'rnini bosadi.
