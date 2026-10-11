# Kirish kodi Telegram orqali — dizayn

Sana: 2026-10-11. Holat: foydalanuvchi plan rejimida tasdiqlagan. Branch: `dev` (test server shu branch'dan). Reja: `~/.claude/plans/endi-shunday-qilish-kerak-purring-cook.md` (sessiya fayli), bosqichlar pastda.

## Kontekst

Foydalanuvchining so'zi: "agar telegram bot user ulangan bo'lsa unda sms o'rniga telegram orqali jonatish kerak. User 1-marta botni bosdi, hali useri yo'q; keyin u user qo'shilsa, keyin shu telegramga kelaverishi kerak."

Hozir user app'ga brauzerdan kirish kodi faqat SMS bilan ketadi: `auth.UserAuth.SendCode` → `sms.Sender` (`SMS_DRIVER=log|eskiz`). User bot raqamni `telegram_contacts` ga `chat_id` bilan bog'laydi (`user.Contacts.Save`), lekin bu bog'lanish faqat Mini App'da kodsiz kirish uchun ishlatiladi (`LoginWithTelegram`, `docs/superpowers/specs/2026-10-03-user-mini-app-design.md`).

Spec (`docs/SPEC.md`, 5.5) kodni faqat SMS orqali ko'zda tutgan: bu hujjat tasdiqlangan chetlanish. Spec 5.6 dagi bot matnlari ham o'zgaradi (pastda).

Ikkinchi talab bazada allaqachon ta'minlangan: `telegram_contacts` da `users` ga FK ataylab yo'q, raqam user bo'lmasa ham saqlanadi. Shuning uchun chat qidiruvi kod yuborilayotgan paytda **telefon bo'yicha** qilinadi; user qachon qo'shilgani ahamiyatsiz. `/start` ning o'zi raqam bermaydi: kod Telegram'ga faqat kontakt yuborilgandan keyin ketadi.

## Qarorlar

| # | Savol | Qaror |
|---|---|---|
| 1 | Kanal tanlovi | `SendCode` a'zolikni tekshirgach raqamning Telegram chatini qidiradi. Topilsa va bot yoqilgan bo'lsa, kod Telegram'ga ketadi, SMS ketmaydi. Topilmasa yoki bot o'chiq bo'lsa (`USER_BOT_TOKEN` bo'sh), hozirgidek SMS |
| 2 | Telegram xatosi | Telegram yubora olmasa (bot bloklangan, chat yo'q, API xatosi): `slog.Warn` (kodsiz) va SMS'ga o'tiladi. SMS ham ketmasa, hozirgidek kod o'chiriladi va xato qaytadi, qayta so'rash bir daqiqa kutmaydi |
| 3 | A'zo bo'lmagan raqam | Hech qayerga ketmaydi (Telegram'ga ham), javob va cooldown bir xil: kim tizimda borligi bilinmaydi |
| 4 | Bir raqam, bir nechta chat | Eng oxirgi `updated_at` li chat g'olib (`ORDER BY updated_at DESC LIMIT 1`). Telegram'da bir raqam bir vaqtda bitta akkauntda bo'ladi, oxirgi ulagan hozirgi egasi. Migratsiya yo'q, `telegram_contacts_phone` indeksi yetadi |
| 5 | Kod, muddat, urinishlar | O'zgarmaydi: 6 xona, 2 daqiqa, 5 xato urinish, `sms_codes` jadvali, 60 soniya cooldown. Endpoint nomlari (`/app/auth/sms/*`), `CodeSent` javobi (`{"retry_after":60}`) va `packages/api-client` sxemasi o'zgarmaydi |
| 6 | Telegram xabari | HTML, nusxalanadigan kod (admin botdagidek): `Hisob24'ga kirish kodi: <code>123456</code>` + yangi qator `2 daqiqa amal qiladi. Uni hech kimga bermang.` |
| 7 | Qatlamlar | Matn va yuborish `userbot.Codes` da (bot paketida, adminbot kabi); qaror (kim qayerga) `auth.UserAuth.SendCode` da; `auth` kichik `TelegramCodes` interfeysini e'lon qiladi, bot o'chiq bo'lsa `nil` beriladi |
| 8 | Dev rejim | `SMS_DRIVER=log` da ulangan raqam kodi haqiqiy Telegram'ga ketadi va log'ga yozilmaydi; ulanmagan raqam hozirgidek log'ga |
| 9 | Bot matnlari | `✅ Akkauntingiz ulandi. Kirish kodlari endi shu yerga keladi.` va `Raqamingiz saqlandi. Hisob24'ga qo'shilganingizda kirish kodlari shu yerga keladi.` |
| 10 | Login matnlari (web) | Kanal ko'rsatilmaydi (foydalanuvchi qarori). 1-qadam: `Telefon raqamingizni kiriting, kod SMS yoki Telegram botga keladi`. 2-qadam: `Kod +998 90 123 45 67 raqamiga yuborildi. SMS yoki Telegram botni tekshiring` |
| 11 | Kechiktirilgan | Login sahifasida bot havolasi (`USER_BOT_USERNAME` yo'q), bloklangan botda kontaktni o'chirish, kanalni UI'da ko'rsatish, qo'shilganda bot orqali xabar berish: so'ralmagan, qilinmaydi |

### Rad etilgan variantlar

- **Javobda `channel: "sms" | "telegram"`** va UI'da "Kod Telegram botga yuborildi". UX yaxshiroq, lekin javob raqam botga ulanganini aytardi. Foydalanuvchi neytral matnni tanladi.
- **Bitta telefon = bitta chat** (unique index, yangi chat ulanganda eskisini o'chirish). Migratsiya va ma'lumot tozalash kerak bo'lardi; `ORDER BY updated_at DESC LIMIT 1` shu natijani so'rovning o'zida beradi.
- **Telegram xatosida xato qaytarish** (SMS'siz). Bot bloklangan user kira olmay qolardi.
- **Alohida "yetkazish" paketi** (`internal/logincode`): kontakt qidiruvi, a'zolik va kod bir joyda, `UserAuth` da turgani ma'qul; Telegram tomoni esa bot paketida.

## O'zgarishlar

| Fayl | O'zgarish |
|---|---|
| `backend/internal/db/queries/telegram_contacts.sql` | `GetTelegramContactChat :one`: raqamning oxirgi chati |
| `backend/internal/bot/userbot/codes.go` | `Codes`, `NewCodes(api)`, `SendLoginCode(ctx, chatID, code)`: HTML xabar |
| `backend/internal/bot/userbot/handler.go` | `linkedText`, `savedText` yangi matnlar |
| `backend/internal/auth/user_auth.go` | `TelegramCodes` interfeysi, `NewUserAuth(..., telegram)`, `SendCode` tarmoqlanishi |
| `backend/internal/app/handler_test.go` | `tgBox` fake va integration test |
| `backend/cmd/api/main.go` | user bot `UserAuth` dan oldin yaratiladi, `userbot.NewCodes(b)` uzatiladi, keyin ishga tushiriladi |
| `backend/openapi.yaml` | `sendLoginCode` tavsifi (sxema o'zgarmaydi), `make api-client` |
| `apps/web/components/login/login-screen.tsx` | ikki matn (10-qaror) |
| `apps/web/components/login/code-step.tsx` | izoh |
| `apps/web/e2e/login.spec.ts` | 2-qadam matni to'liq gap bilan |
| `logic/user.md`, `README.md`, `CLAUDE.md` | qoidalar, ishga tushirish, manbalar |

## Testlar

- `db`: oxirgi chat g'olib; yo'q raqamga `pgx.ErrNoRows`.
- `userbot`: `SendLoginCode` chat, `ParseModeHTML`, matn; yangi javob matnlari (unit va `flow_test`).
- `auth` (table-driven, fake SMS va fake Telegram): ulangan a'zo → Telegram'da kod, SMS yo'q, bazada HMAC; bot o'chiq → SMS; Telegram xatosi → SMS, kod qoladi; ulangan begona → ikkalasi bo'sh, kod saqlangan; ikki chat → oxirgisi; Telegram'dan kelgan kod bilan `Verify`.
- `app` (httptest + Postgres): ulangan raqamga `POST /app/auth/sms/send` 200 `{"retry_after":60}`, SMS bo'sh, Telegram'dagi kod bilan `verify` 200.
- `web`: `login-screen.test.tsx` matnlari; e2e `login.spec.ts`.

## Bosqichlar

1. Shu hujjat. 2. db so'rovi. 3. `userbot.Codes`. 4. `auth.SendCode`. 5. app integration. 6. bot matnlari. 7. web matnlari. 8. wiring, openapi, hujjatlar. 9. `make lint`, `make test`, `make e2e`, push `origin dev`, test serverga deploy va `@test_hisob24_bot` bilan tekshiruv.
