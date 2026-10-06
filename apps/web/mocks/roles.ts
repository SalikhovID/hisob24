// The mock API's roles: what the owner makes and gives to employees
// (logic/roles.md, section 5), answering like backend/internal/app/roles.go.
import { http, HttpResponse } from "msw"
import { allPermissions, sectionLabels, sectionOf } from "@/lib/permissions"
import type { Permission } from "@/lib/types"
import { db, membersOf, nextId, type RoleRow, rolesOf, toRole } from "./data"
import { api, fail, ownerSession } from "./gate"

const invalid = (message: string) => fail(400, "validation_error", message)
const roleNotFound = () => fail(404, "not_found", "Rol topilmadi")
const employeeNotFound = () => fail(404, "not_found", "Xodim topilmadi")
const ownerProtected = () => fail(409, "cannot_change_owner", "Kompaniya egasini o'zgartirib yoki o'chirib bo'lmaydi")
const nameTaken = () => fail(409, "name_taken", "Bu nomli rol allaqachon bor")

// cleanName is the API's rule for a name: trimmed, not empty, sixty
// characters at most.
function cleanName(raw: unknown): string | Response {
  const name = typeof raw === "string" ? raw.trim() : ""
  if (!name) return invalid("Nomni kiriting")
  if ([...name].length > 60) return invalid("Nom 60 belgidan oshmasin")
  return name
}

// same tells two names apart as the API does: whatever the case.
const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase()

// parsePermissions reads a role's permissions as the API does: each in the
// catalog, a repeated one once, an action only with its section's view; the
// list comes back in the catalog's order.
function parsePermissions(raw: unknown): Permission[] | Response {
  if (!Array.isArray(raw)) return invalid("Ruxsat noto'g'ri")
  const set = new Set<Permission>()
  for (const p of raw) {
    if (typeof p !== "string" || !(allPermissions as string[]).includes(p)) return invalid("Ruxsat noto'g'ri")
    set.add(p as Permission)
  }
  for (const p of allPermissions) {
    if (!set.has(p)) continue
    const section = sectionOf(p)
    if (!set.has(`${section}.view` as Permission)) return invalid(`«${sectionLabels[section]}» bo'limida avval «Ko'rish» ni belgilang`)
  }
  return allPermissions.filter((p) => set.has(p))
}

const liveRole = (companyId: number, id: number): RoleRow | undefined =>
  db.roles.find((r) => r.id === id && r.companyId === companyId)

export const rolesHandlers = [
  http.get(api("/app/roles"), ({ request }) => {
    const owner = ownerSession(request)
    if (owner instanceof Response) return owner
    return HttpResponse.json(rolesOf(owner.companyId))
  }),

  http.post(api("/app/roles"), async ({ request }) => {
    const owner = ownerSession(request)
    if (owner instanceof Response) return owner
    const body = (await request.json()) as { name?: unknown; permissions?: unknown }
    const name = cleanName(body.name)
    if (name instanceof Response) return name
    const permissions = parsePermissions(body.permissions)
    if (permissions instanceof Response) return permissions
    if (db.roles.some((r) => r.companyId === owner.companyId && same(r.name, name))) return nameTaken()
    const role: RoleRow = { id: nextId(), companyId: owner.companyId, name, permissions }
    db.roles.push(role)
    return HttpResponse.json(toRole(role), { status: 201 })
  }),

  http.put(api("/app/roles/:id"), async ({ params, request }) => {
    const owner = ownerSession(request)
    if (owner instanceof Response) return owner
    const body = (await request.json()) as { name?: unknown; permissions?: unknown }
    const name = cleanName(body.name)
    if (name instanceof Response) return name
    const permissions = parsePermissions(body.permissions)
    if (permissions instanceof Response) return permissions
    const role = liveRole(owner.companyId, Number(params.id))
    if (!role) return roleNotFound()
    if (db.roles.some((r) => r.companyId === owner.companyId && r.id !== role.id && same(r.name, name))) return nameTaken()
    role.name = name
    role.permissions = permissions
    return HttpResponse.json(toRole(role))
  }),

  http.delete(api("/app/roles/:id"), ({ params, request }) => {
    const owner = ownerSession(request)
    if (owner instanceof Response) return owner
    const role = liveRole(owner.companyId, Number(params.id))
    if (!role) return roleNotFound()
    const holders = toRole(role).members_count
    if (holders > 0) return fail(409, "role_in_use", `Bu rol ${holders} ta xodimga biriktirilgan`)
    db.roles = db.roles.filter((r) => r !== role)
    return new HttpResponse(null, { status: 204 })
  }),

  // The role an employee holds, or none (null). The employee works by it
  // from their next request on: the gate reads the roles afresh.
  http.put(api("/app/employees/:phone/role"), async ({ params, request }) => {
    const owner = ownerSession(request)
    if (owner instanceof Response) return owner
    const body = (await request.json()) as { role_id?: unknown }
    const roleId = typeof body.role_id === "number" ? body.role_id : null
    if (roleId !== null && !liveRole(owner.companyId, roleId)) return roleNotFound()
    const phone = String(params.phone)
    const membership = (db.members[phone] ?? []).find((m) => m.companyId === owner.companyId)
    if (!membership) return employeeNotFound()
    if (membership.role === "owner") return ownerProtected()
    membership.roleId = roleId ?? undefined
    return HttpResponse.json(membersOf(owner.companyId).find((m) => m.phone === phone))
  }),
]
