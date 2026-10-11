// An in-memory copy of the user app API's data for MSW: Vitest and
// Playwright work against the same people, companies and rules as the Go API.
import { allPermissions, defaultPermissions } from "@/lib/permissions"
import type {
  AppAccount,
  AppCompany,
  CompanyCurrency,
  CompanyRole,
  CustomerDropdown,
  CustomerFieldKind,
  CustomerType,
  FinanceKind,
  Location,
  Member,
  Permission,
  ProductKind,
  Role,
  StageColor,
  TaskStage,
  TaskType,
  Unit,
} from "@/lib/types"

export const TODAY = "2026-10-02"
export const LOGIN_CODE = "123456"

// One active company.
export const ALI = "998901234567"
// Two active companies.
export const VALI = "998902223344"
// An expired company and an active one.
export const SARDOR = "998903334455"
// Only an expired company.
export const ZARINA = "998904445566"
// Shared with the user bot, but no user's.
export const STRANGER = "998905556677"
// A phone no company has yet: the e2e tests add it to Nok Market, which
// has two locations, as an employee to restrict.
export const DILNOZA = "998906667788"

// Telegram accounts of the Mini App tests: 1001 Ali, 1002 Vali, 1003 the
// stranger; 1004 never shared a phone.
export const TG_ALI = 1001
export const TG_VALI = 1002
export const TG_STRANGER = 1003
export const TG_UNLINKED = 1004

const DAY = 24 * 60 * 60 * 1000

export function addDays(date: string, days: number): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * DAY).toISOString().slice(0, 10)
}

// daysLeft counts from TODAY, as the API counts from the database's date.
function daysLeft(endDate: string): number {
  return (Date.parse(`${endDate}T00:00:00Z`) - Date.parse(`${TODAY}T00:00:00Z`)) / DAY
}

interface Company {
  id: number
  name: string
  end_date: string
  is_active: boolean
}

// Membership is a user's place in a company. fullName is the name they go by
// there; without one the user's own shows. joined orders the members. roleId
// is the company role an employee holds; without one they have the default
// permissions. locationIds is the restriction an employee is under (the
// locations they may work in); without one they work in every location, as
// the owner always does.
export interface Membership {
  companyId: number
  role: Role
  joined: number
  fullName?: string
  roleId?: number
  locationIds?: number[]
  // navOrder is the member's own order of the menu in the company, by
  // section key; without one the default order (logic/roles.md, section 8).
  navOrder?: string[]
}

// A company role: a name and the permissions it holds (logic/roles.md,
// section 5). A role nobody holds is removed for good.
export interface RoleRow {
  id: number
  companyId: number
  name: string
  permissions: Permission[]
}

// A location of a company (logic/locations.md): a task stands in one. A row
// is never removed: deleted hides it. The order of the array is the order
// the admin added them in.
export interface LocationRow {
  id: number
  companyId: number
  name: string
  deleted?: boolean
}

// What a company's owner sets up for its customers. A row is never removed:
// deleted hides it. The order of an array is the order on screen.
export interface OptionRow {
  id: number
  label: string
  active: boolean
  deleted?: boolean
}

export interface DropdownRow {
  id: number
  companyId: number
  name: string
  options: OptionRow[]
  deleted?: boolean
}

export interface FieldRow {
  id: number
  label: string
  kind: CustomerFieldKind
  required: boolean
  unique: boolean
  dropdownId: number | null
  deleted?: boolean
}

export interface TypeRow {
  id: number
  companyId: number
  name: string
  fields: FieldRow[]
  deleted?: boolean
}

// What a company's owner sets up for its tasks: the stages (the columns of
// the board) and the task types with their fields, which are never told not
// to repeat. A row is never removed: deleted hides it.
export interface StageRow {
  id: number
  companyId: number
  name: string
  color: StageColor
  done: boolean
  deleted?: boolean
}

export interface TaskFieldRow {
  id: number
  label: string
  kind: CustomerFieldKind
  required: boolean
  dropdownId: number | null
  deleted?: boolean
}

export interface TaskTypeRow {
  id: number
  companyId: number
  name: string
  fields: TaskFieldRow[]
  deleted?: boolean
}

// Answer is a customer's answer to one field: a text, a whole number or the
// id of the one option chosen, or the ids of several options.
export type Answer = string | number | number[]

// A customer of a company. The values are the answers by the id of the
// field. by is who entered it, byName the name they went by then. A deleted
// customer is hidden, never removed.
export interface CustomerRow {
  id: number
  companyId: number
  typeId: number
  phone: string
  values: Record<number, Answer>
  by: string
  byName: string | null
  createdAt: string
  updatedAt: string
  deleted?: boolean
}

// What happened to a customer: who did it, under which name then, and what
// an edit changed, as text.
export interface HistoryRow {
  id: number
  customerId: number
  action: "created" | "updated" | "deleted"
  by: string
  byName: string | null
  createdAt: string
  changes: { label: string; old: string; new: string }[]
}

// A task of a company: of a type, in a stage, in a location, for a
// customer, due on a day (YYYY-MM-DD), assigned to a member or nobody
// (assigneeName is the name they went by when assigned). The values are the
// answers by the id of the field. A deleted task is hidden, never removed.
export interface TaskRow {
  id: number
  companyId: number
  typeId: number
  stageId: number
  locationId: number
  customerId: number
  title: string
  deadline: string
  assignee: string | null
  assigneeName: string | null
  values: Record<number, Answer>
  by: string
  byName: string | null
  createdAt: string
  updatedAt: string
  deleted?: boolean
}

// A product or a service of a company (logic/products.md): a product has a
// unit, a service none and no SKU. The amounts are text as the API sends
// them ("150000.50"). by is who entered it, byName the name they went by
// then. A deleted row is hidden, never removed; an inactive one stays.
export interface ProductRow {
  id: number
  companyId: number
  kind: ProductKind
  name: string
  unit: Unit | null
  sku: string | null
  price: string | null
  // currencyId is the currency the price is in (logic/currencies.md).
  currencyId: number
  note: string | null
  active: boolean
  by: string
  byName: string | null
  createdAt: string
  updatedAt: string
  deleted?: boolean
}

// What happened to a task: like a customer's history.
// A supplier of a company (logic/warehouse.md, section 3). A row is never
// removed: deleted hides it; active false keeps it out of new purchases.
export interface SupplierRow {
  id: number
  companyId: number
  name: string
  phone: string | null
  note: string | null
  active: boolean
  by: string
  byName: string | null
  createdAt: string
  updatedAt: string
  deleted?: boolean
}

// A document of the journal (logic/warehouse.md, section 1; the Go API's
// transactions): of a kind, numbered within its kind in the company, at a
// moment (ISO, UTC), with whichever references its kind names, in a
// currency by a rate row, with its amount (a goods document's is the sum of
// its lines) as a number (the Go API keeps it as numeric; the mock rounds
// to two decimals). deleted hides it; its number is never given again.
export type DocumentKind =
  | "purchase"
  | "sale"
  | "transfer"
  | "inventory"
  | "opening_stock"
  | "supplier_payment"
  | "supplier_debt"
  | "supplier_prepay"
  | "customer_payment"
  | "customer_debt"
  | "customer_prepay"
  | "cash_opening"
  | "expense"
  | "income"
  | "money_transfer"
  | "conversion"

export interface TransactionRow {
  id: number
  companyId: number
  kind: DocumentKind
  number: number
  at: string
  locationId: number | null
  toLocationId: number | null
  supplierId: number | null
  customerId: number | null
  bankAccountId: number | null
  toBankAccountId: number | null
  categoryId: number | null
  linkedId: number | null
  currencyId: number
  rateId: number
  total: number
  toTotal: number | null
  note: string | null
  by: string
  byName: string | null
  createdAt: string
  updatedAt: string
  deleted?: boolean
}

// A line of a goods document: a product, its quantity (counted, in an
// inventory, with the stock expected) and its price where the kind has one.
export interface ItemRow {
  transactionId: number
  productId: number
  quantity: number
  expected: number | null
  price: number | null
  position: number
}

// A move of the stock journal: what a document moved in a location, in
// (above zero) or out (below). The stock is the sum of the moves.
export interface MoveRow {
  transactionId: number
  companyId: number
  locationId: number
  productId: number
  quantity: number
}

export interface TaskHistoryRow {
  id: number
  taskId: number
  action: "created" | "updated" | "deleted"
  by: string
  byName: string | null
  createdAt: string
  changes: { label: string; old: string; new: string }[]
}

// A rate row of a company (logic/currencies.md, section 4): so'm per unit
// of each currency, four decimals, who set it and when. A standard row
// (status 1) comes from the settings; a document's own row (status 2) is
// kept out of the history (the company's zero row, or a rate typed in a
// form).
export interface RateRow {
  id: number
  companyId: number
  usd: string
  eur: string
  rub: string
  status: 1 | 2
  setBy: string
  setAt: string
}

// A category of the company's expenses or its other income
// (logic/finance.md, section 6).
export interface FinanceCategoryRow {
  id: number
  companyId: number
  name: string
  kind: FinanceKind
  position: number
  active: boolean
  deleted?: boolean
}

// cashOf is the account every company starts with.
export const cashOf = (id: number): AppAccount => ({ id, name: "Naqd", currency_id: 1, is_active: true })

// CATALOG is every currency there is, the so'm first.
export const CATALOG: Omit<CompanyCurrency, "rate">[] = [
  { id: 1, code: "UZS", name: "O'zbek so'mi", symbol: "so'm" },
  { id: 2, code: "USD", name: "AQSH dollari", symbol: "$" },
  { id: 3, code: "EUR", name: "Yevro", symbol: "€" },
  { id: 4, code: "RUB", name: "Rossiya rubli", symbol: "₽" },
]

interface Db {
  users: Record<string, string | null>
  companies: Company[]
  members: Record<string, Membership[]>
  roles: RoleRow[]
  locations: LocationRow[]
  dropdowns: DropdownRow[]
  types: TypeRow[]
  stages: StageRow[]
  taskTypes: TaskTypeRow[]
  customers: CustomerRow[]
  history: HistoryRow[]
  tasks: TaskRow[]
  taskHistory: TaskHistoryRow[]
  products: ProductRow[]
  suppliers: SupplierRow[]
  // transactions: the journal; items its lines; moves its stock moves.
  transactions: TransactionRow[]
  items: ItemRow[]
  moves: MoveRow[]
  // currencies: the ids of the currencies each company has turned on (the
  // so'm always); rates: the companies' standard rate rows.
  currencies: Record<number, number[]>
  rates: RateRow[]
  // accounts: each company's live accounts (logic/finance.md), in the
  // order the admin added them; every company starts with cash in so'm.
  // financeCategories: the expense and income categories; a row is never
  // removed: deleted hides it.
  accounts: Record<number, AppAccount[]>
  financeCategories: FinanceCategoryRow[]
  // lastId: the id the last settings or customer row took.
  lastId: number
  // minutes: how far the clock of the customers' timestamps has moved.
  minutes: number
  // joined: the counter the next membership takes its place from.
  joined: number
  // codes: the code a phone may sign in with; sentAt: when its last code went.
  codes: Record<string, string>
  sentAt: Record<string, number>
  // refresh: the live refresh tokens; lastRefresh stands in for the cookie
  // where no browser keeps one (Vitest).
  refresh: Set<string>
  lastRefresh: string | null
  // cooldown off lets an e2e test ask again without waiting a real minute.
  cooldown: boolean
  issued: number
  // contacts: the phone each Telegram account shared with the user bot.
  contacts: Record<number, string>
}

// seedSettings is what the companies start with: the ready location Asosiy,
// the two ready customer types, the three ready stages and the ready task
// type every company has and, in Olma Savdo, a dropdown with a field that
// uses it.
function seedSettings(companies: Company[]): Pick<Db, "locations" | "dropdowns" | "types" | "stages" | "taskTypes" | "lastId"> {
  let lastId = 0
  const next = () => (lastId += 1)
  const locations = companies.map((company): LocationRow => ({ id: next(), companyId: company.id, name: "Asosiy" }))
  // Nok Market has a second location: where the switch between them is tested.
  locations.push({ id: next(), companyId: 2, name: "Chilonzor" })
  const text = (label: string): FieldRow => ({ id: next(), label, kind: "string", required: true, unique: false, dropdownId: null })
  const manba: DropdownRow = {
    id: next(),
    companyId: 1,
    name: "Manba",
    options: [
      { id: next(), label: "Instagram", active: true },
      { id: next(), label: "LinkedIn", active: true },
      { id: next(), label: "YouTube", active: false },
    ],
  }
  const types = companies.flatMap((company): TypeRow[] => [
    {
      id: next(),
      companyId: company.id,
      name: "Jismoniy",
      fields: [
        text("F.I.Sh."),
        ...(company.id === 1
          ? [{ id: next(), label: "Manba", kind: "dropdown" as const, required: false, unique: false, dropdownId: manba.id }]
          : []),
      ],
    },
    {
      id: next(),
      companyId: company.id,
      name: "Yuridik",
      fields: [text("Nomi"), { id: next(), label: "INN", kind: "int", required: true, unique: true, dropdownId: null }],
    },
  ])
  const stages = companies.flatMap((company): StageRow[] => [
    { id: next(), companyId: company.id, name: "Yangi", color: "blue", done: false },
    { id: next(), companyId: company.id, name: "Jarayonda", color: "amber", done: false },
    { id: next(), companyId: company.id, name: "Bajarildi", color: "green", done: true },
  ])
  const taskTypes = companies.map((company): TaskTypeRow => ({ id: next(), companyId: company.id, name: "Vazifa", fields: [] }))
  return { locations, dropdowns: [manba], types, stages, taskTypes, lastId }
}

function seed(): Db {
  const companies: Company[] = [
    { id: 1, name: "Olma Savdo", end_date: addDays(TODAY, 30), is_active: true },
    { id: 2, name: "Nok Market", end_date: addDays(TODAY, 10), is_active: true },
    { id: 3, name: "Anor Servis", end_date: addDays(TODAY, -5), is_active: true },
    { id: 4, name: "Behi Blok", end_date: addDays(TODAY, 30), is_active: false },
  ]
  return {
    users: { [ALI]: "Ali Valiyev", [VALI]: "Vali Aliyev", [SARDOR]: "Sardor Karimov", [ZARINA]: null },
    companies,
    ...seedSettings(companies),
    customers: [],
    history: [],
    tasks: [],
    taskHistory: [],
    products: [],
    suppliers: [],
    transactions: [],
    items: [],
    moves: [],
    // Every company has the so'm; Nok Market works in dollars too, at a
    // rate Vali set: where the currency fields are tested.
    currencies: { 1: [1], 2: [1, 2], 3: [1], 4: [1] },
    rates: [{ id: 9001, companyId: 2, usd: "12800.0000", eur: "0.0000", rub: "0.0000", status: 1, setBy: VALI, setAt: "2026-10-01T05:00:00Z" }],
    // Nok Market has a dollar card besides its cash.
    accounts: {
      1: [cashOf(9101)],
      2: [cashOf(9102), { id: 9112, name: "Karta", currency_id: 2, is_active: true }],
      3: [cashOf(9103)],
      4: [cashOf(9104)],
    },
    financeCategories: [],
    minutes: 0,
    members: {
      [ALI]: [{ companyId: 1, role: "owner", joined: 1 }],
      [VALI]: [
        { companyId: 1, role: "user", joined: 2 },
        { companyId: 2, role: "owner", joined: 3 },
      ],
      [SARDOR]: [
        { companyId: 3, role: "owner", joined: 4 },
        { companyId: 1, role: "user", joined: 5 },
        { companyId: 4, role: "user", joined: 6 },
      ],
      [ZARINA]: [{ companyId: 3, role: "user", joined: 7 }],
    },
    roles: [],
    joined: 7,
    codes: {},
    sentAt: {},
    refresh: new Set(),
    lastRefresh: null,
    cooldown: true,
    issued: 0,
    contacts: { [TG_ALI]: ALI, [TG_VALI]: VALI, [TG_STRANGER]: STRANGER },
  }
}

export let db = seed()

export function resetDb() {
  db = seed()
}

// paidUp is the API's subscription check: not past the end date, not blocked.
export function paidUp(company: Company): boolean {
  return company.is_active && company.end_date >= TODAY
}

// roleOf is the company role a member holds, if any.
export function roleOf(membership: Membership): RoleRow | undefined {
  return membership.roleId === undefined ? undefined : db.roles.find((r) => r.id === membership.roleId)
}

export function companiesOf(phone: string): AppCompany[] {
  return (db.members[phone] ?? [])
    .map((membership) => {
      const { companyId, role } = membership
      const c = db.companies.find((company) => company.id === companyId)!
      return {
        id: c.id,
        name: c.name,
        role,
        role_name: roleOf(membership)?.name ?? null,
        end_date: c.end_date,
        days_left: daysLeft(c.end_date),
        is_active: c.is_active,
      }
    })
    .sort((a, b) => a.name.localeCompare(b.name))
}

// permissionsOf is what phone may do in the company, as the API tells it
// (logic/roles.md, section 4): the owner everything, an employee with a role
// what the role holds, one without the default.
export function permissionsOf(phone: string, companyId: number): Permission[] {
  const membership = (db.members[phone] ?? []).find((m) => m.companyId === companyId)
  if (!membership) return []
  if (membership.role === "owner") return allPermissions
  return roleOf(membership)?.permissions ?? defaultPermissions
}

// toRole is a role as the API lists it, with how many members hold it.
export function toRole(role: RoleRow): CompanyRole {
  const holders = Object.values(db.members).flat().filter((m) => m.roleId === role.id).length
  return { id: role.id, name: role.name, permissions: role.permissions, members_count: holders }
}

// rolesOf lists a company's roles as the API does: by name, whatever the case.
export function rolesOf(companyId: number): CompanyRole[] {
  return db.roles
    .filter((r) => r.companyId === companyId)
    .sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()) || a.id - b.id)
    .map(toRole)
}

// nameIn is the name phone goes by in the company: the membership's, or the
// user's own when the membership has none.
export function nameIn(phone: string, companyId: number | null): string | null {
  const membership = (db.members[phone] ?? []).find((m) => m.companyId === companyId)
  return membership?.fullName ?? db.users[phone] ?? null
}

// membersOf lists a company's members as the API does: the owner first, then
// the users in the order they joined.
export function membersOf(companyId: number): Member[] {
  return Object.entries(db.members)
    .flatMap(([phone, memberships]) =>
      memberships.filter((m) => m.companyId === companyId).map((membership) => ({ phone, membership })),
    )
    .sort(
      (a, b) =>
        Number(b.membership.role === "owner") - Number(a.membership.role === "owner") ||
        a.membership.joined - b.membership.joined,
    )
    .map(({ phone, membership }) => ({
      phone,
      full_name: nameIn(phone, companyId),
      role: membership.role,
      role_id: membership.roleId ?? null,
      role_name: roleOf(membership)?.name ?? null,
      // Every location (null), or the live ones of the restriction.
      locations: membership.locationIds === undefined ? null : locationsOf(phone, companyId),
      created_at: new Date(Date.parse(`${TODAY}T05:00:00Z`) + membership.joined * 60_000).toISOString(),
    }))
}

// join adds phone to the company as a user under name: the user's row is
// made when the phone is new, and kept as it is when not.
export function join(phone: string, companyId: number, name: string) {
  if (!(phone in db.users)) db.users[phone] = name
  db.joined += 1
  ;(db.members[phone] ??= []).push({ companyId, role: "user", joined: db.joined, fullName: name })
}

// customerNameOf is the name a customer goes by, as the API tells it with a
// task: its answer to its type's first text field; null when it has none.
export function customerNameOf(customer: CustomerRow): string | null {
  const type = db.types.find((t) => t.id === customer.typeId)
  const field = type?.fields.find((f) => f.kind === "string" && !f.deleted)
  const answer = field ? customer.values[field.id] : undefined
  return typeof answer === "string" && answer !== "" ? answer : null
}

// localToday is the day it is where the browser stands, as YYYY-MM-DD: what
// a deadline is "today" against.
export function localToday(): string {
  const date = new Date()
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, "0"), String(date.getDate()).padStart(2, "0")].join("-")
}

// nextId is the id of a new settings or customer row.
export function nextId(): number {
  db.lastId += 1
  return db.lastId
}

// now is the moment of a customer's change. The clock moves a minute with
// every reading, so what happened later is later, and the same in every run.
export function now(): string {
  db.minutes += 1
  return new Date(Date.parse(`${TODAY}T06:00:00Z`) + db.minutes * 60_000).toISOString()
}

export const toDropdown = (d: DropdownRow): CustomerDropdown => ({
  id: d.id,
  name: d.name,
  options: d.options.filter((o) => !o.deleted).map((o) => ({ id: o.id, label: o.label, is_active: o.active })),
})

export const toField = (f: FieldRow) => ({
  id: f.id,
  label: f.label,
  kind: f.kind,
  required: f.required,
  is_unique: f.unique,
  dropdown_id: f.dropdownId,
})

export const toType = (t: TypeRow): CustomerType => ({
  id: t.id,
  name: t.name,
  fields: t.fields.filter((f) => !f.deleted).map(toField),
})

// dropdownsOf and typesOf are a company's dropdowns and customer types as
// the API lists them: in their order, without what was deleted.
export function dropdownsOf(companyId: number): CustomerDropdown[] {
  return db.dropdowns.filter((d) => d.companyId === companyId && !d.deleted).map(toDropdown)
}

export function typesOf(companyId: number): CustomerType[] {
  return db.types.filter((t) => t.companyId === companyId && !t.deleted).map(toType)
}

export const toStage = (s: StageRow): TaskStage => ({ id: s.id, name: s.name, color: s.color, is_done: s.done })

export const toTaskField = (f: TaskFieldRow) => ({
  id: f.id,
  label: f.label,
  kind: f.kind,
  required: f.required,
  dropdown_id: f.dropdownId,
})

export const toTaskType = (t: TaskTypeRow): TaskType => ({
  id: t.id,
  name: t.name,
  fields: t.fields.filter((f) => !f.deleted).map(toTaskField),
})

// stagesOf and taskTypesOf are a company's stages and task types as the API
// lists them: in their order, without what was deleted.
export function stagesOf(companyId: number): TaskStage[] {
  return db.stages.filter((s) => s.companyId === companyId && !s.deleted).map(toStage)
}

export function taskTypesOf(companyId: number): TaskType[] {
  return db.taskTypes.filter((t) => t.companyId === companyId && !t.deleted).map(toTaskType)
}

// liveLocations is a company's locations as they are now, without the
// deleted, in the order they were added.
export function liveLocations(companyId: number): LocationRow[] {
  return db.locations.filter((l) => l.companyId === companyId && !l.deleted)
}

export const toLocation = (l: LocationRow): Location => ({ id: l.id, name: l.name })

// locationsOf is the locations phone may work in, as the API tells them
// (logic/locations.md, section 5): every live one of the company's for the
// owner and for a member without a restriction, the live ones of the
// restriction otherwise; none for someone who is not a member.
export function locationsOf(phone: string, companyId: number): Location[] {
  const membership = (db.members[phone] ?? []).find((m) => m.companyId === companyId)
  if (!membership) return []
  return liveLocations(companyId)
    .filter((l) => membership.locationIds === undefined || membership.locationIds.includes(l.id))
    .map(toLocation)
}

// seedCustomers enters the customers the pages are tested with into Olma
// Savdo, the oldest first: Dilshod (a Jismoniy who came from Instagram,
// entered by Vali), Anor Tekstil (a Yuridik, entered by Ali) and Malika (a
// Jismoniy who came from YouTube, an option that is turned off; entered by
// Sardor). The company starts with none: a test asks for them.
export function seedCustomers() {
  const [jismoniy, yuridik] = db.types.filter((t) => t.companyId === 1)
  const [fish, manba] = jismoniy.fields
  const [nomi, inn] = yuridik.fields
  const [instagram, , youtube] = db.dropdowns[0].options
  const enter = (typeId: number, phone: string, values: Record<number, Answer>, by: string): CustomerRow => {
    const at = now()
    const customer: CustomerRow = {
      id: nextId(),
      companyId: 1,
      typeId,
      phone,
      values,
      by,
      byName: nameIn(by, 1),
      createdAt: at,
      updatedAt: at,
    }
    db.customers.push(customer)
    db.history.push({ id: nextId(), customerId: customer.id, action: "created", by, byName: customer.byName, createdAt: at, changes: [] })
    return customer
  }
  return {
    dilshod: enter(jismoniy.id, "998911112233", { [fish.id]: "Dilshod Karimov", [manba.id]: instagram.id }, VALI),
    anor: enter(yuridik.id, "998933334455", { [nomi.id]: "Anor Tekstil MChJ", [inn.id]: 301234567 }, ALI),
    malika: enter(jismoniy.id, "998955556677", { [fish.id]: "Malika Yusupova", [manba.id]: youtube.id }, SARDOR),
  }
}

// seedSixKinds gives Olma Savdo's Jismoniy a field of every kind, beside its
// name and its Manba dropdown: a whole number, a radio and checkboxes over
// two more dropdowns (Ingliz is turned off), and a dropdown of several over
// Manba. A test asks for it.
export function seedSixKinds() {
  const jismoniy = db.types.find((t) => t.companyId === 1)!
  const option = (label: string, active = true): OptionRow => ({ id: nextId(), label, active })
  const jins: DropdownRow = { id: nextId(), companyId: 1, name: "Jins", options: [option("Erkak"), option("Ayol")] }
  const til: DropdownRow = {
    id: nextId(),
    companyId: 1,
    name: "Til",
    options: [option("O'zbek"), option("Rus"), option("Ingliz", false)],
  }
  db.dropdowns.push(jins, til)
  const add = (label: string, kind: CustomerFieldKind, dropdownId: number | null = null): FieldRow => {
    const field: FieldRow = { id: nextId(), label, kind, required: false, unique: false, dropdownId }
    jismoniy.fields.push(field)
    return field
  }
  return {
    yosh: add("Yoshi", "int"),
    jinsi: add("Jinsi", "radio", jins.id),
    tillar: add("Tillar", "checkbox", til.id),
    kanallar: add("Kanallar", "multi_dropdown", db.dropdowns[0].id),
    jins,
    til,
  }
}

// seedOrderType gives Olma Savdo a task type Buyurtma with a required text
// Izoh, a number Summa and a checkbox Kanal over Manba. A test asks for it.
export function seedOrderType() {
  const manba = db.dropdowns[0]
  const field = (label: string, kind: CustomerFieldKind, required = false, dropdownId: number | null = null): TaskFieldRow => ({
    id: nextId(),
    label,
    kind,
    required,
    dropdownId,
  })
  const buyurtma: TaskTypeRow = {
    id: nextId(),
    companyId: 1,
    name: "Buyurtma",
    fields: [field("Izoh", "string", true), field("Summa", "int"), field("Kanal", "checkbox", false, manba.id)],
  }
  db.taskTypes.push(buyurtma)
  const [izoh, summa, kanal] = buyurtma.fields
  return { buyurtma, izoh, summa, kanal }
}

// seedTasks enters the customers of seedCustomers, the type of seedOrderType
// and the tasks the pages are tested with into Olma Savdo, in its ready
// location Asosiy, with deadlines
// measured from the browser's day: "Eski buyurtma" (a Vazifa for Dilshod,
// Bajarildi, five days late, assigned to Ali, entered by Ali), "Hisob-
// faktura" (a Buyurtma for Malika, Yangi, two days late, nobody's, by
// Sardor), "Shartnoma yuborish" (a Vazifa for Anor Tekstil, Jarayonda,
// today, nobody's, by Vali) and "Qo'ng'iroq qilish" (a Buyurtma for
// Dilshod, Yangi, three days off, assigned to Vali, by Ali): in that order
// they are due. The company starts with none: a test asks for them.
export function seedTasks() {
  const customers = seedCustomers()
  const order = seedOrderType()
  const [yangi, jarayonda, bajarildi] = db.stages.filter((s) => s.companyId === 1)
  const [vazifa] = db.taskTypes.filter((t) => t.companyId === 1)
  const [asosiy] = liveLocations(1)
  const [instagram, linkedin] = db.dropdowns[0].options
  const today = localToday()
  const enter = (
    typeId: number,
    stageId: number,
    customerId: number,
    title: string,
    deadline: string,
    assignee: string | null,
    values: Record<number, Answer>,
    by: string,
  ): TaskRow => {
    const at = now()
    const task: TaskRow = {
      id: nextId(),
      companyId: 1,
      typeId,
      stageId,
      locationId: asosiy.id,
      customerId,
      title,
      deadline,
      assignee,
      assigneeName: assignee === null ? null : nameIn(assignee, 1),
      values,
      by,
      byName: nameIn(by, 1),
      createdAt: at,
      updatedAt: at,
    }
    db.tasks.push(task)
    db.taskHistory.push({ id: nextId(), taskId: task.id, action: "created", by, byName: task.byName, createdAt: at, changes: [] })
    return task
  }
  return {
    ...customers,
    ...order,
    yangi,
    jarayonda,
    bajarildi,
    vazifa,
    old: enter(vazifa.id, bajarildi.id, customers.dilshod.id, "Eski buyurtma", addDays(today, -5), ALI, {}, ALI),
    invoice: enter(order.buyurtma.id, yangi.id, customers.malika.id, "Hisob-faktura", addDays(today, -2), null, { [order.izoh.id]: "Kechikkan" }, SARDOR),
    contract: enter(vazifa.id, jarayonda.id, customers.anor.id, "Shartnoma yuborish", today, null, {}, VALI),
    call: enter(
      order.buyurtma.id,
      yangi.id,
      customers.dilshod.id,
      "Qo'ng'iroq qilish",
      addDays(today, 3),
      VALI,
      { [order.izoh.id]: "Ertalab qo'ng'iroq", [order.summa.id]: 45000, [order.kanal.id]: [instagram.id, linkedin.id] },
      ALI,
    ),
  }
}

// seedCatalog gives Olma Savdo two products, an inactive one and a service,
// as the tests and the e2e start from: the lists are empty otherwise.
export function seedCatalog() {
  const row = (fields: Pick<ProductRow, "kind" | "name" | "unit" | "sku" | "price" | "note"> & { active?: boolean }): ProductRow => {
    const at = now()
    const product: ProductRow = {
      id: nextId(),
      companyId: 1,
      currencyId: 1,
      active: true,
      by: ALI,
      byName: "Ali Valiyev",
      createdAt: at,
      updatedAt: at,
      ...fields,
    }
    db.products.push(product)
    return product
  }
  const olma = row({ kind: "product", name: "Olma", unit: "kg", sku: "OL-1", price: "12000.00", note: "Qizil" })
  const nok = row({ kind: "product", name: "Nok", unit: "dona", sku: null, price: null, note: null })
  const eski = row({ kind: "product", name: "Eski mahsulot", unit: "dona", sku: null, price: null, note: null, active: false })
  const yetkazish = row({ kind: "service", name: "Yetkazish", unit: null, sku: null, price: "50000.00", note: null })
  return { olma, nok, eski, yetkazish }
}

// zeroRateOf is the company's zero rate row (status 2, nothing in it), made
// on the first ask: what a document in so'm refers to while the company
// has set no rates.
export function zeroRateOf(companyId: number, by: string): RateRow {
  let row = db.rates.find((r) => r.companyId === companyId && r.status === 2 && /^0(\.0+)?$/.test(r.usd) && /^0(\.0+)?$/.test(r.eur) && /^0(\.0+)?$/.test(r.rub))
  if (!row) {
    row = { id: nextId(), companyId, usd: "0.0000", eur: "0.0000", rub: "0.0000", status: 2, setBy: by, setAt: now() }
    db.rates.push(row)
  }
  return row
}

// seedWarehouse enters what the warehouse pages are tested with into Olma
// Savdo: the suppliers Bozor (with a phone and a note) and Dehqon
// (inactive), and, given the catalog's products, purchase № 1 in Asosiy by
// Ali at 9:00 on 2026-10-01 (12.5 kg of Olma at 1000, 3 Nok at 2500.5,
// 5 000 paid with it out of the cash) with its moves and its payment.
export function seedWarehouse(products?: { olma: ProductRow; nok: ProductRow }) {
  const at = now()
  const supplier = (fields: Pick<SupplierRow, "name"> & Partial<SupplierRow>): SupplierRow => {
    const row: SupplierRow = { id: nextId(), companyId: 1, phone: null, note: null, active: true, by: ALI, byName: "Ali Valiyev", createdAt: at, updatedAt: at, ...fields }
    db.suppliers.push(row)
    return row
  }
  const bozor = supplier({ name: "Bozor", phone: "998901234567", note: "Chorsu" })
  const dehqon = supplier({ name: "Dehqon", active: false })
  let purchase: TransactionRow | undefined
  if (products) {
    const asosiy = db.locations.find((l) => l.companyId === 1 && !l.deleted)!
    const rate = zeroRateOf(1, ALI)
    const head = (fields: Partial<TransactionRow> & Pick<TransactionRow, "kind" | "number" | "total">): TransactionRow => ({
      id: nextId(),
      companyId: 1,
      at: "2026-10-01T04:00:00Z",
      locationId: null,
      toLocationId: null,
      supplierId: bozor.id,
      customerId: null,
      bankAccountId: null,
      toBankAccountId: null,
      categoryId: null,
      linkedId: null,
      currencyId: 1,
      rateId: rate.id,
      toTotal: null,
      note: null,
      by: ALI,
      byName: "Ali Valiyev",
      createdAt: at,
      updatedAt: at,
      ...fields,
    })
    purchase = head({ kind: "purchase", number: 1, locationId: asosiy.id, total: 20001.5, note: "Ertalab" })
    db.transactions.push(purchase)
    db.items.push(
      { transactionId: purchase.id, productId: products.olma.id, quantity: 12.5, expected: null, price: 1000, position: 1 },
      { transactionId: purchase.id, productId: products.nok.id, quantity: 3, expected: null, price: 2500.5, position: 2 },
    )
    db.moves.push(
      { transactionId: purchase.id, companyId: 1, locationId: asosiy.id, productId: products.olma.id, quantity: 12.5 },
      { transactionId: purchase.id, companyId: 1, locationId: asosiy.id, productId: products.nok.id, quantity: 3 },
    )
    db.transactions.push(head({ kind: "supplier_payment", number: 1, bankAccountId: db.accounts[1][0].id, linkedId: purchase.id, total: 5000 }))
  }
  return { bozor, dehqon, purchase }
}

// seedPayment enters a payment to the supplier out of the company's cash,
// on its own, at the moment (ISO), by Ali: what the supplier's statement is
// tested with.
export function seedPayment(supplierId: number, amount: number, atISO: string, note: string | null = null): TransactionRow {
  const supplier = db.suppliers.find((s) => s.id === supplierId)!
  const at = now()
  const row: TransactionRow = {
    id: nextId(),
    companyId: supplier.companyId,
    kind: "supplier_payment",
    number: Math.max(0, ...db.transactions.filter((t) => t.companyId === supplier.companyId && t.kind === "supplier_payment").map((t) => t.number)) + 1,
    at: atISO,
    locationId: null,
    toLocationId: null,
    supplierId,
    customerId: null,
    bankAccountId: db.accounts[supplier.companyId][0].id,
    toBankAccountId: null,
    categoryId: null,
    linkedId: null,
    currencyId: 1,
    rateId: zeroRateOf(supplier.companyId, ALI).id,
    total: amount,
    toTotal: null,
    note,
    by: ALI,
    byName: "Ali Valiyev",
    createdAt: at,
    updatedAt: at,
  }
  db.transactions.push(row)
  return row
}

// currentRateOf is the company's standard rate row in force now: the newest.
export function currentRateOf(companyId: number): RateRow | undefined {
  return db.rates
    .filter((r) => r.companyId === companyId && r.status === 1)
    .sort((a, b) => b.setAt.localeCompare(a.setAt) || b.id - a.id)[0]
}

// currenciesOf is the currencies the company has turned on, as /app/me
// lists them: each with the rate in force now ("1.0000" for the so'm, null
// while none was set).
export function currenciesOf(companyId: number): CompanyCurrency[] {
  const on = db.currencies[companyId] ?? [1]
  const rate = currentRateOf(companyId)
  return CATALOG.filter((c) => on.includes(c.id)).map((c) => {
    const column = rate ? { 1: "1.0000", 2: rate.usd, 3: rate.eur, 4: rate.rub }[c.id] : undefined
    return { ...c, rate: c.id === 1 ? "1.0000" : column === undefined || /^0(\.0+)?$/.test(column) ? null : column }
  })
}

// accountsOf is the company's live accounts as /app/me lists them.
export function accountsOf(companyId: number): AppAccount[] {
  return db.accounts[companyId] ?? []
}
