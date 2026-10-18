// The core of the mock journal (logic/warehouse.md, section 1;
// backend/internal/ledger): a document's number within its kind, its
// moment, its currency and rate row, the stock moves a goods document
// makes and the check that nothing goes below zero, the payments entered
// with a document, and what a supplier is owed.
import type { BalanceLine, LastPrice, StatementRow } from "@/lib/types"
import { nameOf } from "./customers"
import { CATALOG } from "./data"
import { db, type DocumentKind, type ItemRow, type MoveRow, nextId, now, type RateRow, type TransactionRow, zeroRateOf } from "./data"
import { fail } from "./gate"

const invalid = (message: string) => fail(400, "validation_error", message)

// round keeps a number to the column's decimals (the database rounds the
// same way).
export const round = (x: number, decimals: number) => Math.round(x * 10 ** decimals) / 10 ** decimals

// asAmount writes an amount as the API does: two decimals. asQuantity a
// quantity: three. asRate a rate: four.
export const asAmount = (x: number) => round(x, 2).toFixed(2)
export const asQuantity = (x: number) => round(x, 3).toFixed(3)
export const asRate = (x: number) => round(x, 4).toFixed(4)

export const money = /^\d{1,12}(\.\d{1,2})?$/
export const quantityPattern = /^\d{1,9}(\.\d{1,3})?$/
const ratePattern = /^\d{1,10}(\.\d{1,4})?$/

// liveDocuments is the company's documents that are not hidden.
export const liveDocuments = (companyId: number) => db.transactions.filter((t) => t.companyId === companyId && !t.deleted)

// nextNumber is the number the company's next document of the kind takes:
// one past the highest so far, the deleted counted.
export function nextNumber(companyId: number, kind: DocumentKind): number {
  return Math.max(0, ...db.transactions.filter((t) => t.companyId === companyId && t.kind === kind).map((t) => t.number)) + 1
}

// atOf reads a document's moment as the client sends it (RFC 3339, with
// its offset): one is needed, and it has to be a moment. It is kept in UTC.
export function atOf(raw: unknown): string | Response {
  const text = typeof raw === "string" ? raw.trim() : ""
  if (text === "") return invalid("Vaqtni kiriting")
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/.test(text) || Number.isNaN(Date.parse(text))) return invalid("Vaqt noto'g'ri")
  return new Date(text).toISOString().replace(/\.000Z$/, "Z")
}

// rateAt is the standard rate row in force at the moment: the newest set
// at or before it, or the earliest when none was yet; none when the
// company has none at all.
export function rateAt(companyId: number, at: string): RateRow | undefined {
  const standard = db.rates.filter((r) => r.companyId === companyId && r.status === 1).sort((a, b) => a.setAt.localeCompare(b.setAt) || a.id - b.id)
  return [...standard].reverse().find((r) => r.setAt <= at) ?? standard[0]
}

// rateColumn is the rate of the currency in the row: the so'm 1, the
// others as kept.
export function rateColumn(rate: RateRow, currencyId: number): number {
  return Number({ 1: "1", 2: rate.usd, 3: rate.eur, 4: rate.rub }[currencyId] ?? "0")
}

// convertAmount turns an amount from one currency into another by the rate
// row, two decimals (the database's convert_amount).
export function convertAmount(amount: number, from: number, to: number, rate: RateRow): number {
  return round((amount * rateColumn(rate, from)) / rateColumn(rate, to), 2)
}

export const rateOf = (id: number) => db.rates.find((r) => r.id === id)!

// Pricing is a document's currency and rate row, with the rate of that
// currency in it.
export interface Pricing {
  currencyId: number
  rateId: number
  rate: number
}

// priceIn settles a document's currency and rate row as the Go API does
// (logic/currencies.md, sections 4 and 5): the currency one of the catalog
// the company has on; without a rate the standard row at the moment (the
// company's zero row for the so'm; "Kursni kiriting" for another currency
// with none); with the standard rate given, that row; with another, the
// document's own row. On an edit, a rate given back as it is keeps the row.
export function priceIn(companyId: number, body: { currency_id?: unknown; rate?: unknown }, at: string, by: string, current?: Pricing): Pricing | Response {
  const currencyId = body.currency_id === undefined || body.currency_id === null || body.currency_id === 0 ? 1 : Number(body.currency_id)
  if (currencyId !== 1) {
    if (![1, 2, 3, 4].includes(currencyId)) return invalid("Valyuta noto'g'ri")
    if (!(db.currencies[companyId] ?? [1]).includes(currencyId)) return fail(400, "currency_not_allowed", "Bu valyuta kompaniyada yoqilmagan")
  }
  let given: number | undefined
  if (typeof body.rate === "string" && body.rate.trim() !== "") {
    const text = body.rate.trim()
    if (!ratePattern.test(text) || Number(text) === 0) return invalid("Kurs noto'g'ri")
    given = Number(text)
  } else if (body.rate !== undefined && body.rate !== null && body.rate !== "") {
    return invalid("Kurs noto'g'ri")
  }
  const standard = rateAt(companyId, at)
  if (currencyId === 1) {
    if (given !== undefined && given !== 1) return invalid("Kurs noto'g'ri")
    const row = standard ?? zeroRateOf(companyId, by)
    return { currencyId, rateId: row.id, rate: 1 }
  }
  if (given === undefined) {
    if (!standard || rateColumn(standard, currencyId) === 0) return invalid("Kursni kiriting")
    return { currencyId, rateId: standard.id, rate: rateColumn(standard, currencyId) }
  }
  if (current && current.currencyId === currencyId && current.rate === given) return current
  if (standard && rateColumn(standard, currencyId) === given) return { currencyId, rateId: standard.id, rate: given }
  const columns = { 2: standard?.usd ?? "0.0000", 3: standard?.eur ?? "0.0000", 4: standard?.rub ?? "0.0000" } as Record<number, string>
  columns[currencyId] = asRate(given)
  const row: RateRow = { id: nextId(), companyId, usd: columns[2], eur: columns[3], rub: columns[4], status: 2, setBy: by, setAt: now() }
  db.rates.push(row)
  return { currencyId, rateId: row.id, rate: given }
}

// Line is a line of a goods document as the moves are made from it.
export interface Line {
  productId: number
  quantity: number
  expected?: number
}

// movesOf is what a document of the kind moves: a purchase and an opening
// stock add their lines, a sale takes them, a transfer takes them out of
// the location and adds them to the other, an inventory moves the
// difference; a move of nothing is left out.
export function movesOf(kind: DocumentKind, companyId: number, transactionId: number, locationId: number, toLocationId: number | null, lines: Line[]): MoveRow[] {
  const moves: MoveRow[] = []
  const add = (location: number, productId: number, quantity: number) => {
    if (round(quantity, 3) !== 0) moves.push({ id: nextId(), transactionId, companyId, locationId: location, productId, quantity: round(quantity, 3) })
  }
  for (const l of lines) {
    switch (kind) {
      case "purchase":
      case "opening_stock":
        add(locationId, l.productId, l.quantity)
        break
      case "sale":
      case "order":
        add(locationId, l.productId, -l.quantity)
        break
      case "transfer":
        add(locationId, l.productId, -l.quantity)
        if (toLocationId !== null) add(toLocationId, l.productId, l.quantity)
        break
      case "inventory":
        add(locationId, l.productId, l.quantity - (l.expected ?? 0))
        break
    }
  }
  return moves
}

// takeMoves removes the document's moves and gives them back, so a refused
// write can put them back.
export function takeMoves(transactionId: number): MoveRow[] {
  const taken = db.moves.filter((m) => m.transactionId === transactionId)
  db.moves = db.moves.filter((m) => m.transactionId !== transactionId)
  return taken
}

// stockOf is the product's stock summed over the locations.
export function stockOf(productId: number, locationIds: number[]): number {
  return round(
    db.moves.filter((m) => m.productId === productId && locationIds.includes(m.locationId)).reduce((sum, m) => sum + m.quantity, 0),
    3,
  )
}

// checkStock refuses when one of the products is below zero in one of the
// locations, naming the first by name.
export function checkStock(locationIds: number[], productIds: number[]): Response | null {
  const below = productIds
    .flatMap((productId) => locationIds.map((locationId) => ({ productId, locationId })))
    .filter(({ productId, locationId }) => stockOf(productId, [locationId]) < 0)
    .map(({ productId }) => db.products.find((p) => p.id === productId)!)
    .sort((a, b) => a.name.localeCompare(b.name) || a.id - b.id)
  return below.length === 0 ? null : fail(409, "stock_insufficient", `«${below[0].name}» uchun omborda yetarli qoldiq yo'q`)
}

// lastPriceOf is the price of the product's newest live purchase or
// opening stock line, with that document's currency; null when it was
// never bought.
export function lastPriceOf(productId: number): LastPrice | null {
  const line = db.items
    .filter((i) => i.productId === productId && i.price !== null)
    .map((i) => ({ item: i, doc: db.transactions.find((t) => t.id === i.transactionId)! }))
    .filter(({ doc }) => !doc.deleted && (doc.kind === "purchase" || doc.kind === "opening_stock"))
    .sort((a, b) => b.doc.at.localeCompare(a.doc.at) || b.doc.id - a.doc.id)[0]
  return line ? { amount: asAmount(line.item.price!), currency_id: line.doc.currencyId } : null
}

// documentsHolding is how many live documents hold the product.
export const documentsHolding = (productId: number) =>
  db.items.filter((i) => i.productId === productId && !db.transactions.find((t) => t.id === i.transactionId)!.deleted).length

// itemsOf is the document's lines in the order entered.
export const itemsOf = (transactionId: number): ItemRow[] => db.items.filter((i) => i.transactionId === transactionId).sort((a, b) => a.position - b.position)

// linkedPaymentsOf is the live payments entered with the document.
export const linkedPaymentsOf = (transactionId: number) => db.transactions.filter((t) => t.linkedId === transactionId && !t.deleted).sort((a, b) => a.id - b.id)

// writeLinkedPayments writes the payments entered with the document anew
// (logic/warehouse.md, 4.1): the ones there are hidden, and one payment is
// entered per line, numbered on, at the document's moment, in the account's
// currency by the rate in force; what is wrong is told line by line: the
// account, the amount, the rate.
export function writeLinkedPayments(head: TransactionRow, lines: unknown, by: string): Response | null {
  const was = linkedPaymentsOf(head.id)
  const held = new Set(was.map((p) => p.bankAccountId))
  for (const p of was) p.deleted = true
  const kind: DocumentKind = head.kind === "sale" || head.kind === "order" ? "customer_payment" : "supplier_payment"
  const list = Array.isArray(lines) ? (lines as Record<string, unknown>[]) : []
  const written: TransactionRow[] = []
  const undo = (refusal: Response) => {
    for (const p of was) p.deleted = false
    db.transactions = db.transactions.filter((t) => !written.includes(t))
    return refusal
  }
  for (const line of list) {
    const accountId = Number(line.bank_account_id ?? 0)
    const account = (db.accounts[head.companyId] ?? []).find((a) => a.id === accountId)
    if (!accountId || !account) return undo(invalid("Akkauntni tanlang"))
    if (!account.is_active && !held.has(account.id)) return undo(invalid("Akkaunt nofaol"))
    const raw = line.amount
    if (typeof raw !== "string" || !money.test(raw) || Number(raw) === 0) return undo(invalid("To'lov summasi noto'g'ri"))
    const pricing = priceIn(head.companyId, { currency_id: account.currency_id }, head.at, by)
    if (pricing instanceof Response) return undo(pricing)
    const at = now()
    const payment: TransactionRow = {
      id: nextId(),
      companyId: head.companyId,
      kind,
      number: nextNumber(head.companyId, kind),
      at: head.at,
      locationId: null,
      toLocationId: null,
      supplierId: head.supplierId,
      customerId: head.customerId,
      bankAccountId: account.id,
      toBankAccountId: null,
      categoryId: null,
      linkedId: head.id,
      currencyId: pricing.currencyId,
      rateId: pricing.rateId,
      total: Number(raw),
      toTotal: null,
      note: null,
      by,
      byName: head.byName,
      createdAt: at,
      updatedAt: at,
    }
    db.transactions.push(payment)
    written.push(payment)
  }
  return null
}

// paidOf is what the live payments entered with the document come to, in
// the document's currency, each by its own rate row.
export function paidOf(doc: TransactionRow): number {
  return round(
    linkedPaymentsOf(doc.id).reduce((sum, p) => sum + convertAmount(p.total, p.currencyId, doc.currencyId, rateOf(p.rateId)), 0),
    2,
  )
}

// signOf says how a document changes what is owed: a purchase, a sale or
// an opening debt adds, a payment or an opening advance takes away. The
// rule is the same for a supplier and a customer.
const signOf = (kind: DocumentKind) => (kind === "purchase" || kind === "supplier_debt" || kind === "sale" || kind === "order" || kind === "customer_debt" ? 1 : -1)

// Party is whose statement is read: a supplier's or a customer's.
export type Party = "supplier" | "customer"

const supplierDocuments = (supplierId: number) => db.transactions.filter((t) => t.supplierId === supplierId && !t.deleted)

// partyDocuments is the party's live documents; a retail sale and its
// payment name no customer and are nobody's.
const partyDocuments = (party: Party, id: number) =>
  db.transactions.filter((t) => (party === "supplier" ? t.supplierId === id : t.customerId === id) && !t.deleted)

// orderDocumentOf is the order's live document, if it has one.
export const orderDocumentOf = (orderId: number) => db.transactions.find((t) => t.kind === "order" && t.orderId === orderId && !t.deleted)

// orderOf is the order a document names: its own, or the one the document
// it links to is of.
function orderOf(t: TransactionRow): { id: number; title: string } | null {
  const linked = t.linkedId === null ? undefined : db.transactions.find((x) => x.id === t.linkedId)
  const orderId = t.kind === "order" ? t.orderId : linked?.kind === "order" ? linked.orderId : null
  const order = orderId ? db.orders.find((o) => o.id === orderId) : undefined
  return order ? { id: order.id, title: order.title } : null
}

// customerBalanceOf is what the customer owes in so'm by each document's
// own rate, and in each currency apart (null for none, as a list shows it).
export function customerBalanceOf(customerId: number): { balance: number; byCurrency: BalanceLine[] } {
  const docs = partyDocuments("customer", customerId)
  const inSom = (t: TransactionRow) => convertAmount(t.total, t.currencyId, 1, rateOf(t.rateId))
  const balance = round(docs.reduce((sum, t) => sum + signOf(t.kind) * inSom(t), 0), 2)
  const byCurrency = [1, 2, 3, 4]
    .map((currencyId) => ({ currency_id: currencyId, amount: round(docs.filter((t) => t.currencyId === currencyId).reduce((sum, t) => sum + signOf(t.kind) * t.total, 0), 2) }))
    .filter((l) => l.amount !== 0)
    .map((l) => ({ currency_id: l.currency_id, amount: asAmount(l.amount) }))
  return { balance, byCurrency }
}

// customerDocumentsOf is how many live documents name the customer.
export const customerDocumentsOf = (customerId: number) => partyDocuments("customer", customerId).length

// balanceOf is what is owed the supplier in so'm by each document's own
// rate (the purchases, the payments, the balance with the opening
// balances), and in each currency apart.
export function balanceOf(supplierId: number): { purchases: number; payments: number; balance: number; byCurrency: BalanceLine[] } {
  const docs = supplierDocuments(supplierId)
  const inSom = (t: TransactionRow) => convertAmount(t.total, t.currencyId, 1, rateOf(t.rateId))
  const purchases = round(docs.filter((t) => t.kind === "purchase").reduce((sum, t) => sum + inSom(t), 0), 2)
  const payments = round(docs.filter((t) => t.kind === "supplier_payment").reduce((sum, t) => sum + inSom(t), 0), 2)
  const balance = round(docs.reduce((sum, t) => sum + signOf(t.kind) * inSom(t), 0), 2)
  const byCurrency = [1, 2, 3, 4]
    .map((currencyId) => ({ currency_id: currencyId, amount: round(docs.filter((t) => t.currencyId === currencyId).reduce((sum, t) => sum + signOf(t.kind) * t.total, 0), 2) }))
    .filter((l) => l.amount !== 0)
    .map((l) => ({ currency_id: l.currency_id, amount: asAmount(l.amount) }))
  return { purchases, payments, balance, byCurrency }
}

// statementOf is the party's statement: its live documents in time, each
// with what was owed after it, the newest first.
export function statementOf(party: Party, id: number): StatementRow[] {
  // An order priced at nothing is not shown.
  const docs = partyDocuments(party, id)
    .filter((t) => !(t.kind === "order" && t.total === 0))
    .sort((a, b) => a.at.localeCompare(b.at) || a.id - b.id)
  let balance = 0
  const rows = docs.map((t): StatementRow => {
    const rate = rateOf(t.rateId)
    const amountUzs = convertAmount(t.total, t.currencyId, 1, rate)
    const delta = round(signOf(t.kind) * amountUzs, 2)
    balance = round(balance + delta, 2)
    const linked = t.linkedId === null ? undefined : db.transactions.find((x) => x.id === t.linkedId)
    const account = t.bankAccountId === null ? undefined : (db.accounts[t.companyId] ?? []).find((a) => a.id === t.bankAccountId)
    return {
      id: t.id,
      kind: t.kind as StatementRow["kind"],
      number: t.number,
      at: t.at,
      amount: asAmount(t.total),
      currency_id: t.currencyId,
      rate: asRate(rateColumn(rate, t.currencyId)),
      amount_uzs: asAmount(amountUzs),
      delta_uzs: asAmount(delta),
      balance_uzs: asAmount(balance),
      linked_id: t.linkedId,
      linked_number: linked?.number ?? null,
      bank_account_id: t.bankAccountId,
      account_name: account?.name ?? null,
      order_id: orderOf(t)?.id ?? null,
      order_title: orderOf(t)?.title ?? null,
      note: t.note,
      created_by_name: nameOf(t.by, t.companyId, t.byName),
    }
  })
  return rows.reverse()
}

// The FIFO cost (logic/warehouse.md, section 10; backend/internal/costing):
// fifoCostOf is what the document's moves out of each of the products
// cost in so'm, the product's live moves in every location replayed in
// time: a purchase's or an opening stock's move in is a lot at its unit
// cost (the last known one from then on), a transfer carries the cost it
// took to the other location, an inventory's surplus is a lot at the last
// known cost, and a move out takes from the oldest lots of its location,
// the rest at the last known cost.
export function fifoCostOf(companyId: number, transactionId: number, productIds: number[]): Map<number, number> {
  const costs = new Map<number, number>()
  for (const productId of productIds) {
    costs.set(productId, 0)
    const moves = db.moves
      .filter((m) => m.productId === productId && m.companyId === companyId)
      .map((m) => ({ m, t: db.transactions.find((t) => t.id === m.transactionId)! }))
      .filter(({ t }) => !t.deleted)
      .sort((a, b) => a.t.at.localeCompare(b.t.at) || a.t.id - b.t.id || Number(b.m.quantity < 0) - Number(a.m.quantity < 0) || a.m.id - b.m.id)
    const lots = new Map<number, { quantity: number; unitCost: number }[]>()
    const carried = new Map<number, number>()
    let lastKnown: number | null = null
    for (const { m, t } of moves) {
      if (m.quantity < 0) {
        let left = -m.quantity
        let cost = 0
        const queue = lots.get(m.locationId) ?? []
        while (left > 0 && queue.length > 0) {
          const taken = Math.min(queue[0].quantity, left)
          cost += taken * queue[0].unitCost
          left = round(left - taken, 3)
          queue[0].quantity = round(queue[0].quantity - taken, 3)
          if (queue[0].quantity === 0) queue.shift()
        }
        lots.set(m.locationId, queue)
        if (left > 0 && lastKnown !== null) cost += left * lastKnown
        if (t.kind === "transfer") carried.set(t.id, cost / -m.quantity)
        if (t.id === transactionId) costs.set(productId, round((costs.get(productId) ?? 0) + cost, 2))
        continue
      }
      let unitCost: number | null = null
      if (t.kind === "transfer") unitCost = carried.get(t.id) ?? null
      else if (t.kind === "purchase" || t.kind === "opening_stock") {
        const line = db.items.find((i) => i.transactionId === t.id && i.productId === productId)
        if (line && line.price !== null) {
          unitCost = convertAmount(line.price, t.currencyId, 1, rateOf(t.rateId))
          lastKnown = unitCost
        }
      }
      if (unitCost === null) unitCost = lastKnown ?? 0
      lots.set(m.locationId, [...(lots.get(m.locationId) ?? []), { quantity: m.quantity, unitCost }])
    }
  }
  return costs
}

// grouped writes a number the way the Go history does: the thousands apart
// by a space, the decimals after a comma without the trailing zeros.
export function grouped(amount: number): string {
  const [whole, decimals = ""] = amount.toFixed(2).split(".")
  const spaced = whole.replace(/\B(?=(\d{3})+(?!\d))/g, " ")
  const trimmed = decimals.replace(/0+$/, "")
  return trimmed ? `${spaced},${trimmed}` : spaced
}

// priceText is an order's price as the history writes it ("5 000 so'm"), "" for none.
export function priceText(amount: number, currencyId: number): string {
  return amount > 0 ? `${grouped(amount)} ${CATALOG.find((c) => c.id === currencyId)?.symbol ?? ""}` : ""
}

// linesText is an order's lines as the history writes them ("Olma × 2 kg, Montaj × 1").
export function linesText(items: ItemRow[]): string {
  return items
    .map((i) => {
      const product = db.products.find((p) => p.id === i.productId)
      const quantity = grouped(i.quantity).replace(/,(\d)$/, ",$1")
      return `${product?.name ?? ""} × ${quantity}${product?.unit ? ` ${product.unit}` : ""}`
    })
    .join(", ")
}

// What an account holds (logic/finance.md, section 4): accountDeltaOf is
// how a document changed it, in the account's own currency: an opening
// balance of the cash, other income and a customer's payment arrive; an
// expense and a supplier's payment leave; a transfer leaves one account
// and arrives in another; a conversion leaves with its amount and arrives
// with the amount that arrives.
export function accountDeltaOf(t: TransactionRow, accountId: number): number {
  switch (t.kind) {
    case "cash_opening":
    case "income":
    case "customer_payment":
      return t.total
    case "expense":
    case "supplier_payment":
      return -t.total
    case "money_transfer":
      return t.bankAccountId === accountId ? -t.total : t.total
    case "conversion":
      return t.bankAccountId === accountId ? -t.total : (t.toTotal ?? 0)
  }
  return 0
}

// accountDocumentsOf is the live documents that name the account, as the
// source or the target, in time.
export const accountDocumentsOf = (accountId: number) =>
  db.transactions.filter((t) => !t.deleted && (t.bankAccountId === accountId || t.toBankAccountId === accountId)).sort((a, b) => a.at.localeCompare(b.at) || a.id - b.id)

// accountBalanceOf is what the account holds now.
export const accountBalanceOf = (accountId: number) => round(accountDocumentsOf(accountId).reduce((sum, t) => sum + accountDeltaOf(t, accountId), 0), 2)
