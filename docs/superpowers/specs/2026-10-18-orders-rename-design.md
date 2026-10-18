# «Vazifa» → «Buyurtma» — dizayn

Sana: 2026-10-18. Holat: foydalanuvchi reja sifatida tasdiqlagan (savol-javob bilan), amalga oshirilgan (2026-10-18, to'rt bosqich, `dev` branch).

## Kontekst

Foydalanuvchining so'zlari: "«Vazifa» -> «Buyurtma» ga o'zgartirib ber".

«Vazifalar» bo'limi (bosqichlar, kanban, turlar va maydonlar, mas'ul, tarix) endi «Buyurtmalar» deb ataladi. Bo'limning qoidalari o'zgarmaydi, faqat nomi o'zgaradi: [`logic/orders.md`](../../../logic/orders.md) (ilgari `logic/tasks.md`). Bo'limning asl dizayni: `2026-10-06-tasks-design.md`.

Bu `docs/SPEC.md` da yo'q ish, foydalanuvchi so'rovi bilan.

## Foydalanuvchi qarorlari (2026-10-18)

| # | Savol | Qaror |
|---|---|---|
| 1 | Nima o'zgaradi | **To'liq:** UI matnlari, API xabarlari, kod nomlari, API yo'llari, jadvallar, ruxsat va tab-bar kalitlari, sahifa manzillari. |
| 2 | Har kompaniyaga beriladigan tayyor «Vazifa» turi | **Yangi + mavjud:** yangi kompaniya «Buyurtma» turi bilan boshlaydi; mavjud kompaniyalarning «Vazifa» turini migratsiya «Buyurtma» deb ataydi. |
| 3 | Eski manzillar (xatcho'p, brauzer tarixi) | **Yangisiga yo'naltiriladi** (doimiy, 308). |

## Nomlash qoidalari

| Nima | Eski | Yangi |
|---|---|---|
| UI so'zi | Vazifa, vazifalar, vazifani, vazifasi… | Buyurtma, buyurtmalar, buyurtmani, buyurtmasi… (ikkalasi ham «a» bilan tugaydi: qo'shimchalar bir xil) |
| Kod | `task` / `Task` / `tasks` | `order` / `Order` / `orders` |
| Go paket | `internal/task` | `internal/order` |
| Tartiblash fe'li | `OrderTaskTypes`, `orderTaskStages`, `task.Service.OrderTypes`, `orderBody` | `ReorderOrderTypes`, `reorderOrderStages`, `order.Service.ReorderTypes`, `reorderBody`: «order» buyurtma bilan adashmasin. REST naqshi saqlangan: `PUT /app/order-types/order` |
| Jadvallar | `tasks`, `task_types`, `task_stages`, `task_fields`, `task_values`, `task_history`; `task_id` | `orders`, `order_types`, `order_stages`, `order_fields`, `order_values`, `order_history`; `order_id` (indeks, constraint, sequence nomlari ham) |
| API | `/app/tasks*`, `/app/task-types*`, `/app/task-stages*`; dashboard `tasks`; admin `tasks_count` | `/app/orders*`, `/app/order-types*`, `/app/order-stages*`; `orders`; `orders_count` |
| OpenAPI | `Task`, `TaskType`, `TaskStage`, … `DashboardTasks` | `Order`, `OrderType`, `OrderStage`, … `DashboardOrders` |
| Ruxsatlar | `tasks.view/create/edit/delete/history` | `orders.*` |
| Kalitlar | nav va tab-bar sahifasi `tasks`, sozlama qismi `tasks` | `orders` |
| Sahifalar | `/tasks`, `/tasks/[id]`, `/settings/task-types`, `/settings/task-types/[id]` | `/orders`, `/orders/[id]`, `/settings/order-types`, `/settings/order-types/[id]` |
| Brauzer (localStorage) | `tasks_view:*`, `tasks_board_open:*` | `orders_view:*`, `orders_board_open:*` |
| Tayyor tur | «Vazifa» | «Buyurtma» |

O'zgarmagan: tarixiy migratsiyalar 00007, 00008, 00010 va ularni eski versiyada tekshiradigan testlar; «Vazifasi» so'zi «maqsadi» ma'nosida (`README.md` jadval sarlavhasi, `docs/design/README.md`); sanali spec va plan'lar; `docs/design` skrinshotlari va ularning fayl nomlari; ikonkalar.

## Bazadagi o'zgarishlar

- **00018_orders.** Oltita jadval, ikkita `task_id` ustuni, 22 indeks, 28 constraint va 5 sequence qayta nomlanadi; qatorlar o'z joyida qoladi. Down hammasini qaytaradi.
- **00019_order_keys.** Har rolning `tasks.*` ruxsatlari `orders.*` bo'ladi, o'z o'rnida (rol avvalgi narsalarga ruxsat beradi); a'zolarning tanlangan pastki panelidagi `tasks` sahifasi `orders` bo'ladi. Down qaytaradi.
- **00020_order_type.** Kompaniyaning jonli «Vazifa» turi «Buyurtma» deb ataladi, agar kompaniyada jonli «Buyurtma» (har qanday registrda) bo'lmasa; o'chirilgan tur nomi o'zgarmaydi. Down hech narsa qilmaydi: qaysi «Buyurtma» avval «Vazifa» bo'lgani saqlanmaydi.

Ruxsatlar har so'rovda bazadan o'qiladi (`requireAccess`), shuning uchun eski access token'lar 00019 dan keyin ham to'g'ri ishlaydi.

## Amalga oshirishda belgilangan qarorlar

- **Testlarning o'z turi «Montaj».** Mock'lar va testlar standart turdan tashqari «Buyurtma» nomli tur qo'shardi; endi standart tur shu nomda, shuning uchun ularniki «Montaj» (`seedMontajType`). «Yetkazish» tanlanmadi: mock katalogida shu nomli xizmat bor. Go testlarida bunday to'qnashuv yo'q (test kompaniyalari seed'siz yaratiladi), ular o'zgartirilmadi.
- **Buyurtma turlari varag'idagi misollar** «Masalan: Ta'mir, Yetkazib berish», placeholder «Masalan, Ta'mir» (ilgari «Buyurtma, Shikoyat»).
- **Eski manzillar:** `next.config.ts` dagi `redirects()`: `/tasks/:path*` → `/orders/:path*`, `/settings/task-types/:path*` → `/settings/order-types/:path*` (308, so'rov parametrlari bilan). Sozlamalarning eski `?tab=tasks` manzili ham buyurtma turlarini ochadi (`oldTabHref`).
- **Brauzerdagi tanlov:** kalitlar o'zgargani uchun kanban/ro'yxat tanlovi va yakuniy ustun holati bir marta standartga qaytadi.
- **Generatsiya qilingan kod** (`db/gen`, `packages/api-client`) qo'lda tahrirlanmadi: `make sqlc` va `make api-client` bilan qayta yaratildi.
