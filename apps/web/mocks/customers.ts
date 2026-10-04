// The customers of the mock API, under the Go API's rules
// (logic/customers.md; backend/internal/customer).
import { http, HttpResponse } from "msw"
import type { Customer } from "@/lib/types"
import { type Answer, type CustomerRow, db, type FieldRow, nameIn, nextId, now, type OptionRow, type TypeRow } from "./data"
import { api, fail, isMember, memberSession, normalizePhone } from "./gate"

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

// offeredBy is the options of the field's dropdown, in their order.
function offeredBy(field: FieldRow): OptionRow[] {
  const dropdown = db.dropdowns.find((d) => d.id === field.dropdownId && !d.deleted)
  return dropdown ? dropdown.options.filter((o) => !o.deleted) : []
}

const isChoice = (field: FieldRow) => field.kind !== "string" && field.kind !== "int"
const isWhole = (value: unknown): value is number =>
  typeof value === "number" && Number.isInteger(value) && Math.abs(value) <= Number.MAX_SAFE_INTEGER

// chosen is the options of an answer to a choice field.
const chosen = (answer: Answer | undefined): number[] =>
  Array.isArray(answer) ? answer : typeof answer === "number" ? [answer] : []

// readAnswer reads what a client sent for one field: the answer as it is
// kept, undefined for a field left empty, or what is wrong with it. An
// option that is turned off is taken only where the customer has it (has).
function readAnswer(field: FieldRow, has: number[], raw: unknown): Answer | undefined | Response {
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
// order). was is the customer's answers before an edit.
function checkValues(fields: FieldRow[], was: Record<number, Answer>, raw: unknown): Record<number, Answer> | Response {
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
const liveCustomers = (companyId: number) => db.customers.filter((c) => c.companyId === companyId && !c.deleted)

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
const nameOf = (phone: string, companyId: number, then: string | null) =>
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

export const customersHandlers = [
  http.post(api("/app/customers"), async ({ request }) => {
    const member = memberSession(request)
    if (member instanceof Response) return member
    const body = (await request.json()) as { type_id?: unknown; phone?: unknown; values?: unknown }
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
    return HttpResponse.json(toCustomer(customer), { status: 201 })
  }),

  http.get(api("/app/customers/:id"), ({ params, request }) => {
    const member = memberSession(request)
    if (member instanceof Response) return member
    const customer = liveCustomers(member.companyId).find((c) => c.id === Number(params.id))
    return customer ? HttpResponse.json(toCustomer(customer)) : customerNotFound()
  }),
]
