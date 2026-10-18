// The orders of the mock API, under the Go API's rules (logic/orders.md;
// backend/internal/order).
import { http, HttpResponse } from "msw"
import { formatDate } from "@/lib/format"
import type { Order, OrderDetail, OrderLine, OrderPayment } from "@/lib/types"
import { asText, checkValues, diffValues, enterCustomer, liveCustomers, nameOf } from "./customers"
import {
  asAmount,
  asQuantity,
  asRate,
  convertAmount,
  fifoCostOf,
  itemsOf,
  linesText,
  linkedPaymentsOf,
  money as moneyPattern,
  orderDocumentOf,
  paidOf,
  priceIn,
  priceText,
  rateColumn,
  rateOf,
  takeMoves,
  writeLinkedPayments,
} from "./ledger"
import { checkLines, newDocument, writeGoods } from "./stock"
import { checkPayment, pricingOf } from "./warehouse"
import {
  type Answer,
  customerNameOf,
  db,
  locationsOf,
  nameIn,
  nextId,
  now,
  type StageRow,
  type OrderHistoryRow,
  type OrderRow,
  type OrderTypeRow,
  permissionsOf,
  type TransactionRow,
} from "./data"
import { api, fail, forbidden, isMember, normalizePhone, permittedSession } from "./gate"

const invalid = (message: string) => fail(400, "validation_error", message)
const orderNotFound = () => fail(404, "not_found", "Buyurtma topilmadi")
const paymentNotFound = () => fail(404, "not_found", "To'lov topilmadi")

// liveOrders is a company's orders, without the deleted.
export const liveOrders = (companyId: number) => db.orders.filter((t) => t.companyId === companyId && !t.deleted)

// Member is who a request is of: a member of the company the token is for.
type Member = { phone: string; companyId: number }

// scopeOf is the locations the member may work in, by id
// (logic/locations.md, section 5).
const scopeOf = (member: Member) => locationsOf(member.phone, member.companyId).map((l) => l.id)

// visibleOrders is the orders the member works with: those of the locations
// they may work in (logic/locations.md, section 6).
const visibleOrders = (member: Member) => {
  const scope = scopeOf(member)
  return liveOrders(member.companyId).filter((t) => scope.includes(t.locationId))
}

const liveStage = (companyId: number, id: unknown): StageRow | undefined =>
  db.stages.find((s) => s.id === id && s.companyId === companyId && !s.deleted)
const liveOrderType = (companyId: number, id: unknown): OrderTypeRow | undefined =>
  db.orderTypes.find((t) => t.id === id && t.companyId === companyId && !t.deleted)
const liveFields = (type: OrderTypeRow) => type.fields.filter((f) => !f.deleted)

const PAGE_SIZE = 20

// moneyOf is an order's money as the API shows it on the order
// (logic/orders.md, 4.3): from its live document, nothing in so'm without one.
function moneyOf(t: OrderRow): Pick<Order, "amount" | "currency_id" | "rate" | "amount_uzs" | "paid"> {
  const doc = orderDocumentOf(t.id)
  if (!doc) return { amount: "0.00", currency_id: 1, rate: "1.0000", amount_uzs: "0.00", paid: "0.00" }
  const rate = rateOf(doc.rateId)
  return {
    amount: asAmount(doc.total),
    currency_id: doc.currencyId,
    rate: asRate(rateColumn(rate, doc.currencyId)),
    amount_uzs: asAmount(convertAmount(doc.total, doc.currencyId, 1, rate)),
    paid: asAmount(paidOf(doc)),
  }
}

// toOrder is an order as the API answers it: with its customer by its name and
// phone, its assignee by the name they go by now (the name of then,
// once they have left the company), and its money.
export const toOrder = (t: OrderRow): Order => {
  const customer = db.customers.find((c) => c.id === t.customerId)!
  return {
    id: t.id,
    type_id: t.typeId,
    stage_id: t.stageId,
    location_id: t.locationId,
    title: t.title,
    deadline: t.deadline,
    customer: { id: customer.id, phone: customer.phone, name: customerNameOf(customer) },
    assignee: t.assignee === null ? null : { phone: t.assignee, full_name: nameOf(t.assignee, t.companyId, t.assigneeName) },
    values: { ...t.values },
    ...moneyOf(t),
    created_by_name: nameOf(t.by, t.companyId, t.byName),
    created_at: t.createdAt,
    updated_at: t.updatedAt,
  }
}

// toOrderPayment is a payment entered for an order as the API shows it.
function toOrderPayment(p: TransactionRow): OrderPayment {
  const rate = rateOf(p.rateId)
  return {
    id: p.id,
    bank_account_id: p.bankAccountId!,
    account_name: (db.accounts[p.companyId] ?? []).find((a) => a.id === p.bankAccountId)?.name ?? "",
    amount: asAmount(p.total),
    currency_id: p.currencyId,
    rate: asRate(rateColumn(rate, p.currencyId)),
    amount_uzs: asAmount(convertAmount(p.total, p.currencyId, 1, rate)),
    at: p.at,
    note: p.note,
    created_by_name: nameOf(p.by, p.companyId, p.byName),
  }
}

// seesCost tells whether the member sees what the goods cost (purchases.view).
const seesCost = (member: { phone: string; companyId: number }) => permissionsOf(member.phone, member.companyId).includes("purchases.view")

// toOrderDetail is an order on its own page: with the lines of its
// document, the payments entered for it (the newest first) and, when
// asked for, the FIFO cost of its goods and the profit (logic/orders.md, 4.4).
export function toOrderDetail(t: OrderRow, withCost: boolean): OrderDetail {
  const order = toOrder(t)
  const doc = orderDocumentOf(t.id)
  const items = doc ? itemsOf(doc.id) : []
  const products = items.filter((i) => db.products.find((p) => p.id === i.productId)?.kind === "product").map((i) => i.productId)
  const costs = withCost && doc ? fifoCostOf(t.companyId, doc.id, products) : null
  let total = 0
  const lines = items.map((i): OrderLine => {
    const product = db.products.find((p) => p.id === i.productId)!
    const cost = costs === null ? null : product.kind === "product" ? (costs.get(i.productId) ?? 0) : 0
    if (cost !== null) total += cost
    return { product_id: product.id, name: product.name, kind: product.kind, unit: product.unit, quantity: asQuantity(i.quantity), cost_uzs: cost === null ? null : asAmount(cost) }
  })
  const payments = (doc ? linkedPaymentsOf(doc.id) : []).sort((a, b) => b.at.localeCompare(a.at) || b.id - a.id).map(toOrderPayment)
  const amountUzs = Number(order.amount_uzs)
  return { ...order, items: lines, payments, cost_uzs: withCost ? asAmount(total) : null, profit_uzs: withCost && amountUzs > 0 ? asAmount(amountUzs - total) : null }
}

// writeOrderDocument saves the order's money as the Go API does
// (logic/orders.md, 4.3): the document is written when there is a price,
// a line or an advance (withPayments: on entry alone), or it is there
// already; its price and lines replaced, its moves written anew, the
// advance entered, the stock checked last. A refusal leaves everything as
// it was. What is wrong is told in this order: the price, the currency
// and the rate, the lines, the advance, the stock.
function writeOrderDocument(member: Member, order: OrderRow, body: Record<string, unknown>, withPayments: boolean): Response | null {
  let amount = 0
  if (typeof body.amount === "string" && body.amount.trim() !== "") {
    if (!moneyPattern.test(body.amount.trim())) return invalid("Narx noto'g'ri")
    amount = Number(body.amount)
  } else if (body.amount !== undefined && body.amount !== null && body.amount !== "") {
    return invalid("Narx noto'g'ri")
  }
  const existing = orderDocumentOf(order.id)
  const items = Array.isArray(body.items) ? body.items : []
  const payments = withPayments && Array.isArray(body.payments) ? body.payments : []
  if (!existing && amount === 0 && items.length === 0 && payments.length === 0) return null
  const at = existing ? existing.at : now()
  const pricing = priceIn(member.companyId, body, at, member.phone, existing ? pricingOf(existing) : undefined)
  if (pricing instanceof Response) return pricing
  const held = existing ? itemsOf(existing.id).map((i) => i.productId) : []
  const lines = checkLines(member.companyId, items, held, { allowNone: true, allowService: true })
  if (lines instanceof Response) return lines
  const doc = existing ?? newDocument("order", member.companyId, member.phone, { at, locationId: order.locationId, customerId: order.customerId, orderId: order.id })
  const was = { total: doc.total, currencyId: doc.currencyId, rateId: doc.rateId }
  if (!existing) db.transactions.push(doc)
  Object.assign(doc, { total: amount, currencyId: pricing.currencyId, rateId: pricing.rateId, updatedAt: now() })
  const undo = (refusal: Response) => {
    if (existing) Object.assign(doc, was)
    else {
      takeMoves(doc.id)
      db.items = db.items.filter((i) => i.transactionId !== doc.id)
      db.transactions = db.transactions.filter((t) => t.id !== doc.id && t.linkedId !== doc.id)
    }
    return refusal
  }
  if (withPayments) {
    const refusal = writeLinkedPayments(doc, payments, member.phone)
    if (refusal) return undo(refusal)
  }
  const refusal = writeGoods(doc, lines, [order.locationId])
  return refusal ? undo(refusal) : null
}

// hideOrderDocument hides the order's document with its payments and gives
// its goods back to the stock.
function hideOrderDocument(order: OrderRow) {
  const doc = orderDocumentOf(order.id)
  if (!doc) return
  for (const p of linkedPaymentsOf(doc.id)) p.deleted = true
  takeMoves(doc.id)
  doc.deleted = true
}

// orderTitle is the API's rule for a title: trimmed, not empty, two hundred
// characters at most.
function orderTitle(raw: unknown): string | Response {
  const title = typeof raw === "string" ? raw.trim() : ""
  if (!title) return invalid("Buyurtma nomini kiriting")
  if ([...title].length > 200) return invalid("Buyurtma nomi 200 belgidan oshmasin")
  return title
}

// orderDeadline is a deadline as the API takes it: a day written YYYY-MM-DD,
// one that exists; a day that is past is taken too.
function orderDeadline(raw: unknown): string | Response {
  const day = typeof raw === "string" ? raw : ""
  if (day.trim() === "") return invalid("Muddatni kiriting")
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return invalid("Muddat noto'g'ri")
  const date = new Date(`${day}T00:00:00Z`)
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== day) return invalid("Muddat noto'g'ri")
  return day
}

// An assignee as an order keeps them: nobody, or a member's phone and the
// name they go by.
type Assignee = { phone: string | null; name: string | null }

// assigneeOf reads the phone a client sent as the assignee: nothing for
// nobody, otherwise a member of the company who works in the order's
// location (logic/locations.md, section 6).
function assigneeOf(companyId: number, locationId: number, raw: unknown): Assignee | Response {
  if (raw === undefined || raw === null || (typeof raw === "string" && raw.trim() === "")) return { phone: null, name: null }
  const phone = typeof raw === "string" ? normalizePhone(raw) : null
  if (!phone || !isMember(phone, companyId)) return invalid("Mas'ul kompaniya a'zosi emas")
  if (!locationsOf(phone, companyId).some((l) => l.id === locationId)) return invalid("Mas'ul bu lokatsiyada ishlamaydi")
  return { phone, name: nameIn(phone, companyId) }
}

// sameAssignee tells whether the phone a client sent names the member the
// order is assigned to already (or nobody, when it is assigned to nobody).
function sameAssignee(raw: unknown, order: OrderRow): boolean {
  if (raw === undefined || raw === null || (typeof raw === "string" && raw.trim() === "")) return order.assignee === null
  return typeof raw === "string" && order.assignee !== null && normalizePhone(raw) === order.assignee
}

// customerOf is a new order's customer: the one named, which has to be the
// company's own and not deleted, or a new one entered with the order under
// the customers' rules. Nothing named is refused.
function customerOf(member: { phone: string; companyId: number }, raw: unknown): number | Response {
  const sent = (raw ?? {}) as { id?: unknown; type_id?: unknown; phone?: unknown; values?: unknown }
  if (sent.id !== undefined && sent.id !== null) {
    const customer = liveCustomers(member.companyId).find((c) => c.id === sent.id)
    return customer ? customer.id : invalid("Mijozni tanlang")
  }
  if (sent.type_id === undefined && sent.phone === undefined && sent.values === undefined) return invalid("Mijozni tanlang")
  const entered = enterCustomer(member, sent)
  return entered instanceof Response ? entered : entered.id
}

// stageName is the name of the stage an order stands in, "" once the stage
// is gone.
const stageName = (id: number) => db.stages.find((s) => s.id === id)?.name ?? ""

// record writes down what a member did to an order.
function record(order: OrderRow, action: OrderHistoryRow["action"], by: string, at: string, changes: OrderHistoryRow["changes"]) {
  db.orderHistory.push({ id: nextId(), orderId: order.id, action, by, byName: nameIn(by, order.companyId), createdAt: at, changes })
}

// found tells whether a search finds the order: the text in its title, its
// text answers and its customer's text answers, whatever the case; the
// digits of a search written as a number or a phone is in the customer's
// phone and in the order's and the customer's whole number answers too. The
// names of the options are not searched.
function found(order: OrderRow, search: string): boolean {
  const text = search.trim().toLowerCase()
  if (!text) return true
  const digits = /^[\d\s+\-()]+$/.test(text) ? text.replace(/\D/g, "") : ""
  const customer = db.customers.find((c) => c.id === order.customerId)!
  const customerFields = db.types.find((t) => t.id === customer.typeId)?.fields ?? []
  const orderFields = db.orderTypes.find((t) => t.id === order.typeId)?.fields ?? []
  const inTexts = (fields: { id: number; kind: string }[], values: Record<number, Answer>) =>
    fields.some((f) => {
      const answer = values[f.id]
      return f.kind === "string" && typeof answer === "string" && answer.toLowerCase().includes(text)
    })
  const inNumbers = (fields: { id: number; kind: string }[], values: Record<number, Answer>) =>
    fields.some((f) => {
      const answer = values[f.id]
      return f.kind === "int" && typeof answer === "number" && String(answer).includes(digits)
    })
  return (
    order.title.toLowerCase().includes(text) ||
    inTexts(orderFields, order.values) ||
    inTexts(customerFields, customer.values) ||
    (digits !== "" && (customer.phone.includes(digits) || inNumbers(orderFields, order.values) || inNumbers(customerFields, customer.values)))
  )
}

export const ordersHandlers = [
  http.get(api("/app/orders"), ({ request }) => {
    const member = permittedSession(request, "orders.view")
    if (member instanceof Response) return member
    const query = new URL(request.url).searchParams
    const page = query.has("page") ? Number(query.get("page")) : 1
    if (!Number.isInteger(page) || page < 1) return invalid("Sahifa raqami noto'g'ri")
    // one is a filter by id: none, the id, or what is wrong with it.
    const one = (name: string, message: string): number | null | Response => {
      if (!query.has(name)) return null
      const id = Number(query.get(name))
      return Number.isInteger(id) && id >= 1 ? id : invalid(message)
    }
    const typeId = one("type_id", "Buyurtma turi noto'g'ri")
    if (typeId instanceof Response) return typeId
    const stageId = one("stage_id", "Bosqich noto'g'ri")
    if (stageId instanceof Response) return stageId
    const customerId = one("customer_id", "Mijoz noto'g'ri")
    if (customerId instanceof Response) return customerId
    // The orders of one location, which the member has to work in; without
    // one, of every location they work in.
    const locationId = one("location_id", "Lokatsiya noto'g'ri")
    if (locationId instanceof Response) return locationId
    if (locationId !== null && !scopeOf(member).includes(locationId)) return forbidden()
    let assignee: string | null = null
    if (query.get("assignee")) {
      assignee = normalizePhone(query.get("assignee")!)
      if (!assignee) return invalid("Mas'ul noto'g'ri")
    }
    const all = visibleOrders(member)
      .filter(
        (t) =>
          (locationId === null || t.locationId === locationId) &&
          (typeId === null || t.typeId === typeId) &&
          (stageId === null || t.stageId === stageId) &&
          (customerId === null || t.customerId === customerId) &&
          (assignee === null || t.assignee === assignee) &&
          found(t, query.get("search") ?? ""),
      )
      // The one due soonest first, the older before the newer of one day.
      .sort((a, b) => a.deadline.localeCompare(b.deadline) || a.id - b.id)
    return HttpResponse.json({
      items: all.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE).map(toOrder),
      total: all.length,
      page,
      page_size: PAGE_SIZE,
    })
  }),

  http.post(api("/app/orders"), async ({ request }) => {
    const member = permittedSession(request, "orders.create")
    if (member instanceof Response) return member
    const body = (await request.json()) as {
      type_id?: unknown
      location_id?: unknown
      title?: unknown
      deadline?: unknown
      stage_id?: unknown
      assignee_phone?: unknown
      values?: unknown
      customer?: unknown
      amount?: unknown
      currency_id?: unknown
      rate?: unknown
      items?: unknown
      payments?: unknown
    }
    // A location the member may not work in is refused before anything
    // else, the way a missing permission is.
    const scope = scopeOf(member)
    if (typeof body.location_id === "number" && body.location_id > 0 && !scope.includes(body.location_id)) return forbidden()
    // What is wrong is said in this order: the title, the deadline, the
    // location, the type, the stage, the assignee, the answers, the customer.
    const title = orderTitle(body.title)
    if (title instanceof Response) return title
    const deadline = orderDeadline(body.deadline)
    if (deadline instanceof Response) return deadline
    const locationId = body.location_id
    if (typeof locationId !== "number" || !scope.includes(locationId)) return invalid("Lokatsiyani tanlang")
    const type = liveOrderType(member.companyId, body.type_id)
    if (!type) return invalid("Buyurtma turini tanlang")
    const stage = liveStage(member.companyId, body.stage_id)
    if (!stage) return invalid("Bosqichni tanlang")
    const assignee = assigneeOf(member.companyId, locationId, body.assignee_phone)
    if (assignee instanceof Response) return assignee
    const values = checkValues(liveFields(type), {}, body.values)
    if (values instanceof Response) return values
    // A customer entered with the order is a customer entered: that takes
    // its own permission (logic/roles.md, section 4.3).
    const wanted = body.customer as { id?: unknown } | null | undefined
    if (wanted && typeof wanted === "object" && wanted.id === undefined && !permissionsOf(member.phone, member.companyId).includes("customers.create")) {
      return forbidden()
    }
    // A new customer is entered last: nothing after it can refuse the order.
    const customerId = customerOf(member, body.customer)
    if (customerId instanceof Response) return customerId
    const at = now()
    const order: OrderRow = {
      id: nextId(),
      companyId: member.companyId,
      typeId: type.id,
      stageId: stage.id,
      locationId,
      customerId,
      title,
      deadline,
      assignee: assignee.phone,
      assigneeName: assignee.name,
      values,
      by: member.phone,
      byName: nameIn(member.phone, member.companyId),
      createdAt: at,
      updatedAt: at,
    }
    db.orders.push(order)
    record(order, "created", member.phone, at, [])
    // The money last: a refusal enters nothing, the new customer included.
    const refusal = writeOrderDocument(member, order, body as Record<string, unknown>, true)
    if (refusal) {
      db.orders = db.orders.filter((o) => o !== order)
      db.orderHistory = db.orderHistory.filter((h) => h.orderId !== order.id)
      if (wanted && typeof wanted === "object" && wanted.id === undefined) db.customers = db.customers.filter((c) => c.id !== customerId)
      return refusal
    }
    return HttpResponse.json(toOrderDetail(order, seesCost(member)), { status: 201 })
  }),

  http.get(api("/app/orders/:id"), ({ params, request }) => {
    const member = permittedSession(request, "orders.view")
    if (member instanceof Response) return member
    const order = visibleOrders(member).find((t) => t.id === Number(params.id))
    return order ? HttpResponse.json(toOrderDetail(order, seesCost(member))) : orderNotFound()
  }),

  http.put(api("/app/orders/:id"), async ({ params, request }) => {
    const member = permittedSession(request, "orders.edit")
    if (member instanceof Response) return member
    const body = (await request.json()) as { title?: unknown; deadline?: unknown; stage_id?: unknown; assignee_phone?: unknown; values?: unknown; amount?: unknown; currency_id?: unknown; rate?: unknown; items?: unknown }
    // An order that is not there is said first, whatever is sent.
    const order = visibleOrders(member).find((t) => t.id === Number(params.id))
    if (!order) return orderNotFound()
    const title = orderTitle(body.title)
    if (title instanceof Response) return title
    const deadline = orderDeadline(body.deadline)
    if (deadline instanceof Response) return deadline
    const stage = liveStage(member.companyId, body.stage_id)
    if (!stage) return invalid("Bosqichni tanlang")
    // The assignee the order has stays as they are, a member no more too;
    // another one has to be a member.
    const assignee = sameAssignee(body.assignee_phone, order)
      ? { phone: order.assignee, name: order.assignee === null ? null : nameOf(order.assignee, order.companyId, order.assigneeName) }
      : assigneeOf(member.companyId, order.locationId, body.assignee_phone)
    if (assignee instanceof Response) return assignee
    const fields = liveFields(db.orderTypes.find((t) => t.id === order.typeId)!)
    const values = checkValues(fields, order.values, body.values)
    if (values instanceof Response) return values
    // The money after the order's own fields: the document saved anew, its
    // payments left alone; what changed goes into the history.
    const wasDoc = orderDocumentOf(order.id)
    const wasMoney = { price: wasDoc ? priceText(wasDoc.total, wasDoc.currencyId) : "", lines: wasDoc ? linesText(itemsOf(wasDoc.id)) : "" }
    const refusal = writeOrderDocument(member, order, body as Record<string, unknown>, false)
    if (refusal) return refusal
    const nowDoc = orderDocumentOf(order.id)
    const nowMoney = { price: nowDoc ? priceText(nowDoc.total, nowDoc.currencyId) : "", lines: nowDoc ? linesText(itemsOf(nowDoc.id)) : "" }
    const changes: OrderHistoryRow["changes"] = []
    if (order.title !== title) changes.push({ label: "Nomi", old: order.title, new: title })
    if (order.deadline !== deadline) changes.push({ label: "Muddat", old: formatDate(order.deadline), new: formatDate(deadline) })
    if (order.stageId !== stage.id) changes.push({ label: "Bosqich", old: stageName(order.stageId), new: stage.name })
    const wasAssignee = order.assignee === null ? "" : (nameOf(order.assignee, order.companyId, order.assigneeName) ?? "")
    if (wasAssignee !== (assignee.name ?? "")) changes.push({ label: "Mas'ul", old: wasAssignee, new: assignee.name ?? "" })
    changes.push(...diffValues(fields, order.values, values))
    if (wasMoney.price !== nowMoney.price) changes.push({ label: "Narx", old: wasMoney.price, new: nowMoney.price })
    if (wasMoney.lines !== nowMoney.lines) changes.push({ label: "Mahsulotlar", old: wasMoney.lines, new: nowMoney.lines })
    // A save that changes nothing writes nothing.
    if (changes.length > 0) {
      const at = now()
      order.title = title
      order.deadline = deadline
      order.stageId = stage.id
      order.assignee = assignee.phone
      order.assigneeName = assignee.name
      order.values = values
      order.updatedAt = at
      record(order, "updated", member.phone, at, changes)
    }
    return HttpResponse.json(toOrderDetail(order, seesCost(member)))
  }),

  http.patch(api("/app/orders/:id/stage"), async ({ params, request }) => {
    const member = permittedSession(request, "orders.edit")
    if (member instanceof Response) return member
    const { stage_id: stageId } = (await request.json()) as { stage_id?: unknown }
    const order = visibleOrders(member).find((t) => t.id === Number(params.id))
    if (!order) return orderNotFound()
    // The same stage changes nothing.
    if (order.stageId === stageId) return HttpResponse.json(toOrderDetail(order, seesCost(member)))
    const stage = liveStage(member.companyId, stageId)
    if (!stage) return invalid("Bosqichni tanlang")
    const at = now()
    const changes = [{ label: "Bosqich", old: stageName(order.stageId), new: stage.name }]
    order.stageId = stage.id
    order.updatedAt = at
    record(order, "updated", member.phone, at, changes)
    return HttpResponse.json(toOrderDetail(order, seesCost(member)))
  }),

  http.delete(api("/app/orders/:id"), ({ params, request }) => {
    const member = permittedSession(request, "orders.delete")
    if (member instanceof Response) return member
    const order = visibleOrders(member).find((t) => t.id === Number(params.id))
    if (!order) return orderNotFound()
    // Hidden, not removed: its answers and its history stay; its document
    // goes with it, the goods back to the stock, the payments hidden.
    order.deleted = true
    hideOrderDocument(order)
    record(order, "deleted", member.phone, now(), [])
    return new HttpResponse(null, { status: 204 })
  }),

  // The payments for an order on their own (logic/orders.md, 4.3): the
  // customer's, at their own moment, linked to the order's document (made
  // for them when the order has none).
  http.post(api("/app/orders/:id/payments"), async ({ params, request }) => {
    const member = permittedSession(request, "orders.edit")
    if (member instanceof Response) return member
    const order = visibleOrders(member).find((t) => t.id === Number(params.id))
    if (!order) return orderNotFound()
    const c = checkPayment(member.companyId, (await request.json()) as Record<string, unknown>, member.phone, 0)
    if (c instanceof Response) return c
    let doc = orderDocumentOf(order.id)
    if (!doc) {
      const at = now()
      const pricing = priceIn(member.companyId, {}, at, member.phone)
      if (pricing instanceof Response) return pricing
      doc = newDocument("order", member.companyId, member.phone, { at, locationId: order.locationId, customerId: order.customerId, orderId: order.id, currencyId: pricing.currencyId, rateId: pricing.rateId })
      db.transactions.push(doc)
    }
    const p = newDocument("customer_payment", member.companyId, member.phone, {
      at: c.at, customerId: order.customerId, bankAccountId: c.accountId, linkedId: doc.id, currencyId: c.pricing.currencyId, rateId: c.pricing.rateId, total: c.amount, note: c.note,
    })
    db.transactions.push(p)
    return HttpResponse.json(toOrderPayment(p), { status: 201 })
  }),

  http.put(api("/app/orders/:id/payments/:paymentId"), async ({ params, request }) => {
    const member = permittedSession(request, "orders.edit")
    if (member instanceof Response) return member
    const order = visibleOrders(member).find((t) => t.id === Number(params.id))
    if (!order) return orderNotFound()
    const doc = orderDocumentOf(order.id)
    const p = doc ? linkedPaymentsOf(doc.id).find((x) => x.id === Number(params.paymentId)) : undefined
    if (!p) return paymentNotFound()
    const c = checkPayment(member.companyId, (await request.json()) as Record<string, unknown>, member.phone, p.bankAccountId!, pricingOf(p))
    if (c instanceof Response) return c
    Object.assign(p, { bankAccountId: c.accountId, total: c.amount, at: c.at, currencyId: c.pricing.currencyId, rateId: c.pricing.rateId, note: c.note, updatedAt: now() })
    return HttpResponse.json(toOrderPayment(p))
  }),

  http.delete(api("/app/orders/:id/payments/:paymentId"), ({ params, request }) => {
    const member = permittedSession(request, "orders.edit")
    if (member instanceof Response) return member
    const order = visibleOrders(member).find((t) => t.id === Number(params.id))
    if (!order) return orderNotFound()
    const doc = orderDocumentOf(order.id)
    const p = doc ? linkedPaymentsOf(doc.id).find((x) => x.id === Number(params.paymentId)) : undefined
    if (!p) return paymentNotFound()
    p.deleted = true
    return new HttpResponse(null, { status: 204 })
  }),

  http.get(api("/app/orders/:id/history"), ({ params, request }) => {
    const member = permittedSession(request, "orders.history")
    if (member instanceof Response) return member
    const order = visibleOrders(member).find((t) => t.id === Number(params.id))
    if (!order) return orderNotFound()
    return HttpResponse.json(
      db.orderHistory
        .filter((entry) => entry.orderId === order.id)
        // The latest first.
        .sort((a, b) => b.id - a.id)
        .map((entry) => ({
          id: entry.id,
          action: entry.action,
          actor_name: nameOf(entry.by, order.companyId, entry.byName),
          created_at: entry.createdAt,
          changes: entry.changes,
        })),
    )
  }),
]

// orderAnswerText writes an order's answer for people to read, as the history
// keeps it: the mock pages' tests compare against it.
export const orderAnswerText = asText
