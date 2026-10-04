// MSW handlers for the user app API, answering like the Go API: same paths,
// status codes, error codes, Uzbek messages and token rotation. Tokens are
// readable strings: "access:<phone>:<company|none>:<n>", "refresh:…".
import { http, HttpResponse } from "msw"
import { customerSettingsHandlers } from "./customer-settings"
import { customersHandlers } from "./customers"
import { api, bearer, fail, isMember, normalizePhone, ownerSession, read, type Session } from "./gate"
import { formatPhone } from "@/lib/phone"
import { companiesOf, db, join, LOGIN_CODE, membersOf, nameIn, paidUp } from "./data"

function token(kind: "access" | "refresh", session: Session): string {
  db.issued += 1
  return `${kind}:${session.phone}:${session.companyId ?? "none"}:${db.issued}`
}

const clearCookie = "refresh_token=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax"

// signedIn answers like the API: the access token in the body, the refresh
// token in an httpOnly cookie.
function signedIn(session: Session) {
  const refresh = token("refresh", session)
  db.refresh.add(refresh)
  db.lastRefresh = refresh
  return HttpResponse.json(
    { access_token: token("access", session), expires_in: 900, company_id: session.companyId },
    { headers: { "Set-Cookie": `refresh_token=${refresh}; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000` } },
  )
}

// presentedRefresh is the refresh_token cookie a browser sent, or the last
// one issued where no browser keeps cookies.
function presentedRefresh(request: Request): string | null {
  const cookie = request.headers.get("cookie") ?? ""
  const match = /(?:^|;\s*)refresh_token=([^;]*)/.exec(cookie)
  return match ? decodeURIComponent(match[1]) : db.lastRefresh
}

const employeeNotFound = () => fail(404, "not_found", "Xodim topilmadi")
const ownerProtected = () =>
  fail(409, "cannot_change_owner", "Kompaniya egasini o'zgartirib yoki o'chirib bo'lmaydi")

// maySignIn is the API's rule for who gets in: a member of at least one
// company. A phone in no company gets no code and no session.
function maySignIn(phone: string): boolean {
  return companiesOf(phone).length > 0
}

export const handlers = [
  http.post(api("/app/auth/sms/send"), async ({ request }) => {
    const { phone: raw } = (await request.json()) as { phone?: string }
    const phone = normalizePhone(raw ?? "")
    if (!phone) return fail(400, "validation_error", "Telefon raqami noto'g'ri")
    if (db.cooldown && Date.now() - (db.sentAt[phone] ?? -Infinity) < 60_000) {
      return fail(429, "too_many_requests", "Kodni qayta olish uchun bir daqiqa kuting")
    }
    db.sentAt[phone] = Date.now()
    if (maySignIn(phone)) db.codes[phone] = LOGIN_CODE
    return HttpResponse.json({ retry_after: 60 })
  }),

  http.post(api("/app/auth/sms/verify"), async ({ request }) => {
    const body = (await request.json()) as { phone?: string; code?: string }
    const phone = normalizePhone(body.phone ?? "")
    if (!phone) return fail(400, "validation_error", "Telefon raqami noto'g'ri")
    if (!db.codes[phone] || db.codes[phone] !== body.code) {
      return fail(401, "invalid_code", "Kod noto'g'ri yoki muddati o'tgan")
    }
    delete db.codes[phone]
    const companies = companiesOf(phone)
    return signedIn({ phone, companyId: companies.length === 1 ? companies[0].id : null })
  }),

  // The Mini App's sign-in: initData's user is the Telegram account (the
  // fake initData is not signed; hash=bad stands for a forged one).
  http.post(api("/app/auth/telegram"), async ({ request }) => {
    const { initData } = (await request.json()) as { initData?: string }
    const params = new URLSearchParams(initData ?? "")
    const user = JSON.parse(params.get("user") ?? "null") as { id?: number } | null
    if (!user?.id || params.get("hash") === "bad") {
      return fail(401, "invalid_init_data", "Telegram ma'lumoti yaroqsiz. Mini App'ni qaytadan oching")
    }
    const phone = db.contacts[user.id]
    if (!phone) return fail(403, "phone_not_shared", "Telefon raqamingiz botga ulanmagan")
    if (!maySignIn(phone)) {
      return fail(
        403,
        "no_access",
        `Hisob24'ga kirish huquqingiz yo'q. Raqamingiz: ${formatPhone(phone)}. Kompaniyangiz administratoriga murojaat qiling.`,
      )
    }
    const companies = companiesOf(phone)
    return signedIn({ phone, companyId: companies.length === 1 ? companies[0].id : null })
  }),

  // Test only: what the user bot does when a Mini App shares the contact
  // (the e2e fake requestContact calls it).
  http.post(api("/__mock/contacts"), async ({ request }) => {
    const { telegram_id: telegramId, phone } = (await request.json()) as { telegram_id: number; phone: string }
    db.contacts[telegramId] = phone
    return new HttpResponse(null, { status: 204 })
  }),

  http.post(api("/app/auth/refresh"), ({ request }) => {
    const presented = presentedRefresh(request)
    const session = read(presented, "refresh")
    if (!presented || !session || !db.refresh.has(presented)) {
      return fail(401, "invalid_refresh_token", "Sessiya tugagan. Qayta kiring", { "Set-Cookie": clearCookie })
    }
    db.refresh.delete(presented)
    // Taken out of every company: the session is over.
    if (!maySignIn(session.phone)) {
      return fail(401, "invalid_refresh_token", "Sessiya tugagan. Qayta kiring", { "Set-Cookie": clearCookie })
    }
    // The membership as it is now: a company the user was taken out of is
    // not kept.
    const companyId = session.companyId !== null && isMember(session.phone, session.companyId) ? session.companyId : null
    return signedIn({ phone: session.phone, companyId })
  }),

  http.post(api("/app/auth/logout"), ({ request }) => {
    const presented = presentedRefresh(request)
    if (presented) db.refresh.delete(presented)
    db.lastRefresh = null
    return new HttpResponse(null, { status: 204, headers: { "Set-Cookie": clearCookie } })
  }),

  http.post(api("/app/auth/switch-company"), async ({ request }) => {
    const user = bearer(request)
    if (!user) return fail(401, "unauthorized", "Avval tizimga kiring")
    const { company_id: companyId } = (await request.json()) as { company_id: number | null }
    if (companyId !== null && !companiesOf(user.phone).some((c) => c.id === companyId)) {
      return fail(403, "not_member", "Siz bu kompaniyaga a'zo emassiz")
    }
    const presented = presentedRefresh(request)
    const session = read(presented, "refresh")
    if (!presented || !session || session.phone !== user.phone || !db.refresh.has(presented)) {
      return fail(401, "invalid_refresh_token", "Sessiya tugagan. Qayta kiring", { "Set-Cookie": clearCookie })
    }
    db.refresh.delete(presented)
    return signedIn({ phone: user.phone, companyId })
  }),

  http.get(api("/app/me"), ({ request }) => {
    const user = bearer(request)
    if (!user) return fail(401, "unauthorized", "Avval tizimga kiring")
    if (user.companyId !== null) {
      // No longer a member: the token is refused and the app refreshes.
      if (!isMember(user.phone, user.companyId)) return fail(401, "unauthorized", "Avval tizimga kiring")
      const company = db.companies.find((c) => c.id === user.companyId)
      if (!company || !paidUp(company)) return fail(402, "subscription_expired", "Kompaniya obunasi tugagan")
    }
    const companies = companiesOf(user.phone)
    return HttpResponse.json({
      user: { phone: user.phone, full_name: nameIn(user.phone, user.companyId) },
      company: companies.find((c) => c.id === user.companyId) ?? null,
      companies,
    })
  }),

  http.get(api("/app/employees"), ({ request }) => {
    const owner = ownerSession(request)
    if (owner instanceof Response) return owner
    return HttpResponse.json(membersOf(owner.companyId))
  }),

  http.post(api("/app/employees"), async ({ request }) => {
    const owner = ownerSession(request)
    if (owner instanceof Response) return owner
    const body = (await request.json()) as { phone?: string; full_name?: string }
    const phone = normalizePhone(body.phone ?? "")
    if (!phone) return fail(400, "validation_error", "Telefon raqami noto'g'ri")
    const name = body.full_name?.trim()
    if (!name) return fail(400, "validation_error", "Ismni kiriting")
    // A member already, the owner too: nothing changes.
    if (isMember(phone, owner.companyId)) {
      return fail(409, "already_member", "Bu raqam kompaniyangizga allaqachon qo'shilgan")
    }
    // A phone that works in another company gets the answer a new one does.
    join(phone, owner.companyId, name)
    return HttpResponse.json(membersOf(owner.companyId).find((m) => m.phone === phone), { status: 201 })
  }),

  http.patch(api("/app/employees/:phone"), async ({ params, request }) => {
    const owner = ownerSession(request)
    if (owner instanceof Response) return owner
    const phone = String(params.phone)
    const name = ((await request.json()) as { full_name?: string }).full_name?.trim()
    if (!name) return fail(400, "validation_error", "Ismni kiriting")
    const membership = (db.members[phone] ?? []).find((m) => m.companyId === owner.companyId)
    if (!membership) return employeeNotFound()
    if (membership.role === "owner") return ownerProtected()
    membership.fullName = name
    return HttpResponse.json(membersOf(owner.companyId).find((m) => m.phone === phone))
  }),

  http.delete(api("/app/employees/:phone"), ({ params, request }) => {
    const owner = ownerSession(request)
    if (owner instanceof Response) return owner
    const phone = String(params.phone)
    const membership = (db.members[phone] ?? []).find((m) => m.companyId === owner.companyId)
    if (!membership) return employeeNotFound()
    if (membership.role === "owner") return ownerProtected()
    // Only the membership goes: the user and their other companies stay.
    db.members[phone] = db.members[phone].filter((m) => m !== membership)
    return new HttpResponse(null, { status: 204 })
  }),

  ...customerSettingsHandlers,
  ...customersHandlers,
]
