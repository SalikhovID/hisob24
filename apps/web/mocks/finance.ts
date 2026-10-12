// The finance settings of the mock API (logic/finance.md, section 6;
// backend/internal/finance): the expense and income categories, read by
// every member, kept with the settings' permissions.
import { http, HttpResponse } from "msw"
import type { FinanceCategory, FinanceKind } from "@/lib/types"
import { db, type FinanceCategoryRow, nextId } from "./data"
import { api, fail, memberSession, permittedSession } from "./gate"

const invalid = (message: string) => fail(400, "validation_error", message)
const notFound = () => fail(404, "not_found", "Kategoriya topilmadi")
const nameTaken = () => fail(409, "name_taken", "Bu nomli kategoriya allaqachon bor")
const orderChanged = () => fail(409, "order_changed", "Ro'yxat o'zgargan. Sahifani yangilang")

const kinds: FinanceKind[] = ["expense", "income"]
const isKind = (raw: unknown): raw is FinanceKind => kinds.includes(raw as FinanceKind)

// categoryName is the API's rule for a name: trimmed, not empty, sixty
// characters at most.
function categoryName(raw: unknown): string | Response {
  const name = typeof raw === "string" ? raw.trim() : ""
  if (!name) return invalid("Nomni kiriting")
  if ([...name].length > 60) return invalid("Nom 60 belgidan oshmasin")
  return name
}

const sameName = (a: string, b: string) => a.toLowerCase() === b.toLowerCase()

export const liveCategories = (companyId: number, kind?: FinanceKind) =>
  db.financeCategories
    .filter((c) => c.companyId === companyId && !c.deleted && (kind === undefined || c.kind === kind))
    .sort((a, b) => kinds.indexOf(a.kind) - kinds.indexOf(b.kind) || a.position - b.position || a.id - b.id)

export const toCategory = (c: FinanceCategoryRow): FinanceCategory => ({ id: c.id, name: c.name, kind: c.kind, is_active: c.active })

export const financeHandlers = [
  http.get(api("/app/finance-categories"), ({ request }) => {
    const member = memberSession(request)
    if (member instanceof Response) return member
    const kind = new URL(request.url).searchParams.get("kind")
    if (kind !== null && !isKind(kind)) return invalid("Tur noto'g'ri")
    return HttpResponse.json(liveCategories(member.companyId, kind ?? undefined).map(toCategory))
  }),

  http.post(api("/app/finance-categories"), async ({ request }) => {
    const member = permittedSession(request, "settings.create")
    if (member instanceof Response) return member
    const body = (await request.json()) as { name?: unknown; kind?: unknown }
    if (!isKind(body.kind)) return invalid("Turni tanlang")
    const name = categoryName(body.name)
    if (name instanceof Response) return name
    const siblings = liveCategories(member.companyId, body.kind)
    if (siblings.some((c) => sameName(c.name, name))) return nameTaken()
    const row: FinanceCategoryRow = {
      id: nextId(),
      companyId: member.companyId,
      name,
      kind: body.kind,
      position: (siblings.at(-1)?.position ?? 0) + 1,
      active: true,
    }
    db.financeCategories.push(row)
    return HttpResponse.json(toCategory(row), { status: 201 })
  }),

  http.put(api("/app/finance-categories/order"), async ({ request }) => {
    const member = permittedSession(request, "settings.edit")
    if (member instanceof Response) return member
    const body = (await request.json()) as { kind?: unknown; ids?: unknown }
    if (!isKind(body.kind)) return invalid("Tur noto'g'ri")
    const ids = Array.isArray(body.ids) ? body.ids.map(Number) : []
    const live = liveCategories(member.companyId, body.kind).map((c) => c.id)
    if (ids.length !== live.length || new Set(ids).size !== ids.length || !ids.every((id) => live.includes(id))) return orderChanged()
    ids.forEach((id, index) => {
      const row = db.financeCategories.find((c) => c.id === id)
      if (row) row.position = index + 1
    })
    return new HttpResponse(null, { status: 204 })
  }),

  http.patch(api("/app/finance-categories/:id"), async ({ params, request }) => {
    const member = permittedSession(request, "settings.edit")
    if (member instanceof Response) return member
    const row = liveCategories(member.companyId).find((c) => c.id === Number(params.id))
    if (!row) return notFound()
    const body = (await request.json()) as { name?: unknown; is_active?: unknown }
    if (body.name !== undefined) {
      const name = categoryName(body.name)
      if (name instanceof Response) return name
      if (liveCategories(member.companyId, row.kind).some((c) => c.id !== row.id && sameName(c.name, name))) return nameTaken()
      row.name = name
    }
    if (typeof body.is_active === "boolean") row.active = body.is_active
    return HttpResponse.json(toCategory(row))
  }),

  http.delete(api("/app/finance-categories/:id"), ({ params, request }) => {
    const member = permittedSession(request, "settings.delete")
    if (member instanceof Response) return member
    const row = liveCategories(member.companyId).find((c) => c.id === Number(params.id))
    if (!row) return notFound()
    // A category that live documents are filed under stays; it may be turned off.
    const filed = db.transactions.filter((t) => !t.deleted && t.categoryId === row.id).length
    if (filed > 0) return fail(409, "category_in_use", `Bu kategoriyada ${filed} ta hujjat bor`)
    row.deleted = true
    return new HttpResponse(null, { status: 204 })
  }),
]
