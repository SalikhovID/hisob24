// The customers of the mock API, under the Go API's rules
// (logic/customers.md; backend/internal/customer).
import { http, HttpResponse } from "msw"
import { formatPhone } from "@/lib/phone"
import type { Customer } from "@/lib/types"
import {
  type Answer,
  type CustomerRow,
  db,
  type FieldRow,
  type HistoryRow,
  nameIn,
  nextId,
  now,
  type OptionRow,
  type TypeRow,
} from "./data"
import { api, fail, isMember, normalizePhone, permittedSession } from "./gate"

const invalid = (message: string) => fail(400, "validation_error", message)
const customerNotFound = () => fail(404, "not_found", "Mijoz topilmadi")

// taken refuses a phone or an answer that another customer has, and names
// that customer.
const taken = (error: "phone_taken" | "value_taken", message: string, customerId: number) =>
  HttpResponse.json({ error, message, customer_id: customerId }, { status: 409 })

// customerPhone is a customer's phone as it is kept: an Uzbek number.
function customerPhone(raw: unknown): string | null {
  const phone = typeof raw === "string" ? normalizePhone(raw) : null
  return phone && /^998\d{9}$/.test(phone) ? phone : null
}

function liveType(companyId: number, id: unknown): TypeRow | undefined {
  return db.types.find((t) => t.id === id && t.companyId === companyId && !t.deleted)
}

const liveFields = (type: TypeRow) => type.fields.filter((f) => !f.deleted)

// FormField is a field of a form the owner set up, of a customer type or of
// a task type: what reading an answer needs of it.
export type FormField = Pick<FieldRow, "id" | "label" | "kind" | "required" | "dropdownId">

// offeredBy is the options of the field's dropdown, in their order.
function offeredBy(field: FormField): OptionRow[] {
  const dropdown = db.dropdowns.find((d) => d.id === field.dropdownId && !d.deleted)
  return dropdown ? dropdown.options.filter((o) => !o.deleted) : []
}

const isChoice = (field: FormField) => field.kind !== "string" && field.kind !== "int"
const isWhole = (value: unknown): value is number =>
  typeof value === "number" && Number.isInteger(value) && Math.abs(value) <= Number.MAX_SAFE_INTEGER

// chosen is the options of an answer to a choice field.
const chosen = (answer: Answer | undefined): number[] =>
  Array.isArray(answer) ? answer : typeof answer === "number" ? [answer] : []

// readAnswer reads what a client sent for one field: the answer as it is
// kept, undefined for a field left empty, or what is wrong with it. An
// option that is turned off is taken only where the customer has it (has).
function readAnswer(field: FormField, has: number[], raw: unknown): Answer | undefined | Response {
  if (raw === undefined || raw === null) return undefined
  const name = `«${field.label}»`
  const offers = (id: unknown): id is number =>
    isWhole(id) && offeredBy(field).some((o) => o.id === id && (o.active || has.includes(id)))
  switch (field.kind) {
    case "string": {
      if (typeof raw !== "string") return invalid(`${name} matn bo'lishi kerak`)
      const text = raw.trim()
      if ([...text].length > 500) return invalid(`${name} 500 belgidan oshmasin`)
      return text === "" ? undefined : text
    }
    case "int":
      return isWhole(raw) ? raw : invalid(`${name} butun son bo'lishi kerak`)
    case "dropdown":
    case "radio":
      return offers(raw) ? raw : invalid(`${name} uchun variant noto'g'ri`)
    default: {
      if (!Array.isArray(raw) || !raw.every(offers)) return invalid(`${name} uchun variant noto'g'ri`)
      // Each option once, in the order of the dropdown.
      const ids = offeredBy(field)
        .map((o) => o.id)
        .filter((id) => raw.includes(id))
      return ids.length > 0 ? ids : undefined
    }
  }
}

// checkValues reads the answers a client sent for the fields of a type: the
// answers as they are kept, or the first thing wrong with them, as the API
// tells it (an answer to a field the type has not, then the fields in their
// order). was is the record's answers before an edit. The tasks' answers
// are read the same way.
export function checkValues(fields: FormField[], was: Record<number, Answer>, raw: unknown): Record<number, Answer> | Response {
  const sent = (raw ?? {}) as Record<string, unknown>
  if (Object.keys(sent).some((key) => !fields.some((f) => String(f.id) === key))) return invalid("Bu turda bunday maydon yo'q")
  const values: Record<number, Answer> = {}
  for (const field of fields) {
    const answer = readAnswer(field, chosen(was[field.id]), sent[field.id])
    if (answer instanceof Response) return answer
    if (answer !== undefined) values[field.id] = answer
    else if (field.required) {
      return invalid(isChoice(field) ? `«${field.label}» ni tanlang` : `«${field.label}» maydonini to'ldiring`)
    }
  }
  return values
}

// liveCustomers is a company's customers, without the deleted.
export const liveCustomers = (companyId: number) => db.customers.filter((c) => c.companyId === companyId && !c.deleted)

// free refuses a phone, or an answer to a field that may not repeat, that
// another customer of the company has. except is the customer being edited.
function free(companyId: number, fields: FieldRow[], phone: string, values: Record<number, Answer>, except?: number) {
  const others = liveCustomers(companyId).filter((c) => c.id !== except)
  const samePhone = others.find((c) => c.phone === phone)
  if (samePhone) return taken("phone_taken", "Bu raqamli mijoz allaqachon bor", samePhone.id)
  const same = (a: Answer, b: Answer | undefined) =>
    typeof a === "string" ? typeof b === "string" && a.toLowerCase() === b.toLowerCase() : a === b
  for (const field of fields.filter((f) => f.unique && values[f.id] !== undefined)) {
    const other = others.find((c) => same(values[field.id], c.values[field.id]))
    if (other) return taken("value_taken", `Bu «${field.label}» boshqa mijozda bor`, other.id)
  }
  return null
}

// nameOf is the name a member goes by in the company now; for someone who
// has left it, the name they went by then.
export const nameOf = (phone: string, companyId: number, then: string | null) =>
  isMember(phone, companyId) ? (nameIn(phone, companyId) ?? then) : then

const toCustomer = (c: CustomerRow): Customer => ({
  id: c.id,
  type_id: c.typeId,
  phone: c.phone,
  values: { ...c.values },
  created_by_name: nameOf(c.by, c.companyId, c.byName),
  created_at: c.createdAt,
  updated_at: c.updatedAt,
})

// asText writes an answer for people to read, as the history keeps it: a
// number in its digits, the options by their names; "" for no answer.
export function asText(field: FormField, answer: Answer | undefined): string {
  if (answer === undefined) return ""
  if (!isChoice(field)) return String(answer)
  const offered = offeredBy(field)
  return chosen(answer)
    .map((id) => offered.find((o) => o.id === id)?.label ?? "")
    .join(", ")
}

// diffValues tells what an edit changed in the answers: the fields in
// their order, each as text under the names of the moment.
export function diffValues(fields: FormField[], was: Record<number, Answer>, values: Record<number, Answer>): HistoryRow["changes"] {
  const changes: HistoryRow["changes"] = []
  for (const field of fields) {
    const [before, after] = [was[field.id], values[field.id]]
    if (JSON.stringify(before) !== JSON.stringify(after)) {
      changes.push({ label: field.label, old: asText(field, before), new: asText(field, after) })
    }
  }
  return changes
}

// diff tells what an edit changed: the phone first, then the answers.
function diff(fields: FieldRow[], customer: CustomerRow, phone: string, values: Record<number, Answer>): HistoryRow["changes"] {
  const changes: HistoryRow["changes"] = []
  if (customer.phone !== phone) changes.push({ label: "Telefon", old: formatPhone(customer.phone), new: formatPhone(phone) })
  return [...changes, ...diffValues(fields, customer.values, values)]
}

// enterCustomer enters a customer as a member of the company, under the
// customers' rules, or says what is wrong. The task form enters one with
// a task the same way.
export function enterCustomer(
  member: { phone: string; companyId: number },
  body: { type_id?: unknown; phone?: unknown; values?: unknown },
): CustomerRow | Response {
  const phone = customerPhone(body.phone)
  if (!phone) return invalid("Telefon raqami noto'g'ri")
  const type = liveType(member.companyId, body.type_id)
  if (!type) return invalid("Mijoz turini tanlang")
  const fields = liveFields(type)
  const values = checkValues(fields, {}, body.values)
  if (values instanceof Response) return values
  const refusal = free(member.companyId, fields, phone, values)
  if (refusal) return refusal
  const at = now()
  const byName = nameIn(member.phone, member.companyId)
  const customer: CustomerRow = {
    id: nextId(),
    companyId: member.companyId,
    typeId: type.id,
    phone,
    values,
    by: member.phone,
    byName,
    createdAt: at,
    updatedAt: at,
  }
  db.customers.push(customer)
  db.history.push({ id: nextId(), customerId: customer.id, action: "created", by: member.phone, byName, createdAt: at, changes: [] })
  return customer
}

const PAGE_SIZE = 20

// found tells whether a search finds the customer: the text in its text
// answers, whatever the case; the digits of a search written as a number or
// a phone is (digits, spaces, "+", "-", parentheses) in its phone and its
// whole number answers too. The names of the options are not searched.
function found(customer: CustomerRow, search: string): boolean {
  const text = search.trim().toLowerCase()
  if (!text) return true
  const digits = /^[\d\s+\-()]+$/.test(text) ? text.replace(/\D/g, "") : ""
  const fields = db.types.find((t) => t.id === customer.typeId)?.fields ?? []
  return (
    (digits !== "" && customer.phone.includes(digits)) ||
    fields.some((field) => {
      const answer = customer.values[field.id]
      if (field.kind === "string") return typeof answer === "string" && answer.toLowerCase().includes(text)
      return field.kind === "int" && typeof answer === "number" && digits !== "" && String(answer).includes(digits)
    })
  )
}

export const customersHandlers = [
  http.get(api("/app/customers"), ({ request }) => {
    const member = permittedSession(request, "customers.view")
    if (member instanceof Response) return member
    const query = new URL(request.url).searchParams
    const page = query.has("page") ? Number(query.get("page")) : 1
    if (!Number.isInteger(page) || page < 1) return invalid("Sahifa raqami noto'g'ri")
    const typeId = query.has("type_id") ? Number(query.get("type_id")) : null
    if (typeId !== null && (!Number.isInteger(typeId) || typeId < 1)) return invalid("Mijoz turi noto'g'ri")
    // The digits a phone begins with, after 998: the task form's suggestions.
    const prefix = query.get("phone") || null
    if (prefix !== null && !/^\d{1,9}$/.test(prefix)) return invalid("Telefon raqami noto'g'ri")
    const all = liveCustomers(member.companyId)
      .filter(
        (c) =>
          (typeId === null || c.typeId === typeId) &&
          (prefix === null || c.phone.startsWith(`998${prefix}`)) &&
          found(c, query.get("search") ?? ""),
      )
      // The newest first.
      .sort((a, b) => b.id - a.id)
    return HttpResponse.json({
      items: all.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE).map(toCustomer),
      total: all.length,
      page,
      page_size: PAGE_SIZE,
    })
  }),

  http.post(api("/app/customers"), async ({ request }) => {
    const member = permittedSession(request, "customers.create")
    if (member instanceof Response) return member
    const body = (await request.json()) as { type_id?: unknown; phone?: unknown; values?: unknown }
    const customer = enterCustomer(member, body)
    if (customer instanceof Response) return customer
    return HttpResponse.json(toCustomer(customer), { status: 201 })
  }),

  http.get(api("/app/customers/:id"), ({ params, request }) => {
    const member = permittedSession(request, "customers.view")
    if (member instanceof Response) return member
    const customer = liveCustomers(member.companyId).find((c) => c.id === Number(params.id))
    return customer ? HttpResponse.json(toCustomer(customer)) : customerNotFound()
  }),

  http.put(api("/app/customers/:id"), async ({ params, request }) => {
    const member = permittedSession(request, "customers.edit")
    if (member instanceof Response) return member
    const body = (await request.json()) as { phone?: unknown; values?: unknown }
    // A customer that is not there is said first, whatever is sent.
    const customer = liveCustomers(member.companyId).find((c) => c.id === Number(params.id))
    if (!customer) return customerNotFound()
    const phone = customerPhone(body.phone)
    if (!phone) return invalid("Telefon raqami noto'g'ri")
    const fields = liveFields(db.types.find((t) => t.id === customer.typeId)!)
    const values = checkValues(fields, customer.values, body.values)
    if (values instanceof Response) return values
    const refusal = free(member.companyId, fields, phone, values, customer.id)
    if (refusal) return refusal
    const changes = diff(fields, customer, phone, values)
    // A save that changes nothing writes nothing.
    if (changes.length > 0) {
      const at = now()
      customer.phone = phone
      customer.values = values
      customer.updatedAt = at
      db.history.push({
        id: nextId(),
        customerId: customer.id,
        action: "updated",
        by: member.phone,
        byName: nameIn(member.phone, member.companyId),
        createdAt: at,
        changes,
      })
    }
    return HttpResponse.json(toCustomer(customer))
  }),

  http.delete(api("/app/customers/:id"), ({ params, request }) => {
    const member = permittedSession(request, "customers.delete")
    if (member instanceof Response) return member
    const customer = liveCustomers(member.companyId).find((c) => c.id === Number(params.id))
    if (!customer) return customerNotFound()
    // A customer with a live task stays.
    const used = db.tasks.filter((t) => t.customerId === customer.id && !t.deleted).length
    if (used > 0) return fail(409, "customer_in_use", `Bu mijozda ${used} ta vazifa bor`)
    // Hidden, not removed: its answers and its history stay.
    customer.deleted = true
    db.history.push({
      id: nextId(),
      customerId: customer.id,
      action: "deleted",
      by: member.phone,
      byName: nameIn(member.phone, member.companyId),
      createdAt: now(),
      changes: [],
    })
    return new HttpResponse(null, { status: 204 })
  }),

  http.get(api("/app/customers/:id/history"), ({ params, request }) => {
    const member = permittedSession(request, "customers.history")
    if (member instanceof Response) return member
    const customer = liveCustomers(member.companyId).find((c) => c.id === Number(params.id))
    if (!customer) return customerNotFound()
    return HttpResponse.json(
      db.history
        .filter((entry) => entry.customerId === customer.id)
        // The latest first.
        .sort((a, b) => b.id - a.id)
        .map((entry) => ({
          id: entry.id,
          action: entry.action,
          actor_name: nameOf(entry.by, customer.companyId, entry.byName),
          created_at: entry.createdAt,
          changes: entry.changes,
        })),
    )
  }),
]
