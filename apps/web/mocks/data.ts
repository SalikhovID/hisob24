// An in-memory copy of the user app API's data for MSW: Vitest and
// Playwright work against the same people, companies and rules as the Go API.
import type { AppCompany, Member, Role } from "@/lib/types"

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
// there; without one the user's own shows. joined orders the members.
interface Membership {
  companyId: number
  role: Role
  joined: number
  fullName?: string
}

interface Db {
  users: Record<string, string | null>
  companies: Company[]
  members: Record<string, Membership[]>
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

export function companiesOf(phone: string): AppCompany[] {
  return (db.members[phone] ?? [])
    .map(({ companyId, role }) => {
      const c = db.companies.find((company) => company.id === companyId)!
      return { id: c.id, name: c.name, role, end_date: c.end_date, days_left: daysLeft(c.end_date), is_active: c.is_active }
    })
    .sort((a, b) => a.name.localeCompare(b.name))
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
