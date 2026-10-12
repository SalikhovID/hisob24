import { api, call } from "@/lib/api"
import type { InventoryCreate, OpeningInput, OpeningStockCreate, SaleCreate, TransferCreate } from "@/lib/types"

// The stock documents a test enters through the mocked API, as a signed-in
// member would, before it renders a page about them.
export const enterTransfer = (body: TransferCreate) => call(api.POST("/app/transfers", { body }))
export const enterInventory = (body: InventoryCreate) => call(api.POST("/app/inventories", { body }))
export const enterOpeningStock = (body: OpeningStockCreate) => call(api.POST("/app/opening-stock", { body }))
export const enterOpening = (supplierId: number, body: OpeningInput) => call(api.POST("/app/suppliers/{id}/openings", { params: { path: { id: supplierId } }, body }))
export const enterSale = (body: SaleCreate) => call(api.POST("/app/sales", { body }))
