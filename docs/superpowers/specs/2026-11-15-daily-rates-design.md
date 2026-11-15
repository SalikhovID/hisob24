# Avtomatik valyuta kurslari: har kuni 00:00 (UTC+5) da bankdan — dizayn

Sana: 2026-11-15. Holat: foydalanuvchi reja sifatida tasdiqlagan (savol-javob bilan), amalga oshirilmoqda (`dev` branch).

## Kontekst

Foydalanuvchining so'zlari:

- «har bir kompaniya uchun 00:00 (+5UTC) da banklardan valyuta kurslarini olib set qilib qo'yish kerak, default CBU bo'lsin, agar shu paytda valyuta olishda muammo bo'lsa default kechagini qo'yib ketishi kerak, namunani ../tw-dobroe dan ol»
- «yaxlitlash 100 lik bo'lsin default»
- «o'chirib qo'ysa default 00:00da kechagi malumotni qo'shib qo'yishi kerak»

Hozirgacha kursni faqat egasi (yoki `settings.edit`) **Sozlamalar → Valyuta kurslari** da qo'lda kiritardi (`POST /app/currency-rates`). Kiritilmagan kun eski kurs amalda qolardi. Namuna: `../tw-dobroe/backend/pkg/bankapi` (Markaziy bank va 6 bank: rasmiy JSON, valyutalarkursi.uz aggregatori, sahifa scrape'lari) va `internal/worker/currency_rate_worker.go` (har kuni `CURRENCY_RATE_CRON`, kompaniyaning `bank` ustuni, `money_rounding` bilan `RoundToStep`, bank xato bersa CBU). hisob24 da bu birinchi fon ishi.

`docs/SPEC.md` da yo'q ish, foydalanuvchi so'rovi bilan. Qoidalar: [`logic/currencies.md`](../../../logic/currencies.md), 4-bo'lim «Avtomatik kurs».

## Foydalanuvchi qarorlari (2026-11-15)

| # | Savol | Qaror |
|---|---|---|
| 1 | Manba (bank) va yaxlitlash qayerda tanlanadi | **Admin panelda**, kompaniya sahifasida |
| 2 | RUB ~146 so'm: 100 ga yaxlitlansa 100 yoki 200 bo'ladi | **RUB yaxlitlanmaydi**; qadam faqat USD va EUR ga |
| 3 | Tanlangan bank javob bermasa | **Avval Markaziy bank, keyin kechagi** (tw-dobroe kabi) |
| 4 | Avtomatik kursni o'chirish varianti | **Ha, «Qo'lda»** |
| 5 | «Qo'lda» kompaniyada 00:00 da | **Kechagi kurs nusxasi yoziladi** (foydalanuvchining keyingi xabari) |
| 6 | Yaxlitlash standarti | **100** (foydalanuvchining xabari) |

Reja bilan tasdiqlanganlar: vaqt `time.FixedZone(+05:00)` (Toshkentda yozgi vaqt yo'q), env yo'q; zanjir 3 marta, oralig'i 1 daqiqa, HTTP timeout 15 s; bir kunda bir marta (shu kun 00:00 dan keyin standart qator bo'lsa yozilmaydi, qo'lda kiritilgani ham); API ishga tushganda shu kunning qatori yo'q kompaniyalarga darhol yoziladi; hamma kompaniya (nofaol va muddati o'tganlari ham); bankdan olingan qatorga uchala kurs yoziladi (yoqilmagan valyutaniki ham, tw-dobroe kabi), bank bermagan valyuta kechagi qatordan; kun ichida qayta urinish yo'q; manba o'zgarsa keyingi 00:00 dan; qo'lda kiritilgan kurs va kechagi nusxa yaxlitlanmaydi.

## Baza: `00023_rate_sources.sql`

```sql
ALTER TABLE companies
  ADD COLUMN rate_source TEXT NOT NULL DEFAULT 'cbu'
    CHECK (rate_source IN ('manual','cbu','kapitalbank','ipakyuli','asaka','hamkor','uzum','ofb')),
  ADD COLUMN rate_rounding INT NOT NULL DEFAULT 100 CHECK (rate_rounding IN (1,10,100,1000));
ALTER TABLE currency_rates
  ALTER COLUMN set_by DROP NOT NULL,
  ADD COLUMN source TEXT CHECK (source IN ('cbu','kapitalbank','ipakyuli','asaka','hamkor','uzum','ofb','carried','failed')),
  ADD CONSTRAINT currency_rates_author CHECK ((set_by IS NULL) <> (source IS NULL));
```

- `currency_rates.source`: NULL — a'zo kiritgan (sozlamalardan yoki hujjatning o'z kursi); bank kodi — o'sha bankdan olingan (CBU zaxirasi ishlatilsa `cbu`); `carried` — «Qo'lda» manbada kechagi nusxa; `failed` — bank javob bermagani uchun kechagi nusxa.
- Mavjud kompaniyalar `cbu` va 100 oladi.
- Down: avtomatik qatorlarga kompaniya egasining raqami yoziladi (hujjat ularga havola qilgan bo'lishi mumkin, o'chirilmaydi), `set_by NOT NULL` qaytadi, ustunlar ketadi.

## Backend

### `internal/bankrate` (yangi; tw-dobroe `pkg/bankapi` dan)

- `Rates{USD, EUR, RUB float64}` (so'm, bank bermagani 0), `Sources` (`cbu`, `kapitalbank`, `ipakyuli`, `asaka`, `hamkor`, `uzum`, `ofb`).
- `Client` (`New()`): URL'lar maydonlarda (testda `httptest`), `http.Client` timeout 15 s, `Attempts` 3, `Pause` 1 daqiqa (testda in'ektsiya), User-Agent `Mozilla/5.0 (compatible; RateFetcher/1.0)`.
- `Fetch(ctx, source) (Rates, used string, err)`: tanlangan bank, keyin `cbu` (bir xil bo'lsa bir marta); zanjir `Attempts` marta, oralig'i `Pause`.
- Banklar tw-dobroe dagidek: CBU JSON (`Nominal` ga bo'linadi; USD, EUR, RUB shart); Kapitalbank, Asakabank, Hamkorbank — aggregator, keyin sahifa scrape; Ipak Yo'li — `__NUXT_DATA__`, keyin aggregator, keyin scrape; OFB — `currency-table` DOM, keyin aggregator, keyin scrape; Uzum — scrape. Bog'liqlik `golang.org/x/net/html`.
- Live test `//go:build integration` (`TestAllBanksLive`).

### `internal/currency`

- `roundRate(v, step)`: eng yaqin karrali (`math.Round(v/step)*step`), `step <= 1` o'zgarmaydi.
- `Daily(ctx, f Fetcher, at) Report`: hamma kompaniya (`ListRateSources`) → shu kunning (UTC+5) qatori yo'qlari (`HasStandardRateSince(dayStart)`) → kerakli banklar tranzaksiyadan tashqarida, har biri bir marta → har kompaniya o'z tranzaksiyasida: `LockCompanyCustomers` (qo'lda `SetRates` bilan navbat), qator yana tekshiriladi, bankdan olingan qator (`CreateAutoRate`: USD va EUR yaxlitlangan, RUB yo'q, bank bermagani kechagidan) yoki kechagi nusxa (`RateAt` + `ColumnOf`); kechagi yo'q bo'lsa hech narsa. Bitta kompaniya xatosi qolganlarini to'xtatmaydi (`slog.Warn`). `Report{Fetched, Carried, Failed, Skipped, Errors}`.
- `NextMidnight(now)`, `RunDaily(ctx, f)`: avval `Daily(now)`, keyin har 00:00 da; `ctx` bekor bo'lsa to'xtaydi (soat va taymer testda in'ektsiya).
- `SourceOf`, `SetSourceOf(companyID, source, rounding)`: 400 «Manba noto'g'ri», «Yaxlitlash noto'g'ri»; 404 «Kompaniya topilmadi».
- `History`: qatorda `Source`, sahifada `RateSource`, `RateRounding`.
- `cmd/api/main.go`: `go currencies.RunDaily(ctx, bankrate.New())`.

## API

- `PUT /admin/companies/{id}/rate-source {source, rounding}` → `{source, rounding}`. `CompanyDetail.rate_source`, `rate_rounding`.
- `Rates.source` (`cbu` … `ofb`, `carried`, `failed` yoki null), `RatesPage.rate_source`, `RatesPage.rate_rounding`.

## Admin panel

Kompaniya sahifasida «Valyutalar» dan keyin «Valyuta kurslari» bo'limi: «Ma'lumot» dagidek ramka (Manba, Yaxlitlash «100 so'mgacha · USD, EUR», Vaqt «Har kuni 00:00 (UTC+5)») va bitta amal — `RateSourceDialog` (ikkita `SelectField`; «Qo'lda» da yaxlitlash o'chiq). Nomlar: Markaziy bank, Kapitalbank, Ipak Yo'li banki, Asakabank, Hamkorbank, Uzum Bank, Orient Finans Bank, Qo'lda. Qadamlar: Yaxlitlanmaydi, 10 so'm, 100 so'm, 1 000 so'm.

## User app

**Valyuta kurslari** tarixida avtomatik qatorning ostida manba: bank nomi, «Kechagi kurs», «Bank javob bermadi · kechagi kurs». Foot manbaga qarab: bankda «Har kuni 00:00 da Markaziy bank kursi olinadi, USD va EUR 100 so'mgacha yaxlitlanadi», «Qo'lda» da «Har kuni 00:00 da kechagi kurs takrorlanadi».

## Bosqichlar

1. **Hujjatlar, baza va backend yadrosi:** logic va shu hujjat, 00023, so'rovlar, `bankrate`, `roundRate`, `Daily`, `NextMidnight`, `RunDaily`, `main.go`. Push gate: `make lint-go`, `make test-go`.
2. **API, admin panel va user app:** manba API, `CompanyDetail`, tarix maydonlari, `openapi.yaml` + `make api-client`, admin bo'limi va dialog, user app tarixi, mocklar. Push gate ikkala tomon + `companies.spec.ts` va valyuta kurslari sahifasining web spec'i.

## Chegara (bu ishga kirmaydi)

Kun ichida qayta urinish; «Hozir olish» tugmasi; bildirishnoma (admin botga); egasining manba tanlashi; qo'lda kiritilgan kursni yaxlitlash; boshqa valyutalar (katalog UZS, USD, EUR, RUB).

## Xavf

- **Deploy kuni:** API ishga tushishi bilan shu kun qo'lda kurs kiritilmagan har kompaniya Markaziy bank kursini oladi (100 ga yaxlitlangan). O'z kursida qolishi kerak bo'lgan kompaniyaga admin «Qo'lda» ni tanlaydi va egasi shu kunning kursini qo'lda kiritadi.
- Bank sahifalari o'zgaradi (tw-dobroe fixture'lari 2026-05-12 niki); ishlamay qolgan bankda Markaziy bank zaxirasi bor. Live test qaysi bank javob berayotganini ko'rsatadi.
