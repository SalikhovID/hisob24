// The sales of the mock API (logic/sales.md; backend/internal/warehouse):
// a sale out of a location to a customer or to nobody, its products out of
// the stock and its services moving nothing, the payments entered with it;
// a customer's payments, opening balances and statement.
import { http, HttpResponse } from "msw"
import type { CustomerOpening, CustomerPayment, Sale, SaleDetail } from "@/lib/types"
import { customerNameOf, liveCustomers, nameOf } from "./customers"
import { db, now, type TransactionRow } from "./data"
import { api, fail, permittedSession } from "./gate"
import { asAmount, asRate, atOf, convertAmount, itemsOf, linkedPaymentsOf, liveDocuments, paidOf, priceIn, type Pricing, rateColumn, rateOf, statementOf, writeLinkedPayments } from "./ledger"
import { checkLines, checkNote, checkOpening, deleteGoods, documentIn, enter, entryLocation, locationNamed, newDocument, newestFirst, scoped, scopeOf, writeGoods } from "./stock"
import { checkPayment, locationParam, page, paged, pricingOf, toItem } from "./warehouse"

const invalid = (message: string) => fail(400, "validation_error", message)
const saleNotFound = () => fail(404, "not_found", "Sotuv topilmadi")
const customerNotFound = () => fail(404, "not_found", "Mijoz topilmadi")
const paymentNotFound = () => fail(404, "not_found", "To'lov topilmadi")
const documentNotFound = () => fail(404, "not_found", "Hujjat topilmadi")
const paymentLinked = () => fail(409, "payment_linked", "Bu to'lov sotuv bilan kiritilgan: sotuvni tahrirlang")
const paymentForOrder = () => fail(409, "payment_linked", "Bu to'lov buyurtma bilan kiritilgan: buyurtmani oching")
// linkedRefusal is why a payment entered with a document is not changed here.
const linkedRefusal = (p: TransactionRow) => (db.transactions.find((x) => x.id === p.linkedId)?.kind === "order" ? paymentForOrder() : paymentLinked())

const liveCustomer = (companyId: number, id: unknown) => liveCustomers(companyId).find((c) => c.id === Number(id))

function toSale(t: TransactionRow): Sale {
  const customer = t.customerId === null ? undefined : db.customers.find((c) => c.id === t.customerId)
  const rate = rateOf(t.rateId)
  return {
    id: t.id,
    number: t.number,
    location_id: t.locationId!,
    location_name: locationNamed(t.locationId),
    customer: t.customerId === null ? null : { id: t.customerId, name: customer ? customerNameOf(customer) : "" },
    at: t.at,
    currency_id: t.currencyId,
    rate: asRate(rateColumn(rate, t.currencyId)),
    note: t.note,
    total: asAmount(t.total),
    total_uzs: asAmount(convertAmount(t.total, t.currencyId, 1, rate)),
    paid: asAmount(paidOf(t)),
    items_count: itemsOf(t.id).length,
    created_by_name: nameOf(t.by, t.companyId, t.byName),
    created_at: t.createdAt,
    updated_at: t.updatedAt,
  }
}

const toSaleDetail = (t: TransactionRow): SaleDetail => ({
  ...toSale(t),
  items: itemsOf(t.id).map(toItem),
  payments: linkedPaymentsOf(t.id).map((l) => ({ id: l.id, bank_account_id: l.bankAccountId!, account_name: (db.accounts[l.companyId] ?? []).find((a) => a.id === l.bankAccountId)?.name ?? "", amount: asAmount(l.total), currency_id: l.currencyId })),
})

type CheckedSale = { customerId: number | null; at: string; pricing: Pricing; note: string | null; items: ReturnType<typeof checkLines> }

// checkSale reads a body in the Go API's order (logic/sales.md, 3.2): the
// customer (one of the company's live ones, or none), the moment, the
// currency and rate, the note, the lines (products and services). The
// payments are read as they are written, and a retail sale has to be paid
// in full after.
function checkSale(companyId: number, body: Record<string, unknown>, by: string, held: number[], current?: Pricing): CheckedSale | Response {
  let customerId: number | null = null
  if (body.customer_id !== undefined && body.customer_id !== null) {
    const customer = liveCustomer(companyId, body.customer_id)
    if (!customer) return invalid("Mijozni tanlang")
    customerId = customer.id
  }
  const at = atOf(body.at)
  if (at instanceof Response) return at
  const pricing = priceIn(companyId, body, at, by, current)
  if (pricing instanceof Response) return pricing
  const note = checkNote(body.note)
  if (note instanceof Response) return note
  const items = checkLines(companyId, body.items, held, { withPrice: true, allowService: true })
  if (items instanceof Response) return items
  return { customerId, at, pricing, note, items }
}

// paidInFull refuses a retail sale that is not paid exactly in full with it.
const paidInFull = (doc: TransactionRow): Response | null => (doc.customerId === null && paidOf(doc) !== doc.total ? invalid("Mijozsiz sotuv to'liq to'langan bo'lsin") : null)

function toCustomerPayment(p: TransactionRow): CustomerPayment {
  const linked = p.linkedId === null ? undefined : db.transactions.find((x) => x.id === p.linkedId)
  const sale = linked?.kind === "sale" ? linked : undefined
  const rate = rateOf(p.rateId)
  return {
    id: p.id,
    customer_id: p.customerId!,
    sale_id: sale?.id ?? null,
    sale_number: sale?.number ?? null,
    order_id: linked?.kind === "order" ? (linked.orderId ?? null) : null,
    bank_account_id: p.bankAccountId!,
    account_name: (db.accounts[p.companyId] ?? []).find((a) => a.id === p.bankAccountId)?.name ?? "",
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

const customerPaymentsOf = (companyId: number, customerId: number) => liveDocuments(companyId).filter((t) => t.kind === "customer_payment" && t.customerId === customerId)

function toCustomerOpening(t: TransactionRow): CustomerOpening {
  const rate = rateOf(t.rateId)
  return {
    id: t.id,
    kind: t.kind === "customer_prepay" ? "prepay" : "debt",
    customer_id: t.customerId!,
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

const customerOpeningOf = (companyId: number, customerId: number, id: unknown) =>
  liveDocuments(companyId).find((t) => t.id === Number(id) && t.customerId === customerId && (t.kind === "customer_debt" || t.kind === "customer_prepay"))

export const salesHandlers = [
  http.get(api("/app/sales"), ({ request }) => {
    const member = scoped(request, "sales.view")
    if (member instanceof Response) return member
    const query = new URL(request.url).searchParams
    const locationId = locationParam(query, member.allowed)
    if (locationId instanceof Response) return locationId
    let customerId = 0
    if (query.has("customer_id")) {
      customerId = Number(query.get("customer_id"))
      if (!Number.isInteger(customerId) || customerId <= 0) return invalid("Mijoz noto'g'ri")
    }
    const n = page(query)
    if (n instanceof Response) return n
    const ids = scopeOf(member.allowed, locationId)
    const all = liveDocuments(member.companyId)
      .filter((t) => t.kind === "sale" && ids.includes(t.locationId!) && (customerId === 0 || t.customerId === customerId))
      .sort(newestFirst)
    return HttpResponse.json(paged(all.map(toSale), n))
  }),

  http.post(api("/app/sales"), async ({ request }) => {
    const member = scoped(request, "sales.create")
    if (member instanceof Response) return member
    const body = (await request.json()) as Record<string, unknown>
    const locationId = entryLocation(body, member.allowed)
    if (locationId instanceof Response) return locationId
    const c = checkSale(member.companyId, body, member.phone, [])
    if (c instanceof Response) return c
    const doc = newDocument("sale", member.companyId, member.phone, { at: c.at, locationId, customerId: c.customerId, currencyId: c.pricing.currencyId, rateId: c.pricing.rateId, note: c.note })
    return enter(
      doc,
      () => writeGoods(doc, c.items as never, [locationId]) ?? writeLinkedPayments(doc, body.payments, member.phone) ?? paidInFull(doc),
      () => toSaleDetail(doc),
    )
  }),

  http.get(api("/app/sales/:id"), ({ params, request }) => {
    const member = scoped(request, "sales.view")
    if (member instanceof Response) return member
    const t = documentIn(member.companyId, "sale", params.id, member.allowed)
    return t ? HttpResponse.json(toSaleDetail(t)) : saleNotFound()
  }),

  http.put(api("/app/sales/:id"), async ({ params, request }) => {
    const member = scoped(request, "sales.edit")
    if (member instanceof Response) return member
    const t = documentIn(member.companyId, "sale", params.id, member.allowed)
    if (!t) return saleNotFound()
    const body = (await request.json()) as Record<string, unknown>
    const c = checkSale(member.companyId, body, member.phone, itemsOf(t.id).map((i) => i.productId), pricingOf(t))
    if (c instanceof Response) return c
    const was = { customerId: t.customerId, at: t.at, currencyId: t.currencyId, rateId: t.rateId, note: t.note, updatedAt: t.updatedAt }
    const wasPayments = linkedPaymentsOf(t.id)
    Object.assign(t, { customerId: c.customerId, at: c.at, currencyId: c.pricing.currencyId, rateId: c.pricing.rateId, note: c.note, updatedAt: now() })
    const refusal = writeGoods(t, c.items as never, [t.locationId!]) ?? writeLinkedPayments(t, body.payments, member.phone) ?? paidInFull(t)
    if (refusal) {
      Object.assign(t, was)
      // The payments written anew go, the ones there come back.
      db.transactions = db.transactions.filter((x) => x.linkedId !== t.id || wasPayments.includes(x))
      for (const p of wasPayments) p.deleted = false
      return refusal
    }
    return HttpResponse.json(toSaleDetail(t))
  }),

  http.delete(api("/app/sales/:id"), ({ params, request }) => {
    const member = scoped(request, "sales.delete")
    if (member instanceof Response) return member
    const t = documentIn(member.companyId, "sale", params.id, member.allowed)
    if (!t) return saleNotFound()
    const refusal = deleteGoods(t, [t.locationId!])
    if (refusal) return refusal
    for (const linked of linkedPaymentsOf(t.id)) linked.deleted = true
    return new HttpResponse(null, { status: 204 })
  }),

  http.get(api("/app/customers/:id/payments"), ({ params, request }) => {
    const member = permittedSession(request, "sales.view")
    if (member instanceof Response) return member
    const n = page(new URL(request.url).searchParams)
    if (n instanceof Response) return n
    const customer = liveCustomer(member.companyId, params.id)
    if (!customer) return customerNotFound()
    const all = customerPaymentsOf(member.companyId, customer.id).sort(newestFirst)
    return HttpResponse.json(paged(all.map(toCustomerPayment), n))
  }),

  http.post(api("/app/customers/:id/payments"), async ({ params, request }) => {
    const member = permittedSession(request, "sales.create")
    if (member instanceof Response) return member
    const customer = liveCustomer(member.companyId, params.id)
    if (!customer) return customerNotFound()
    const c = checkPayment(member.companyId, (await request.json()) as Record<string, unknown>, member.phone, 0)
    if (c instanceof Response) return c
    const doc = newDocument("customer_payment", member.companyId, member.phone, { at: c.at, customerId: customer.id, bankAccountId: c.accountId, currencyId: c.pricing.currencyId, rateId: c.pricing.rateId, total: c.amount, note: c.note })
    db.transactions.push(doc)
    return HttpResponse.json(toCustomerPayment(doc), { status: 201 })
  }),

  http.put(api("/app/customers/:id/payments/:paymentId"), async ({ params, request }) => {
    const member = permittedSession(request, "sales.edit")
    if (member instanceof Response) return member
    const p = customerPaymentsOf(member.companyId, Number(params.id)).find((x) => x.id === Number(params.paymentId))
    if (!p) return paymentNotFound()
    if (p.linkedId !== null) return linkedRefusal(p)
    const c = checkPayment(member.companyId, (await request.json()) as Record<string, unknown>, member.phone, p.bankAccountId!, pricingOf(p))
    if (c instanceof Response) return c
    Object.assign(p, { bankAccountId: c.accountId, total: c.amount, at: c.at, currencyId: c.pricing.currencyId, rateId: c.pricing.rateId, note: c.note, updatedAt: now() })
    return HttpResponse.json(toCustomerPayment(p))
  }),

  http.delete(api("/app/customers/:id/payments/:paymentId"), ({ params, request }) => {
    const member = permittedSession(request, "sales.delete")
    if (member instanceof Response) return member
    const p = customerPaymentsOf(member.companyId, Number(params.id)).find((x) => x.id === Number(params.paymentId))
    if (!p) return paymentNotFound()
    if (p.linkedId !== null) return linkedRefusal(p)
    p.deleted = true
    return new HttpResponse(null, { status: 204 })
  }),

  http.get(api("/app/customers/:id/openings"), ({ params, request }) => {
    const member = permittedSession(request, "sales.view")
    if (member instanceof Response) return member
    const n = page(new URL(request.url).searchParams)
    if (n instanceof Response) return n
    const customer = liveCustomer(member.companyId, params.id)
    if (!customer) return customerNotFound()
    const all = liveDocuments(member.companyId)
      .filter((t) => t.customerId === customer.id && (t.kind === "customer_debt" || t.kind === "customer_prepay"))
      .sort(newestFirst)
    return HttpResponse.json(paged(all.map(toCustomerOpening), n))
  }),

  http.post(api("/app/customers/:id/openings"), async ({ params, request }) => {
    const member = permittedSession(request, "sales.create")
    if (member instanceof Response) return member
    const customer = liveCustomer(member.companyId, params.id)
    if (!customer) return customerNotFound()
    const body = (await request.json()) as Record<string, unknown>
    const c = checkOpening(member.companyId, body, member.phone)
    if (c instanceof Response) return c
    const kind = c.kind === "supplier_prepay" ? "customer_prepay" : "customer_debt"
    const doc = newDocument(kind, member.companyId, member.phone, { at: c.at, customerId: customer.id, currencyId: c.pricing.currencyId, rateId: c.pricing.rateId, total: c.amount, note: c.note })
    db.transactions.push(doc)
    return HttpResponse.json(toCustomerOpening(doc), { status: 201 })
  }),

  http.put(api("/app/customers/:id/openings/:openingId"), async ({ params, request }) => {
    const member = permittedSession(request, "sales.edit")
    if (member instanceof Response) return member
    const t = customerOpeningOf(member.companyId, Number(params.id), params.openingId)
    if (!t) return documentNotFound()
    const body = (await request.json()) as Record<string, unknown>
    const c = checkOpening(member.companyId, body, member.phone, pricingOf(t))
    if (c instanceof Response) return c
    const kind = c.kind === "supplier_prepay" ? "customer_prepay" : "customer_debt"
    if (kind !== t.kind) return invalid("Tur o'zgartirilmaydi")
    Object.assign(t, { at: c.at, currencyId: c.pricing.currencyId, rateId: c.pricing.rateId, total: c.amount, note: c.note, updatedAt: now() })
    return HttpResponse.json(toCustomerOpening(t))
  }),

  http.delete(api("/app/customers/:id/openings/:openingId"), ({ params, request }) => {
    const member = permittedSession(request, "sales.delete")
    if (member instanceof Response) return member
    const t = customerOpeningOf(member.companyId, Number(params.id), params.openingId)
    if (!t) return documentNotFound()
    t.deleted = true
    return new HttpResponse(null, { status: 204 })
  }),

  http.get(api("/app/customers/:id/statement"), ({ params, request }) => {
    const member = permittedSession(request, "sales.view")
    if (member instanceof Response) return member
    const n = page(new URL(request.url).searchParams)
    if (n instanceof Response) return n
    const customer = liveCustomer(member.companyId, params.id)
    if (!customer) return customerNotFound()
    return HttpResponse.json(paged(statementOf("customer", customer.id), n))
  }),
]
