// The warehouse of the mock API: the suppliers, the purchases into the
// stock journal of the locations, the payments through the accounts and
// what is owed, under the Go API's rules (logic/warehouse.md;
// backend/internal/warehouse).
import { http, HttpResponse } from "msw"
import type { Payment, Purchase, PurchaseDetail, PurchaseItem, Supplier } from "@/lib/types"
import { nameOf } from "./customers"
import { db, locationsOf, nameIn, nextId, now, permissionsOf, type ProductRow, type SupplierRow, type TransactionRow } from "./data"
import { api, fail, forbidden, normalizePhone, permittedSession } from "./gate"
import {
  asAmount,
  asQuantity,
  asRate,
  atOf,
  balanceOf,
  checkStock,
  convertAmount,
  itemsOf,
  linkedPaymentsOf,
  liveDocuments,
  money,
  movesOf,
  nextNumber,
  paidOf,
  priceIn,
  type Pricing,
  quantityPattern,
  rateColumn,
  rateOf,
  round,
  statementOf,
  takeMoves,
  writeLinkedPayments,
} from "./ledger"

export { asAmount, asQuantity, documentsHolding, lastPriceOf, stockOf } from "./ledger"

const PAGE_SIZE = 20

const invalid = (message: string) => fail(400, "validation_error", message)
const supplierNotFound = () => fail(404, "not_found", "Ta'minotchi topilmadi")
const purchaseNotFound = () => fail(404, "not_found", "Xarid topilmadi")
const paymentNotFound = () => fail(404, "not_found", "To'lov topilmadi")
const paymentLinked = () => fail(409, "payment_linked", "Bu to'lov xarid bilan kiritilgan: xaridni tahrirlang")

// trimmed is an optional text without the spaces around it, null when
// nothing is left.
function trimmed(raw: unknown): string | null {
  const text = typeof raw === "string" ? raw.trim() : ""
  return text === "" ? null : text
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
export const livePurchases = (companyId: number) => liveDocuments(companyId).filter((t) => t.kind === "purchase")
const livePayments = (companyId: number) => liveDocuments(companyId).filter((t) => t.kind === "supplier_payment")

// toSupplier is a supplier as the API shows it: with its balance for
// whoever may see the purchases, by currency on its own page alone.
export function toSupplier(s: SupplierRow, withBalance: boolean, detail = false): Supplier {
  const b = balanceOf(s.id)
  return {
    id: s.id,
    name: s.name,
    phone: s.phone,
    note: s.note,
    is_active: s.active,
    balance: withBalance ? asAmount(b.balance) : null,
    purchases_total: withBalance ? asAmount(b.purchases) : null,
    payments_total: withBalance ? asAmount(b.payments) : null,
    balance_by_currency: withBalance && detail ? b.byCurrency : null,
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

// accountOf is the company's live account with the id.
const accountOf = (companyId: number, id: number) => (db.accounts[companyId] ?? []).find((a) => a.id === id)

export function toPayment(p: TransactionRow): Payment {
  const purchase = p.linkedId === null ? undefined : db.transactions.find((x) => x.id === p.linkedId)
  const rate = rateOf(p.rateId)
  return {
    id: p.id,
    supplier_id: p.supplierId!,
    purchase_id: p.linkedId,
    purchase_number: purchase?.number ?? null,
    bank_account_id: p.bankAccountId!,
    account_name: accountOf(p.companyId, p.bankAccountId!)?.name ?? "",
    amount: asAmount(p.total),
    currency_id: p.currencyId,
    rate: asRate(rateColumn(rate, p.currencyId)),
    amount_uzs: asAmount(convertAmount(p.total, p.currencyId, 1, rate)),
    at: p.at,
    note: p.note,
    created_by_name: nameOf(p.by, p.companyId, p.byName),
    created_at: p.createdAt,
    updated_at: p.updatedAt,
  }
}

type CheckedPayment = { accountId: number; amount: number; at: string; pricing: Pricing; note: string | null }

// checkPayment reads a body in the Go API's order: the account (active
// unless it is the one kept), the amount, the moment, the rate, the note.
function checkPayment(companyId: number, body: Record<string, unknown>, by: string, keep: number, current?: Pricing): CheckedPayment | Response {
  const accountId = Number(body.bank_account_id ?? 0)
  const account = accountId ? accountOf(companyId, accountId) : undefined
  if (!account) return invalid("Akkauntni tanlang")
  if (!account.is_active && account.id !== keep) return invalid("Akkaunt nofaol")
  const raw = body.amount
  if (raw === undefined || raw === null || raw === "") return invalid("Summani kiriting")
  if (typeof raw !== "string" || !money.test(raw) || Number(raw) === 0) return invalid("Summa noto'g'ri")
  const at = atOf(body.at)
  if (at instanceof Response) return at
  const pricing = priceIn(companyId, { currency_id: account.currency_id, rate: body.rate }, at, by, current)
  if (pricing instanceof Response) return pricing
  const note = trimmed(body.note)
  if (note !== null && [...note].length > 500) return invalid("Izoh 500 belgidan oshmasin")
  return { accountId: account.id, amount: Number(raw), at, pricing, note }
}

// pricingOf is the document's pricing now.
const pricingOf = (t: TransactionRow): Pricing => ({ currencyId: t.currencyId, rateId: t.rateId, rate: rateColumn(rateOf(t.rateId), t.currencyId) })

function toItem(i: { productId: number; quantity: number; price: number | null }): PurchaseItem {
  const product = db.products.find((p) => p.id === i.productId)
  const price = i.price ?? 0
  return { product_id: i.productId, name: product?.name ?? "", unit: product?.unit ?? null, quantity: asQuantity(i.quantity), price: asAmount(price), amount: asAmount(round(i.quantity * price, 2)) }
}

export function toPurchase(p: TransactionRow): Purchase {
  const supplier = db.suppliers.find((s) => s.id === p.supplierId)
  const location = db.locations.find((l) => l.id === p.locationId)
  const rate = rateOf(p.rateId)
  return {
    id: p.id,
    number: p.number,
    location_id: p.locationId!,
    location_name: location?.name ?? "",
    supplier: { id: p.supplierId!, name: supplier?.name ?? "" },
    at: p.at,
    currency_id: p.currencyId,
    rate: asRate(rateColumn(rate, p.currencyId)),
    note: p.note,
    total: asAmount(p.total),
    total_uzs: asAmount(convertAmount(p.total, p.currencyId, 1, rate)),
    paid: asAmount(paidOf(p)),
    items_count: itemsOf(p.id).length,
    created_by_name: nameOf(p.by, p.companyId, p.byName),
    created_at: p.createdAt,
    updated_at: p.updatedAt,
  }
}

const toPurchaseDetail = (p: TransactionRow): PurchaseDetail => ({
  ...toPurchase(p),
  items: itemsOf(p.id).map(toItem),
  payments: linkedPaymentsOf(p.id).map((l) => ({ id: l.id, bank_account_id: l.bankAccountId!, account_name: accountOf(l.companyId, l.bankAccountId!)?.name ?? "", amount: asAmount(l.total), currency_id: l.currencyId })),
})

type CheckedLine = { productId: number; quantity: number; price: number }
type CheckedPurchase = { supplierId: number; at: string; pricing: Pricing; note: string | null; items: CheckedLine[] }

// checkPurchase reads a body in the Go API's order (logic/warehouse.md,
// 4.2): the supplier (active unless it is the one kept), the moment, the
// currency and rate, the note, the lines (each product one of the
// company's, a product, active unless held already, once; its quantity;
// its price). The payments are read as they are written.
function checkPurchase(companyId: number, body: Record<string, unknown>, by: string, keep: number, held: number[], current?: Pricing): CheckedPurchase | Response {
  const supplierId = Number(body.supplier_id ?? 0)
  const supplier = supplierId ? liveSupplier(companyId, supplierId) : undefined
  if (!supplier) return invalid("Ta'minotchini tanlang")
  if (!supplier.active && supplier.id !== keep) return invalid("Ta'minotchi nofaol")
  const at = atOf(body.at)
  if (at instanceof Response) return at
  const pricing = priceIn(companyId, body, at, by, current)
  if (pricing instanceof Response) return pricing
  const note = trimmed(body.note)
  if (note !== null && [...note].length > 500) return invalid("Izoh 500 belgidan oshmasin")
  const lines = Array.isArray(body.items) ? (body.items as Record<string, unknown>[]) : []
  if (lines.length === 0) return invalid("Kamida bitta mahsulot qo'shing")
  const items: CheckedLine[] = []
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
  return { supplierId, at, pricing, note, items }
}

// writeLines replaces the purchase's lines, its total and its moves; below
// zero puts everything back and returns the refusal.
function writeLines(purchase: TransactionRow, items: CheckedLine[]): Response | null {
  const wasItems = itemsOf(purchase.id)
  const wasMoves = takeMoves(purchase.id)
  const wasTotal = purchase.total
  db.items = db.items.filter((i) => i.transactionId !== purchase.id)
  items.forEach((it, index) => db.items.push({ transactionId: purchase.id, productId: it.productId, quantity: it.quantity, expected: null, price: it.price, position: index + 1 }))
  purchase.total = round(items.reduce((sum, i) => sum + round(i.quantity * i.price, 2), 0), 2)
  db.moves.push(...movesOf("purchase", purchase.companyId, purchase.id, purchase.locationId!, null, items.map((i) => ({ productId: i.productId, quantity: i.quantity }))))
  const refusal = checkStock([purchase.locationId!], [...new Set([...wasItems.map((i) => i.productId), ...items.map((i) => i.productId)])])
  if (refusal) {
    takeMoves(purchase.id)
    db.moves.push(...wasMoves)
    db.items = db.items.filter((i) => i.transactionId !== purchase.id)
    db.items.push(...wasItems)
    purchase.total = wasTotal
    return refusal
  }
  return null
}

function purchaseIn(companyId: number, id: unknown, locationIds: number[]): TransactionRow | undefined {
  return livePurchases(companyId).find((p) => p.id === Number(id) && locationIds.includes(p.locationId!))
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
    return HttpResponse.json(toSupplier(row, seesBalance(member.phone, member.companyId), true), { status: 201 })
  }),

  http.get(api("/app/suppliers/:id"), ({ params, request }) => {
    const member = permittedSession(request, "suppliers.view")
    if (member instanceof Response) return member
    const s = liveSupplier(member.companyId, params.id)
    return s ? HttpResponse.json(toSupplier(s, seesBalance(member.phone, member.companyId), true)) : supplierNotFound()
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
    return HttpResponse.json(toSupplier(s, seesBalance(member.phone, member.companyId), true))
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
    return HttpResponse.json(toSupplier(s, seesBalance(member.phone, member.companyId), true))
  }),

  http.delete(api("/app/suppliers/:id"), ({ params, request }) => {
    const member = permittedSession(request, "suppliers.delete")
    if (member instanceof Response) return member
    const s = liveSupplier(member.companyId, params.id)
    if (!s) return supplierNotFound()
    const documents = liveDocuments(member.companyId).filter((t) => t.supplierId === s.id).length
    if (documents > 0) return fail(409, "supplier_in_use", `Bu ta'minotchida ${documents} ta hujjat bor`)
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
      .sort((a, b) => b.at.localeCompare(a.at) || b.id - a.id)
    const result = paged(all, n)
    return HttpResponse.json({ ...result, items: result.items.map(toPayment) })
  }),

  http.get(api("/app/suppliers/:id/statement"), ({ params, request }) => {
    const member = permittedSession(request, "purchases.view")
    if (member instanceof Response) return member
    const n = page(new URL(request.url).searchParams)
    if (n instanceof Response) return n
    const s = liveSupplier(member.companyId, params.id)
    if (!s) return supplierNotFound()
    return HttpResponse.json(paged(statementOf(s.id), n))
  }),

  http.post(api("/app/suppliers/:id/payments"), async ({ params, request }) => {
    const member = permittedSession(request, "purchases.create")
    if (member instanceof Response) return member
    const s = liveSupplier(member.companyId, params.id)
    if (!s) return supplierNotFound()
    const c = checkPayment(member.companyId, (await request.json()) as Record<string, unknown>, member.phone, 0)
    if (c instanceof Response) return c
    const at = now()
    const row: TransactionRow = {
      id: nextId(),
      companyId: member.companyId,
      kind: "supplier_payment",
      number: nextNumber(member.companyId, "supplier_payment"),
      at: c.at,
      locationId: null,
      toLocationId: null,
      supplierId: s.id,
      customerId: null,
      bankAccountId: c.accountId,
      toBankAccountId: null,
      categoryId: null,
      linkedId: null,
      currencyId: c.pricing.currencyId,
      rateId: c.pricing.rateId,
      total: c.amount,
      toTotal: null,
      note: c.note,
      by: member.phone,
      byName: nameIn(member.phone, member.companyId),
      createdAt: at,
      updatedAt: at,
    }
    db.transactions.push(row)
    return HttpResponse.json(toPayment(row), { status: 201 })
  }),

  http.put(api("/app/suppliers/:id/payments/:paymentId"), async ({ params, request }) => {
    const member = permittedSession(request, "purchases.edit")
    if (member instanceof Response) return member
    const p = livePayments(member.companyId).find((x) => x.id === Number(params.paymentId) && x.supplierId === Number(params.id))
    if (!p) return paymentNotFound()
    if (p.linkedId !== null) return paymentLinked()
    const c = checkPayment(member.companyId, (await request.json()) as Record<string, unknown>, member.phone, p.bankAccountId!, pricingOf(p))
    if (c instanceof Response) return c
    Object.assign(p, { bankAccountId: c.accountId, total: c.amount, at: c.at, currencyId: c.pricing.currencyId, rateId: c.pricing.rateId, note: c.note, updatedAt: now() })
    return HttpResponse.json(toPayment(p))
  }),

  http.delete(api("/app/suppliers/:id/payments/:paymentId"), ({ params, request }) => {
    const member = permittedSession(request, "purchases.delete")
    if (member instanceof Response) return member
    const p = livePayments(member.companyId).find((x) => x.id === Number(params.paymentId) && x.supplierId === Number(params.id))
    if (!p) return paymentNotFound()
    if (p.linkedId !== null) return paymentLinked()
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
      .filter((p) => locations.includes(p.locationId!) && (!supplierId || p.supplierId === supplierId))
      .sort((a, b) => b.at.localeCompare(a.at) || b.id - a.id)
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
    const c = checkPurchase(member.companyId, body, member.phone, 0, [])
    if (c instanceof Response) return c
    const at = now()
    const row: TransactionRow = {
      id: nextId(),
      companyId: member.companyId,
      kind: "purchase",
      number: nextNumber(member.companyId, "purchase"),
      at: c.at,
      locationId,
      toLocationId: null,
      supplierId: c.supplierId,
      customerId: null,
      bankAccountId: null,
      toBankAccountId: null,
      categoryId: null,
      linkedId: null,
      currencyId: c.pricing.currencyId,
      rateId: c.pricing.rateId,
      total: 0,
      toTotal: null,
      note: c.note,
      by: member.phone,
      byName: nameIn(member.phone, member.companyId),
      createdAt: at,
      updatedAt: at,
    }
    db.transactions.push(row)
    const refusal = writeLines(row, c.items) ?? writeLinkedPayments(row, body.payments, member.phone)
    if (refusal) {
      takeMoves(row.id)
      db.items = db.items.filter((i) => i.transactionId !== row.id)
      db.transactions = db.transactions.filter((t) => t.id !== row.id)
      return refusal
    }
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
    const body = (await request.json()) as Record<string, unknown>
    const c = checkPurchase(member.companyId, body, member.phone, p.supplierId!, itemsOf(p.id).map((i) => i.productId), pricingOf(p))
    if (c instanceof Response) return c
    const was = { supplierId: p.supplierId, at: p.at, currencyId: p.currencyId, rateId: p.rateId, note: p.note, updatedAt: p.updatedAt }
    Object.assign(p, { supplierId: c.supplierId, at: c.at, currencyId: c.pricing.currencyId, rateId: c.pricing.rateId, note: c.note, updatedAt: now() })
    const refusal = writeLines(p, c.items) ?? writeLinkedPayments(p, body.payments, member.phone)
    if (refusal) {
      Object.assign(p, was)
      return refusal
    }
    return HttpResponse.json(toPurchaseDetail(p))
  }),

  http.delete(api("/app/purchases/:id"), ({ params, request }) => {
    const member = permittedSession(request, "purchases.delete")
    if (member instanceof Response) return member
    const p = purchaseIn(member.companyId, params.id, memberLocationIds(member.phone, member.companyId))
    if (!p) return purchaseNotFound()
    const wasMoves = takeMoves(p.id)
    const refusal = checkStock([p.locationId!], itemsOf(p.id).map((i) => i.productId))
    if (refusal) {
      db.moves.push(...wasMoves)
      return refusal
    }
    p.deleted = true
    for (const linked of linkedPaymentsOf(p.id)) linked.deleted = true
    return new HttpResponse(null, { status: 204 })
  }),
]
