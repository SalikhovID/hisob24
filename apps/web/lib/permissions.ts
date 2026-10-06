import type { Permission } from "./types"

// What a member of a company may do, as the API tells it in /app/me
// (logic/roles.md, section 4): the owner has the whole catalog, an employee
// without a role the default, an employee with a role what the role holds.

// allPermissions is the catalog in its order.
export const allPermissions: Permission[] = [
  "customers.view",
  "customers.create",
  "customers.edit",
  "customers.delete",
  "customers.history",
  "tasks.view",
  "tasks.create",
  "tasks.edit",
  "tasks.delete",
  "tasks.history",
  "employees.view",
  "employees.create",
  "employees.edit",
  "employees.delete",
  "settings.view",
  "settings.create",
  "settings.edit",
  "settings.delete",
]

// defaultPermissions is what an employee without a role has: the customers
// and the tasks, without their history. It is the rule from before roles.
export const defaultPermissions: Permission[] = [
  "customers.view",
  "customers.create",
  "customers.edit",
  "customers.delete",
  "tasks.view",
  "tasks.create",
  "tasks.edit",
  "tasks.delete",
]

// Section is the part of a permission before the dot.
export type Section = "customers" | "tasks" | "employees" | "settings"

// sectionLabels are the sections' names in the app.
export const sectionLabels: Record<Section, string> = {
  customers: "Mijozlar",
  tasks: "Vazifalar",
  employees: "Xodimlar",
  settings: "Sozlamalar",
}

// sectionOf is the section a permission belongs to.
export function sectionOf(permission: Permission): Section {
  return permission.split(".")[0] as Section
}

// can says whether permissions (what /app/me told, undefined before it
// answered) hold permission.
export function can(permissions: readonly Permission[] | undefined, permission: Permission): boolean {
  return permissions?.includes(permission) ?? false
}

// sections are the sections in the catalog's order.
export const sections: Section[] = ["customers", "tasks", "employees", "settings"]

// summaryOf names the sections permissions reach into, in the catalog's
// order: what a role is about, in a line. "Ruxsat yo'q" for none.
export function summaryOf(permissions: readonly Permission[]): string {
  const named = sections.filter((section) => permissions.some((permission) => sectionOf(permission) === section))
  return named.length > 0 ? named.map((section) => sectionLabels[section]).join(", ") : "Ruxsat yo'q"
}
