// An in-memory copy of the user app API's data for MSW: Vitest and
// Playwright work against the same people, companies and rules as the Go API.
import type { AppCompany, Role } from "@/lib/types"

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

interface Db {
  users: Record<string, string | null>
  companies: Company[]
  members: Record<string, { companyId: number; role: Role }[]>
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

function seed(): Db {
  return {
    users: { [ALI]: "Ali Valiyev", [VALI]: "Vali Aliyev", [SARDOR]: "Sardor Karimov", [ZARINA]: null },
    companies: [
      { id: 1, name: "Olma Savdo", end_date: addDays(TODAY, 30), is_active: true },
      { id: 2, name: "Nok Market", end_date: addDays(TODAY, 10), is_active: true },
      { id: 3, name: "Anor Servis", end_date: addDays(TODAY, -5), is_active: true },
      { id: 4, name: "Behi Blok", end_date: addDays(TODAY, 30), is_active: false },
    ],
    members: {
      [ALI]: [{ companyId: 1, role: "owner" }],
      [VALI]: [
        { companyId: 1, role: "user" },
        { companyId: 2, role: "owner" },
      ],
      [SARDOR]: [
        { companyId: 3, role: "owner" },
        { companyId: 1, role: "user" },
        { companyId: 4, role: "user" },
      ],
      [ZARINA]: [{ companyId: 3, role: "user" }],
    },
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

export function companiesOf(phone: string): AppCompany[] {
  return (db.members[phone] ?? [])
    .map(({ companyId, role }) => {
      const c = db.companies.find((company) => company.id === companyId)!
      return { id: c.id, name: c.name, role, end_date: c.end_date, days_left: daysLeft(c.end_date), is_active: c.is_active }
    })
    .sort((a, b) => a.name.localeCompare(b.name))
}
