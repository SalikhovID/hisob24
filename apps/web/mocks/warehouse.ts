// The warehouse of the mock API: the suppliers, the purchases into the
// stock of the locations, the payments and what is owed, under the Go API's
// rules (logic/warehouse.md; backend/internal/warehouse).
import { http, HttpResponse } from "msw"
import type { Payment, Purchase, PurchaseDetail, PurchaseItem, Supplier } from "@/lib/types"
import { nameOf } from "./customers"
import { db, locationsOf, nameIn, nextId, now, permissionsOf, type PaymentRow, type ProductRow, type PurchaseItemRow, type PurchaseRow, type SupplierRow } from "./data"
import { api, fail, forbidden, normalizePhone, permittedSession } from "./gate"

const PAGE_SIZE = 20
const money = /^\d{1,12}(\.\d{1,2})?$/
const quantityPattern = /^\d{1,9}(\.\d{1,3})?$/

const invalid = (message: string) => fail(400, "validation_error", message)
const supplierNotFound = () => fail(404, "not_found", "Ta'minotchi topilmadi")
const purchaseNotFound = () => fail(404, "not_found", "Xarid topilmadi")
const paymentNotFound = () => fail(404, "not_found", "To'lov topilmadi")
const paymentLinked = () => fail(409, "payment_linked", "Bu to'lov xarid bilan kiritilgan: xaridni tahrirlang")
const stockInsufficient = () => fail(409, "stock_insufficient", "Omborda yetarli qoldiq yo'q")

// round keeps a number to the column's decimals (the database rounds the
// same way).
const round = (x: number, decimals: number) => Math.round(x * 10 ** decimals) / 10 ** decimals

// asAmount writes an amount as the API does: two decimals. asQuantity a
// quantity: three.
export const asAmount = (x: number) => round(x, 2).toFixed(2)
export const asQuantity = (x: number) => round(x, 3).toFixed(3)

// trimmed is an optional text without the spaces around it, null when
// nothing is left.
function trimmed(raw: unknown): string | null {
  const text = typeof raw === "string" ? raw.trim() : ""
  return text === "" ? null : text
}

// aDay reads a day the client sent, YYYY-MM-DD; a Response when it is
// missing or not a date.
function aDay(raw: unknown): string | Response {
  const text = typeof raw === "string" ? raw.trim() : ""
  if (text === "") return invalid("Sanani kiriting")
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text) || new Date(`${text}T00:00:00Z`).toISOString().slice(0, 10) !== text) return invalid("Sana noto'g'ri")
  return text
}

const page = (query: URLSearchParams): number | Response => {
  const n = query.has("page") ? Number(query.get("page")) : 1
  return Number.isInteger(n) && n >= 1 ? n : invalid("Sahifa raqami noto'g'ri")
}

const paged = <T>(all: T[], n: number) => ({ items: all.slice((n - 1) * PAGE_SIZE, n * PAGE_SIZE), total: all.length, page: n, page_size: PAGE_SIZE })

// memberLocationIds are the locations the member works in.
export const memberLocationIds = (phone: string, companyId: number) => locationsOf(phone, companyId).map((l) => l.id)

// locationParam reads ?location_id=: 0 when it is not given; a Response when
// it is not a number (400) or not one of the member's (403).
export function locationParam(query: URLSearchParams, allowed: number[]): number | Response {
  if (!query.has("location_id")) return 0
  const id = Number(query.get("location_id"))
  if (!Number.isInteger(id) || id <= 0) return invalid("Lokatsiya noto'g'ri")
  if (!allowed.includes(id)) return forbidden()
  return id
}

// liveLocationsIn is the company's live locations among the ids given, in
// the order they were added.
export const liveLocationsIn = (companyId: number, ids: number[]) => db.locations.filter((l) => l.companyId === companyId && !l.deleted && ids.includes(l.id))

export const liveSuppliers = (companyId: number) => db.suppliers.filter((s) => s.companyId === companyId && !s.deleted)
export const livePurchases = (companyId: number) => db.purchases.filter((p) => p.companyId === companyId && !p.deleted)
const livePayments = (companyId: number) => db.payments.filter((p) => p.companyId === companyId && !p.deleted)

// stockOf is the product's stock summed over the locations.
export function stockOf(productId: number, locationIds: number[]): number {
  return db.stock.filter((s) => s.productId === productId && locationIds.includes(s.locationId)).reduce((sum, s) => sum + s.quantity, 0)
}

// lastPriceOf is the price of the product's newest live purchase line,
// whatever the location; null when it was never bought.
export function lastPriceOf(productId: number): string | null {
  const line = [...db.purchases]
    .filter((p) => !p.deleted && p.items.some((i) => i.productId === productId))
    .sort((a, b) => b.purchasedOn.localeCompare(a.purchasedOn) || b.id - a.id)[0]
  const item = line?.items.find((i) => i.productId === productId)
  return item ? asAmount(item.price) : null
}

// purchasesHolding is how many live purchases hold the product.
export const purchasesHolding = (productId: number) => db.purchases.filter((p) => !p.deleted && p.items.some((i) => i.productId === productId)).length

// moveStock moves the product's stock in the location by delta; below zero
// is refused (the caller gives nothing back when it is).
function moveStock(companyId: number, locationId: number, productId: number, delta: number): Response | null {
  let row = db.stock.find((s) => s.locationId === locationId && s.productId === productId)
  if (!row) {
    row = { companyId, locationId, productId, quantity: 0 }
    db.stock.push(row)
  }
  const next = round(row.quantity + delta, 3)
  if (next < 0) return stockInsufficient()
  row.quantity = next
  return null
}

const totalOf = (items: PurchaseItemRow[]) => round(items.reduce((sum, i) => sum + round(i.quantity * i.price, 2), 0), 2)

// balanceOf is what is owed the supplier: the live purchases' totals less
// the live payments.
function totals(supplier: SupplierRow) {
  const purchases = round(livePurchases(supplier.companyId).filter((p) => p.supplierId === supplier.id).reduce((sum, p) => sum + totalOf(p.items), 0), 2)
  const payments = round(livePayments(supplier.companyId).filter((p) => p.supplierId === supplier.id).reduce((sum, p) => sum + p.amount, 0), 2)
  return { purchases, payments, balance: round(purchases - payments, 2) }
}

export function toSupplier(s: SupplierRow, withBalance: boolean): Supplier {
  const t = totals(s)
  return {
    id: s.id,
    name: s.name,
    phone: s.phone,
    note: s.note,
    is_active: s.active,
    balance: withBalance ? asAmount(t.balance) : null,
    purchases_total: withBalance ? asAmount(t.purchases) : null,
    payments_total: withBalance ? asAmount(t.payments) : null,
    created_by_name: nameOf(s.by, s.companyId, s.byName),
    created_at: s.createdAt,
    updated_at: s.updatedAt,
  }
}

const seesBalance = (phone: string, companyId: number) => permissionsOf(phone, companyId).includes("purchases.view")

type CheckedSupplier = Pick<SupplierRow, "name" | "phone" | "note">

// checkSupplier reads a body as the Go API does, in its order: the name,
// the phone, the note.
function checkSupplier(body: Record<string, unknown>): CheckedSupplier | Response {
  const name = trimmed(body.name)
  if (!name) return invalid("Nomni kiriting")
  if ([...name].length > 120) return invalid("Nom 120 belgidan oshmasin")
  let phone: string | null = null
  const rawPhone = trimmed(body.phone)
  if (rawPhone !== null) {
    phone = normalizePhone(rawPhone)
    if (phone === null || !/^998\d{9}$/.test(phone)) return invalid("Telefon raqami noto'g'ri")
  }
  const note = trimmed(body.note)
  if (note !== null && [...note].length > 500) return invalid("Izoh 500 belgidan oshmasin")
  return { name, phone, note }
}

const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase()

function liveSupplier(companyId: number, id: unknown): SupplierRow | undefined {
  return liveSuppliers(companyId).find((s) => s.id === Number(id))
}

export function toPayment(p: PaymentRow): Payment {
  const purchase = p.purchaseId === null ? undefined : db.purchases.find((x) => x.id === p.purchaseId)
  return {
    id: p.id,
    supplier_id: p.supplierId,
    purchase_id: p.purchaseId,
    purchase_number: purchase?.number ?? null,
    amount: asAmount(p.amount),
    paid_on: p.paidOn,
    note: p.note,
    created_by_name: nameOf(p.by, p.companyId, p.byName),
    created_at: p.createdAt,
    updated_at: p.updatedAt,
  }
}

type CheckedPayment = { amount: number; paidOn: string; note: string | null }

// checkPayment reads a body in the Go API's order: the amount, the day, the
// note.
function checkPayment(body: Record<string, unknown>): CheckedPayment | Response {
  const raw = body.amount
  if (raw === undefined || raw === null || raw === "") return invalid("Summani kiriting")
  if (typeof raw !== "string" || !money.test(raw) || Number(raw) === 0) return invalid("Summa noto'g'ri")
  const paidOn = aDay(body.paid_on)
  if (paidOn instanceof Response) return paidOn
  const note = trimmed(body.note)
  if (note !== null && [...note].length > 500) return invalid("Izoh 500 belgidan oshmasin")
  return { amount: Number(raw), paidOn, note }
}

function toItem(i: PurchaseItemRow): PurchaseItem {
  const product = db.products.find((p) => p.id === i.productId)
  return { product_id: i.productId, name: product?.name ?? "", unit: product?.unit ?? null, quantity: asQuantity(i.quantity), price: asAmount(i.price), amount: asAmount(round(i.quantity * i.price, 2)) }
}

export function toPurchase(p: PurchaseRow): Purchase {
  const supplier = db.suppliers.find((s) => s.id === p.supplierId)
  const location = db.locations.find((l) => l.id === p.locationId)
  const paid = livePayments(p.companyId).find((x) => x.purchaseId === p.id)
  return {
    id: p.id,
    number: p.number,
    location_id: p.locationId,
    location_name: location?.name ?? "",
    supplier: { id: p.supplierId, name: supplier?.name ?? "" },
    purchased_on: p.purchasedOn,
    note: p.note,
    total: asAmount(totalOf(p.items)),
    paid: asAmount(paid?.amount ?? 0),
    items_count: p.items.length,
    created_by_name: nameOf(p.by, p.companyId, p.byName),
    created_at: p.createdAt,
    updated_at: p.updatedAt,
  }
}

const toPurchaseDetail = (p: PurchaseRow): PurchaseDetail => ({ ...toPurchase(p), items: p.items.map(toItem) })

type CheckedPurchase = { supplierId: number; purchasedOn: string; note: string | null; items: PurchaseItemRow[]; paid: number }

// checkPurchase reads a body in the Go API's order (logic/warehouse.md,
// 4.2): the supplier (active unless it is the one kept), the day, the note,
// the lines (each product one of the company's, a product, active unless
// held already, once; its quantity; its price), what was paid.
function checkPurchase(companyId: number, body: Record<string, unknown>, keep: number, held: number[]): CheckedPurchase | Response {
  const supplierId = Number(body.supplier_id ?? 0)
  const supplier = supplierId ? liveSupplier(companyId, supplierId) : undefined
  if (!supplier) return invalid("Ta'minotchini tanlang")
  if (!supplier.active && supplier.id !== keep) return invalid("Ta'minotchi nofaol")
  const purchasedOn = aDay(body.purchased_on)
  if (purchasedOn instanceof Response) return purchasedOn
  const note = trimmed(body.note)
  if (note !== null && [...note].length > 500) return invalid("Izoh 500 belgidan oshmasin")
  const lines = Array.isArray(body.items) ? (body.items as Record<string, unknown>[]) : []
  if (lines.length === 0) return invalid("Kamida bitta mahsulot qo'shing")
  const items: PurchaseItemRow[] = []
  const seen = new Set<number>()
  for (const line of lines) {
    const productId = Number(line.product_id ?? 0)
    const product: ProductRow | undefined = productId ? db.products.find((p) => p.id === productId && p.companyId === companyId && !p.deleted) : undefined
    if (!product) return invalid("Mahsulotni tanlang")
    if (product.kind !== "product") return invalid("Xizmat xaridga kiritilmaydi")
    if (!product.active && !held.includes(product.id)) return invalid("Mahsulot nofaol")
    if (seen.has(product.id)) return invalid(`«${product.name}» ikki marta kiritilgan`)
    seen.add(product.id)
    const quantity = line.quantity
    if (typeof quantity !== "string" || !quantityPattern.test(quantity) || Number(quantity) === 0) return invalid(`«${product.name}» miqdori noto'g'ri`)
    const price = line.price
    if (typeof price !== "string" || !money.test(price)) return invalid(`«${product.name}» narxi noto'g'ri`)
    items.push({ productId: product.id, quantity: Number(quantity), price: Number(price) })
  }
  const rawPaid = body.paid
  const paid = rawPaid === undefined || rawPaid === null || rawPaid === "" ? 0 : typeof rawPaid === "string" && money.test(rawPaid) ? Number(rawPaid) : NaN
  if (Number.isNaN(paid)) return invalid("To'langan summa noto'g'ri")
  return { supplierId, purchasedOn, note, items, paid }
}

// settle keeps the payment entered with the purchase as what was paid says.
function settle(purchase: PurchaseRow, c: CheckedPurchase, by: string) {
  const linked = livePayments(purchase.companyId).find((x) => x.purchaseId === purchase.id)
  if (c.paid === 0) {
    if (linked) linked.deleted = true
    return
  }
  if (linked) {
    Object.assign(linked, { supplierId: c.supplierId, amount: c.paid, paidOn: c.purchasedOn, updatedAt: now() })
    return
  }
  const at = now()
  db.payments.push({
    id: nextId(),
    companyId: purchase.companyId,
    supplierId: c.supplierId,
    purchaseId: purchase.id,
    amount: c.paid,
    paidOn: c.purchasedOn,
    note: null,
    by,
    byName: nameIn(by, purchase.companyId),
    createdAt: at,
    updatedAt: at,
  })
}

// writeLines replaces the purchase's lines and moves the stock by the
// difference, product by product; below zero undoes nothing (the caller
// returns the refusal; the mock has no transaction, so the lines written so
// far are rolled back by hand).
function writeLines(purchase: PurchaseRow, items: PurchaseItemRow[]): Response | null {
  const before = new Map(purchase.items.map((i) => [i.productId, i.quantity]))
  const after = new Map(items.map((i) => [i.productId, i.quantity]))
  const moved: [number, number][] = []
  for (const productId of new Set([...before.keys(), ...after.keys()])) {
    const delta = round((after.get(productId) ?? 0) - (before.get(productId) ?? 0), 3)
    const refusal = moveStock(purchase.companyId, purchase.locationId, productId, delta)
    if (refusal) {
      for (const [id, d] of moved) moveStock(purchase.companyId, purchase.locationId, id, -d)
      return refusal
    }
    moved.push([productId, delta])
  }
  purchase.items = items
  return null
}

function purchaseIn(companyId: number, id: unknown, locationIds: number[]): PurchaseRow | undefined {
  return livePurchases(companyId).find((p) => p.id === Number(id) && locationIds.includes(p.locationId))
}


export const warehouseHandlers = [
  http.get(api("/app/suppliers"), ({ request }) => {
    const member = permittedSession(request, "suppliers.view")
    if (member instanceof Response) return member
    const query = new URL(request.url).searchParams
    const n = page(query)
    if (n instanceof Response) return n
    const status = query.get("status") || "active"
    if (status !== "active" && status !== "inactive") return invalid("Holat noto'g'ri")
    const search = (query.get("search") ?? "").trim()
    const digits = /^[\d\s+\-()]+$/.test(search) ? search.replace(/\D/g, "") : ""
    const all = liveSuppliers(member.companyId)
      .filter((s) => s.active === (status === "active"))
      .filter((s) => !search || s.name.toLowerCase().includes(search.toLowerCase()) || (digits !== "" && s.phone !== null && s.phone.includes(digits)))
      .sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()) || a.id - b.id)
    const withBalance = seesBalance(member.phone, member.companyId)
    const result = paged(all, n)
    return HttpResponse.json({ ...result, items: result.items.map((s) => toSupplier(s, withBalance)) })
  }),

  http.post(api("/app/suppliers"), async ({ request }) => {
    const member = permittedSession(request, "suppliers.create")
    if (member instanceof Response) return member
    const body = (await request.json()) as Record<string, unknown>
    const c = checkSupplier(body)
    if (c instanceof Response) return c
    if (liveSuppliers(member.companyId).some((s) => same(s.name, c.name))) return fail(409, "name_taken", "Bu nomli ta'minotchi allaqachon bor")
    const at = now()
    const row: SupplierRow = { id: nextId(), companyId: member.companyId, ...c, active: true, by: member.phone, byName: nameIn(member.phone, member.companyId), createdAt: at, updatedAt: at }
    db.suppliers.push(row)
    return HttpResponse.json(toSupplier(row, seesBalance(member.phone, member.companyId)), { status: 201 })
  }),

  http.get(api("/app/suppliers/:id"), ({ params, request }) => {
    const member = permittedSession(request, "suppliers.view")
    if (member instanceof Response) return member
    const s = liveSupplier(member.companyId, params.id)
    return s ? HttpResponse.json(toSupplier(s, seesBalance(member.phone, member.companyId))) : supplierNotFound()
  }),

  http.put(api("/app/suppliers/:id"), async ({ params, request }) => {
    const member = permittedSession(request, "suppliers.edit")
    if (member instanceof Response) return member
    const s = liveSupplier(member.companyId, params.id)
    if (!s) return supplierNotFound()
    const c = checkSupplier((await request.json()) as Record<string, unknown>)
    if (c instanceof Response) return c
    if (liveSuppliers(member.companyId).some((x) => x.id !== s.id && same(x.name, c.name))) return fail(409, "name_taken", "Bu nomli ta'minotchi allaqachon bor")
    Object.assign(s, c, { updatedAt: now() })
    return HttpResponse.json(toSupplier(s, seesBalance(member.phone, member.companyId)))
  }),

  http.patch(api("/app/suppliers/:id"), async ({ params, request }) => {
    const member = permittedSession(request, "suppliers.edit")
    if (member instanceof Response) return member
    const body = (await request.json()) as { is_active?: unknown }
    if (typeof body.is_active !== "boolean") return invalid("Holat noto'g'ri")
    const s = liveSupplier(member.companyId, params.id)
    if (!s) return supplierNotFound()
    s.active = body.is_active
    s.updatedAt = now()
    return HttpResponse.json(toSupplier(s, seesBalance(member.phone, member.companyId)))
  }),

  http.delete(api("/app/suppliers/:id"), ({ params, request }) => {
    const member = permittedSession(request, "suppliers.delete")
    if (member instanceof Response) return member
    const s = liveSupplier(member.companyId, params.id)
    if (!s) return supplierNotFound()
    const purchases = livePurchases(member.companyId).filter((p) => p.supplierId === s.id).length
    if (purchases > 0) return fail(409, "supplier_in_use", `Bu ta'minotchida ${purchases} ta xarid bor`)
    const payments = livePayments(member.companyId).filter((p) => p.supplierId === s.id).length
    if (payments > 0) return fail(409, "supplier_in_use", `Bu ta'minotchida ${payments} ta to'lov bor`)
    s.deleted = true
    return new HttpResponse(null, { status: 204 })
  }),

  http.get(api("/app/suppliers/:id/payments"), ({ params, request }) => {
    const member = permittedSession(request, "purchases.view")
    if (member instanceof Response) return member
    const n = page(new URL(request.url).searchParams)
    if (n instanceof Response) return n
    const s = liveSupplier(member.companyId, params.id)
    if (!s) return supplierNotFound()
    const all = livePayments(member.companyId)
      .filter((p) => p.supplierId === s.id)
      .sort((a, b) => b.paidOn.localeCompare(a.paidOn) || b.id - a.id)
    const result = paged(all, n)
    return HttpResponse.json({ ...result, items: result.items.map(toPayment) })
  }),

  http.post(api("/app/suppliers/:id/payments"), async ({ params, request }) => {
    const member = permittedSession(request, "purchases.create")
    if (member instanceof Response) return member
    const s = liveSupplier(member.companyId, params.id)
    if (!s) return supplierNotFound()
    const c = checkPayment((await request.json()) as Record<string, unknown>)
    if (c instanceof Response) return c
    const at = now()
    const row: PaymentRow = { id: nextId(), companyId: member.companyId, supplierId: s.id, purchaseId: null, ...c, by: member.phone, byName: nameIn(member.phone, member.companyId), createdAt: at, updatedAt: at }
    db.payments.push(row)
    return HttpResponse.json(toPayment(row), { status: 201 })
  }),

  http.put(api("/app/suppliers/:id/payments/:paymentId"), async ({ params, request }) => {
    const member = permittedSession(request, "purchases.edit")
    if (member instanceof Response) return member
    const p = livePayments(member.companyId).find((x) => x.id === Number(params.paymentId) && x.supplierId === Number(params.id))
    if (!p) return paymentNotFound()
    if (p.purchaseId !== null) return paymentLinked()
    const c = checkPayment((await request.json()) as Record<string, unknown>)
    if (c instanceof Response) return c
    Object.assign(p, c, { updatedAt: now() })
    return HttpResponse.json(toPayment(p))
  }),

  http.delete(api("/app/suppliers/:id/payments/:paymentId"), ({ params, request }) => {
    const member = permittedSession(request, "purchases.delete")
    if (member instanceof Response) return member
    const p = livePayments(member.companyId).find((x) => x.id === Number(params.paymentId) && x.supplierId === Number(params.id))
    if (!p) return paymentNotFound()
    if (p.purchaseId !== null) return paymentLinked()
    p.deleted = true
    return new HttpResponse(null, { status: 204 })
  }),

  http.get(api("/app/purchases"), ({ request }) => {
    const member = permittedSession(request, "purchases.view")
    if (member instanceof Response) return member
    const query = new URL(request.url).searchParams
    const mine = memberLocationIds(member.phone, member.companyId)
    const location = locationParam(query, mine)
    if (location instanceof Response) return location
    let supplierId = 0
    if (query.has("supplier_id")) {
      supplierId = Number(query.get("supplier_id"))
      if (!Number.isInteger(supplierId) || supplierId <= 0) return invalid("Ta'minotchi noto'g'ri")
    }
    const n = page(query)
    if (n instanceof Response) return n
    const locations = location ? [location] : mine
    const all = livePurchases(member.companyId)
      .filter((p) => locations.includes(p.locationId) && (!supplierId || p.supplierId === supplierId))
      .sort((a, b) => b.purchasedOn.localeCompare(a.purchasedOn) || b.id - a.id)
    const result = paged(all, n)
    return HttpResponse.json({ ...result, items: result.items.map(toPurchase) })
  }),

  http.post(api("/app/purchases"), async ({ request }) => {
    const member = permittedSession(request, "purchases.create")
    if (member instanceof Response) return member
    const body = (await request.json()) as Record<string, unknown>
    const locationId = Number(body.location_id ?? 0)
    if (!locationId) return invalid("Lokatsiyani tanlang")
    if (!memberLocationIds(member.phone, member.companyId).includes(locationId)) return forbidden()
    const c = checkPurchase(member.companyId, body, 0, [])
    if (c instanceof Response) return c
    const number = Math.max(0, ...db.purchases.filter((p) => p.companyId === member.companyId).map((p) => p.number)) + 1
    const at = now()
    const row: PurchaseRow = {
      id: nextId(),
      companyId: member.companyId,
      number,
      locationId,
      supplierId: c.supplierId,
      purchasedOn: c.purchasedOn,
      note: c.note,
      items: [],
      by: member.phone,
      byName: nameIn(member.phone, member.companyId),
      createdAt: at,
      updatedAt: at,
    }
    const refusal = writeLines(row, c.items)
    if (refusal) return refusal
    db.purchases.push(row)
    settle(row, c, member.phone)
    return HttpResponse.json(toPurchaseDetail(row), { status: 201 })
  }),

  http.get(api("/app/purchases/:id"), ({ params, request }) => {
    const member = permittedSession(request, "purchases.view")
    if (member instanceof Response) return member
    const p = purchaseIn(member.companyId, params.id, memberLocationIds(member.phone, member.companyId))
    return p ? HttpResponse.json(toPurchaseDetail(p)) : purchaseNotFound()
  }),

  http.put(api("/app/purchases/:id"), async ({ params, request }) => {
    const member = permittedSession(request, "purchases.edit")
    if (member instanceof Response) return member
    const p = purchaseIn(member.companyId, params.id, memberLocationIds(member.phone, member.companyId))
    if (!p) return purchaseNotFound()
    const c = checkPurchase(member.companyId, (await request.json()) as Record<string, unknown>, p.supplierId, p.items.map((i) => i.productId))
    if (c instanceof Response) return c
    const refusal = writeLines(p, c.items)
    if (refusal) return refusal
    Object.assign(p, { supplierId: c.supplierId, purchasedOn: c.purchasedOn, note: c.note, updatedAt: now() })
    settle(p, c, member.phone)
    return HttpResponse.json(toPurchaseDetail(p))
  }),

  http.delete(api("/app/purchases/:id"), ({ params, request }) => {
    const member = permittedSession(request, "purchases.delete")
    if (member instanceof Response) return member
    const p = purchaseIn(member.companyId, params.id, memberLocationIds(member.phone, member.companyId))
    if (!p) return purchaseNotFound()
    const refusal = writeLines(p, [])
    if (refusal) return refusal
    p.deleted = true
    const linked = livePayments(member.companyId).find((x) => x.purchaseId === p.id)
    if (linked) linked.deleted = true
    return new HttpResponse(null, { status: 204 })
  }),
]
