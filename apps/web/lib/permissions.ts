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

// Action is the part of a permission after the dot.
export type Action = "view" | "create" | "edit" | "delete" | "history"

// actions are the actions in the catalog's order; actionLabels their names
// in the app.
export const actions: Action[] = ["view", "create", "edit", "delete", "history"]
export const actionLabels: Record<Action, string> = {
  view: "Ko'rish",
  create: "Qo'shish",
  edit: "Tahrirlash",
  delete: "O'chirish",
  history: "Tarix",
}

// permissionOf is the permission of an action in a section.
export function permissionOf(section: Section, action: Action): Permission {
  return `${section}.${action}` as Permission
}

// actionsOf is the actions a section has: every section has view, create,
// edit and delete; the customers and the tasks have a history too.
export function actionsOf(section: Section): Action[] {
  return actions.filter((action) => (allPermissions as string[]).includes(`${section}.${action}`))
}

// toggled is the permissions after one is ticked (on) or unticked: an action
// brings its section's view with it, and the view taken away takes the
// section's actions with it, as the API would refuse an action without the
// view. The result is in the catalog's order.
export function toggled(permissions: readonly Permission[], permission: Permission, on: boolean): Permission[] {
  const set = new Set(permissions)
  const section = sectionOf(permission)
  const view = permissionOf(section, "view")
  if (on) {
    set.add(permission)
    set.add(view)
  } else if (permission === view) {
    for (const candidate of allPermissions) if (sectionOf(candidate) === section) set.delete(candidate)
  } else {
    set.delete(permission)
  }
  return allPermissions.filter((candidate) => set.has(candidate))
}
