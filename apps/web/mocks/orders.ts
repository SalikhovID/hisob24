// The orders of the mock API, under the Go API's rules (logic/tasks.md;
// backend/internal/order).
import { http, HttpResponse } from "msw"
import { formatDate } from "@/lib/format"
import type { Order } from "@/lib/types"
import { asText, checkValues, diffValues, enterCustomer, liveCustomers, nameOf } from "./customers"
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
} from "./data"
import { api, fail, forbidden, isMember, normalizePhone, permittedSession } from "./gate"

const invalid = (message: string) => fail(400, "validation_error", message)
const orderNotFound = () => fail(404, "not_found", "Buyurtma topilmadi")

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

// toOrder is an order as the API answers it: with its customer by its name and
// phone, and its assignee by the name they go by now (the name of then,
// once they have left the company).
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
    created_by_name: nameOf(t.by, t.companyId, t.byName),
    created_at: t.createdAt,
    updated_at: t.updatedAt,
  }
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
    return HttpResponse.json(toOrder(order), { status: 201 })
  }),

  http.get(api("/app/orders/:id"), ({ params, request }) => {
    const member = permittedSession(request, "orders.view")
    if (member instanceof Response) return member
    const order = visibleOrders(member).find((t) => t.id === Number(params.id))
    return order ? HttpResponse.json(toOrder(order)) : orderNotFound()
  }),

  http.put(api("/app/orders/:id"), async ({ params, request }) => {
    const member = permittedSession(request, "orders.edit")
    if (member instanceof Response) return member
    const body = (await request.json()) as { title?: unknown; deadline?: unknown; stage_id?: unknown; assignee_phone?: unknown; values?: unknown }
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
    const changes: OrderHistoryRow["changes"] = []
    if (order.title !== title) changes.push({ label: "Nomi", old: order.title, new: title })
    if (order.deadline !== deadline) changes.push({ label: "Muddat", old: formatDate(order.deadline), new: formatDate(deadline) })
    if (order.stageId !== stage.id) changes.push({ label: "Bosqich", old: stageName(order.stageId), new: stage.name })
    const wasAssignee = order.assignee === null ? "" : (nameOf(order.assignee, order.companyId, order.assigneeName) ?? "")
    if (wasAssignee !== (assignee.name ?? "")) changes.push({ label: "Mas'ul", old: wasAssignee, new: assignee.name ?? "" })
    changes.push(...diffValues(fields, order.values, values))
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
    return HttpResponse.json(toOrder(order))
  }),

  http.patch(api("/app/orders/:id/stage"), async ({ params, request }) => {
    const member = permittedSession(request, "orders.edit")
    if (member instanceof Response) return member
    const { stage_id: stageId } = (await request.json()) as { stage_id?: unknown }
    const order = visibleOrders(member).find((t) => t.id === Number(params.id))
    if (!order) return orderNotFound()
    // The same stage changes nothing.
    if (order.stageId === stageId) return HttpResponse.json(toOrder(order))
    const stage = liveStage(member.companyId, stageId)
    if (!stage) return invalid("Bosqichni tanlang")
    const at = now()
    const changes = [{ label: "Bosqich", old: stageName(order.stageId), new: stage.name }]
    order.stageId = stage.id
    order.updatedAt = at
    record(order, "updated", member.phone, at, changes)
    return HttpResponse.json(toOrder(order))
  }),

  http.delete(api("/app/orders/:id"), ({ params, request }) => {
    const member = permittedSession(request, "orders.delete")
    if (member instanceof Response) return member
    const order = visibleOrders(member).find((t) => t.id === Number(params.id))
    if (!order) return orderNotFound()
    // Hidden, not removed: its answers and its history stay.
    order.deleted = true
    record(order, "deleted", member.phone, now(), [])
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
