// The product categories of the mock API (logic/products.md, 3.4;
// backend/internal/catalog/categories.go): one level, read by every member,
// kept with the settings' permissions; a category live products are filed
// under stays.
import { http, HttpResponse } from "msw"
import type { ProductCategory } from "@/lib/types"
import { db, nextId, type ProductCategoryRow } from "./data"
import { api, fail, memberSession, permittedSession } from "./gate"

const invalid = (message: string) => fail(400, "validation_error", message)
const notFound = () => fail(404, "not_found", "Kategoriya topilmadi")
const nameTaken = () => fail(409, "name_taken", "Bu nomli kategoriya allaqachon bor")
const orderChanged = () => fail(409, "order_changed", "Ro'yxat o'zgargan. Sahifani yangilang")

// categoryName is the API's rule for a name: trimmed, not empty, sixty
// characters at most.
function categoryName(raw: unknown): string | Response {
  const name = typeof raw === "string" ? raw.trim() : ""
  if (!name) return invalid("Nomni kiriting")
  if ([...name].length > 60) return invalid("Nom 60 belgidan oshmasin")
  return name
}

const sameName = (a: string, b: string) => a.toLowerCase() === b.toLowerCase()

// liveProductCategories is the company's live categories, in their order.
export const liveProductCategories = (companyId: number) =>
  db.productCategories.filter((c) => c.companyId === companyId && !c.deleted).sort((a, b) => a.position - b.position || a.id - b.id)

// productCategoryName is the name of a category as it is now, null for none.
export const productCategoryName = (id: number | null | undefined) => (id ? (db.productCategories.find((c) => c.id === id)?.name ?? null) : null)

const toProductCategory = (c: ProductCategoryRow): ProductCategory => ({ id: c.id, name: c.name })

// CategoryFilter keeps the products of a category (id), or the ones with
// none (none); with neither every product is kept.
export type CategoryFilter = { id?: number; none?: boolean }

// categoryParam reads ?category_id= as the Go API does: a category's id, or
// none; any other value is refused.
export function categoryParam(query: URLSearchParams): CategoryFilter | Response {
  const raw = query.get("category_id")
  if (raw === null || raw === "") return {}
  if (raw === "none") return { none: true }
  if (!/^[1-9]\d*$/.test(raw)) return invalid("Kategoriya noto'g'ri")
  return { id: Number(raw) }
}

// inCategory tells whether a product is kept by the filter.
export const inCategory = (filter: CategoryFilter, categoryId: number | null | undefined) =>
  filter.id !== undefined ? categoryId === filter.id : filter.none ? !categoryId : true

export const productCategoryHandlers = [
  http.get(api("/app/product-categories"), ({ request }) => {
    const member = memberSession(request)
    if (member instanceof Response) return member
    return HttpResponse.json(liveProductCategories(member.companyId).map(toProductCategory))
  }),

  http.post(api("/app/product-categories"), async ({ request }) => {
    const member = permittedSession(request, "settings.create")
    if (member instanceof Response) return member
    const body = (await request.json()) as { name?: unknown }
    const name = categoryName(body.name)
    if (name instanceof Response) return name
    const live = liveProductCategories(member.companyId)
    if (live.some((c) => sameName(c.name, name))) return nameTaken()
    const row: ProductCategoryRow = { id: nextId(), companyId: member.companyId, name, position: (live.at(-1)?.position ?? 0) + 1 }
    db.productCategories.push(row)
    return HttpResponse.json(toProductCategory(row), { status: 201 })
  }),

  http.put(api("/app/product-categories/order"), async ({ request }) => {
    const member = permittedSession(request, "settings.edit")
    if (member instanceof Response) return member
    const body = (await request.json()) as { ids?: unknown }
    const ids = Array.isArray(body.ids) ? body.ids.map(Number) : []
    const live = liveProductCategories(member.companyId).map((c) => c.id)
    if (ids.length !== live.length || new Set(ids).size !== ids.length || !ids.every((id) => live.includes(id))) return orderChanged()
    ids.forEach((id, index) => {
      const row = db.productCategories.find((c) => c.id === id)
      if (row) row.position = index + 1
    })
    return new HttpResponse(null, { status: 204 })
  }),

  http.patch(api("/app/product-categories/:id"), async ({ params, request }) => {
    const member = permittedSession(request, "settings.edit")
    if (member instanceof Response) return member
    const row = liveProductCategories(member.companyId).find((c) => c.id === Number(params.id))
    if (!row) return notFound()
    const body = (await request.json()) as { name?: unknown }
    const name = categoryName(body.name)
    if (name instanceof Response) return name
    if (liveProductCategories(member.companyId).some((c) => c.id !== row.id && sameName(c.name, name))) return nameTaken()
    row.name = name
    return HttpResponse.json(toProductCategory(row))
  }),

  http.delete(api("/app/product-categories/:id"), ({ params, request }) => {
    const member = permittedSession(request, "settings.delete")
    if (member instanceof Response) return member
    const row = liveProductCategories(member.companyId).find((c) => c.id === Number(params.id))
    if (!row) return notFound()
    // A category live products (the inactive ones too) are filed under stays.
    const filed = db.products.filter((p) => !p.deleted && p.categoryId === row.id).length
    if (filed > 0) return fail(409, "category_in_use", `Bu kategoriyada ${filed} ta mahsulot bor`)
    row.deleted = true
    return new HttpResponse(null, { status: 204 })
  }),
]
