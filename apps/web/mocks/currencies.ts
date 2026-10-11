// The currencies of the mock API (logic/currencies.md; backend/internal/
// currency): the rates a company keeps, read with the settings and set with
// settings.edit. What a company has turned on is the admin panel's to
// change; here it is seeded (db.currencies).
import { http, HttpResponse } from "msw"
import type { Rates } from "@/lib/types"
import { currentRateOf, db, nameIn, nextId, now, type RateRow } from "./data"
import { api, fail, permittedSession } from "./gate"

const PAGE_SIZE = 20
const ratePattern = /^\d{1,10}(\.\d{1,4})?$/

const invalid = (message: string) => fail(400, "validation_error", message)
export const notAllowed = () => fail(400, "currency_not_allowed", "Bu valyuta kompaniyada yoqilmagan")

// asRate writes a rate as the database does: four decimals.
export function asRate(raw: string): string {
  const [whole, decimals = ""] = raw.split(".")
  return `${whole}.${decimals.padEnd(4, "0")}`
}

const toRates = (r: RateRow): Rates => ({
  id: r.id,
  usd: r.usd,
  eur: r.eur,
  rub: r.rub,
  set_by_name: nameIn(r.setBy, r.companyId),
  set_at: r.setAt,
})

export const currenciesHandlers = [
  http.get(api("/app/currency-rates"), ({ request }) => {
    const member = permittedSession(request, "settings.view")
    if (member instanceof Response) return member
    const query = new URL(request.url).searchParams
    const page = query.has("page") ? Number(query.get("page")) : 1
    if (!Number.isInteger(page) || page < 1) return invalid("Sahifa raqami noto'g'ri")
    const all = db.rates
      .filter((r) => r.companyId === member.companyId)
      .sort((a, b) => b.setAt.localeCompare(a.setAt) || b.id - a.id)
    return HttpResponse.json({ items: all.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE).map(toRates), total: all.length, page, page_size: PAGE_SIZE })
  }),

  // A new standard row: each currency the company has on takes the rate
  // given, or the previous row's; one that is off takes none.
  http.post(api("/app/currency-rates"), async ({ request }) => {
    const member = permittedSession(request, "settings.edit")
    if (member instanceof Response) return member
    const body = (await request.json()) as Record<string, unknown>
    const given = { 2: body.usd, 3: body.eur, 4: body.rub } as Record<number, unknown>
    if ([2, 3, 4].every((id) => given[id] === undefined)) return invalid("Kursni kiriting")
    const on = db.currencies[member.companyId] ?? [1]
    const previous = currentRateOf(member.companyId)
    const rates: Record<number, string> = {}
    for (const id of [2, 3, 4]) {
      const raw = given[id]
      if (raw !== undefined && !on.includes(id)) return notAllowed()
      if (raw !== undefined) {
        if (typeof raw !== "string" || !ratePattern.test(raw) || Number(raw) === 0) return invalid("Kurs noto'g'ri")
        rates[id] = asRate(raw)
      } else if (on.includes(id) && previous) {
        rates[id] = { 2: previous.usd, 3: previous.eur, 4: previous.rub }[id] as string
      } else {
        rates[id] = "0.0000"
      }
    }
    const row: RateRow = { id: nextId(), companyId: member.companyId, usd: rates[2], eur: rates[3], rub: rates[4], setBy: member.phone, setAt: now() }
    db.rates.push(row)
    return HttpResponse.json(toRates(row), { status: 201 })
  }),
]
