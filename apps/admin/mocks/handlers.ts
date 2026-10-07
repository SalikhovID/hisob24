// MSW handlers for the admin API, answering like the Go API: same paths,
// status codes, error codes and Uzbek messages.
import { http, HttpResponse } from "msw"
import {
  addDays,
  type AdminLocation,
  type Billing,
  company,
  daysBetween,
  db,
  LOGIN_CODE,
  member,
  type Member,
  OWNER_ID,
  SESSION_COOKIE,
  TODAY,
} from "./data"

const PAGE_SIZE = 20

// api matches the path on any origin: jsdom's and the Playwright server's.
const api = (path: string) => `*/api${path}`

function fail(status: number, error: string, message: string) {
  return HttpResponse.json({ error, message }, { status })
}

const notFound = () => fail(404, "not_found", "Kompaniya topilmadi")
const locationNotFound = () => fail(404, "not_found", "Lokatsiya topilmadi")
const nameTaken = () => fail(409, "name_taken", "Bu nomli lokatsiya allaqachon bor")

// locationName is the API's rule for a location's name: trimmed, not
// empty, sixty characters at most.
function locationName(raw: unknown): string | Response {
  const name = typeof raw === "string" ? raw.trim() : ""
  if (!name) return fail(400, "validation_error", "Nomni kiriting")
  if ([...name].length > 60) return fail(400, "validation_error", "Nom 60 belgidan oshmasin")
  return name
}

// sameName tells two names apart as the API does: whatever the case.
const sameName = (a: string, b: string) => a.toLowerCase() === b.toLowerCase()

function normalizePhone(raw: string): string | null {
  const digits = raw.replace(/[+\-()\s]/g, "")
  if (!/^\d{9,15}$/.test(digits)) return null
  return digits.length === 9 ? `998${digits}` : digits
}

function findCompany(id: unknown) {
  return db.companies.find((c) => c.id === Number(id))
}

function owner() {
  return { telegram_id: OWNER_ID, full_name: "Owner" }
}

// ownerFirst lists members as the API does: the owner, then the users in
// the order they joined.
function ownerFirst(members: Member[]): Member[] {
  return [...members].sort((a, b) => Number(b.role === "owner") - Number(a.role === "owner"))
}

export const handlers = [
  http.post(api("/admin/auth/otp"), async ({ request }) => {
    const { code } = (await request.json()) as { code: string }
    if (code !== LOGIN_CODE) return fail(401, "invalid_code", "Kod noto'g'ri yoki muddati o'tgan")
    return HttpResponse.json(owner(), { headers: { "Set-Cookie": SESSION_COOKIE } })
  }),

  http.post(api("/admin/auth/telegram"), async ({ request }) => {
    const { initData } = (await request.json()) as { initData: string }
    const user = new URLSearchParams(initData).get("user")
    const id = user ? (JSON.parse(user) as { id?: number }).id : undefined
    if (!id) return fail(401, "invalid_init_data", "Telegram ma'lumotlari tasdiqlanmadi")
    const admin = db.admins.find((a) => a.telegram_id === id && a.is_active)
    if (!admin) return fail(403, "not_admin", "Sizda ruxsat yo'q")
    return HttpResponse.json(
      { telegram_id: admin.telegram_id, full_name: admin.full_name },
      { headers: { "Set-Cookie": SESSION_COOKIE } },
    )
  }),

  http.post(
    api("/admin/auth/logout"),
    () => new HttpResponse(null, { status: 204, headers: { "Set-Cookie": "admin_session=; Path=/; Max-Age=0" } }),
  ),

  http.get(api("/admin/me"), () => HttpResponse.json(owner())),

  http.get(api("/admin/companies"), ({ request }) => {
    const url = new URL(request.url)
    const search = (url.searchParams.get("search") ?? "").trim().toLowerCase()
    const status = url.searchParams.get("status")
    const page = Number(url.searchParams.get("page") ?? "1")
    if (status && status !== "active" && status !== "expired") {
      return fail(400, "validation_error", "Status active yoki expired bo'lishi kerak")
    }
    if (!Number.isInteger(page) || page < 1) return fail(400, "validation_error", "Sahifa raqami noto'g'ri")
    const matching = [...db.companies]
      .sort((a, b) => b.id - a.id)
      .filter((c) => !search || c.name.toLowerCase().includes(search))
      .filter((c) => !status || (status === "active") === (c.is_active && c.days_left >= 0))
    return HttpResponse.json({
      items: matching.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
      total: matching.length,
      page,
      page_size: PAGE_SIZE,
    })
  }),

  http.post(api("/admin/companies"), async ({ request }) => {
    const body = (await request.json()) as Record<string, string | undefined>
    const name = body.name?.trim()
    if (!name) return fail(400, "validation_error", "Kompaniya nomini kiriting")
    if (!/^\d{4}-\d{2}-\d{2}$/.test(body.end_date ?? "")) {
      return fail(400, "validation_error", "Tugash sanasi YYYY-MM-DD ko'rinishida bo'lishi kerak")
    }
    const phone = normalizePhone(body.owner_phone ?? "")
    if (!phone) return fail(400, "validation_error", "Egasining telefon raqami noto'g'ri")
    const ownerName = body.owner_full_name?.trim()
    if (!ownerName) return fail(400, "validation_error", "Egasining ismini kiriting")
    const created = company(db.nextId++, name, body.end_date!)
    db.companies.push(created)
    db.members[created.id] = [member(phone, ownerName, "owner")]
    // A new company starts with the ready location.
    db.locations[created.id] = [{ id: db.nextId++, name: "Asosiy", tasks_count: 0, created_at: new Date().toISOString() }]
    db.billings[created.id] = []
    return HttpResponse.json(created, { status: 201 })
  }),

  http.get(api("/admin/companies/:id"), ({ params }) => {
    const c = findCompany(params.id)
    if (!c) return notFound()
    return HttpResponse.json({ ...c, users: ownerFirst(db.members[c.id] ?? []), locations: db.locations[c.id] ?? [] })
  }),

  // The company's locations (logic/locations.md, section 3): added, renamed
  // and deleted by the admin, under the Go API's rules
  // (backend/internal/company/locations.go).
  http.post(api("/admin/companies/:id/locations"), async ({ params, request }) => {
    const body = (await request.json()) as { name?: unknown }
    const name = locationName(body.name)
    if (name instanceof Response) return name
    const c = findCompany(params.id)
    if (!c) return notFound()
    const locations = (db.locations[c.id] ??= [])
    if (locations.some((l) => sameName(l.name, name))) return nameTaken()
    const location: AdminLocation = { id: db.nextId++, name, tasks_count: 0, created_at: new Date().toISOString() }
    locations.push(location)
    return HttpResponse.json(location, { status: 201 })
  }),

  http.patch(api("/admin/companies/:id/locations/:locationId"), async ({ params, request }) => {
    const body = (await request.json()) as { name?: unknown }
    const name = locationName(body.name)
    if (name instanceof Response) return name
    const c = findCompany(params.id)
    const location = c && db.locations[c.id]?.find((l) => l.id === Number(params.locationId))
    if (!location) return locationNotFound()
    if (db.locations[c.id].some((l) => l !== location && sameName(l.name, name))) return nameTaken()
    location.name = name
    return HttpResponse.json(location)
  }),

  http.delete(api("/admin/companies/:id/locations/:locationId"), ({ params }) => {
    const c = findCompany(params.id)
    const locations = c ? (db.locations[c.id] ?? []) : []
    const location = locations.find((l) => l.id === Number(params.locationId))
    if (!c || !location) return locationNotFound()
    if (locations.length <= 1) return fail(409, "last_location", "Kompaniyaning yagona lokatsiyasi o'chirilmaydi")
    if (location.tasks_count > 0) return fail(409, "location_in_use", `Bu lokatsiyada ${location.tasks_count} ta vazifa bor`)
    db.locations[c.id] = locations.filter((l) => l !== location)
    return new HttpResponse(null, { status: 204 })
  }),

  http.patch(api("/admin/companies/:id"), async ({ params, request }) => {
    const c = findCompany(params.id)
    if (!c) return notFound()
    const body = (await request.json()) as { name?: string; is_active?: boolean }
    if (body.name !== undefined) {
      if (!body.name.trim()) return fail(400, "validation_error", "Kompaniya nomini kiriting")
      c.name = body.name.trim()
    }
    if (body.is_active !== undefined) c.is_active = body.is_active
    return HttpResponse.json(c)
  }),

  http.put(api("/admin/companies/:id/owner"), async ({ params, request }) => {
    const body = (await request.json()) as Record<string, string | undefined>
    const phone = normalizePhone(body.phone ?? "")
    if (!phone) return fail(400, "validation_error", "Telefon raqami noto'g'ri")
    const name = body.full_name?.trim()
    if (!name) return fail(400, "validation_error", "Ismni kiriting")
    const c = findCompany(params.id)
    if (!c) return notFound()
    const members = (db.members[c.id] ??= [])
    // A company has one owner: the one before stays as a user. A member is
    // promoted under the name given, anyone else joins as the owner.
    for (const m of members) m.role = "user"
    let replaced = members.find((m) => m.phone === phone)
    if (replaced) {
      replaced.role = "owner"
      replaced.full_name = name
    } else {
      replaced = member(phone, name, "owner")
      members.push(replaced)
    }
    return HttpResponse.json(replaced)
  }),

  http.get(api("/admin/companies/:id/billings"), ({ params }) => {
    const c = findCompany(params.id)
    if (!c) return notFound()
    return HttpResponse.json(db.billings[c.id] ?? [])
  }),

  http.post(api("/admin/companies/:id/billings"), async ({ params, request }) => {
    const body = (await request.json()) as { days?: number; amount?: string; note?: string }
    const days = body.days ?? 0
    if (!Number.isInteger(days) || days < 1 || days > 3650) {
      return fail(400, "validation_error", "Kunlar soni 1 dan 3650 gacha bo'lishi kerak")
    }
    if (body.amount && !/^\d{1,12}(\.\d{1,2})?$/.test(body.amount)) {
      return fail(400, "validation_error", "Summa noto'g'ri: masalan 150000 yoki 150000.50")
    }
    const c = findCompany(params.id)
    if (!c) return notFound()
    const newEnd = addDays(c.end_date > TODAY ? c.end_date : TODAY, days)
    const billing: Billing = {
      id: db.nextId++,
      company_id: c.id,
      days,
      amount: body.amount ? Number(body.amount).toFixed(2) : null,
      prev_end_date: c.end_date,
      new_end_date: newEnd,
      note: body.note?.trim() || null,
      created_by: OWNER_ID,
      created_at: new Date().toISOString(),
    }
    c.end_date = newEnd
    c.days_left = daysBetween(TODAY, newEnd)
    ;(db.billings[c.id] ??= []).unshift(billing)
    return HttpResponse.json(billing, { status: 201 })
  }),

  http.get(api("/admin/admins"), () => HttpResponse.json(db.admins)),

  http.post(api("/admin/admins"), async ({ request }) => {
    const body = (await request.json()) as { telegram_id?: number; full_name?: string }
    const id = body.telegram_id ?? 0
    if (!Number.isInteger(id) || id <= 0) return fail(400, "validation_error", "Telegram ID noto'g'ri")
    const name = body.full_name?.trim()
    if (!name) return fail(400, "validation_error", "Adminning ismini kiriting")
    const existing = db.admins.find((a) => a.telegram_id === id)
    if (existing?.is_active) return fail(409, "admin_exists", "Bu admin allaqachon faol")
    if (existing) {
      existing.is_active = true
      existing.full_name = name
      return HttpResponse.json(existing, { status: 201 })
    }
    const added = { telegram_id: id, full_name: name, is_active: true, created_at: new Date().toISOString() }
    db.admins.push(added)
    return HttpResponse.json(added, { status: 201 })
  }),

  http.delete(api("/admin/admins/:telegramId"), ({ params }) => {
    const id = Number(params.telegramId)
    if (id === OWNER_ID) return fail(409, "cannot_delete_self", "O'zingizni o'chira olmaysiz")
    const target = db.admins.find((a) => a.telegram_id === id && a.is_active)
    if (!target) return fail(404, "not_found", "Faol admin topilmadi")
    if (db.admins.filter((a) => a.is_active).length === 1) {
      return fail(409, "last_admin", "Kamida bitta faol admin qolishi kerak")
    }
    target.is_active = false
    return new HttpResponse(null, { status: 204 })
  }),
]
