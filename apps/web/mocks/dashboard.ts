// The home's blocks of the mock API, under the Go API's rules
// (backend/internal/dashboard; docs/superpowers/specs/2026-10-13-mini-app-ui-design.md):
// each by its permission, money in so'm by each document's own rate, the
// orders, purchases and sales of the location asked for or of every one of
// the member's. The days are counted where the mock runs, as localToday
// counts them.
import { http, HttpResponse } from "msw"
import { liveCustomers } from "./customers"
import { db, localToday, locationsOf, permissionsOf, type TransactionRow } from "./data"
import { api, fail, forbidden, memberSession } from "./gate"
import { asAmount, balanceOf, convertAmount, rateOf, round } from "./ledger"
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

    let suppliers = null
    if (may.includes("purchases.view")) {
      const balances = db.suppliers.filter((s) => s.companyId === member.companyId && !s.deleted).map((s) => balanceOf(s.id).balance)
      suppliers = {
        debt: asAmount(balances.filter((b) => b > 0).reduce((sum, b) => sum + b, 0)),
        debtors: balances.filter((b) => b > 0).length,
        advance: asAmount(-balances.filter((b) => b < 0).reduce((sum, b) => sum + b, 0)),
      }
    }

    let customers = null
    if (may.includes("customers.view")) {
      const came = liveCustomers(member.companyId).map((c) => dayOf(c.createdAt))
      const byDay = days.map((d) => came.filter((c) => c <= d).length)
      const total = byDay.at(-1) ?? 0
      customers = { total, added_this_month: total - came.filter((c) => c < monthStart).length, by_day: byDay }
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

    // money is a kind of goods documents this month up to today, by each day's end.
    const money = (kind: TransactionRow["kind"]) => {
      const docs = db.transactions.filter(
        (t) => t.companyId === member.companyId && t.kind === kind && !t.deleted && t.locationId !== null && locations.includes(t.locationId),
      )
      const inSom = docs
        .map((t) => ({ day: dayOf(t.at), som: convertAmount(t.total, t.currencyId, 1, rateOf(t.rateId)) }))
        .filter((d) => d.day >= monthStart && d.day <= today)
      const byDay = days.map((d) => round(inSom.filter((x) => x.day <= d).reduce((sum, x) => sum + x.som, 0), 2))
      return { month_total: asAmount(byDay.at(-1) ?? 0), month_count: inSom.length, by_day: byDay.map(asAmount) }
    }

    return HttpResponse.json({
      suppliers,
      customers,
      orders,
      purchases: may.includes("purchases.view") ? money("purchase") : null,
      sales: may.includes("sales.view") ? money("sale") : null,
    })
  }),
]
