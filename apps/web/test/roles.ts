import type { Permission } from "@/lib/types"
import { db, nextId, type RoleRow } from "@/mocks/data"

// giveRole makes a role of the company with the permissions and hands it to
// the member with phone: the fixture of a test about an employee's rights.
export function giveRole(phone: string, companyId: number, name: string, permissions: Permission[]): RoleRow {
  const role: RoleRow = { id: nextId(), companyId, name, permissions }
  db.roles.push(role)
  const membership = db.members[phone]?.find((m) => m.companyId === companyId)
  if (!membership) throw new Error(`${phone} is no member of company ${companyId}`)
  membership.roleId = role.id
  return role
}
