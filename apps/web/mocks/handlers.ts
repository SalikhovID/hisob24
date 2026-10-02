// MSW handlers for the user app API, answering like the Go API: same paths,
// status codes, error codes, Uzbek messages and token rotation. Tokens are
// readable strings: "access:<phone>:<company|none>:<n>", "refresh:…".
import { http, HttpResponse } from "msw"
import { formatPhone } from "@/lib/phone"
import { companiesOf, db, LOGIN_CODE, paidUp } from "./data"

const api = (path: string) => `*/api${path}`

function fail(status: number, error: string, message: string, headers?: HeadersInit) {
  return HttpResponse.json({ error, message }, { status, headers })
}

function normalizePhone(raw: string): string | null {
  const digits = raw.replace(/[+\-()\s]/g, "")
  if (!/^\d{9,15}$/.test(digits)) return null
  return digits.length === 9 ? `998${digits}` : digits
}

type Session = { phone: string; companyId: number | null }

function token(kind: "access" | "refresh", session: Session): string {
  db.issued += 1
  return `${kind}:${session.phone}:${session.companyId ?? "none"}:${db.issued}`
}

function read(value: string | undefined | null, kind: "access" | "refresh"): Session | null {
  const [prefix, phone, company] = (value ?? "").split(":")
  if (prefix !== kind || !phone) return null
  return { phone, companyId: company === "none" ? null : Number(company) }
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

function bearer(request: Request): Session | null {
  const header = request.headers.get("authorization") ?? ""
  return header.startsWith("Bearer ") ? read(header.slice(7), "access") : null
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
    if (phone in db.users) db.codes[phone] = LOGIN_CODE
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
    if (!(phone in db.users)) {
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
    return signedIn(session)
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
      const company = db.companies.find((c) => c.id === user.companyId)
      if (!company || !paidUp(company)) return fail(402, "subscription_expired", "Kompaniya obunasi tugagan")
    }
    const companies = companiesOf(user.phone)
    return HttpResponse.json({
      user: { phone: user.phone, full_name: db.users[user.phone] ?? null },
      company: companies.find((c) => c.id === user.companyId) ?? null,
      companies,
    })
  }),
]
