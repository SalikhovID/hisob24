# Pastki panel: 4 ta tanlanadigan sahifa + «Sozlama» — dizayn

Sana: 2026-10-15. Holat: foydalanuvchi reja sifatida tasdiqlagan (savol-javob bilan), amalga oshirilgan (2026-10-15, pastda «Amalga oshirishda belgilangan qarorlar»). User app (`apps/web`) uchun; admin panel o'zgarmaydi.

## Kontekst

Foydalanuvchining so'zlari: "mini app yoki kichik ekranlarda 5-button sozlama bo'lsin unda boshqa shifalar va pasdagi 4ta buttonni o'zgartirish bo'lsin, namumani ../enwin/ dan ol".

Hozir (2026-10-13 dizayni, `logic/roles.md` §8) tor ekrandagi suzuvchi panelda Bosh sahifa (qulflangan) va a'zo tartibidagi birinchi 4 bo'lim turadi; qolgan bo'limlar profil sahifasida va telefonda bosh sahifada qator-qator, «Yana» yo'q; tartib `/profile/menu` da sudraladi (`user_companies.nav_order`, sidebar ham shu tartibda).

Namuna: `../enwin/enwin-frontend` — `lib/bottom-nav.ts`, `components/layout/bottom-nav.tsx` (panelda a'zo tanlagan 4 sahifa + doim «⋯»), `more-sheet.tsx` (pastdan chiqadigan menyu: qidiruv, guruhlarda plitkalar, joriy va paneldagi sahifa belgilangan, pastida «Panelni sozlash»), `bottom-nav-dialog.tsx` (panel ro'yxati sudraladi va olib tashlanadi, «Standart», guruhlarda «Qo'shish», 4 ta chegarasi, «Saqlash»).

Bu `docs/SPEC.md` da yo'q ish, foydalanuvchi so'rovi bilan.

## Foydalanuvchi qarorlari (2026-10-15)

| # | Savol | Qaror |
|---|---|---|
| 1 | Bosh sahifa panelda qulflanadimi | **Erkin:** 4 tugmaning hammasi tanlanadi, Bosh sahifa ham; standartda u birinchi. |
| 2 | 5-tugma nima ochadi | **Varaq, enwin'dagidek:** «Sozlama» varag'i, undan «Pastki panelni sozlash» varag'i. |
| 3 | 5-tugmaning nomi va belgisi | **«Sozlama» ⚙.** Panelda ikkita ⚙ bo'lmasligi uchun «Sozlamalar» bo'limi panelga qo'yilmaydi: u faqat «Sozlama» varag'ida. |
| 4 | Varaqda va panelda nima | **Bo'limlar va ichki sahifalar** alohida-alohida (Xizmatlar, Xaridlar, Kassa…), qidiruv bilan; panelga ham shu sahifalar qo'yiladi. |
| 5 | Sidebar tartibi | **Olib tashlanadi:** sidebar doim standart tartibda. `nav_order` va `/profile/menu` o'rnida bitta sozlama — panel sahifalari (`tab_bar`). Eski saqlangan tartiblar o'chadi. |

## Spec'dan chetlanishlar

| # | Avvalgi qaror | Yangi | Sabab |
|---|---|---|---|
| 1 | 2026-10-13, 9-qaror va 2-bosqich 1, 5, 6: «Yana» yo'q, bar'ga sig'magan bo'limlar profil va bosh sahifada, `/profile/menu` | 5-tugma «Sozlama» varag'i; profil va bosh sahifadagi «Bo'limlar» va `/profile/menu` o'chiriladi | 2–4-qarorlar |
| 2 | `logic/roles.md` §8: Bosh sahifa doim birinchi va qulflangan, menyu tartibi a'zoniki (sidebar va tab-bar bir tartibda) | panelning 4 sahifasi a'zoniki (Bosh sahifa ham), sidebar standart tartibda | 1, 5-qarorlar |
| 3 | Tab-bar bo'limning o'z sahifalarida (bo'lim manzili, tablari, ombor sahifasi); ombor va sozlamalar qismlarida yashirin | menyuning har sahifasida, ombor va sozlamalar qismlari ham | qismlar panelga qo'yiladi |
| 4 | API: `PUT /app/me/nav {sections}`, `/app/me` da `nav_order` | `PUT /app/me/tab-bar {pages}`, `/app/me` da `tab_bar` | 4, 5-qarorlar |

## Dizayn

### Sahifalar katalogi (`apps/web/lib/nav.ts`)

Panelga qo'yiladigan 16 sahifa, varaqdagi guruhi bilan (kalit — manzil — ruxsat):

| Guruh | Sahifalar |
|---|---|
| guruhsiz | `home` `/` (hammaga), `customers` `/customers` (`customers.view`), `tasks` `/tasks` (`tasks.view`), `sales` `/sales` (`sales.view`), `employees` `/employees` (`employees.view`) |
| Mahsulotlar | `products` `/products`, `services` `/services` (`products.view`) |
| Ombor | `warehouse` `/warehouse` (hub: `purchases.view`, `stock.view` yoki `suppliers.view` dan biri), `purchases` `/purchases` (`purchases.view`), `transfers` `/transfers`, `inventories` `/inventories`, `opening_stock` `/opening-stock` (`stock.view`), `suppliers` `/suppliers` (`suppliers.view`) |
| Moliya | `accounts` `/accounts` (Kassa), `expenses` `/expenses`, `money_transfers` `/money-transfers` (`finance.view`) |

Faqat varaqda, «Sozlamalar» guruhida (`settings.view`): Mijoz turlari, Vazifa turlari, Bosqichlar, Dropdownlar, Valyuta kurslari, Moliya kategoriyalari; Rollar faqat egasiga. Belgi va ranglari sozlamalar hub'idagidek.

- Har sahifaning nomi, rangi va panel uchun to'ldirilgan belgisi bor (`tab-icons.tsx`, 28×28). Yangi belgilar: Xizmatlar, Xaridlar, Ko'chirishlar, Inventarizatsiya, Boshlang'ich qoldiq, Ta'minotchilar, Xarajatlar, O'tkazmalar. Kassa — Moliya'ning hamyoni, «Sozlama» — mavjud tishli g'ildirak. Ombor qismlarining ranglari ombor hub'idagidek.
- **Standart panel** (`tab_bar` null): home, customers, tasks, products, sales, warehouse, accounts, employees tartibidan a'zo ocha oladigan birinchi 4 tasi (egasida Bosh sahifa, Mijozlar, Vazifalar, Mahsulotlar).
- Saqlangan sahifalardan a'zo ocha olmaydigani tushib qoladi. Panelda 0–4 sahifa bo'lishi mumkin (enwin'dagidek).

### Panel (`components/shell/tab-bar.tsx`)

- Tor ekranda (768px gacha): a'zoning sahifalari o'z tartibida, oxirida doim «Sozlama» tugmasi (`aria-haspopup="dialog"`, `aria-expanded`). Tugma eni, linza, shisha — o'zgarmaydi (ko'pi bilan 5 tugma).
- **Joriy tugma:** sahifaning o'zi panelda bo'lsa o'sha; «Ombor» hub'i o'z qismlarida ham joriy (qism o'zi panelda bo'lmasa); boshqa hollarda linza «Sozlama» ostida (enwin'ning «⋯» kabi).
- Panel **menyuning har sahifasida** ko'rinadi (`isMenuPath`): bosh sahifa, bo'limlar, segment tablari, ombor va sozlamalar hub'lari va ularning qismlari. Qismlardagi «‹ Ombor» / «‹ Sozlamalar» havolasi va Telegram BackButton qoladi (`isRootPath` o'zgarmaydi). Yozuv, forma va profil sahifasida panel avvalgidek yashirinadi. `AppShell` ning `pb-bar` joyi ham `isMenuPath` bo'yicha.
- Panel tugmasi va varaq plitkasi sahifani sirpantirmasdan almashtiradi (`moveTo(undefined)`).

### «Sozlama» varag'i (`components/shell/menu-sheet.tsx`)

- Varaq (`Dialog`, `tall`): sarlavha «Sozlama», tagida kompaniya nomi. Ochilganda fokus varaqning o'zida (telefon klaviaturasi ko'tarilmaydi).
- Qidiruv (`SearchBox`, `delay=0`) sahifa nomi bo'yicha, apostroflarsiz ham topadi (picker'ning `norm`); varaq yopilganda tozalanadi; topilmasa «Hech narsa topilmadi».
- Plitkalar: guruhsizlar, keyin «Mahsulotlar», «Ombor», «Moliya», «Sozlamalar» sarlavhalari ostida; telefonda 3, `sm` dan 4 ustun. Plitka: karta, rangli `TileIcon`, nom (2 qatorgacha). Joriy sahifa belgilangan (`aria-current`), paneldagilarda kichik pin («Pastki panelda»). Bosilsa sahifa ochiladi, varaq yopiladi.
- Pastda «Pastki panelni sozlash» qatori: shu varaqni yopib, sozlash varag'ini ochadi.

### «Pastki panel» varag'i (`components/shell/tab-bar-sheet.tsx`)

- Izoh: «Panelda 4 tagacha sahifa turadi, qolganlari «Sozlama» ichida. Tartibini tutqichdan sudrab o'zgartiring.»
- «Panelda · n/4» sarlavhasi, o'ngida «Standart». Ro'yxat — `SortableList` (sudrash, strelkalar, ovozli e'lon): tutqich, belgi, nom, qizil «−» («Olib tashlash: …»). Bo'sh: «Panelda sahifa yo'q — pastdagi ro'yxatdan qo'shing.»
- «Qo'shish»: qolgan sahifalar guruhlari bilan, har birida «+» («Qo'shish: …»); panel to'lganda «+» o'chiq va izoh «Ko'pi bilan 4 ta sahifa — yangisini qo'shish uchun avval birini olib tashlang.»
- `MainButton` «Saqlash» → toast «Pastki panel saqlandi», varaq yopiladi; xato `Refusal` bilan. ✕ saqlamasdan yopadi. Qoralama har ochilishda saqlangan paneldan boshlanadi; «Standart» tanlanib o'zgartirilmasa `null` yuboriladi.

### Boshqa ekranlar

- Sidebar: bo'limlar standart tartibda (`navFor` tartibsiz).
- Profil sahifasi: «Bo'limlar» guruhi va «Pastki menyu» qatori yo'q; «Ilova» guruhida brauzerda «Mavzu», Mini App'da guruh yo'q.
- Bosh sahifa: telefondagi «Bo'limlar» qatorlari yo'q.
- `/profile/menu` va `MenuOrderPage` o'chiriladi.

### API va DB

- Migratsiya `00017_tab_bar.sql`: `user_companies.tab_bar TEXT[]` (NULL — standart), `nav_order` o'chiriladi; Down teskarisi.
- `internal/user`: `TabBarPages` (16 kalit, standart tartibda), `TabBarLimit = 4`, `ParseTabBar`: noma'lum kalit — 400 «Sahifa noto'g'ri»; takror bir marta; takrorsiz 4 tadan ko'p — 400 «Panelda ko'pi bilan 4 ta sahifa»; `[]` ham panel.
- `PUT /app/me/tab-bar {pages: string[] | null}` → 200 `Me` (`PUT /app/me/nav` o'rniga); `/app/me` da `tab_bar` (`nav_order` o'rniga). Ruxsatni client hisobga oladi (avvalgidek).
- `openapi.yaml`: `TabBarPage`, `TabBarInput`, `Me.tab_bar`; `NavSection`, `NavOrderInput`, nav endpoint'i o'chiriladi; `packages/api-client` qayta generatsiya.

## Testlar

- Go: `ParseTabBar` (table-driven), migratsiya (NULL, `nav_order` yo'q, Down), `TestSetTabBar` (pgtest: saqlanadi, `/app/me`, takror, noma'lum, 5 ta, `[]`, `null`, kompaniyasiz 403).
- Vitest: `lib/nav` (standart, ruxsat filtri, 4 chegarasi, joriy tugma, `isMenuPath`), `TabBar`, `MenuSheet`, `TabBarSheet`, profil, bosh sahifa, `AppShell`, belgilar.
- Playwright (375px + desktop): panel 4 + «Sozlama», varaqda qidiruv va plitka, sozlash (olib tashlash, qo'shish, saqlash, qayta yuklash, «Standart»); `openSection` yordamchisi panel yoki «Sozlama» varag'i orqali.
- Olib tashlangan xatti-harakatning testlari (`nav_order`, `/profile/menu`, «Bo'limlar» ro'yxatlari) funksiya bilan birga ketadi.

### Rad etilgan variantlar

- Bosh sahifa qulflangan (Bosh sahifa + 3): foydalanuvchi «4ta buttonni o'zgartirish» dedi.
- «Sozlama» o'rniga `/menu` ildiz sahifasi (iOS «More» tabi): foydalanuvchi enwin'dagi varaqni tanladi.
- «Yana» ⋯ yoki «Menyu» ☰ nomi: foydalanuvchi «Sozlama» ⚙ ni tanladi.
- Faqat bo'limlar (API o'zgarmasdan): foydalanuvchi ichki sahifalarni ham tanladi.
- Sidebar tartibini keng ekranda saqlab qolish (ikkita sozlama): foydalanuvchi olib tashlashni tanladi.

## Amalga oshirishda belgilangan qarorlar

1. **Pin havola nomini o'zgartirmaydi.** Paneldagi sahifa plitkasining pini bezak (`aria-hidden`); «Pastki panelda» havolaga `aria-describedby` bilan (bitta yashirin matn) beriladi: havola nomi sahifa nomi bo'lib qoladi.
2. **Telefonda sozlamalar hub'i** (`/settings`) varaqda plitka emas: uning qismlari plitka. Hub'ga qism sahifasining «‹ Sozlamalar» havolasi olib boradi (panel u yerda ham ko'rinadi, «Sozlama» belgilangan). e2e `openSection("Sozlamalar")` telefonda shu yo'l bilan yuradi; «Moliya» — «Kassa» plitkasi orqali.
3. **Umumiy qismlar:** guruhlash `pageGroups` (`lib/nav.ts`) «Sozlama» va «Pastki panel» uchun bitta; apostrofsiz solishtirish `norm` picker'dan `lib/utils.ts` ga ko'chdi (picker va «Sozlama» qidiruvi bitta); sahifa ranglari `pageColors` (`kit/tile-icon.tsx`), belgilari `pageIcons` (`kit/tab-icons.tsx`).
4. **Telegram BackButton qoidasi o'zgarmadi** (`isRootPath`): ombor va sozlamalar qismlarida panel ham, «‹ …» havolasi va BackButton ham bor; sirpanish yo'nalishi (`stepInto`) ham o'zgarmadi (hub → qism oldinga).
5. **«Standart»** standart panelda o'chiq; bo'sh guruh (ruxsat yo'q yoki hammasi panelda) chiqmaydi.
6. **Testlar.** Olib tashlangan xatti-harakatning testlari almashtirildi: `TestNavSections`, `TestParseNavOrder`, `TestSetNavOrder` (app) → `TestTabBarPages`, `TestParseTabBar`, `TestSetTabBar`; service va DB testlari (`TestSetNavOrder`, `TestGetCompanyAccessTellsTheMembersOrderOfTheMenu`) `tab_bar` nomlariga o'tdi; `TestAMembershipKeepsTheMembersOrderOfTheMenu` (00012) ustun hali bor 16-versiyaga bog'landi; web'da `menu-order-page.test.tsx` o'chirildi, nav / tab-bar / sidebar / profil / bosh sahifa / AppShell / mock testlarining `nav_order` va «Bo'limlar» qismlari yangi xatti-harakatga almashtirildi.
7. **Lokal muhit:** `go test ./...` hamma paketni parallel yurgizganda lokal Postgres'ning 100 ulanishi tugab, aloqasiz testlar `SQLSTATE 53300` bilan tasodifan yiqiladi; tekshiruv `go test -p 4 ./...` bilan.
