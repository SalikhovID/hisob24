// What the mock API's handlers share: the paths, the error answers and the
// gates the Go API puts before its routes.
import { HttpResponse } from "msw"
import type { Permission } from "@/lib/types"
import { companiesOf, db, paidUp, permissionsOf } from "./data"

export const api = (path: string) => `*/api${path}`

export function fail(status: number, error: string, message: string, headers?: HeadersInit) {
  return HttpResponse.json({ error, message }, { status, headers })
}

export function normalizePhone(raw: string): string | null {
  const digits = raw.replace(/[+\-()\s]/g, "")
  if (!/^\d{9,15}$/.test(digits)) return null
  return digits.length === 9 ? `998${digits}` : digits
}

export type Session = { phone: string; companyId: number | null }

export function read(value: string | undefined | null, kind: "access" | "refresh"): Session | null {
  const [prefix, phone, company] = (value ?? "").split(":")
  if (prefix !== kind || !phone) return null
  return { phone, companyId: company === "none" ? null : Number(company) }
}

export function bearer(request: Request): Session | null {
  const header = request.headers.get("authorization") ?? ""
  return header.startsWith("Bearer ") ? read(header.slice(7), "access") : null
}

// isMember is the API's check on every request: the user may have been
// taken out of the company since the token was issued.
export function isMember(phone: string, companyId: number): boolean {
  return companiesOf(phone).some((company) => company.id === companyId)
}

export const ownerOnly = () => fail(403, "owner_only", "Bu bo'lim faqat kompaniya egasi uchun")
export const forbidden = () => fail(403, "forbidden", "Bu amal uchun ruxsatingiz yo'q")

// ownerSession is the API's gate before the employees, in its order: the
// token (401), the membership as it is now (401), the subscription (402),
// the owner's role (403). The company is the token's, never the request's.
export function ownerSession(request: Request): { phone: string; companyId: number } | Response {
  const user = bearer(request)
  if (!user) return fail(401, "unauthorized", "Avval tizimga kiring")
  if (user.companyId === null) return ownerOnly()
  if (!isMember(user.phone, user.companyId)) return fail(401, "unauthorized", "Avval tizimga kiring")
  const company = db.companies.find((c) => c.id === user.companyId)
  if (!company || !paidUp(company)) return fail(402, "subscription_expired", "Kompaniya obunasi tugagan")
  const membership = db.members[user.phone].find((m) => m.companyId === user.companyId)
  if (membership?.role !== "owner") return ownerOnly()
  return { phone: user.phone, companyId: user.companyId }
}

// memberSession is the API's gate before what every member of a company may
// do, in its order: the token (401), the membership as it is now (401), the
// subscription (402), a company chosen (403).
export function memberSession(request: Request): { phone: string; companyId: number } | Response {
  const user = bearer(request)
  if (!user) return fail(401, "unauthorized", "Avval tizimga kiring")
  if (user.companyId === null) return fail(403, "company_required", "Avval kompaniyani tanlang")
  if (!isMember(user.phone, user.companyId)) return fail(401, "unauthorized", "Avval tizimga kiring")
  const company = db.companies.find((c) => c.id === user.companyId)
  if (!company || !paidUp(company)) return fail(402, "subscription_expired", "Kompaniya obunasi tugagan")
  return { phone: user.phone, companyId: user.companyId }
}

// permittedSession is the API's gate before what takes a permission, in its
// order: the token (401), a company chosen (403 company_required), the
// membership as it is now (401), the subscription (402), the permission as
// the member has it now (403 forbidden). The company is the token's, never
// the request's.
export function permittedSession(request: Request, permission: Permission): { phone: string; companyId: number } | Response {
  const member = memberSession(request)
  if (member instanceof Response) return member
  if (!permissionsOf(member.phone, member.companyId).includes(permission)) return forbidden()
  return member
}
