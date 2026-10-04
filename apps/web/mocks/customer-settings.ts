// The customer settings of the mock API: the customer types with their
// fields and the dropdowns with their options, under the Go API's rules
// (logic/customers.md; backend/internal/customer).
import { http, HttpResponse } from "msw"
import { db, type DropdownRow, dropdownsOf, nextId, toDropdown, typesOf } from "./data"
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
]
