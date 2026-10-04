// The customer settings of the mock API: the customer types with their
// fields and the dropdowns with their options, under the Go API's rules
// (logic/customers.md; backend/internal/customer).
import { http, HttpResponse } from "msw"
import { db, type DropdownRow, dropdownsOf, nextId, toDropdown, toType, type TypeRow, typesOf } from "./data"
import { api, fail, memberSession, ownerSession } from "./gate"

// cleanName is the API's rule for a name: trimmed, not empty, sixty
// characters at most.
function cleanName(raw: unknown): string | Response {
  const name = typeof raw === "string" ? raw.trim() : ""
  if (!name) return fail(400, "validation_error", "Nomni kiriting")
  if ([...name].length > 60) return fail(400, "validation_error", "Nom 60 belgidan oshmasin")
  return name
}

// same tells two names apart as the API does: whatever the case.
const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase()

const dropdownNotFound = () => fail(404, "not_found", "Dropdown topilmadi")
const dropdownTaken = () => fail(409, "name_taken", "Bu nomli dropdown allaqachon bor")

function liveDropdown(companyId: number, id: number): DropdownRow | undefined {
  return db.dropdowns.find((d) => d.id === id && d.companyId === companyId && !d.deleted)
}

const optionNotFound = () => fail(404, "not_found", "Variant topilmadi")
const optionTaken = () => fail(409, "name_taken", "Bu variant allaqachon bor")
const orderChanged = () => fail(409, "order_changed", "Ro'yxat o'zgargan. Sahifani yangilang")

// sameIds tells whether ids names each of live once and nothing else.
function sameIds(ids: unknown, live: number[]): ids is number[] {
  if (!Array.isArray(ids) || ids.length !== live.length) return false
  return new Set(ids).size === live.length && ids.every((id) => live.includes(id))
}

// inOrder puts rows in the order of ids, with the deleted ones after them.
function inOrder<T extends { id: number; deleted?: boolean }>(rows: T[], ids: number[]): T[] {
  return [...ids.map((id) => rows.find((row) => row.id === id)!), ...rows.filter((row) => row.deleted)]
}

const typeNotFound = () => fail(404, "not_found", "Tur topilmadi")
const typeTaken = () => fail(409, "name_taken", "Bu nomli tur allaqachon bor")

function liveType(companyId: number, id: number): TypeRow | undefined {
  return db.types.find((t) => t.id === id && t.companyId === companyId && !t.deleted)
}

// fieldsUsing counts the fields that take their options from a dropdown:
// those not deleted, of types not deleted.
function fieldsUsing(dropdownId: number): number {
  return db.types
    .filter((t) => !t.deleted)
    .flatMap((t) => t.fields)
    .filter((f) => !f.deleted && f.dropdownId === dropdownId).length
}

export const customerSettingsHandlers = [
  http.get(api("/app/customer-dropdowns"), ({ request }) => {
    const member = memberSession(request)
    if (member instanceof Response) return member
    return HttpResponse.json(dropdownsOf(member.companyId))
  }),

  http.get(api("/app/customer-types"), ({ request }) => {
    const member = memberSession(request)
    if (member instanceof Response) return member
    return HttpResponse.json(typesOf(member.companyId))
  }),

  http.post(api("/app/customer-dropdowns"), async ({ request }) => {
    const owner = ownerSession(request)
    if (owner instanceof Response) return owner
    const name = cleanName(((await request.json()) as { name?: unknown }).name)
    if (name instanceof Response) return name
    if (dropdownsOf(owner.companyId).some((d) => same(d.name, name))) return dropdownTaken()
    const dropdown: DropdownRow = { id: nextId(), companyId: owner.companyId, name, options: [] }
    db.dropdowns.push(dropdown)
    return HttpResponse.json(toDropdown(dropdown), { status: 201 })
  }),

  http.patch(api("/app/customer-dropdowns/:id"), async ({ params, request }) => {
    const owner = ownerSession(request)
    if (owner instanceof Response) return owner
    const name = cleanName(((await request.json()) as { name?: unknown }).name)
    if (name instanceof Response) return name
    const dropdown = liveDropdown(owner.companyId, Number(params.id))
    if (!dropdown) return dropdownNotFound()
    if (dropdownsOf(owner.companyId).some((d) => d.id !== dropdown.id && same(d.name, name))) return dropdownTaken()
    dropdown.name = name
    return HttpResponse.json(toDropdown(dropdown))
  }),

  http.delete(api("/app/customer-dropdowns/:id"), ({ params, request }) => {
    const owner = ownerSession(request)
    if (owner instanceof Response) return owner
    const dropdown = liveDropdown(owner.companyId, Number(params.id))
    if (!dropdown) return dropdownNotFound()
    const used = fieldsUsing(dropdown.id)
    if (used > 0) return fail(409, "dropdown_in_use", `Bu dropdown ${used} ta maydonda ishlatilgan`)
    dropdown.deleted = true
    return new HttpResponse(null, { status: 204 })
  }),

  http.post(api("/app/customer-dropdowns/:id/options"), async ({ params, request }) => {
    const owner = ownerSession(request)
    if (owner instanceof Response) return owner
    const label = cleanName(((await request.json()) as { label?: unknown }).label)
    if (label instanceof Response) return label
    const dropdown = liveDropdown(owner.companyId, Number(params.id))
    if (!dropdown) return dropdownNotFound()
    if (dropdown.options.some((o) => !o.deleted && same(o.label, label))) return optionTaken()
    const option = { id: nextId(), label, active: true }
    dropdown.options.push(option)
    return HttpResponse.json({ id: option.id, label, is_active: true }, { status: 201 })
  }),

  http.put(api("/app/customer-dropdowns/:id/options/order"), async ({ params, request }) => {
    const owner = ownerSession(request)
    if (owner instanceof Response) return owner
    const { ids } = (await request.json()) as { ids?: unknown }
    const dropdown = liveDropdown(owner.companyId, Number(params.id))
    if (!dropdown) return dropdownNotFound()
    const live = dropdown.options.filter((o) => !o.deleted).map((o) => o.id)
    if (!sameIds(ids, live)) return orderChanged()
    dropdown.options = inOrder(dropdown.options, ids)
    return new HttpResponse(null, { status: 204 })
  }),

  http.patch(api("/app/customer-dropdowns/:id/options/:optionId"), async ({ params, request }) => {
    const owner = ownerSession(request)
    if (owner instanceof Response) return owner
    const body = (await request.json()) as { label?: unknown; is_active?: boolean }
    const label = body.label === undefined ? undefined : cleanName(body.label)
    if (label instanceof Response) return label
    const dropdown = liveDropdown(owner.companyId, Number(params.id))
    const option = dropdown?.options.find((o) => o.id === Number(params.optionId) && !o.deleted)
    if (!dropdown || !option) return optionNotFound()
    if (label !== undefined) {
      if (dropdown.options.some((o) => o !== option && !o.deleted && same(o.label, label))) return optionTaken()
      option.label = label
    }
    if (body.is_active !== undefined) option.active = body.is_active
    return HttpResponse.json({ id: option.id, label: option.label, is_active: option.active })
  }),

  http.delete(api("/app/customer-dropdowns/:id/options/:optionId"), ({ params, request }) => {
    const owner = ownerSession(request)
    if (owner instanceof Response) return owner
    const dropdown = liveDropdown(owner.companyId, Number(params.id))
    const option = dropdown?.options.find((o) => o.id === Number(params.optionId) && !o.deleted)
    if (!option) return optionNotFound()
    option.deleted = true
    return new HttpResponse(null, { status: 204 })
  }),

  http.post(api("/app/customer-types"), async ({ request }) => {
    const owner = ownerSession(request)
    if (owner instanceof Response) return owner
    const name = cleanName(((await request.json()) as { name?: unknown }).name)
    if (name instanceof Response) return name
    if (typesOf(owner.companyId).some((t) => same(t.name, name))) return typeTaken()
    const type: TypeRow = { id: nextId(), companyId: owner.companyId, name, fields: [] }
    db.types.push(type)
    return HttpResponse.json(toType(type), { status: 201 })
  }),

  http.put(api("/app/customer-types/order"), async ({ request }) => {
    const owner = ownerSession(request)
    if (owner instanceof Response) return owner
    const { ids } = (await request.json()) as { ids?: unknown }
    const live = typesOf(owner.companyId).map((t) => t.id)
    if (!sameIds(ids, live)) return orderChanged()
    const others = db.types.filter((t) => !ids.includes(t.id))
    db.types = [...ids.map((id) => db.types.find((t) => t.id === id)!), ...others]
    return new HttpResponse(null, { status: 204 })
  }),

  http.patch(api("/app/customer-types/:id"), async ({ params, request }) => {
    const owner = ownerSession(request)
    if (owner instanceof Response) return owner
    const name = cleanName(((await request.json()) as { name?: unknown }).name)
    if (name instanceof Response) return name
    const type = liveType(owner.companyId, Number(params.id))
    if (!type) return typeNotFound()
    if (typesOf(owner.companyId).some((t) => t.id !== type.id && same(t.name, name))) return typeTaken()
    type.name = name
    return HttpResponse.json(toType(type))
  }),

  http.delete(api("/app/customer-types/:id"), ({ params, request }) => {
    const owner = ownerSession(request)
    if (owner instanceof Response) return owner
    const type = liveType(owner.companyId, Number(params.id))
    if (!type) return typeNotFound()
    // Its fields go with it.
    type.deleted = true
    type.fields.forEach((f) => (f.deleted = true))
    return new HttpResponse(null, { status: 204 })
  }),
]
