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
