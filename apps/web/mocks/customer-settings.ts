// The customer settings of the mock API: the customer types with their
// fields and the dropdowns with their options, under the Go API's rules
// (logic/customers.md; backend/internal/customer).
import { http, HttpResponse } from "msw"
import type { CustomerFieldKind } from "@/lib/types"
import { db, type DropdownRow, dropdownsOf, type FieldRow, nextId, toDropdown, toField, toType, type TypeRow, typesOf } from "./data"
import { api, fail, memberSession, permittedSession } from "./gate"

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

const fieldNotFound = () => fail(404, "not_found", "Maydon topilmadi")
const fieldTaken = () => fail(409, "name_taken", "Bu nomli maydon allaqachon bor")
const invalid = (message: string) => fail(400, "validation_error", message)
const choiceUnique = () => invalid("Faqat matn va son maydoni takrorlanmas bo'ladi")

const kinds: Record<CustomerFieldKind, { choice: boolean }> = {
  string: { choice: false },
  int: { choice: false },
  dropdown: { choice: true },
  multi_dropdown: { choice: true },
  radio: { choice: true },
  checkbox: { choice: true },
}

// fieldsUsing counts the fields, of the customer types and of the task
// types, that take their options from a dropdown: those not deleted, of
// types not deleted.
function fieldsUsing(dropdownId: number): number {
  const live = (fields: { deleted?: boolean; dropdownId: number | null }[]) =>
    fields.filter((f) => !f.deleted && f.dropdownId === dropdownId).length
  return (
    live(db.types.filter((t) => !t.deleted).flatMap((t) => t.fields)) +
    live(db.taskTypes.filter((t) => !t.deleted).flatMap((t) => t.fields))
  )
}

// What the customers use is not deleted; the deleted customers use nothing.
const liveCustomers = () => db.customers.filter((c) => !c.deleted)

// answered counts the customers who filled the field in.
const answered = (field: FieldRow) => liveCustomers().filter((c) => c.values[field.id] !== undefined).length

// chose counts the customers who chose the option, in any field that takes
// its options from the dropdown.
function chose(dropdown: DropdownRow, optionId: number): number {
  const fields = db.types.flatMap((t) => t.fields).filter((f) => f.dropdownId === dropdown.id)
  return liveCustomers().filter((c) =>
    fields.some((f) => {
      const answer = c.values[f.id]
      return Array.isArray(answer) ? answer.includes(optionId) : answer === optionId
    }),
  ).length
}

// choseInTasks counts the live tasks that chose the option, in any task
// field that takes its options from the dropdown.
function choseInTasks(dropdown: DropdownRow, optionId: number): number {
  const fields = db.taskTypes.flatMap((t) => t.fields).filter((f) => f.dropdownId === dropdown.id)
  return db.tasks.filter(
    (t) =>
      !t.deleted &&
      fields.some((f) => {
        const answer = t.values[f.id]
        return Array.isArray(answer) ? answer.includes(optionId) : answer === optionId
      }),
  ).length
}

// repeats tells whether two customers have the same answer in the field, a
// text whatever its case.
function repeats(field: FieldRow): boolean {
  const answers = liveCustomers()
    .map((c) => c.values[field.id])
    .filter((answer) => answer !== undefined)
    .map((answer) => (typeof answer === "string" ? answer.toLowerCase() : answer))
  return new Set(answers).size < answers.length
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
    const member = permittedSession(request, "settings.create")
    if (member instanceof Response) return member
    const name = cleanName(((await request.json()) as { name?: unknown }).name)
    if (name instanceof Response) return name
    if (dropdownsOf(member.companyId).some((d) => same(d.name, name))) return dropdownTaken()
    const dropdown: DropdownRow = { id: nextId(), companyId: member.companyId, name, options: [] }
    db.dropdowns.push(dropdown)
    return HttpResponse.json(toDropdown(dropdown), { status: 201 })
  }),

  http.patch(api("/app/customer-dropdowns/:id"), async ({ params, request }) => {
    const member = permittedSession(request, "settings.edit")
    if (member instanceof Response) return member
    const name = cleanName(((await request.json()) as { name?: unknown }).name)
    if (name instanceof Response) return name
    const dropdown = liveDropdown(member.companyId, Number(params.id))
    if (!dropdown) return dropdownNotFound()
    if (dropdownsOf(member.companyId).some((d) => d.id !== dropdown.id && same(d.name, name))) return dropdownTaken()
    dropdown.name = name
    return HttpResponse.json(toDropdown(dropdown))
  }),

  http.delete(api("/app/customer-dropdowns/:id"), ({ params, request }) => {
    const member = permittedSession(request, "settings.delete")
    if (member instanceof Response) return member
    const dropdown = liveDropdown(member.companyId, Number(params.id))
    if (!dropdown) return dropdownNotFound()
    const used = fieldsUsing(dropdown.id)
    if (used > 0) return fail(409, "dropdown_in_use", `Bu dropdown ${used} ta maydonda ishlatilgan`)
    dropdown.deleted = true
    return new HttpResponse(null, { status: 204 })
  }),

  http.post(api("/app/customer-dropdowns/:id/options"), async ({ params, request }) => {
    const member = permittedSession(request, "settings.create")
    if (member instanceof Response) return member
    const label = cleanName(((await request.json()) as { label?: unknown }).label)
    if (label instanceof Response) return label
    const dropdown = liveDropdown(member.companyId, Number(params.id))
    if (!dropdown) return dropdownNotFound()
    if (dropdown.options.some((o) => !o.deleted && same(o.label, label))) return optionTaken()
    const option = { id: nextId(), label, active: true }
    dropdown.options.push(option)
    return HttpResponse.json({ id: option.id, label, is_active: true }, { status: 201 })
  }),

  http.put(api("/app/customer-dropdowns/:id/options/order"), async ({ params, request }) => {
    const member = permittedSession(request, "settings.edit")
    if (member instanceof Response) return member
    const { ids } = (await request.json()) as { ids?: unknown }
    const dropdown = liveDropdown(member.companyId, Number(params.id))
    if (!dropdown) return dropdownNotFound()
    const live = dropdown.options.filter((o) => !o.deleted).map((o) => o.id)
    if (!sameIds(ids, live)) return orderChanged()
    dropdown.options = inOrder(dropdown.options, ids)
    return new HttpResponse(null, { status: 204 })
  }),

  http.patch(api("/app/customer-dropdowns/:id/options/:optionId"), async ({ params, request }) => {
    const member = permittedSession(request, "settings.edit")
    if (member instanceof Response) return member
    const body = (await request.json()) as { label?: unknown; is_active?: boolean }
    const label = body.label === undefined ? undefined : cleanName(body.label)
    if (label instanceof Response) return label
    const dropdown = liveDropdown(member.companyId, Number(params.id))
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
    const member = permittedSession(request, "settings.delete")
    if (member instanceof Response) return member
    const dropdown = liveDropdown(member.companyId, Number(params.id))
    const option = dropdown?.options.find((o) => o.id === Number(params.optionId) && !o.deleted)
    if (!dropdown || !option) return optionNotFound()
    const used = chose(dropdown, option.id)
    if (used > 0) return fail(409, "option_in_use", `Bu variant ${used} ta mijozda tanlangan`)
    // The tasks hold it too, and are told after the customers.
    const inTasks = choseInTasks(dropdown, option.id)
    if (inTasks > 0) return fail(409, "option_in_use", `Bu variant ${inTasks} ta vazifada tanlangan`)
    option.deleted = true
    return new HttpResponse(null, { status: 204 })
  }),

  http.post(api("/app/customer-types"), async ({ request }) => {
    const member = permittedSession(request, "settings.create")
    if (member instanceof Response) return member
    const name = cleanName(((await request.json()) as { name?: unknown }).name)
    if (name instanceof Response) return name
    if (typesOf(member.companyId).some((t) => same(t.name, name))) return typeTaken()
    const type: TypeRow = { id: nextId(), companyId: member.companyId, name, fields: [] }
    db.types.push(type)
    return HttpResponse.json(toType(type), { status: 201 })
  }),

  http.put(api("/app/customer-types/order"), async ({ request }) => {
    const member = permittedSession(request, "settings.edit")
    if (member instanceof Response) return member
    const { ids } = (await request.json()) as { ids?: unknown }
    const live = typesOf(member.companyId).map((t) => t.id)
    if (!sameIds(ids, live)) return orderChanged()
    const others = db.types.filter((t) => !ids.includes(t.id))
    db.types = [...ids.map((id) => db.types.find((t) => t.id === id)!), ...others]
    return new HttpResponse(null, { status: 204 })
  }),

  http.patch(api("/app/customer-types/:id"), async ({ params, request }) => {
    const member = permittedSession(request, "settings.edit")
    if (member instanceof Response) return member
    const name = cleanName(((await request.json()) as { name?: unknown }).name)
    if (name instanceof Response) return name
    const type = liveType(member.companyId, Number(params.id))
    if (!type) return typeNotFound()
    if (typesOf(member.companyId).some((t) => t.id !== type.id && same(t.name, name))) return typeTaken()
    type.name = name
    return HttpResponse.json(toType(type))
  }),

  http.delete(api("/app/customer-types/:id"), ({ params, request }) => {
    const member = permittedSession(request, "settings.delete")
    if (member instanceof Response) return member
    const type = liveType(member.companyId, Number(params.id))
    if (!type) return typeNotFound()
    const used = liveCustomers().filter((c) => c.typeId === type.id).length
    if (used > 0) return fail(409, "type_in_use", `Bu turda ${used} ta mijoz bor`)
    // Its fields go with it.
    type.deleted = true
    type.fields.forEach((f) => (f.deleted = true))
    return new HttpResponse(null, { status: 204 })
  }),

  http.post(api("/app/customer-types/:id/fields"), async ({ params, request }) => {
    const member = permittedSession(request, "settings.create")
    if (member instanceof Response) return member
    const body = (await request.json()) as {
      label?: unknown
      kind?: string
      required?: boolean
      is_unique?: boolean
      dropdown_id?: number | null
    }
    const label = cleanName(body.label)
    if (label instanceof Response) return label
    const kind = kinds[body.kind as CustomerFieldKind]
    const dropdownId = body.dropdown_id ?? null
    const unique = body.is_unique ?? false
    if (!kind) return invalid("Maydon turini tanlang")
    if (kind.choice && dropdownId === null) return invalid("Dropdownni tanlang")
    if (kind.choice && unique) return choiceUnique()
    if (!kind.choice && dropdownId !== null) return invalid("Matn va son maydoniga dropdown ulanmaydi")
    if (dropdownId !== null && !liveDropdown(member.companyId, dropdownId)) return invalid("Dropdownni tanlang")
    const type = liveType(member.companyId, Number(params.id))
    if (!type) return typeNotFound()
    if (type.fields.some((f) => !f.deleted && same(f.label, label))) return fieldTaken()
    const field: FieldRow = {
      id: nextId(),
      label,
      kind: body.kind as CustomerFieldKind,
      required: body.required ?? false,
      unique,
      dropdownId,
    }
    type.fields.push(field)
    return HttpResponse.json(toField(field), { status: 201 })
  }),

  http.put(api("/app/customer-types/:id/fields/order"), async ({ params, request }) => {
    const member = permittedSession(request, "settings.edit")
    if (member instanceof Response) return member
    const { ids } = (await request.json()) as { ids?: unknown }
    const type = liveType(member.companyId, Number(params.id))
    if (!type) return typeNotFound()
    const live = type.fields.filter((f) => !f.deleted).map((f) => f.id)
    if (!sameIds(ids, live)) return orderChanged()
    type.fields = inOrder(type.fields, ids)
    return new HttpResponse(null, { status: 204 })
  }),

  http.patch(api("/app/customer-types/:id/fields/:fieldId"), async ({ params, request }) => {
    const member = permittedSession(request, "settings.edit")
    if (member instanceof Response) return member
    const body = (await request.json()) as { label?: unknown; required?: boolean; is_unique?: boolean }
    const label = body.label === undefined ? undefined : cleanName(body.label)
    if (label instanceof Response) return label
    const type = liveType(member.companyId, Number(params.id))
    const field = type?.fields.find((f) => f.id === Number(params.fieldId) && !f.deleted)
    if (!type || !field) return fieldNotFound()
    if (kinds[field.kind].choice && body.is_unique) return choiceUnique()
    if (body.is_unique && repeats(field)) return fail(409, "duplicates_exist", "Bu maydonda takrorlangan qiymatlar bor")
    if (label !== undefined) {
      if (type.fields.some((f) => f !== field && !f.deleted && same(f.label, label))) return fieldTaken()
      field.label = label
    }
    if (body.required !== undefined) field.required = body.required
    if (body.is_unique !== undefined) field.unique = body.is_unique
    return HttpResponse.json(toField(field))
  }),

  http.delete(api("/app/customer-types/:id/fields/:fieldId"), ({ params, request }) => {
    const member = permittedSession(request, "settings.delete")
    if (member instanceof Response) return member
    const field = liveType(member.companyId, Number(params.id))?.fields.find((f) => f.id === Number(params.fieldId) && !f.deleted)
    if (!field) return fieldNotFound()
    const used = answered(field)
    if (used > 0) return fail(409, "field_in_use", `Bu maydon ${used} ta mijozda to'ldirilgan`)
    field.deleted = true
    return new HttpResponse(null, { status: 204 })
  }),
]
