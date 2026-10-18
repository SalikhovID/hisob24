// The stock documents besides the purchases of the mock API: the transfers,
// the inventories and the opening stock in the journal, the stock of a
// location at a moment, a product's moves, and the opening balances of a
// supplier, under the Go API's rules (logic/warehouse.md, sections 5 and
// 6; backend/internal/warehouse).
import { http, HttpResponse } from "msw"
import type { Inventory, InventoryDetail, InventoryItem, Opening, OpeningStock, OpeningStockDetail, ProductMove, SaleDetail, StockRow, Transfer, TransferDetail, TransferItem } from "@/lib/types"
import { nameOf } from "./customers"
import { customerNameOf, db, type DocumentKind, type ItemRow, nameIn, nextId, now, type ProductRow, type TransactionRow } from "./data"
import { api, fail, forbidden, permittedSession } from "./gate"
import {
  asAmount,
  asQuantity,
  asRate,
  atOf,
  checkStock,
  convertAmount,
  itemsOf,
  type Line,
  liveDocuments,
  money,
  movesOf,
  nextNumber,
  priceIn,
  type Pricing,
  quantityPattern,
  rateColumn,
  rateOf,
  round,
  takeMoves,
} from "./ledger"
import { liveSupplier, locationParam, memberLocationIds, page, paged, pricingOf, toItem, trimmed } from "./warehouse"

const invalid = (message: string) => fail(400, "validation_error", message)
const transferNotFound = () => fail(404, "not_found", "Ko'chirish topilmadi")
const inventoryNotFound = () => fail(404, "not_found", "Inventarizatsiya topilmadi")
const documentNotFound = () => fail(404, "not_found", "Hujjat topilmadi")
const supplierNotFound = () => fail(404, "not_found", "Ta'minotchi topilmadi")

// scopeOf is the locations a list is of: the member's, or the one asked for.
export const scopeOf = (allowed: number[], locationId: number) => (locationId === 0 ? allowed : [locationId])

export const newestFirst = (a: TransactionRow, b: TransactionRow) => Date.parse(b.at) - Date.parse(a.at) || b.id - a.id

export const locationNamed = (id: number | null) => db.locations.find((l) => l.id === id)?.name ?? ""
const productOf = (id: number) => db.products.find((p) => p.id === id)

// newDocument is a journal row of the kind, numbered next among its kind,
// as the member with phone by enters it.
export function newDocument(kind: DocumentKind, companyId: number, by: string, fields: Partial<TransactionRow>): TransactionRow {
  const at = now()
  return {
    id: nextId(),
    companyId,
    kind,
    number: nextNumber(companyId, kind),
    at: "",
    locationId: null,
    toLocationId: null,
    supplierId: null,
    customerId: null,
    bankAccountId: null,
    toBankAccountId: null,
    categoryId: null,
    linkedId: null,
    currencyId: 1,
    rateId: 0,
    total: 0,
    toTotal: null,
    note: null,
    by,
    byName: nameIn(by, companyId),
    createdAt: at,
    updatedAt: at,
    ...fields,
  }
}

// enter keeps the new document when its lines are written, and drops it
// with everything written when they are refused.
export function enter(doc: TransactionRow, write: () => Response | null, shown: () => TransferDetail | InventoryDetail | OpeningStockDetail | SaleDetail): Response {
  db.transactions.push(doc)
  const refusal = write()
  if (refusal) {
    takeMoves(doc.id)
    db.items = db.items.filter((i) => i.transactionId !== doc.id)
    db.transactions = db.transactions.filter((t) => t.id !== doc.id && t.linkedId !== doc.id)
    return refusal
  }
  return HttpResponse.json(shown(), { status: 201 })
}

export type LineRule = { allowNone?: boolean; allowZero?: boolean; withPrice?: boolean; allowService?: boolean }
export type CheckedLine = { productId: number; quantity: number; price: number | null }

// checkLines reads the lines of a goods document as the Go API does: at
// least one; each product one of the company's, a product not a service,
// active unless held already, once; its quantity (counted, in an
// inventory, 0 allowed); its price where the kind has one.
export function checkLines(companyId: number, raw: unknown, held: number[], rule: LineRule): CheckedLine[] | Response {
  const lines = Array.isArray(raw) ? (raw as Record<string, unknown>[]) : []
  if (lines.length === 0 && !rule.allowNone) return invalid("Kamida bitta mahsulot qo'shing")
  const items: CheckedLine[] = []
  const seen = new Set<number>()
  for (const line of lines) {
    const productId = Number(line.product_id ?? 0)
    const product: ProductRow | undefined = productId ? db.products.find((p) => p.id === productId && p.companyId === companyId && !p.deleted) : undefined
    if (!product) return invalid("Mahsulotni tanlang")
    if (product.kind !== "product" && !rule.allowService) return invalid("Xizmat ombor hujjatiga kiritilmaydi")
    if (!product.active && !held.includes(product.id)) return invalid("Mahsulot nofaol")
    if (seen.has(product.id)) return invalid(`«${product.name}» ikki marta kiritilgan`)
    seen.add(product.id)
    const quantity = rule.allowZero ? line.counted : line.quantity
    if (typeof quantity !== "string" || !quantityPattern.test(quantity) || (!rule.allowZero && Number(quantity) === 0)) return invalid(`«${product.name}» miqdori noto'g'ri`)
    let price: number | null = null
    if (rule.withPrice) {
      if (typeof line.price !== "string" || !money.test(line.price)) return invalid(`«${product.name}» narxi noto'g'ri`)
      price = Number(line.price)
    }
    items.push({ productId: product.id, quantity: Number(quantity), price })
  }
  return items
}

export const checkNote = (raw: unknown): string | null | Response => {
  const note = trimmed(raw)
  return note !== null && [...note].length > 500 ? invalid("Izoh 500 belgidan oshmasin") : note
}

// stockAt is the stock of each product in the location at the moment: the
// moves of the live documents at or before it, the document given left out.
function stockAt(locationId: number, at: string, excludeId = 0): Map<number, number> {
  const stock = new Map<number, number>()
  for (const m of db.moves) {
    if (m.locationId !== locationId) continue
    const t = db.transactions.find((x) => x.id === m.transactionId)!
    if (t.id === excludeId || t.deleted || Date.parse(t.at) > Date.parse(at)) continue
    stock.set(m.productId, round((stock.get(m.productId) ?? 0) + m.quantity, 3))
  }
  return stock
}

// writeGoods replaces the document's lines (an inventory's with what the
// journal expected at its moment), its total where the kind has one, and
// its moves, and checks the stock of the locations for the products of
// the old lines and the new; a refusal puts everything back.
export function writeGoods(doc: TransactionRow, items: CheckedLine[], locations: number[]): Response | null {
  const wasItems = itemsOf(doc.id)
  const wasMoves = takeMoves(doc.id)
  const wasTotal = doc.total
  db.items = db.items.filter((i) => i.transactionId !== doc.id)
  const expected = doc.kind === "inventory" ? stockAt(doc.locationId!, doc.at, doc.id) : new Map<number, number>()
  const lines: Line[] = []
  items.forEach((it, index) => {
    const e = doc.kind === "inventory" ? (expected.get(it.productId) ?? 0) : null
    db.items.push({ transactionId: doc.id, productId: it.productId, quantity: it.quantity, expected: e, price: it.price, position: index + 1 })
    lines.push({ productId: it.productId, quantity: it.quantity, expected: e ?? undefined })
  })
  if (doc.kind === "opening_stock" || doc.kind === "sale") doc.total = round(items.reduce((sum, i) => sum + round(i.quantity * (i.price ?? 0), 2), 0), 2)
  // A service moves nothing.
  const moving = lines.filter((l) => db.products.find((p) => p.id === l.productId)?.kind === "product")
  db.moves.push(...movesOf(doc.kind, doc.companyId, doc.id, doc.locationId!, doc.toLocationId, moving))
  const refusal = checkStock([...new Set(locations)], [...new Set([...wasItems.map((i) => i.productId), ...items.map((i) => i.productId)])])
  if (refusal) {
    takeMoves(doc.id)
    db.moves.push(...wasMoves)
    db.items = db.items.filter((i) => i.transactionId !== doc.id)
    db.items.push(...wasItems)
    doc.total = wasTotal
    return refusal
  }
  return null
}

// deleteGoods hides the document and takes its moves back; the locations
// have to stay above zero.
export function deleteGoods(doc: TransactionRow, locations: number[]): Response | null {
  const wasMoves = takeMoves(doc.id)
  const refusal = checkStock([...new Set(locations)], itemsOf(doc.id).map((i) => i.productId))
  if (refusal) {
    db.moves.push(...wasMoves)
    return refusal
  }
  doc.deleted = true
  return null
}

// A session with the permission, with the locations the member works in.
export function scoped(request: Request, permission: Parameters<typeof permittedSession>[1]) {
  const member = permittedSession(request, permission)
  if (member instanceof Response) return member
  return { ...member, allowed: memberLocationIds(member.phone, member.companyId) }
}

// entryLocation reads the location a document is entered into: none is
// refused, one the member may not work in too.
export function entryLocation(body: Record<string, unknown>, allowed: number[]): number | Response {
  const locationId = Number(body.location_id ?? 0)
  if (!locationId) return invalid("Lokatsiyani tanlang")
  if (!allowed.includes(locationId)) return forbidden()
  return locationId
}

const head = (t: TransactionRow) => ({
  id: t.id,
  number: t.number,
  location_id: t.locationId!,
  location_name: locationNamed(t.locationId),
  at: t.at,
  note: t.note,
  items_count: itemsOf(t.id).length,
  created_by_name: nameOf(t.by, t.companyId, t.byName),
  created_at: t.createdAt,
  updated_at: t.updatedAt,
})

// Transfers (logic/warehouse.md, 5.1).

const toTransfer = (t: TransactionRow): Transfer => ({ ...head(t), to_location_id: t.toLocationId!, to_location_name: locationNamed(t.toLocationId) })
const toTransferItem = (i: ItemRow): TransferItem => ({ product_id: i.productId, name: productOf(i.productId)?.name ?? "", unit: productOf(i.productId)?.unit ?? null, quantity: asQuantity(i.quantity) })
const toTransferDetail = (t: TransactionRow): TransferDetail => ({ ...toTransfer(t), items: itemsOf(t.id).map(toTransferItem) })

type CheckedTransfer = { toLocationId: number; at: string; note: string | null; items: CheckedLine[] }

// checkTransfer reads a body in the Go API's order: the other location
// (one of the company's live ones, not the source), the moment, the note,
// the lines.
function checkTransfer(companyId: number, locationId: number, body: Record<string, unknown>, held: number[]): CheckedTransfer | Response {
  const toLocationId = Number(body.to_location_id ?? 0)
  const to = toLocationId ? db.locations.find((l) => l.id === toLocationId && l.companyId === companyId && !l.deleted) : undefined
  if (!to) return invalid("Maqsad lokatsiyani tanlang")
  if (to.id === locationId) return invalid("Maqsad lokatsiya boshqa bo'lsin")
  const at = atOf(body.at)
  if (at instanceof Response) return at
  const note = checkNote(body.note)
  if (note instanceof Response) return note
  const items = checkLines(companyId, body.items, held, {})
  if (items instanceof Response) return items
  return { toLocationId: to.id, at, note, items }
}

// transferIn is the live transfer out of or into one of the locations.
const transferIn = (companyId: number, id: unknown, ids: number[]) =>
  liveDocuments(companyId).find((t) => t.kind === "transfer" && t.id === Number(id) && (ids.includes(t.locationId!) || ids.includes(t.toLocationId!)))

// Inventories (logic/warehouse.md, 5.2).

const toInventory = (t: TransactionRow): Inventory => head(t)
const toInventoryItem = (i: ItemRow): InventoryItem => ({
  product_id: i.productId,
  name: productOf(i.productId)?.name ?? "",
  unit: productOf(i.productId)?.unit ?? null,
  expected: asQuantity(i.expected ?? 0),
  counted: asQuantity(i.quantity),
  difference: asQuantity(round(i.quantity - (i.expected ?? 0), 3)),
})
const toInventoryDetail = (t: TransactionRow): InventoryDetail => ({ ...toInventory(t), items: itemsOf(t.id).map(toInventoryItem) })

type CheckedInventory = { at: string; note: string | null; items: CheckedLine[] }

function checkInventory(companyId: number, body: Record<string, unknown>, held: number[]): CheckedInventory | Response {
  const at = atOf(body.at)
  if (at instanceof Response) return at
  const note = checkNote(body.note)
  if (note instanceof Response) return note
  const items = checkLines(companyId, body.items, held, { allowZero: true })
  if (items instanceof Response) return items
  return { at, note, items }
}

// Opening stock (logic/warehouse.md, 5.3).

function toOpeningStock(t: TransactionRow): OpeningStock {
  const rate = rateOf(t.rateId)
  return { ...head(t), currency_id: t.currencyId, rate: asRate(rateColumn(rate, t.currencyId)), total: asAmount(t.total), total_uzs: asAmount(convertAmount(t.total, t.currencyId, 1, rate)) }
}
const toOpeningStockDetail = (t: TransactionRow): OpeningStockDetail => ({ ...toOpeningStock(t), items: itemsOf(t.id).map(toItem) })

type CheckedOpeningStock = { at: string; pricing: Pricing; note: string | null; items: CheckedLine[] }

function checkOpeningStock(companyId: number, body: Record<string, unknown>, by: string, held: number[], current?: Pricing): CheckedOpeningStock | Response {
  const at = atOf(body.at)
  if (at instanceof Response) return at
  const pricing = priceIn(companyId, body, at, by, current)
  if (pricing instanceof Response) return pricing
  const note = checkNote(body.note)
  if (note instanceof Response) return note
  const items = checkLines(companyId, body.items, held, { withPrice: true })
  if (items instanceof Response) return items
  return { at, pricing, note, items }
}

// documentIn is the live document of the kind in one of the locations.
export const documentIn = (companyId: number, kind: DocumentKind, id: unknown, ids: number[]) =>
  liveDocuments(companyId).find((t) => t.kind === kind && t.id === Number(id) && ids.includes(t.locationId!))

// The opening balances of a supplier (logic/warehouse.md, section 6).

function toOpening(t: TransactionRow): Opening {
  const rate = rateOf(t.rateId)
  return {
    id: t.id,
    kind: t.kind === "supplier_prepay" ? "prepay" : "debt",
    supplier_id: t.supplierId!,
    amount: asAmount(t.total),
    currency_id: t.currencyId,
    rate: asRate(rateColumn(rate, t.currencyId)),
    amount_uzs: asAmount(convertAmount(t.total, t.currencyId, 1, rate)),
    at: t.at,
    note: t.note,
    created_by_name: nameOf(t.by, t.companyId, t.byName),
    created_at: t.createdAt,
    updated_at: t.updatedAt,
  }
}

type CheckedOpening = { kind: DocumentKind; amount: number; at: string; pricing: Pricing; note: string | null }

// checkOpening reads a body in the Go API's order: the kind, the amount,
// the moment, the currency and rate, the note.
export function checkOpening(companyId: number, body: Record<string, unknown>, by: string, current?: Pricing): CheckedOpening | Response {
  const kind = body.kind
  if (kind === undefined || kind === null || kind === "") return invalid("Turni tanlang")
  if (kind !== "debt" && kind !== "prepay") return invalid("Tur noto'g'ri")
  const raw = body.amount
  if (raw === undefined || raw === null || raw === "") return invalid("Summani kiriting")
  if (typeof raw !== "string" || !money.test(raw) || Number(raw) === 0) return invalid("Summa noto'g'ri")
  const at = atOf(body.at)
  if (at instanceof Response) return at
  const pricing = priceIn(companyId, body, at, by, current)
  if (pricing instanceof Response) return pricing
  const note = checkNote(body.note)
  if (note instanceof Response) return note
  return { kind: kind === "debt" ? "supplier_debt" : "supplier_prepay", amount: Number(raw), at, pricing, note }
}

const openingOf = (companyId: number, supplierId: number, id: unknown) =>
  liveDocuments(companyId).find((t) => t.id === Number(id) && t.supplierId === supplierId && (t.kind === "supplier_debt" || t.kind === "supplier_prepay"))

export const stockHandlers = [
  http.get(api("/app/transfers"), ({ request }) => {
    const member = scoped(request, "stock.view")
    if (member instanceof Response) return member
    const query = new URL(request.url).searchParams
    const locationId = locationParam(query, member.allowed)
    if (locationId instanceof Response) return locationId
    const n = page(query)
    if (n instanceof Response) return n
    const ids = scopeOf(member.allowed, locationId)
    const all = liveDocuments(member.companyId)
      .filter((t) => t.kind === "transfer" && (ids.includes(t.locationId!) || ids.includes(t.toLocationId!)))
      .sort(newestFirst)
    return HttpResponse.json(paged(all.map(toTransfer), n))
  }),

  http.post(api("/app/transfers"), async ({ request }) => {
    const member = scoped(request, "stock.create")
    if (member instanceof Response) return member
    const body = (await request.json()) as Record<string, unknown>
    const locationId = entryLocation(body, member.allowed)
    if (locationId instanceof Response) return locationId
    const c = checkTransfer(member.companyId, locationId, body, [])
    if (c instanceof Response) return c
    const pricing = priceIn(member.companyId, {}, c.at, member.phone)
    if (pricing instanceof Response) return pricing
    const doc = newDocument("transfer", member.companyId, member.phone, { at: c.at, locationId, toLocationId: c.toLocationId, currencyId: pricing.currencyId, rateId: pricing.rateId, note: c.note })
    return enter(
      doc,
      () => writeGoods(doc, c.items, [locationId, c.toLocationId]),
      () => toTransferDetail(doc),
    )
  }),

  http.get(api("/app/transfers/:id"), ({ params, request }) => {
    const member = scoped(request, "stock.view")
    if (member instanceof Response) return member
    const t = transferIn(member.companyId, params.id, member.allowed)
    return t ? HttpResponse.json(toTransferDetail(t)) : transferNotFound()
  }),

  http.put(api("/app/transfers/:id"), async ({ params, request }) => {
    const member = scoped(request, "stock.edit")
    if (member instanceof Response) return member
    const t = transferIn(member.companyId, params.id, member.allowed)
    if (!t) return transferNotFound()
    if (!member.allowed.includes(t.locationId!)) return forbidden()
    const body = (await request.json()) as Record<string, unknown>
    const c = checkTransfer(member.companyId, t.locationId!, body, itemsOf(t.id).map((i) => i.productId))
    if (c instanceof Response) return c
    const was = { toLocationId: t.toLocationId, at: t.at, note: t.note, updatedAt: t.updatedAt }
    Object.assign(t, { toLocationId: c.toLocationId, at: c.at, note: c.note, updatedAt: now() })
    const refusal = writeGoods(t, c.items, [t.locationId!, c.toLocationId, was.toLocationId!])
    if (refusal) {
      Object.assign(t, was)
      return refusal
    }
    return HttpResponse.json(toTransferDetail(t))
  }),

  http.delete(api("/app/transfers/:id"), ({ params, request }) => {
    const member = scoped(request, "stock.delete")
    if (member instanceof Response) return member
    const t = transferIn(member.companyId, params.id, member.allowed)
    if (!t) return transferNotFound()
    if (!member.allowed.includes(t.locationId!)) return forbidden()
    return deleteGoods(t, [t.locationId!, t.toLocationId!]) ?? new HttpResponse(null, { status: 204 })
  }),

  http.get(api("/app/inventories"), ({ request }) => {
    const member = scoped(request, "stock.view")
    if (member instanceof Response) return member
    const query = new URL(request.url).searchParams
    const locationId = locationParam(query, member.allowed)
    if (locationId instanceof Response) return locationId
    const n = page(query)
    if (n instanceof Response) return n
    const ids = scopeOf(member.allowed, locationId)
    const all = liveDocuments(member.companyId)
      .filter((t) => t.kind === "inventory" && ids.includes(t.locationId!))
      .sort(newestFirst)
    return HttpResponse.json(paged(all.map(toInventory), n))
  }),

  http.post(api("/app/inventories"), async ({ request }) => {
    const member = scoped(request, "stock.create")
    if (member instanceof Response) return member
    const body = (await request.json()) as Record<string, unknown>
    const locationId = entryLocation(body, member.allowed)
    if (locationId instanceof Response) return locationId
    const c = checkInventory(member.companyId, body, [])
    if (c instanceof Response) return c
    const pricing = priceIn(member.companyId, {}, c.at, member.phone)
    if (pricing instanceof Response) return pricing
    const doc = newDocument("inventory", member.companyId, member.phone, { at: c.at, locationId, currencyId: pricing.currencyId, rateId: pricing.rateId, note: c.note })
    return enter(
      doc,
      () => writeGoods(doc, c.items, [locationId]),
      () => toInventoryDetail(doc),
    )
  }),

  http.get(api("/app/inventories/:id"), ({ params, request }) => {
    const member = scoped(request, "stock.view")
    if (member instanceof Response) return member
    const t = documentIn(member.companyId, "inventory", params.id, member.allowed)
    return t ? HttpResponse.json(toInventoryDetail(t)) : inventoryNotFound()
  }),

  http.put(api("/app/inventories/:id"), async ({ params, request }) => {
    const member = scoped(request, "stock.edit")
    if (member instanceof Response) return member
    const t = documentIn(member.companyId, "inventory", params.id, member.allowed)
    if (!t) return inventoryNotFound()
    const body = (await request.json()) as Record<string, unknown>
    const c = checkInventory(member.companyId, body, itemsOf(t.id).map((i) => i.productId))
    if (c instanceof Response) return c
    const was = { at: t.at, note: t.note, updatedAt: t.updatedAt }
    Object.assign(t, { at: c.at, note: c.note, updatedAt: now() })
    const refusal = writeGoods(t, c.items, [t.locationId!])
    if (refusal) {
      Object.assign(t, was)
      return refusal
    }
    return HttpResponse.json(toInventoryDetail(t))
  }),

  http.delete(api("/app/inventories/:id"), ({ params, request }) => {
    const member = scoped(request, "stock.delete")
    if (member instanceof Response) return member
    const t = documentIn(member.companyId, "inventory", params.id, member.allowed)
    if (!t) return inventoryNotFound()
    return deleteGoods(t, [t.locationId!]) ?? new HttpResponse(null, { status: 204 })
  }),

  http.get(api("/app/opening-stock"), ({ request }) => {
    const member = scoped(request, "stock.view")
    if (member instanceof Response) return member
    const query = new URL(request.url).searchParams
    const locationId = locationParam(query, member.allowed)
    if (locationId instanceof Response) return locationId
    const n = page(query)
    if (n instanceof Response) return n
    const ids = scopeOf(member.allowed, locationId)
    const all = liveDocuments(member.companyId)
      .filter((t) => t.kind === "opening_stock" && ids.includes(t.locationId!))
      .sort(newestFirst)
    return HttpResponse.json(paged(all.map(toOpeningStock), n))
  }),

  http.post(api("/app/opening-stock"), async ({ request }) => {
    const member = scoped(request, "stock.create")
    if (member instanceof Response) return member
    const body = (await request.json()) as Record<string, unknown>
    const locationId = entryLocation(body, member.allowed)
    if (locationId instanceof Response) return locationId
    const c = checkOpeningStock(member.companyId, body, member.phone, [])
    if (c instanceof Response) return c
    const doc = newDocument("opening_stock", member.companyId, member.phone, { at: c.at, locationId, currencyId: c.pricing.currencyId, rateId: c.pricing.rateId, note: c.note })
    return enter(
      doc,
      () => writeGoods(doc, c.items, [locationId]),
      () => toOpeningStockDetail(doc),
    )
  }),

  http.get(api("/app/opening-stock/:id"), ({ params, request }) => {
    const member = scoped(request, "stock.view")
    if (member instanceof Response) return member
    const t = documentIn(member.companyId, "opening_stock", params.id, member.allowed)
    return t ? HttpResponse.json(toOpeningStockDetail(t)) : documentNotFound()
  }),

  http.put(api("/app/opening-stock/:id"), async ({ params, request }) => {
    const member = scoped(request, "stock.edit")
    if (member instanceof Response) return member
    const t = documentIn(member.companyId, "opening_stock", params.id, member.allowed)
    if (!t) return documentNotFound()
    const body = (await request.json()) as Record<string, unknown>
    const c = checkOpeningStock(member.companyId, body, member.phone, itemsOf(t.id).map((i) => i.productId), pricingOf(t))
    if (c instanceof Response) return c
    const was = { at: t.at, currencyId: t.currencyId, rateId: t.rateId, note: t.note, updatedAt: t.updatedAt }
    Object.assign(t, { at: c.at, currencyId: c.pricing.currencyId, rateId: c.pricing.rateId, note: c.note, updatedAt: now() })
    const refusal = writeGoods(t, c.items, [t.locationId!])
    if (refusal) {
      Object.assign(t, was)
      return refusal
    }
    return HttpResponse.json(toOpeningStockDetail(t))
  }),

  http.delete(api("/app/opening-stock/:id"), ({ params, request }) => {
    const member = scoped(request, "stock.delete")
    if (member instanceof Response) return member
    const t = documentIn(member.companyId, "opening_stock", params.id, member.allowed)
    if (!t) return documentNotFound()
    return deleteGoods(t, [t.locationId!]) ?? new HttpResponse(null, { status: 204 })
  }),

  // The products in stock in a location at a moment (now unless given), the
  // moves of the document ?exclude_id= left out, by name: what an
  // inventory starts from, or shows while it is edited.
  http.get(api("/app/stock"), ({ request }) => {
    const member = scoped(request, "stock.view")
    if (member instanceof Response) return member
    const query = new URL(request.url).searchParams
    const locationId = locationParam(query, member.allowed)
    if (locationId instanceof Response) return locationId
    if (locationId === 0) return invalid("Lokatsiyani tanlang")
    let at = now()
    if (query.get("at")) {
      const parsed = atOf(query.get("at"))
      if (parsed instanceof Response) return parsed
      at = parsed
    }
    let excludeId = 0
    if (query.get("exclude_id")) {
      excludeId = Number(query.get("exclude_id"))
      if (!Number.isInteger(excludeId) || excludeId <= 0) return invalid("Hujjat noto'g'ri")
    }
    const rows: StockRow[] = [...stockAt(locationId, at, excludeId).entries()]
      .filter(([, quantity]) => quantity !== 0)
      .map(([productId, quantity]) => ({ product_id: productId, name: productOf(productId)?.name ?? "", unit: productOf(productId)?.unit ?? null, quantity: asQuantity(quantity) }))
      .sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()) || a.product_id - b.product_id)
    return HttpResponse.json(rows)
  }),

  // A product's moves in the member's locations, the newest document first
  // (then the later entered), with the counterpart: the supplier, or a
  // transfer's other location.
  http.get(api("/app/products/:id/moves"), ({ params, request }) => {
    const member = scoped(request, "stock.view")
    if (member instanceof Response) return member
    const query = new URL(request.url).searchParams
    const locationId = locationParam(query, member.allowed)
    if (locationId instanceof Response) return locationId
    const n = page(query)
    if (n instanceof Response) return n
    const product = db.products.find((p) => p.id === Number(params.id) && p.companyId === member.companyId && !p.deleted)
    if (!product) return fail(404, "not_found", "Mahsulot topilmadi")
    const ids = scopeOf(member.allowed, locationId)
    const rows = db.moves
      .map((m) => ({ m, t: db.transactions.find((t) => t.id === m.transactionId)! }))
      .filter(({ m, t }) => m.productId === product.id && ids.includes(m.locationId) && !t.deleted)
      .sort((a, b) => newestFirst(a.t, b.t) || b.m.id - a.m.id)
      .map(({ m, t }): ProductMove => {
        const supplier = t.supplierId === null ? undefined : db.suppliers.find((s) => s.id === t.supplierId)
        const customer = t.customerId === null ? undefined : db.customers.find((c) => c.id === t.customerId)
        const counterpart =
          supplier?.name ?? (customer ? (customerNameOf(customer) ?? customer.phone) : null) ?? (t.kind === "transfer" ? locationNamed(m.locationId === t.locationId ? t.toLocationId : t.locationId) : null)
        const order = t.kind === "order" && t.orderId ? db.orders.find((o) => o.id === t.orderId) : undefined
        return {
          id: m.id,
          transaction_id: t.id,
          kind: t.kind as ProductMove["kind"],
          number: t.number,
          at: t.at,
          location_id: m.locationId,
          location_name: locationNamed(m.locationId),
          quantity: asQuantity(m.quantity),
          counterpart,
          order_id: order?.id ?? null,
          order_number: order?.number ?? null,
        }
      })
    return HttpResponse.json(paged(rows, n))
  }),

  http.get(api("/app/suppliers/:id/openings"), ({ params, request }) => {
    const member = permittedSession(request, "purchases.view")
    if (member instanceof Response) return member
    const n = page(new URL(request.url).searchParams)
    if (n instanceof Response) return n
    const supplier = liveSupplier(member.companyId, params.id)
    if (!supplier) return supplierNotFound()
    const all = liveDocuments(member.companyId)
      .filter((t) => t.supplierId === supplier.id && (t.kind === "supplier_debt" || t.kind === "supplier_prepay"))
      .sort(newestFirst)
    return HttpResponse.json(paged(all.map(toOpening), n))
  }),

  http.post(api("/app/suppliers/:id/openings"), async ({ params, request }) => {
    const member = permittedSession(request, "purchases.create")
    if (member instanceof Response) return member
    const supplier = liveSupplier(member.companyId, params.id)
    if (!supplier) return supplierNotFound()
    const body = (await request.json()) as Record<string, unknown>
    const c = checkOpening(member.companyId, body, member.phone)
    if (c instanceof Response) return c
    const doc = newDocument(c.kind, member.companyId, member.phone, { at: c.at, supplierId: supplier.id, currencyId: c.pricing.currencyId, rateId: c.pricing.rateId, total: c.amount, note: c.note })
    db.transactions.push(doc)
    return HttpResponse.json(toOpening(doc), { status: 201 })
  }),

  http.put(api("/app/suppliers/:id/openings/:openingId"), async ({ params, request }) => {
    const member = permittedSession(request, "purchases.edit")
    if (member instanceof Response) return member
    const t = openingOf(member.companyId, Number(params.id), params.openingId)
    if (!t) return documentNotFound()
    const body = (await request.json()) as Record<string, unknown>
    const c = checkOpening(member.companyId, body, member.phone, pricingOf(t))
    if (c instanceof Response) return c
    if (c.kind !== t.kind) return invalid("Tur o'zgartirilmaydi")
    Object.assign(t, { at: c.at, currencyId: c.pricing.currencyId, rateId: c.pricing.rateId, total: c.amount, note: c.note, updatedAt: now() })
    return HttpResponse.json(toOpening(t))
  }),

  http.delete(api("/app/suppliers/:id/openings/:openingId"), ({ params, request }) => {
    const member = permittedSession(request, "purchases.delete")
    if (member instanceof Response) return member
    const t = openingOf(member.companyId, Number(params.id), params.openingId)
    if (!t) return documentNotFound()
    t.deleted = true
    return new HttpResponse(null, { status: 204 })
  }),
]
