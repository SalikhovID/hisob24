// The catalog of the mock API: the products and the services of a company,
// under the Go API's rules (logic/products.md; backend/internal/catalog).
import { http, HttpResponse } from "msw"
import type { Product, ProductKind, Unit } from "@/lib/types"
import { nameOf } from "./customers"
import { db, nameIn, nextId, now, type ProductRow } from "./data"
import { api, fail, permittedSession } from "./gate"

const PAGE_SIZE = 20
export const units: Unit[] = ["dona", "kg", "g", "l", "ml", "m", "m2", "quti", "juft", "komplekt"]
const money = /^\d{1,12}(\.\d{1,2})?$/

const invalid = (message: string) => fail(400, "validation_error", message)
const productNotFound = () => fail(404, "not_found", "Mahsulot topilmadi")
const nameTaken = (kind: ProductKind) =>
  fail(409, "name_taken", kind === "service" ? "Bu nomli xizmat allaqachon bor" : "Bu nomli mahsulot allaqachon bor")
const skuTaken = () => fail(409, "sku_taken", "Bu artikulli mahsulot allaqachon bor")

// asMoney writes an amount as the database does: two decimals.
export function asMoney(raw: string): string {
  const [whole, decimals = ""] = raw.split(".")
  return `${whole}.${decimals.padEnd(2, "0")}`
}

// trimmed is an optional text without the spaces around it, null when
// nothing is left.
function trimmed(raw: unknown): string | null {
  const text = typeof raw === "string" ? raw.trim() : ""
  return text === "" ? null : text
}

type Checked = Pick<ProductRow, "name" | "unit" | "sku" | "price" | "note">

// check reads a body as the Go API does, in its order: the kind, the name,
// the unit, the SKU, the price, the note.
function check(kind: unknown, body: Record<string, unknown>): Checked | Response {
  if (kind !== "product" && kind !== "service") return invalid("Turni tanlang")
  const name = trimmed(body.name)
  if (!name) return invalid("Nomni kiriting")
  if ([...name].length > 120) return invalid("Nom 120 belgidan oshmasin")
  const unit = trimmed(body.unit)
  if (kind === "service" && unit !== null) return invalid("Xizmatga birlik berilmaydi")
  if (kind === "product" && !units.includes(unit as Unit)) return invalid("Birlikni tanlang")
  const sku = trimmed(body.sku)
  if (kind === "service" && sku !== null) return invalid("Xizmatga artikul berilmaydi")
  if (sku !== null && [...sku].length > 60) return invalid("Artikul 60 belgidan oshmasin")
  const price = typeof body.price === "string" && body.price !== "" ? body.price : null
  if (price !== null && !money.test(price)) return invalid("Narx noto'g'ri")
  const note = trimmed(body.note)
  if (note !== null && [...note].length > 500) return invalid("Izoh 500 belgidan oshmasin")
  return { name, unit: unit as Unit | null, sku, price: price === null ? null : asMoney(price), note }
}

const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase()
export const liveProducts = (companyId: number) => db.products.filter((p) => p.companyId === companyId && !p.deleted)

// taken is the refusal of a name another live row of the kind has, or of a
// SKU another live product has; null when both are free.
function taken(companyId: number, kind: ProductKind, c: Checked, except?: number): Response | null {
  const others = liveProducts(companyId).filter((p) => p.id !== except)
  if (others.some((p) => p.kind === kind && same(p.name, c.name))) return nameTaken(kind)
  const sku = c.sku
  if (sku !== null && others.some((p) => p.sku !== null && same(p.sku, sku))) return skuTaken()
  return null
}

export const toProduct = (p: ProductRow): Product => ({
  id: p.id,
  kind: p.kind,
  name: p.name,
  unit: p.unit,
  sku: p.sku,
  price: p.price,
  note: p.note,
  is_active: p.active,
  created_by_name: nameOf(p.by, p.companyId, p.byName),
  created_at: p.createdAt,
  updated_at: p.updatedAt,
})

function liveProduct(companyId: number, id: unknown): ProductRow | undefined {
  return liveProducts(companyId).find((p) => p.id === Number(id))
}

export const catalogHandlers = [
  http.get(api("/app/products"), ({ request }) => {
    const member = permittedSession(request, "products.view")
    if (member instanceof Response) return member
    const query = new URL(request.url).searchParams
    const page = query.has("page") ? Number(query.get("page")) : 1
    if (!Number.isInteger(page) || page < 1) return invalid("Sahifa raqami noto'g'ri")
    const kind = query.get("kind") || "product"
    if (kind !== "product" && kind !== "service") return invalid("Tur noto'g'ri")
    const status = query.get("status") || "active"
    if (status !== "active" && status !== "inactive") return invalid("Holat noto'g'ri")
    const search = (query.get("search") ?? "").trim().toLowerCase()
    const all = liveProducts(member.companyId)
      .filter((p) => p.kind === kind && p.active === (status === "active"))
      .filter((p) => !search || p.name.toLowerCase().includes(search) || (p.sku !== null && p.sku.toLowerCase().includes(search)))
      .sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()) || a.id - b.id)
    return HttpResponse.json({
      items: all.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE).map(toProduct),
      total: all.length,
      page,
      page_size: PAGE_SIZE,
    })
  }),

  http.post(api("/app/products"), async ({ request }) => {
    const member = permittedSession(request, "products.create")
    if (member instanceof Response) return member
    const body = (await request.json()) as Record<string, unknown>
    const c = check(body.kind, body)
    if (c instanceof Response) return c
    const kind = body.kind as ProductKind
    const refusal = taken(member.companyId, kind, c)
    if (refusal) return refusal
    const at = now()
    const row: ProductRow = {
      id: nextId(),
      companyId: member.companyId,
      kind,
      ...c,
      active: true,
      by: member.phone,
      byName: nameIn(member.phone, member.companyId),
      createdAt: at,
      updatedAt: at,
    }
    db.products.push(row)
    return HttpResponse.json(toProduct(row), { status: 201 })
  }),

  http.get(api("/app/products/:id"), ({ params, request }) => {
    const member = permittedSession(request, "products.view")
    if (member instanceof Response) return member
    const p = liveProduct(member.companyId, params.id)
    return p ? HttpResponse.json(toProduct(p)) : productNotFound()
  }),

  http.put(api("/app/products/:id"), async ({ params, request }) => {
    const member = permittedSession(request, "products.edit")
    if (member instanceof Response) return member
    const p = liveProduct(member.companyId, params.id)
    if (!p) return productNotFound()
    const body = (await request.json()) as Record<string, unknown>
    const c = check(p.kind, body)
    if (c instanceof Response) return c
    const refusal = taken(member.companyId, p.kind, c, p.id)
    if (refusal) return refusal
    Object.assign(p, c, { updatedAt: now() })
    return HttpResponse.json(toProduct(p))
  }),

  http.patch(api("/app/products/:id"), async ({ params, request }) => {
    const member = permittedSession(request, "products.edit")
    if (member instanceof Response) return member
    const body = (await request.json()) as { is_active?: unknown }
    if (typeof body.is_active !== "boolean") return invalid("Holat noto'g'ri")
    const p = liveProduct(member.companyId, params.id)
    if (!p) return productNotFound()
    p.active = body.is_active
    p.updatedAt = now()
    return HttpResponse.json(toProduct(p))
  }),

  http.delete(api("/app/products/:id"), ({ params, request }) => {
    const member = permittedSession(request, "products.delete")
    if (member instanceof Response) return member
    const p = liveProduct(member.companyId, params.id)
    if (!p) return productNotFound()
    p.deleted = true
    return new HttpResponse(null, { status: 204 })
  }),
]
