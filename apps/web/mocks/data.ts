// An in-memory copy of the user app API's data for MSW: Vitest and
// Playwright work against the same people, companies and rules as the Go API.
import { allPermissions, defaultPermissions } from "@/lib/permissions"
import type {
  AppCompany,
  CompanyRole,
  CustomerDropdown,
  CustomerFieldKind,
  CustomerType,
  Member,
  Permission,
  Role,
  StageColor,
  TaskStage,
  TaskType,
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
// permissions.
export interface Membership {
  companyId: number
  role: Role
  joined: number
  fullName?: string
  roleId?: number
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

// What happened to a task: like a customer's history.
export interface TaskHistoryRow {
  id: number
  taskId: number
  action: "created" | "updated" | "deleted"
  by: string
  byName: string | null
  createdAt: string
  changes: { label: string; old: string; new: string }[]
}

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
