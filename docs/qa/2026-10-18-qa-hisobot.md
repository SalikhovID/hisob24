# QA hisoboti — 2026-10-18

Qamrov: mahsulot va xizmat (qo'shish / tahrirlash / o'chirish), moliya (pul kiritish va chiqarish, har xil valyutalar, o'tkazma, konvertatsiya), oldi-berdi (ta'minotchi va mijoz to'lovlari, qarz / avans, hisob harakati), ombordan omborga ko'chirish, tovar sotish. Branch `dev`: API binary `8a25fa3` dan qurilgan (backend keyin o'zgarmagan); user app `next dev` yurish davomida tushgan 10 ta commit (`f88f7f3` … `88a7828`, modal ortidagi muzlagan fon) bilan jonli yangilanib ishladi, dialoglar shundan keyin ham o'tdi.

## 1. Xulosa

| Qism | Tekshiruvlar | Natija |
|---|---|---|
| API, yangi kompaniyada to'liq oqim (`api_qa.py`) | 653 | 653 o'tdi, 0 xato |
| API, ikkinchi o'tish: kurslar, sahifalash, admin cheklovlari, poyga (`api_qa2.py`) | 148 | 140 o'tdi; 8 «xato» — skript kutgan qiymatning o'zi noto'g'ri edi (o'chirilgan hujjat raqami davom etadi, kurs qatori avvalgi yurishdan qolgan), ikkitasi quyidagi 2- va 3-topilmaga aylandi |
| API, uchinchi o'tish: kurs qayta tanlovi, kelgusi sanali hujjat (`api_qa3.py`) | 39 | 38 o'tdi; 1 — 3-topilma |
| Brauzer, desktop 1280×800 + telefon 375×812 (`ui_qa.cjs`, `ui_d22.cjs`, `ui_overlap.cjs`) | 37 qadam + 2 maxsus skript | 34 o'tdi; 1 — 1-topilma, 2 — avvalgi qadamga bog'liq (raqamlash) |

Backend hisob-kitobi toza: har bir akkaunt, ta'minotchi va mijoz hisob harakatidagi yig'indi balansga teng, API qoldig'i bazadagi `SUM(stock_moves)` bilan bir xil, o'chirilgan hujjat harakat qoldirmaydi, raqamlar tur ichida takrorlanmaydi, 5 ta parallel sotuvdan faqat bittasi oxirgi donani oladi. Rad javoblari spec'dagi kod va matnlar bilan keladi.

Topilmalar: 1 ta o'rta (UI, valyuta almashganda narxlar), 4 ta past, 4 ta kosmetik. Pul yo'qotadigan yoki qoldiqni buzadigan xato topilmadi.

## 2. Muhit va usul

- Alohida DB `hisob24_qa` (`CREATE DATABASE … TEMPLATE hisob24`, goose 20), lokal `hisob24` DB'ga tegilmagan.
- API: `go build` qilingan binary, `:8091`, botlarsiz, `SMS_DRIVER=log` (kodlar `api.log`dan olinadi). User app: `next dev -p 3011`, `API_URL=http://127.0.0.1:8091`.
- Admin amallari (kompaniya, lokatsiyalar «Filial 2», «Filial 3», valyutalar USD + EUR, akkauntlar «Dollar», «Evro», «Bank») admin API orqali (`cmd/otp` kodi). Egasi SMS kod bilan kiradi. Kurslar: 1 USD = 12 800, 1 EUR = 14 000.
- API skriptlar Python (`urllib`), har javob status + maydonlar bo'yicha tekshirilgan, pul `Decimal` bilan solishtirilgan. Brauzer skriptlar Playwright (chromium), har qadim ok/FAIL, xatoda skrinshot; konsol xatolari va 4xx javoblar yig'ilgan (faqat ataylab chaqirilgan 409/401 lar).
- Skriptlar va skrinshotlar: `/private/tmp/claude-501/-Users-salikhov-id-www-hisob24/326d7981-0708-4d23-b50d-d9827a3d6744/scratchpad/qa/` (`stack.sh`, `api_qa.py`, `api_qa2.py`, `api_qa3.py`, `ui_qa.cjs`, `ui_d22.cjs`, `ui_overlap.cjs`, `shots/`). Vaqtinchalik papka; kerak bo'lsa repo'ga ko'chiriladi.

## 3. Topilmalar

### 3.1 [O'rta] Sotuv / xarid formasida valyuta almashtirilganda qator narxlari qayta hisoblanmaydi

- **Qayerda:** `apps/web/components/warehouse/lines-field.tsx` (narx taklifi faqat mahsulot tanlanganda, `offered()` → `set(items.N.price)`), `components/sales/sale-form.tsx`, `components/warehouse/purchase-form.tsx` (`currency_id` SelectRow).
- **Takrorlash:** Sotuv → Sotuv qo'shish → qatorga «Telefon» (narxi 150 $) tanlanadi — so'm hujjatida 1 920 000 taklif qilinadi (to'g'ri) → Valyuta → USD. Narx 1 920 000 ligicha qoladi, endi 1 920 000 $ bo'lib turadi; «Jami» ham shunga qarab hisoblanadi. Teskarisi ham: USD'da Telefon 150.00, Olma 0.94 tanlanib, UZS'ga qaytarilsa 150 so'm va 0,94 so'm bo'lib qoladi. Tahrirda ham: so'mdagi Sotuv № 6 ochilib Valyuta USD qilinsa Olma 12000.00 → 12 000 $.
- **Kutilgan:** valyuta o'zgarganda narxlar hujjat kursi bilan aylantirilishi (yoki qayta taklif qilinishi), kamida ogohlantirish. Spec (`logic/currencies.md` §5) faqat «mahsulot tanlanganda» taklif haqida yozadi, almashtirish holati yozilmagan — shuning uchun spec'ga ham bir jumla kerak.
- **Dalil:** `shots/d22-switch.png`, `shots/d22-edit-switch.png`, `shots/fail-01.png` (birinchi yurish).
- **Xavf:** foydalanuvchi valyutani keyin almashtirsa, 12 800 barobar noto'g'ri summali hujjat saqlanadi (server narxni tekshirmaydi, tekshira olmaydi ham).

### 3.2 [Past] `PUT /admin/companies/{id}/currencies` UZS'siz ro'yxatga 400 bermaydi

- **Qayerda:** `backend/internal/currency/currency.go:120` — `wanted := map[int64]bool{UZS: true}`: UZS jimgina qo'shib qo'yiladi.
- **Bo'lgan:** `{"currency_ids": [2, 3]}` → 200, javobda UZS ham bor.
- **Spec:** `logic/currencies.md` §3: «UZS doim ro'yxatda, olib tashlanmaydi (400 «UZS olib tashlanmaydi»)». Admin UI UZS'ni yubormasdan qo'ymaydi, shuning uchun amaliy zarari yo'q; yo spec'dagi 400 kodga, yo koddagi jim saqlash spec'ga keltirilsin.

### 3.3 [Past] Kelgusi sanali hujjat qoldiq ko'rinishlarida har xil hisobga olinadi

- **Takrorlash (API):** mahsulotga 5 daqiqa avval 3 dona boshlang'ich qoldiq, keyin 2 soat *keyingi* vaqt bilan 2 dona sotuv. Natija: `GET /app/stock?location_id=` (inventarizatsiya formasi, «hozir») → **3**; `GET /app/stock&at=+3h` → 1; mahsulotlar ro'yxati va mahsulot sahifasi → **1**; hozir yana 2 dona sotish → 409 `stock_insufficient` (kelgusi sotuv hisobga olinadi); hozirgi vaqt bilan inventarizatsiya → tizim qoldig'i 3, farq 0.
- **Nima bo'ladi:** sana noto'g'ri terilsa (masalan 2027), mahsulot sahifasi «1» desa, inventarizatsiya «tizim qoldig'i 3» deydi va foydalanuvchi 3 deb sanasa farq yozilmaydi — ro'yxat esa 1 ligicha qoladi. Spec bo'yicha lahzadagi qoldiq to'g'ri hisoblangan, lekin ro'yxat / sahifa / forma o'zaro mos emas.
- **Taklif:** ro'yxat va sahifada ham «hozirgi lahza» qoldig'ini ko'rsatish (yoki kelgusi hujjatlarni alohida belgilash); hujjat vaqti hozirgidan ancha keyin bo'lsa formada ogohlantirish.

### 3.4 [Past] «To'liq» boshqa valyutali akkauntda yaxlitlab, hujjatni «ortiqcha to'langan» qiladi

- **Takrorlash:** 50 000 so'mlik xarid, to'lov akkaunti «Dollar ($)», «To'liq» → 3,91 $ (50 000 / 12 800 = 3,90625). Saqlangach xarid sahifasi «Jami 50 000 so'm, To'langan 50 048 so'm», ta'minotchi balansi 48 so'mga kamayadi (avans).
- **Spec:** `logic/currencies.md` §5 kurs farqi balansda qoladi, deydi; lekin «To'liq» o'zi farq chiqarishi foydalanuvchi uchun kutilmagan (`shots/d-purchase-page.png`, `shots/d-supplier.png`).
- **Taklif:** pastga yaxlitlash (3,90 $ → «Qoldi 32 so'm») yoki forma ostida farqni ko'rsatish.

### 3.5 [Past] Balans kartasidagi valyuta tafsiloti ishorasi sarlavhaga teskari

- **Bo'lgan:** mijoz sahifasida «**Avans** 104 000 so'm — shu jumladan 88 000 so'm, -15 $» (`shots/d-customer.png`). Sarlavha avansni musbat ko'rsatadi, tafsilot esa qarz ishorasida: aslida 88 000 so'm *qarz*, 15 $ *avans*. Ta'minotchida: «Qarz 4 119 952 so'm — shu jumladan 1 090 000 so'm, 346,09 $, -100 €» — bu yerda ishora sarlavha bilan mos, lekin «-100 €» ni o'qish baribir qiyin.
- **Yana:** tafsilotdagi minus oddiy defis «-», hisob harakatida tipografik «−» (U+2212).
- **Taklif:** «shu jumladan qarz 88 000 so'm, avans 15 $» ko'rinishi; bir xil minus belgisi.

### 3.6 [Kosmetik] Narx taklifi formati har xil

O'z valyutasidagi narx «12000.00», aylantirilgani «1920000» (kasrsiz), USD'da «0.94». Bir ko'rinishga keltirilsin (`lines-field.tsx`, `offered()`).

### 3.7 [Kosmetik] Bosh sahifa grafigi bitta kunlik ma'lumotda «jarlik»

«Xaridlar» va «Sotuv» kartalaridagi oy chizig'i faqat bugungi hujjatlar bo'lganda o'ng chekkada tik ko'tariladi va kartadan chiqib ketgandek ko'rinadi (`shots/d-home-after.png`).

### 3.8 [Kosmetik] Telefonda sarlavha osti ikki qatorga bo'linadi

«Kompaniyangiz mahsulotlari · 3 ta» — «ta» yolg'iz ikkinchi qatorga tushadi (`shots/p-products.png`). `3 ta` orasiga uzilmas bo'shliq yoki qisqaroq matn.

### 3.9 [Kosmetik] Desktopda xato banneri formaning oxirgi qatorini tugma ostiga suradi

Ko'chirish formasida 409 banneri chiqqach «Izoh» qatori suzuvchi «Saqlash» ostida qoladi (`shots/d-transfer-refused.png`); `main` 70 px suriladi va qator ochiladi, shuning uchun jiddiy emas (`ui_overlap.cjs` o'lchovi).

## 4. Xato emas, lekin bilib qo'yish kerak

- O'z kursli hujjat (`status = 2`) API orqali `rate`siz tahrirlansa vaqtidagi standart kursga qaytadi; UI formasi kursni doim yuboradi, shuning uchun UI'da o'z kurs saqlanadi. API kontraktida buni aytib qo'yish kerak (`openapi.yaml`).
- `GET /app/money-transfers/{id}` konvertatsiya uchun 404; konvertatsiya faqat `/app/conversions/{id}` da. UI shunday ishlatadi (`delete-cash-document-button.tsx`), lekin `logic/finance.md` §5 jadvalidagi «GET/PUT/DELETE …/{id}» ikkalasini qamraydigandek o'qiladi.
- `/app/me.accounts` nofaol akkauntni ham `is_active: false` bilan beradi; formalar `accountOptions` bilan filtrlaydi (eski hujjatda nofaol akkaunt nomi ko'rinishi uchun kerak).
- O'chirilgan hujjat raqami bo'shamaydi (spec bo'yicha): ro'yxatda «№ 1» dan keyin darrov «№ 8» ko'rinishi mumkin.
- Pul ko'rinishi: «169,50 €», «20,50 €» — spec faqat «.00» tashlanadi deydi, shunga mos.
- Kelgusi vaqt bilan hujjat kiritish mumkin (spec «kelgusi ham»); 3.3-topilma shundan kelib chiqadi.

## 5. Tekshirilgan oqimlar

### Mahsulot va xizmat
- Qo'shish: so'm va USD narx, artikul, izoh; chetidagi bo'shliq olib tashlanadi; `currency_id` standart UZS; RUB (yoqilmagan) → 400 `currency_not_allowed`.
- Takrorlar: nom (harf farqsiz) 409 `name_taken`, artikul 409 `sku_taken`; xizmat va mahsulot bir xil nomda bo'lishi mumkin; nofaol mahsulot nomi band; o'chirilgan mahsulot nomi bo'shaydi.
- Tekshiruv matnlari: «Birlikni tanlang» (birliksiz, ro'yxatda yo'q birlik), «Nomni kiriting», «Nom 120 belgidan oshmasin», «Narx noto'g'ri» (manfiy, vergulli, 3 kasr, 13 xona), «Izoh 500 belgidan oshmasin», «Artikul 60 belgidan oshmasin», «Xizmatga birlik berilmaydi», «Xizmatga artikul berilmaydi», «Turni tanlang».
- Tahrirlash: maydonlar almashadi, yuborilmagan artikul / izoh bo'shaydi, tur o'zgarmaydi, boshqa nomga 409, 404 «Mahsulot topilmadi»; xizmat narxi.
- Nofaol / faol: ro'yxat tablari, PATCH; xarid takliflaridan chiqadi («Mahsulot nofaol»).
- Ro'yxat: nom tartibi, `kind`, qidiruv nomda va artikulda, `page` xatolari va oxiridan keyingi sahifa, `location_id` (begona → 403, son emas → 400), lokatsiyasiz yig'indi.
- O'chirish: ishlatilmagan → 204 va 404; hujjatda bor mahsulot va sotuvdagi xizmat → 409 `product_in_use` (UI toast «Bu mahsulot 2 ta hujjatda bor»); boshqa kompaniyaniki → 404 (GET / PUT / PATCH / DELETE).
- UI: ro'yxat, dialogda qo'shish (narx «8 000» bo'shliq bilan), takror nom xabari dialog ichida, mahsulot sahifasi (narx, oxirgi xarid narxi, lokatsiya bo'yicha qoldiq, harakatlar), artikul tahriri, nofaol / faol, o'chirish rad va qabul; xizmatlar: qo'shish, narx tahriri, o'chirish, rad. Telefonda: qo'shish, sahifa, o'chirish, yon scroll yo'q.

### Moliya
- 4 akkaunt (Naqd, Bank — so'm; Dollar; Evro), boshida 0.
- Kassa boshlang'ich qoldig'i 3 valyutada; 0 / «abc» / summasiz / begona akkaunt / vaqtsiz / noto'g'ri vaqt → to'g'ri 400 matnlari; 12 xonali summa qabul, 13 xonali rad.
- Kirim va xarajat: kategoriya turi mos kelmasa «Kategoriya turi mos emas», kategoriyasiz «Kategoriyani tanlang», tur xatolari; xarajat qoldiqdan katta — qabul, balans manfiy; USD va EUR xarajat (19,5 € vergul bilan UI'da); 3 kasr / manfiy rad.
- Tahrir: summa, akkaunt almashishi (ikkala balans), «Tur o'zgartirilmaydi»; o'chirish, o'chirilgani 404.
- Ro'yxat filtrlari: `kind`, `account_id`, `category_id`, `from` / `to` (teskari → «Sana noto'g'ri»); 23 ta hujjat 20 + 3 sahifada takrorsiz.
- O'tkazma: so'm → so'm; valyutalar farq qilsa, o'ziga, yo'q / begona akkauntga → spec'dagi 400 matnlari.
- Konvertatsiya: so'm → $ (kurs 12 800), $ → € (0,9), $ → so'm (13 000); bir valyutada → 400; tahrirda ikkala balans qayta; o'chirish.
- Hisob harakati: har qatorda `delta` va qoldiq, oxirgi qoldiq balansga teng (4 akkaunt, 2 sahifa ham), `party_name` kategoriya / boshqa akkaunt; begona akkaunt 404.
- Admin: valyuta o'chirish hujjat / akkaunt bo'lsa 409 `currency_in_use`; akkaunt valyutasi va o'chirish hujjat bo'lsa 409 `account_in_use`; oxirgi faol akkaunt 409 `last_account`; nofaol akkaunt formada rad («Akkaunt nofaol»); nom takrori 409; ishlatilmagan akkaunt valyutasi o'zgaradi va o'chadi.
- UI: akkauntlar ro'yxati balanslari, Naqd sahifasida boshlang'ich qoldiq, xarajat, kirim, o'tkazma, konvertatsiya (dialogda «1 $ = 12 800 so'm»), balans 794 000 → ro'yxatda 794 000 / 100 000 / 75 $; Evro 150 €; xarajat tahriri 60 000; Kirim tabi; konvertatsiya o'chirilgach 912 000 va 65 $. Telefonda xarajat.

### Oldi-berdi
- Xarid: so'mda bog'langan to'lov bilan (`paid`, balans 40 000); USD'da standart kursda (`total_uzs`), o'z kursida; Dollar akkauntdan to'lov; `last_price`; raqam o'chirilgandan keyin davom etadi.
- Xarid tekshiruvlari: xizmat, nofaol mahsulot, ikki marta, miqdor 0, manfiy narx, qatorsiz, ruxsatsiz / begona lokatsiya (403), begona ta'minotchi, begona mahsulot, begona akkaunt, to'lov 0, RUB, nofaol ta'minotchi — hech biri qoldiq va kassaga tegmaydi.
- Ta'minotchi to'lovi so'mda va evroda (kurs, `amount_uzs`), boshlang'ich qarz va avans ($), balans va valyuta bo'yicha tafsilot, `purchases_total` / `payments_total`; hisob harakati (8 qator, bog'langan to'lovlar xarid raqami bilan); bog'langan to'lovni tahrirlash / o'chirish 409 `payment_linked`; o'z to'lovini tahrirlash va o'chirish; ta'minotchini o'chirish 409 `supplier_in_use`; o'z kursli to'lov; kurs qatori hujjat vaqtiga qarab tanlanadi va vaqt tahrirlanganda qayta tanlanadi.
- Xarid tahriri: qator miqdori va ikkinchi to'lov (to'lovlar butunlay almashadi), lokatsiya o'zgarmaydi.
- Mijoz: sotuvdan qarz 24 000, so'm va $ to'lovlar, boshlang'ich qarz / avans, balans tafsiloti, hisob harakati, bog'langan to'lov 409, o'chirish 409 `customer_in_use`, ro'yxatdagi balans.
- UI: mijoz sahifasida balans va to'lov (klaviatura varag'i), ta'minotchi sahifasida balans va 100 000 to'lov, xarid formasi (narx taklifi 10000.00, «To'liq» Dollar akkauntdan).

### Ombordan omborga ko'chirish
- Yaratish Asosiy → Filial 2 (4 kg): manbadan chiqadi, maqsadga tushadi; ro'yxat ikkala lokatsiyada (Chiqim / Kirim), uchinchisida yo'q; sahifa; mahsulot sahifasida 5 / 4 / 0; `location_id` li ro'yxatda 4 kg, lokatsiyasiz yig'indi 9; harakatlar ikki qator, har biri boshqa lokatsiya nomi bilan.
- Rad: o'ziga, yo'q / begona maqsad, begona manba (403), qoldiqdan ko'p, manbada yo'q tovar, xizmat, qatorsiz, ikki marta — hech biri qoldiqqa tegmaydi.
- Maqsadda sotuvdan keyin o'chirish va kamaytirish 409 `stock_insufficient`, maqsadni almashtirish 409; ko'paytirish ishlaydi; sotuv o'chirilgach ko'chirish o'chadi va qoldiq qaytadi; ikkinchi ko'chirish № 2; inventarizatsiya (kutilgan 10 / 2,5, farq −1 / 0) va o'chirilishi.
- UI: forma, sahifa «Ko'chirish № 3», ro'yxatda Chiqim / Kirim lokatsiya almashtirib, Filial 2 da ro'yxatda 4 kg, tahrir 5 kg, qoldiqdan ko'p → banner «„Olma“ uchun omborda yetarli qoldiq yo'q». Telefonda 1 kg ko'chirish.

### Sotuv
- Mijozga: mahsulot + xizmat, qisman to'lov, qoldiq kamayadi (xizmat tegmaydi), mijoz qarzi; qoldiqdan ko'p → 409 hech narsa yozilmaydi, raqam sarflanmaydi; chakana: kam / ko'p / to'lovsiz → «Mijozsiz sotuv to'liq to'langan bo'lsin», to'liq → saqlanadi; USD sotuv so'm to'lovi bilan (`paid` 5 $, `total_uzs`), yangi kursda «paid» aniq; 10 000 so'm / 13 000 → `paid` 0,77 (yaxlitlangan), hisob harakati baribir mos.
- Tahrir: miqdor va to'lovlar qayta yoziladi, mijoz olib tashlanganda to'liq to'lov talabi, qoldiqdan ko'p → 409 va hech narsa o'zgarmaydi; o'chirish: qoldiq va kassa qaytadi, bog'langan to'lovlar yo'qoladi, mijoz balansi mos; faqat xizmatli sotuv; begona lokatsiya 403, begona mahsulot 400, begona sotuv 404.
- Poyga: 5 ta parallel sotuv 1 donaga — bitta 201, to'rttasi 409; 4 ta parallel xarid — hammasi 201, raqamlar ketma-ket.
- UI: forma (mijoz, narx taklifi 12000.00 va 50000.00, jami 74 000, to'lov 50 000), sahifa «Sotuv № 6» («Qoldi 24 000»), mijoz sahifasida avans, USD sotuv (valyuta avval tanlanganda Telefon 150.00, Olma 0.94; «To'liq» 1 920 000 so'm; sahifada «USD · 1 USD = 12 800 so'm», «So'mda 1 920 000 so'm»), tahrir 1 kg → 62 000, o'chirish. Telefonda sotuv «To'liq» bilan.

## 6. Takrorlash

```bash
S=/private/tmp/claude-501/-Users-salikhov-id-www-hisob24/326d7981-0708-4d23-b50d-d9827a3d6744/scratchpad/qa
bash $S/stack.sh > $S/stack.log 2>&1        # hisob24_qa DB, API :8091, web :3011
cd $S && python3 -I api_qa.py               # yangi kompaniya + 653 tekshiruv, run.txt yozadi
sleep 25 && node ui_qa.cjs                  # desktop + telefon (run.txt dagi egasi)
python3 -I api_qa2.py run.txt && python3 -I api_qa3.py run.txt
```

Tugatish: `:8091` va `:3011` jarayonlarini to'xtatish, `DROP DATABASE hisob24_qa`, `rm -rf apps/web/.next-real`, `git checkout -- apps/web/tsconfig.json`.

## 7. Holat (2026-11-03)

Topilmalar `dev` branch'da TDD bilan tuzatildi (har biri avval yiqiladigan test, keyin kod). Qaror talab qilganlari (3.1–3.4) foydalanuvchi bilan kelishildi.

| Topilma | Holat | Commit |
|---|---|---|
| 3.1 Valyuta almashganda narxlar | Tuzatildi: sotuv, xarid va boshlang'ich qoldiq qatorlaridagi narxlar hamda buyurtma narxi (taklif qilingani ham, qo'lda yozilgani ham) joriy kurs bilan yangi valyutaga aylantiriladi; o'z valyutasida ochilgan hujjat narxlari o'zgarmaydi. `logic/currencies.md` §5 ga yozildi. | `2ee36fd`, `c537b01` |
| 3.1 ga yondosh, yangi topilma: kurs eski valyutada qolardi | Tuzatildi: USD → EUR almashganda (yoki to'lovda dollar akkauntidan evro akkauntiga o'tilganda) kurs maydonida dollar kursi (12 800) qolib, hujjat noto'g'ri so'm qiymati bilan saqlanardi. Endi har valyuta almashganda yangi valyutaning standart kursi olinadi (kursi yo'q bo'lsa maydon bo'shaydi va so'raladi). 6 ta forma: sotuv, xarid, boshlang'ich qoldiq, buyurtma, to'lov, boshlang'ich qarz / avans. | `eecb1bd` |
| 3.2 UZS'siz valyuta ro'yxati | Tuzatildi, kod spec'ga keltirildi: 400 «UZS olib tashlanmaydi» (bo'sh ro'yxat ham). Jim xatti-harakatni yozib qo'ygan testlar (Go service, admin handler, `accounts_test.go` dagi ikki tayyorlov chaqiruvi) va admin MSW mock yangilandi. | `6ef6163` |
| 3.3 Kelgusi sanali hujjat va qoldiq | Kod o'zgarmaydi (foydalanuvchi qarori); hozirgi xatti-harakat `logic/warehouse.md` §5 ga yozildi. | shu hujjatlar commit'i |
| 3.4 «To'liq» boshqa valyutali akkauntda | «To'liq» eng yaqin sentga yaxlitlashda qoladi; to'lovlar jamidan oshsa forma «Qolgan: 0 so'm» o'rniga «Ortiqcha: 48 so'm» deydi. | `c2e6838` |
| 3.5 Balans tafsiloti ishorasi | Tuzatildi: «shu jumladan qarz 88 000 so'm, avans 15 $», ishorasiz; qoldig'i 0 valyuta aytilmaydi. | `3c10f33` |
| 3.6 Narx taklifi formati | Tuzatildi: aylantirilgan taklif ham ikki kasr bilan («12800.00», «5.00»), tahrir formasidagi narxlar kabi. | `a782b0f` |
| 3.7 Grafikdagi «jarlik» | Tuzatildi: egri chiziq monoton (asosdan pastga botmaydi), oxirgi kun chekkadan 12/160 oldin turadi va chiziq chekkagacha tekis davom etadi. | `01213da` |
| 3.8 «ta» yolg'iz qatorda | Tuzatildi: `count()` raqam va «ta» ni uzilmas bo'shliq bilan bog'laydi; hamma sarlavha osti va bo'lim hint'larida. | `2576ea3` |
| 3.9 Banner va suzuvchi «Saqlash» | O'zgartirilmadi: desktopdagi suzuvchi tugma dizayn bo'yicha fon bermaydi, uzun forma oxiri har doim shunday; surilganda qator ochiladi. | — |
| 4-bo'lim: o'z kursli hujjat `rate`siz tahriri | `openapi.yaml` dagi `rate` tavsiflariga yozildi: tahrirda ham `rate`siz yuborilsa vaqtidagi standart kursga qaytadi. | shu hujjatlar commit'i |
| 4-bo'lim: `GET /app/money-transfers/{id}` va konvertatsiya | `logic/finance.md` §5 jadvalida aniqlashtirildi: `/app/money-transfers/{id}` faqat o'tkazma, konvertatsiya `/app/conversions/{id}` da. | shu hujjatlar commit'i |

2-bo'limdagi skriptlar va skrinshotlar vaqtinchalik papkada edi, endi yo'q.
