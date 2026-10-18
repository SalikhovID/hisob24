# Buyurtmada narx, to'lovlar, tovarlar va FIFO tan narxi — dizayn

Sana: 2026-10-18. Holat: foydalanuvchi reja sifatida tasdiqlagan (savol-javob bilan), amalga oshirilmoqda (`dev` branch). Qoidalar: `logic/orders.md` (4.3, 4.4), `logic/sales.md` (5), `logic/warehouse.md` (10), `logic/products.md`, `logic/finance.md`.

## Kontekst

Foydalanuvchining so'zlari: «buyurtmaga narx ko'rsatish imkonini qoshish kerak va buyurtmadan qancha pul olganini ko'rsatishi kerak, bu klient balansida ko'rinishi kerak. va buyurtmalarga tovar biriktirish imkoni bo'lsin, tovar biriktirilsa shu tovar huddi sotilgandek bo'ladi. buyurtma 5000$ qilinsa avans ham kiritish bo'lishi kerak formada, 400$ ko'rsatsa keyin 300$ berilsa … qarz deb ko'rsatishi kerak. tovar biriktirishda summa oshmaydi … tovar tan narxi hisoblanishi kerak.»

Buyurtma (`orders`) shu paytgacha pulsiz edi. Mijoz balansi va hisob harakati jurnaldan (`transactions`) hisoblanadi; qoldiq `stock_moves` yig'indisi. Tan narx (WAC / FIFO) ledger dizaynida keyinga qoldirilgan edi (`2026-10-11-ledger-design.md`, 13-qaror); endi FIFO shu ish bilan keladi, hisobot esa keyingi versiyada.

`docs/SPEC.md` da yo'q ish, foydalanuvchi so'rovi bilan.

## Yondashuv

Buyurtmaning puli va tovarlari jurnalda **bitta hujjat**: `transactions.kind = 'order'`, `transactions.order_id → orders`. `total` = narx (qatorlardan emas, qo'lda), `transaction_items` = biriktirilgan mahsulot va xizmat qatorlari (narxsiz), `stock_moves` = mahsulotlar buyurtma lokatsiyasi qoldig'idan `−`, to'lovlar = hujjatga bog'langan `customer_payment` (`linked_id`). Shunda mijoz balansi, hisob harakati, akkaunt qoldig'i, qoldiq tekshiruvi, valyuta va kurs, `*_in_use` qoidalari mavjud mexanizm bilan ishlaydi: balans formulasiga faqat `'order'` turi qo'shiladi.

Rad etilganlar: `orders` jadvaliga `amount` ustuni va balansda `UNION` (kurs, hisob harakati, to'lov bog'lash takrorlanardi); buyurtma uchun avtomatik `sale` hujjati (sotuvning jamisi qatorlardan chiqadi, buyurtmada narx tovardan mustaqil).

## Foydalanuvchi qarorlari (2026-10-18)

| # | Savol | Qaror |
|---|---|---|
| 1 | 5000 $ buyurtma, 400 $ avans, 300 $ to'lov → qarz | **4300 $** (narx − avans − to'lovlar; «5300» yozuvda xato) |
| 2 | Keyingi to'lovlar | **Buyurtma sahifasida «To'lov»**: o'z sanasi, akkaunti, kursi, izohi; sahifada to'lovlar ro'yxati (tahrirlash / o'chirish). Qo'shish formasida «Avans». Tahrir formasi to'lovlarga tegmaydi |
| 3 | Tan narx | **FIFO** |
| 4 | Ruxsat | **`orders.*`**: narx, tovar, to'lovlar `orders.create` / `orders.edit`; ko'rish `orders.view`; takliflar `products.view`; mijoz balansi avvalgidek `sales.view` |
| 5 | FIFO qachon | **Hozir, buyurtma sahifasida**: «Tan narxi» so'mda, `purchases.view` bilan, jurnaldan jonli; hisobot keyin |
| 6 | Qatorlar | **Mahsulot va xizmat** (xizmat qoldiqqa tegmaydi, tan narxi 0) |
| 7 | Karta / ro'yxat | **Narx va qolgan** («5 000 $ · qolgan 4 300 $»; to'liq to'langanda «to'langan»); narxsiz buyurtmada yo'q |
| 8 | Bosh sahifa | **Alohida «Buyurtmalar» summasi** kartasi (oy ichida yaratilgan narxli buyurtmalar, so'mda) |

Amalga oshirishda belgilanganlar (foydalanuvchi rejani tasdiqlagan): hujjat kerak bo'lgandagina yaratiladi va keyin qoladi; `doc_at` yaratilgan daqiqa (soniyalarsiz); tarixga «Narx» va «Mahsulotlar» yoziladi, to'lovlar yozilmaydi; narxi 0 hujjat hisob harakatida va bosh sahifada sanalmaydi; sahifada «Foyda / Zarar» qatori (`profit_uzs`).

## Qoidalar

### Buyurtma hujjati

- **Qachon.** Qo'shishda narx > 0, yoki qator bor, yoki avans bor; tahrirda hujjat yo'q bo'lsa va narx > 0 yoki qator bo'lsa; sahifadan to'lov qo'shilganda hujjat yo'q bo'lsa. Yaratilgach qoladi (narx 0 va qatorsiz bo'lsa ham). Eski buyurtmalar hujjatsiz: API'da `amount: "0.00"`, `paid: "0.00"`.
- `doc_at` = yaratilgan daqiqa (`time.Now().Truncate(time.Minute)`: formalar har hujjatni daqiqagacha sanalaydi, shunda sahifadan shu daqiqada kiritilgan to'lov hisob harakatida buyurtmadan keyin turadi), keyin o'zgarmaydi; kurs qatori shu lahzadagi standart (`ledger.PriceIn`; formada o'zgartirilsa hujjatning o'z qatori; tahrirda `current` bilan). `number` = `NextNumber(order)`, ko'rsatilmaydi. `location_id` = buyurtma lokatsiyasi, `customer_id` = buyurtma mijozi.
- **Narx** (`amount`): ≥ 0, 12 xona va 2 kasr («Narx noto'g'ri»), hujjat valyutasida (`currency_id`, `rate`; `currency_not_allowed`, «Kursni kiriting», «Kurs noto'g'ri»). 0 = narx yo'q.
- **Qatorlar** (`items[]: {product_id, quantity}`): sotuv qoidasi narxsiz (`lineRule{AllowService, AllowNone}`): bo'sh bo'lishi mumkin; mahsulot yoki xizmat kompaniyaniki, faol (avvaldan bor nofaol qoladi), bir marta, miqdor > 0 (3 kasr); xabarlar sotuvniki. Mahsulot qatori `−` harakat (`MovesOf(order)` sotuv kabi), xizmat harakat yozmaydi. Saqlashda 409 `stock_insufficient`. Tahrirda qatorlar butunlay almashadi, harakatlar qayta yoziladi, eski va yangi mahsulotlar tekshiriladi.
- **Avans** (`payments[]`, faqat qo'shishda) → `ledger.WriteLinkedPayments` (vaqti hujjatniki). **Keyingi to'lovlar** `POST /app/orders/{id}/payments` (`PaymentInput`), `PUT/DELETE …/payments/{paymentId}` faqat shu buyurtmaga bog'langan to'lov (boshqasi 404 «To'lov topilmadi»); `customer_id` = buyurtma mijozi, `linked_id` = hujjat. Mijoz sahifasidan 409 `payment_linked` «Bu to'lov buyurtma bilan kiritilgan: buyurtmani oching».
- `paid` = bog'langan jonli to'lovlar hujjat valyutasiga aylantirilgan yig'indisi; qolgan = `amount − paid` (manfiy = mijoz avansi).
- **Tekshiruv tartibi** (qo'shish): nom → muddat → lokatsiya → tur → bosqich → mas'ul → maydonlar → mijoz → narx → valyuta / kurs → qatorlar → to'lovlar → qoldiq (409). Tahrirda: buyurtmaning o'zi (404) → shu tartib to'lovsiz.
- **O'chirish**: hujjat yashiriladi, harakatlari o'chiriladi, bog'langan to'lovlari yashiriladi (sotuvdagidek).
- **Tarix**: «Narx» (matn «5 000 $», «1 200 000 so'm», bo'shi "") va «Mahsulotlar» («Kabel × 2 m, Montaj × 1», bo'shi ""); to'lovlar yozilmaydi.
- **Mijoz balansi**: `sale + order + customer_debt − customer_payment − customer_prepay`. Hisob harakati: `order` qatori «Buyurtma · nomi» (2026-10-18 kechqurundan «Buyurtma № N», `2026-10-18-order-number-design.md`) → `/orders/{order_id}`; bog'langan to'lov «To'lov · nomi» (endi «To'lov · Buyurtma № N») → `/orders/{order_id}`; narxi 0 hujjat ko'rinmaydi (`count` ham).
- **Akkaunt hisob harakati**: buyurtmaga bog'langan to'lovda buyurtma nomi (endi raqami), havola. **Mahsulot harakatlari**: `kind: order`, «Buyurtma · nomi» (endi «Buyurtma № N»), `counterpart` mijoz nomi (sotuvda ham).
- **Ruxsat**: hamma narsa `orders.*`; `cost_uzs` / `profit_uzs` faqat `purchases.view` (aks holda `null`).

### FIFO tan narxi (`internal/costing`)

- Har mahsulot bo'yicha kompaniyaning hamma lokatsiyasidagi harakatlar `(doc_at, transaction_id, chiqim avval, move id)` tartibida qayta o'ynaladi; har lokatsiyada partiyalar navbati `{miqdor, birlik tan narxi so'mda}`.
- Kirim: `purchase` / `opening_stock` qatori — `convert_amount(price, currency, UZS, hujjat kursi)`; `lastKnown` = shu narx (lokatsiyadan qat'i nazar). `transfer` kirimi — manbadan chiqqan partiyalar tan narxi bilan. `inventory` ortiqchasi — `lastKnown` (yo'q bo'lsa 0).
- Chiqim (`sale`, `order`, `transfer` manbasi, `inventory` kamligi): eng eski partiyalardan; yetmasa qolgan miqdor `lastKnown` (yo'q bo'lsa 0).
- Natija: hujjat va qator bo'yicha so'mda, 2 kasr (`big.Rat`, oxirida yaxlitlash). Xizmat 0. `OrderDetail`: `items[].cost_uzs`, `cost_uzs`, `profit_uzs = amount_uzs − cost_uzs` (narx 0 → `null`). So'rov paytida hisoblanadi, saqlanmaydi.

### Bosh sahifa

`Dashboard.orders_money: DashboardMoney | null` (`orders.view`): oy ichida yaratilgan narxli (`total > 0`) buyurtma hujjatlari so'mdagi yig'indisi, soni, kun bo'yicha (`DashboardMoneyByDay` `kind = 'order'`, `AND (t.kind <> 'order' OR t.total > 0)`). Kartada «Buyurtmalar», havola `/orders`.

## Ma'lumotlar modeli

Migratsiya `00021_order_documents.sql`: `orders` `UNIQUE (company_id, id)`; `transactions.order_id BIGINT` + FK `(company_id, order_id) → orders (company_id, id)`; `transactions_kind_check` `'order'` bilan qayta; `transactions_kind_fields`ga `WHEN 'order' THEN order_id IS NOT NULL AND customer_id IS NOT NULL AND location_id IS NOT NULL`; `CREATE UNIQUE INDEX transactions_order ON transactions (order_id) WHERE kind = 'order' AND deleted_at IS NULL`. Down: buyurtma hujjatlarining harakatlari, qatorlari, bog'langan to'lovlari va o'zlari o'chiriladi, constraint'lar eski holiga, ustun va unique olib tashlanadi.

## API (`backend/openapi.yaml` → `make api-client`)

- `Order` += `amount`, `currency_id`, `rate`, `amount_uzs`, `paid`. Yangi `OrderDetail` = `Order` + `items: OrderLine[]` (`product_id`, `name`, `kind`, `unit`, `quantity`, `cost_uzs`), `payments: OrderPayment[]`, `cost_uzs`, `profit_uzs`. `GET/POST/PUT /app/orders/{id}` va `PATCH …/stage` `OrderDetail` qaytaradi; ro'yxat `Order`.
- `OrderCreate` += `amount?`, `currency_id?`, `rate?`, `items?: OrderLineInput[]`, `payments?: PaymentLine[]`. `OrderUpdate` += `amount?`, `currency_id?`, `rate?`, `items?`.
- `POST /app/orders/{id}/payments` (201 `OrderPayment`), `PUT/DELETE /app/orders/{id}/payments/{paymentId}` — `orders.edit`.
- `StatementRow.kind` += `order`; += `order_id`, `order_title` (2026-10-18 kechqurundan `order_number`). `CustomerPayment.sale_id/sale_number` faqat sotuvga bog'langanda; += `order_id`. `AccountStatementRow` += `order_id`, `order_title`. `ProductMove.kind` += `order`; += `order_id`. `Dashboard` += `orders_money`.

## Backend

`internal/ledger`: `Order` turi, `MovesOf(order)`, `WriteLinkedPayments` buyurtma uchun `customer_payment`. `internal/warehouse/order_documents.go`: `WriteOrderDocument`, `DeleteOrderDocument`, `ReadOrderMoney`, buyurtma to'lovlari (`AddOrderPayment`, `UpdateOrderPayment`, `DeleteOrderPayment`); `order` paketi `warehouse`ni import qiladi (halqa yo'q). `internal/costing`: `FIFO` sof funksiya + `CostOf`. `internal/order`: `Input.Money`, `Order` pul maydonlari, `Detail`, tarixda «Narx» va «Mahsulotlar». `internal/dashboard`: `orders_money`.

## User app

`lib/orders.ts` (sxema, `moneyLine`), `order-form.tsx` (narx, valyuta / kurs, `LinesField` narxsiz, `PaymentsField` «Avans»), `order-page.tsx` (pul kartasi, «To'lov» plitkasi → `PaymentDialog` `orderId` bilan, «Mahsulotlar» tan narxi va foyda bilan, «To'lovlar»), karta va qator puli, `statement-list`, akkaunt hisob harakati, mahsulot harakatlari, `home/overview` «Buyurtmalar» kartasi; mocklar `mocks/orders.ts` + `mocks/ledger.ts` (FIFO ham); e2e `orders.spec.ts`, `home.spec.ts`.

## Bosqichlar

0. Hujjatlar. 1. Baza va jurnal yadrosi (00021, `ledger`, so'rovlar). 2. Buyurtma hujjati (backend, API). 3. Buyurtma to'lovlari (backend, API). 4. FIFO va bosh sahifa (backend). 5. User app. 6. Yakuniy ko'rik (lint / test / e2e, mutatsiya, haqiqiy stack smoke, hisobot).

Har bosqich TDD (RED → GREEN → commit), oxirida `make lint`, `make test`, `make e2e`, `git push origin dev`.

## Amalga oshirishda belgilangan qarorlar (2026-10-18)

- **Hujjatlar so'rovlari.** `GetOrder` / `ListOrders` / `ListActiveOrders` buyurtmaning jonli hujjatini `LEFT JOIN` bilan oladi (`amount`, `currency_id`, `rate`, `amount_uzs`, `paid`, `document_id`); hujjatsiz buyurtma so'mda nol. `ListTransactionItems` endi mahsulot turini (`kind`) ham qaytaradi: buyurtma sahifasi xizmatni mahsulotdan shu bilan ajratadi. `GetCustomerPayment` da `sale_id` faqat sotuvga bog'langan to'lovda (ilgari har `linked_id`), `order_id` buyurtmaga bog'langanida.
- **Buyurtma hujjati `warehouse` paketida** (`order_documents.go`): `WriteOrderDocument`, `ReadOrderMoney`, `DeleteOrderDocument` va buyurtma to'lovlari (`AddOrderPayment`, `UpdateOrderPayment`, `DeleteOrderPayment`); `order` paketi `warehouse`ni import qiladi (halqa yo'q). `lineRule.AllowNone`: buyurtma hujjati qatorsiz bo'lishi mumkin. Hujjat yozilmaydigan holat (narx 0, qator yo'q, avans yo'q, hujjat yo'q) kurs qatoriga tegmaydi: `PriceIn` chaqirilmaydi, shuning uchun kompaniyaning nol kurs qatori bekorga yozilmaydi.
- **Tekshiruv tartibi** 4.1 bo'yicha: buyurtma hujjatida qatorlar va avans yozilgandan keyin qoldiq tekshiriladi (sotuvdan farqli: sotuvda to'lovlar qoldiqdan keyin). Qo'shishda hujjat buyurtma qatori va tarix yozuvidan keyin yoziladi; rad etilsa tranzaksiya hammasini qaytaradi (yangi mijozni ham).
- **Tarixdagi pul matni** Go'da `numtext.Grouped` + `currency.SymbolOf` ("5 000 $", minglar oddiy bo'shliq bilan); ekranda `formatMoney` NBSP bilan ko'rsatadi, tarix matni esa qanday yozilgan bo'lsa shunday chiqadi.
- **Buyurtma to'lovlarining kursi** `checkPayment` bilan: akkaunt valyutasining hujjat sanasidagi standart kursi, formada o'zgartirish mumkin (`PaymentInput.rate`); avans qatorlari (`PaymentLine`) esa `WriteLinkedPayments` bilan, kurs maydonsiz.
- **FIFO** (`internal/costing`): `FIFO(moves)` sof funksiya `big.Rat` bilan; `Lines(ctx, q, companyID, transactionID, productIDs)` jurnaldan (`ListProductCostMoves`: mahsulot, vaqt, hujjat, chiqim avval, harakat tartibida; xarid / boshlang'ich qoldiq qatorining birlik narxi so'mda hujjat kursi bilan). Tan narx `Detail(withCost)` da hisoblanadi; `profit_uzs` narx 0 bo'lsa `null`; xizmat qatori "0.00". Handler `purchases.view` bilan so'raydi.
- **Bosh sahifa**: `DashboardMoneyByDay` `kind = 'order'` uchun `total > 0` filtri; `Dashboard.orders_money` `orders.view` bilan; kartaning nomi «Buyurtma summasi» (faol buyurtmalar kartasi «Buyurtmalar» nomini saqlaydi), havola `/orders`.
- **Web**: `MoneySection` (`order-form.tsx`) narx, valyuta / kurs (2+ valyutada, standart kurs taklifi sotuv formasidagidek), `LinesField` narxsiz (`products.view` bilan; `canPickProducts`), qo'shishda `PaymentsField` «Avans» (jami = narx). Sahifada `OrderMoneyCard` («Pul»: Narx / To'langan / Qolgan, ortiqcha to'langanda «Avans»; narxsiz va to'lovsiz buyurtmada yo'q), `OrderLines` («Mahsulotlar»: nom, miqdor; `purchases.view` bilan qator tan narxi, «Tan narxi», «Foyda» / «Zarar»), `OrderPayments` («To'lovlar»: akkaunt, vaqt, izoh; qator varag'i Tahrirlash / O'chirish `orders.edit` bilan). `PaymentDialog` va `DeletePaymentDialog` `orderId` bilan buyurtma endpointlariga; «To'lov» plitkasi `orders.edit` bilan, so'mdagi buyurtmada qolgan summa «To'liq» uchun taklif qilinadi. Karta va qatorda `moneyLine` («5 000 $ · qolgan 4 300 $» / «· to'langan» / «· avans N»). `GET /app/orders/{id}` javobi `OrderDetail`: `useOrder` detalni oladi, `useMoveOrder` javobni keshga qo'yadi.
- **Keshlar**: `forgetOrderMoney` (`lib/order-money.ts`) buyurtma, ro'yxatlar, tarix, mijoz (balans), mijozlar, mijoz hisob harakati, mahsulotlar (qoldiq) va moliya keshlarini tashlaydi.
- **Mock API**: `mocks/orders.ts` hujjatni `writeOrderDocument` bilan yozadi (`checkLines` `allowNone`, `writeGoods`, `writeLinkedPayments`), `fifoCostOf` (`mocks/ledger.ts`) Go FIFO qoidasini takrorlaydi, `priceText` / `linesText` tarix matnini; `statementOf` narxi 0 hujjatni tashlaydi va `order_id` / `order_title` beradi.
- **Hujjat vaqti daqiqagacha** (2026-10-18, haqiqiy stack'dagi brauzer tekshiruvi topdi): `doc_at` soniyali bo'lganda sahifadan shu daqiqada kiritilgan to'lov (`datetime-local` daqiqagacha) hisob harakatida buyurtmadan *oldin* turar va oraliq balans «avans» bo'lib ko'rinar edi; endi `WriteOrderDocument` va `ensureOrderDocument` vaqtni daqiqaga yaxlitlaydi, teng vaqtda `id` tartibi (`TestOrderDocumentIsDatedToTheMinute`). Mock soati allaqachon daqiqali.
- **Tahrir formasidagi miqdor** API'dan «12.000» ko'rinishida keladi: sotuv, ko'chirish va boshlang'ich qoldiq formalari bilan bir xil mavjud odat, o'zgartirilmadi.
- **Talab o'zgargani uchun o'zgargan testlar**: `TestTheOrdersMigrationDownBringsTheTasksTablesBack` 18-dan boshlaydi (keyingi migratsiyalar ham «order» nomli narsalar qo'shadi); `order.TestCreate` literal'i pul maydonlari bilan; `app.TestListOrders` ro'yxat qatorini detaldan ajratadi (`row`); `app.TestPaymentsAPI` statement qatori `order_id` / `order_title` bilan; `lib/orders.test.ts` forma / chiqish literal'lari; `lib/stock.test.ts` (`order` turi, `StatementRow` maydonlari); `home-hero.test.tsx` / `overview.test.tsx` (`orders_money`); `upcoming-orders.test.tsx` provayderlar bilan (qator valyutani sessiyadan oladi); mock `handlers.test.ts` ro'yxat va harakat qatorlari.

