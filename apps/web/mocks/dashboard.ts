// The home's blocks of the mock API, under the Go API's rules
// (backend/internal/dashboard; docs/superpowers/specs/2026-11-03-flat-redesign-design.md):
// each by its permission; the cash by currency as the accounts hold it, the
// customers' debt and the sales in so'm by each document's own rate; the
// orders, the sales and the low stock of the location asked for or of every
// one of the member's. The days are counted where the mock runs, as
// localToday counts them.
import { http, HttpResponse } from "msw"
import { liveCustomers } from "./customers"
import { db, localToday, locationsOf, permissionsOf } from "./data"
import { api, fail, forbidden, memberSession } from "./gate"
import { accountBalanceOf, asAmount, convertAmount, customerBalanceOf, rateOf, round, stockOf } from "./ledger"
import { liveOrders, toOrder } from "./orders"

const pad = (n: number) => String(n).padStart(2, "0")

// dayOf is the day of a moment where the mock runs.
const dayOf = (iso: string) => {
  const d = new Date(iso)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

// monthDays is each day of today's month up to today.
const monthDays = (today: string) => Array.from({ length: Number(today.slice(8, 10)) }, (_, i) => `${today.slice(0, 8)}${pad(i + 1)}`)

export const dashboardHandlers = [
  http.get(api("/app/dashboard"), ({ request }) => {
    const member = memberSession(request)
    if (member instanceof Response) return member
    const scope = locationsOf(member.phone, member.companyId).map((l) => l.id)
    const query = new URL(request.url).searchParams
    let locations = scope
    if (query.has("location_id")) {
      const id = Number(query.get("location_id"))
      if (!Number.isInteger(id) || id < 1) return fail(400, "validation_error", "Lokatsiya noto'g'ri")
      if (!scope.includes(id)) return forbidden()
      locations = [id]
    }
    const may = permissionsOf(member.phone, member.companyId)
    const today = localToday()
    const days = monthDays(today)
    const monthStart = days[0]

    let cash = null
    if (may.includes("finance.view")) {
      const accounts = db.accounts[member.companyId] ?? []
      const totals = [1, 2, 3, 4]
        .map((currencyId) => ({
          currency_id: currencyId,
          amount: round(accounts.filter((a) => a.currency_id === currencyId).reduce((sum, a) => sum + accountBalanceOf(a.id), 0), 2),
        }))
        .filter((t) => t.amount !== 0)
        .map((t) => ({ currency_id: t.currency_id, amount: asAmount(t.amount) }))
      cash = { totals, accounts: accounts.length }
    }

    let debtors = null
    if (may.includes("customers.view") && may.includes("sales.view")) {
      const owed = liveCustomers(member.companyId)
        .map((c) => customerBalanceOf(c.id).balance)
        .filter((b) => b > 0)
      debtors = { debt: asAmount(owed.reduce((sum, b) => sum + b, 0)), count: owed.length }
    }

    let lowStock = null
    if (may.includes("stock.view")) {
      // The live active products moved in the locations, at 3 or less there.
      const low = db.products
        .filter((p) => p.companyId === member.companyId && !p.deleted && p.active && p.kind === "product")
        .filter((p) => db.moves.some((m) => m.productId === p.id && locations.includes(m.locationId)))
        .filter((p) => stockOf(p.id, locations) <= 3)
        .sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()) || a.id - b.id)
      lowStock = { count: low.length, names: low.slice(0, 5).map((p) => p.name) }
    }

    let orders = null
    if (may.includes("orders.view")) {
      const doneStages = new Set(db.stages.filter((s) => s.companyId === member.companyId && s.done).map((s) => s.id))
      const active = liveOrders(member.companyId)
        .filter((t) => locations.includes(t.locationId) && !doneStages.has(t.stageId))
        .sort((a, b) => a.deadline.localeCompare(b.deadline) || a.id - b.id)
      orders = {
        active: active.length,
        late: active.filter((t) => t.deadline < today).length,
        by_stage: db.stages
          .filter((s) => s.companyId === member.companyId && !s.deleted && !s.done)
          .map((s) => ({ stage_id: s.id, count: active.filter((t) => t.stageId === s.id).length })),
        upcoming: active.slice(0, 5).map(toOrder),
      }
    }

    // sales is this month's sales up to today, by each day's end.
    const sales = () => {
      const docs = db.transactions.filter((t) => t.companyId === member.companyId && t.kind === "sale" && !t.deleted && t.locationId !== null && locations.includes(t.locationId))
      const inSom = docs
        .map((t) => ({ day: dayOf(t.at), som: convertAmount(t.total, t.currencyId, 1, rateOf(t.rateId)) }))
        .filter((d) => d.day >= monthStart && d.day <= today)
      const byDay = days.map((d) => round(inSom.filter((x) => x.day <= d).reduce((sum, x) => sum + x.som, 0), 2))
      return { month_total: asAmount(byDay.at(-1) ?? 0), month_count: inSom.length, by_day: byDay.map(asAmount) }
    }

    return HttpResponse.json({ cash, debtors, orders, sales: may.includes("sales.view") ? sales() : null, low_stock: lowStock })
  }),
]
