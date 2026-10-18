import { api, call } from "@/lib/api"
import type { OrderCreate, OrderDetail } from "@/lib/types"
import { db, type OrderRow, orderTypesOf, seedCatalog, seedOrders, seedWarehouse, stagesOf } from "@/mocks/data"
import { asosiyOf } from "@/test/locations"

// pricedOrder enters, through the mock API as the signed-in member, an
// order for Dilshod in Asosiy with money (logic/orders.md, 4.3): priced at
// 5 000 so'm, 2 kg Olma from the stock (12,5 kg bought at 1 000) and an
// advance of 400 out of the cash; over changes what a test is about.
export async function pricedOrder(over: Partial<OrderCreate> = {}): Promise<{ order: OrderDetail; row: OrderRow; dilshod: { id: number }; olma: { id: number }; cash: number }> {
  const seeded = seedOrders()
  const catalog = seedCatalog()
  seedWarehouse(catalog)
  const [yangi] = stagesOf(1)
  const [buyurtma] = orderTypesOf(1)
  const cash = db.accounts[1][0].id
  const order = await call(
    api.POST("/app/orders", {
      body: {
        type_id: buyurtma.id,
        location_id: asosiyOf(1).id,
        deadline: "2026-10-20",
        stage_id: yangi.id,
        values: {},
        customer: { id: seeded.dilshod.id },
        amount: "5000",
        items: [{ product_id: catalog.olma.id, quantity: "2" }],
        payments: [{ bank_account_id: cash, amount: "400" }],
        ...over,
      },
    }),
  )
  return { order, row: db.orders.find((o) => o.id === order.id)!, dilshod: seeded.dilshod, olma: catalog.olma, cash }
}
