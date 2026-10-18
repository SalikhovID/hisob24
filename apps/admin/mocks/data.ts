// An in-memory copy of the admin API's data for MSW: Vitest and Playwright
// work against the same records and rules as the Go API.
import type { AdminAccount, AdminLocation, BankAccount, Billing, Company, Currency, Member } from "@/lib/types"

export type { AdminAccount, AdminLocation, Billing, Company, Member }

// The mock database's today, so day counts never drift.
export const TODAY = "2026-10-02"
export const OWNER_ID = 461603558
export const LOGIN_CODE = "123456"
export const SESSION_COOKIE = "admin_session=mock-session; Path=/; HttpOnly; SameSite=Lax"

const DAY = 24 * 60 * 60 * 1000

export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY)
}

export function addDays(date: string, days: number): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * DAY).toISOString().slice(0, 10)
}

export function company(id: number, name: string, endDate: string, isActive = true): Company {
  return {
    id,
    name,
    end_date: endDate,
    is_active: isActive,
    days_left: daysBetween(TODAY, endDate),
    // A day of September whatever the id: 11th to 30th.
    created_at: `2026-09-${String(10 + (id % 20 || 20)).padStart(2, "0")}T05:00:00Z`,
  }
}

// The company roles and the location restrictions of the user app are not
// the admin panel's: nobody here holds one, everybody works in every
// location.
export function member(phone: string, fullName: string, role: Member["role"]): Member {
  return { phone, full_name: fullName, role, role_id: null, role_name: null, locations: null, created_at: "2026-09-20T05:00:00Z" }
}

interface Db {
  companies: Company[]
  members: Record<number, Member[]>
  // locations: each company's live locations, in the order they were added
  // (logic/locations.md); orders_count is what the API counts for them.
  locations: Record<number, AdminLocation[]>
  billings: Record<number, Billing[]>
  admins: AdminAccount[]
  // currencies: the ids of the currencies each company has turned on (the
  // so'm always); currencyUse: how many live prices each company keeps in
  // a currency (what keeps it from being turned off), by currency id.
  currencies: Record<number, number[]>
  currencyUse: Record<number, Record<number, number>>
  // accounts: each company's live accounts, in the order they were added
  // (logic/finance.md); every company starts with cash in so'm.
  accounts: Record<number, BankAccount[]>
  nextId: number
}

// cash is the account every company starts with.
export function cash(id: number): BankAccount {
  return { id, name: "Naqd", currency_id: 1, is_active: true, created_at: "2026-09-20T05:00:00Z" }
}

// CATALOG is every currency there is, the so'm first (logic/currencies.md).
export const CATALOG: Currency[] = [
  { id: 1, code: "UZS", name: "O'zbek so'mi", symbol: "so'm" },
  { id: 2, code: "USD", name: "AQSH dollari", symbol: "$" },
  { id: 3, code: "EUR", name: "Yevro", symbol: "€" },
  { id: 4, code: "RUB", name: "Rossiya rubli", symbol: "₽" },
]

function seed(): Db {
  return {
    companies: [
      company(1, "Olma Savdo", addDays(TODAY, 30)),
      company(2, "Nok Market", TODAY),
      company(3, "Olcha Servis", addDays(TODAY, -7)),
    ],
    members: {
      1: [member("998901234567", "Ali Valiyev", "owner"), member("998902223344", "Vali Aliyev", "user")],
      2: [member("998903334455", "Sardor Karimov", "owner")],
      3: [member("998904445566", "Dilnoza Rahimova", "owner")],
    },
    // Every company starts with the ready location.
    locations: {
      1: [{ id: 101, name: "Asosiy", orders_count: 0, created_at: "2026-09-20T05:00:00Z" }],
      2: [{ id: 102, name: "Asosiy", orders_count: 0, created_at: "2026-09-20T05:00:00Z" }],
      3: [{ id: 103, name: "Asosiy", orders_count: 0, created_at: "2026-09-20T05:00:00Z" }],
    },
    billings: { 1: [], 2: [], 3: [] },
    admins: [{ telegram_id: OWNER_ID, full_name: "Owner", is_active: true, created_at: "2026-10-01T04:00:00Z" }],
    // Every company starts with the so'm alone.
    currencies: { 1: [1], 2: [1], 3: [1] },
    currencyUse: {},
    accounts: { 1: [cash(201)], 2: [cash(202)], 3: [cash(203)] },
    nextId: 4,
  }
}

export let db = seed()

export function resetDb() {
  db = seed()
}
