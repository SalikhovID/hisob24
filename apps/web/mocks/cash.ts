// The cash of the mock API (logic/finance.md, sections 4 and 5;
// backend/internal/app/cash.go): what the accounts hold and their
// statements, and the cash documents: an opening balance of the cash, an
// expense or other income, a transfer between accounts, a conversion
// between currencies. The rules are the Go API's.
import { http, HttpResponse, type JsonBodyType } from "msw"
import type { AccountBalance, AccountStatementRow, AppAccount, CashOpening, Expense, MoneyTransfer, Permission } from "@/lib/types"
import { customerNameOf, nameOf } from "./customers"
import { db, type DocumentKind, type FinanceCategoryRow, nameIn, nextId, now, type TransactionRow, zeroRateOf } from "./data"
import { api, fail, permittedSession } from "./gate"
import { accountBalanceOf, accountDeltaOf, accountDocumentsOf, asAmount, asRate, atOf, liveDocuments, money, nextNumber, rateAt, round } from "./ledger"
import { page, paged, trimmed } from "./warehouse"

const invalid = (message: string) => fail(400, "validation_error", message)
const documentNotFound = () => fail(404, "not_found", "Hujjat topilmadi")
const accountNotFound = () => fail(404, "not_found", "Akkaunt topilmadi")

const accountOf = (companyId: number, id: number) => (db.accounts[companyId] ?? []).find((a) => a.id === id)

// head is what every cash document is saved with, as it is kept.
type Head = { account: AppAccount; at: string; rateId: number; amount: number; note: string | null }

// checkHead reads the fields every cash document shares, in the Go API's
// order: the account (kept: those the document already names, off or
// not), what the kind checks between (a category, a target), the moment,
// the amount, what comes after the amount (the amount a conversion arrives
// with), the note.
function checkHead(
  companyId: number,
  body: Record<string, unknown>,
  by: string,
  accountId: unknown,
  kept: number[],
  between?: (account: AppAccount) => Response | null,
  afterAmount?: () => Response | null,
): Head | Response {
  const account = Number(accountId ?? 0) ? accountOf(companyId, Number(accountId)) : undefined
  if (!account) return invalid("Akkauntni tanlang")
  if (!account.is_active && !kept.includes(account.id)) return invalid("Akkaunt nofaol")
  const refused = between?.(account)
  if (refused) return refused
  const at = atOf(body.at)
  if (at instanceof Response) return at
  const rateId = (rateAt(companyId, at) ?? zeroRateOf(companyId, by)).id
  const raw = body.amount
  if (raw === undefined || raw === null || raw === "") return invalid("Summani kiriting")
  if (typeof raw !== "string" || !money.test(raw) || Number(raw) === 0) return invalid("Summa noto'g'ri")
  const later = afterAmount?.()
  if (later) return later
  const note = trimmed(body.note)
  if (note !== null && [...note].length > 500) return invalid("Izoh 500 belgidan oshmasin")
  return { account, at, rateId, amount: Number(raw), note }
}

// categoryFor reads the category a document is filed under: one of the
// company's, of the kind, active unless it is the one kept.
function categoryFor(companyId: number, id: unknown, kind: string, keep: number): FinanceCategoryRow | Response {
  const category = Number(id ?? 0) ? db.financeCategories.find((c) => c.id === Number(id) && c.companyId === companyId && !c.deleted) : undefined
  if (!category) return invalid("Kategoriyani tanlang")
  if (category.kind !== kind) return invalid("Kategoriya turi mos emas")
  if (!category.active && category.id !== keep) return invalid("Kategoriya nofaol")
  return category
}

// targetFor reads the account a document goes to: one of the company's,
// another than the source, active unless it is one kept.
function targetFor(companyId: number, source: AppAccount, id: unknown, kept: number[]): AppAccount | Response {
  const target = Number(id ?? 0) ? accountOf(companyId, Number(id)) : undefined
  if (!target) return invalid("Maqsad akkauntni tanlang")
  if (target.id === source.id) return invalid("Maqsad akkaunt boshqa bo'lsin")
  if (!target.is_active && !kept.includes(target.id)) return invalid("Maqsad akkaunt nofaol")
  return target
}

// arrivingAmount reads the amount a conversion arrives with.
function arrivingAmount(raw: unknown): number | Response {
  if (raw === undefined || raw === null || raw === "") return invalid("Maqsad summani kiriting")
  if (typeof raw !== "string" || !money.test(raw) || Number(raw) === 0) return invalid("Maqsad summa noto'g'ri")
  return Number(raw)
}

// enter writes a new cash document of the kind, numbered on within the kind.
function enter(companyId: number, by: string, kind: DocumentKind, head: Head, extra: Partial<TransactionRow> = {}): TransactionRow {
  const at = now()
  const row: TransactionRow = {
    id: nextId(),
    companyId,
    kind,
    number: nextNumber(companyId, kind),
    at: head.at,
    locationId: null,
    toLocationId: null,
    supplierId: null,
    customerId: null,
    bankAccountId: head.account.id,
    toBankAccountId: null,
    categoryId: null,
    linkedId: null,
    currencyId: head.account.currency_id,
    rateId: head.rateId,
    total: head.amount,
    toTotal: null,
    note: head.note,
    by,
    byName: nameIn(by, companyId),
    createdAt: at,
    updatedAt: at,
    ...extra,
  }
  db.transactions.push(row)
  return row
}

// save writes the head and whatever else the kind names over the document.
function save(row: TransactionRow, head: Head, extra: Partial<TransactionRow> = {}) {
  Object.assign(row, { at: head.at, bankAccountId: head.account.id, currencyId: head.account.currency_id, rateId: head.rateId, total: head.amount, note: head.note, updatedAt: now(), toBankAccountId: null, categoryId: null, toTotal: null, ...extra })
  return row
}

const accountsOf = (t: TransactionRow) => [t.bankAccountId, t.toBankAccountId].filter((id): id is number => id !== null)

const documentOf = (companyId: number, id: unknown, kinds: DocumentKind[]) => liveDocuments(companyId).find((t) => t.id === Number(id) && kinds.includes(t.kind))

function toCashOpening(t: TransactionRow): CashOpening {
  const account = accountOf(t.companyId, t.bankAccountId ?? 0)
  return {
    id: t.id,
    number: t.number,
    bank_account_id: t.bankAccountId ?? 0,
    account_name: account?.name ?? "",
    currency_id: t.currencyId,
    amount: asAmount(t.total),
    at: t.at,
    note: t.note,
    created_by_name: nameOf(t.by, t.companyId, t.byName),
    created_at: t.createdAt,
    updated_at: t.updatedAt,
  }
}

function toExpense(t: TransactionRow): Expense {
  const category = db.financeCategories.find((c) => c.id === t.categoryId)
  return { ...toCashOpening(t), kind: t.kind === "income" ? "income" : "expense", category_id: t.categoryId ?? 0, category_name: category?.name ?? "" }
}

// A conversion's rate: so'm per unit of the other currency when the so'm
// is on either side; what arrives per unit of what leaves otherwise.
function toMoneyTransfer(t: TransactionRow): MoneyTransfer {
  const base = toCashOpening(t)
  const target = accountOf(t.companyId, t.toBankAccountId ?? 0)
  const toTotal = t.toTotal
  let rate: string | null = null
  if (t.kind === "conversion" && toTotal !== null && toTotal !== 0 && t.total !== 0) {
    rate = asRate(t.currencyId === 1 ? t.total / toTotal : toTotal / t.total)
  }
  return {
    id: base.id,
    kind: t.kind === "conversion" ? "conversion" : "money_transfer",
    number: base.number,
    from_account_id: base.bank_account_id,
    from_account_name: base.account_name,
    currency_id: base.currency_id,
    amount: base.amount,
    to_account_id: target?.id ?? 0,
    to_account_name: target?.name ?? "",
    to_currency_id: target?.currency_id ?? 0,
    to_amount: toTotal === null ? null : asAmount(toTotal),
    rate,
    at: base.at,
    note: base.note,
    created_by_name: base.created_by_name,
    created_at: base.created_at,
    updated_at: base.updated_at,
  }
}

// dayBoundsOf reads ?from= and ?to= as days in Tashkent: the moment the
// span starts at and the one it ends before.
function dayBoundsOf(query: URLSearchParams): { from: string | null; to: string | null } | Response {
  const day = (raw: string | null, next: boolean) => {
    if (raw === null || raw === "") return null
    if (!/^\d{4}-\d{2}-\d{2}$/.test(raw) || Number.isNaN(Date.parse(`${raw}T00:00:00+05:00`))) return invalid("Sana noto'g'ri")
    const moment = new Date(`${raw}T00:00:00+05:00`)
    if (next) moment.setUTCDate(moment.getUTCDate() + 1)
    return moment.toISOString().replace(/\.000Z$/, "Z")
  }
  const from = day(query.get("from"), false)
  if (from instanceof Response) return from
  const to = day(query.get("to"), true)
  if (to instanceof Response) return to
  if (from !== null && to !== null && from >= to) return invalid("Sana noto'g'ri")
  return { from, to }
}

// optionalId reads an id from the query: none unless given, a positive number.
function optionalId(query: URLSearchParams, name: string, message: string): number | null | Response {
  const raw = query.get(name)
  if (raw === null || raw === "") return null
  const id = Number(raw)
  if (!Number.isInteger(id) || id <= 0) return invalid(message)
  return id
}

// listCash is a page of the company's live cash documents of the kinds,
// the newest first, narrowed as the query says.
function listCash(companyId: number, kinds: DocumentKind[], query: URLSearchParams, to: (t: TransactionRow) => unknown): Response {
  const accountId = optionalId(query, "account_id", "Akkaunt noto'g'ri")
  if (accountId instanceof Response) return accountId
  const categoryId = optionalId(query, "category_id", "Kategoriya noto'g'ri")
  if (categoryId instanceof Response) return categoryId
  const bounds = dayBoundsOf(query)
  if (bounds instanceof Response) return bounds
  const n = page(query)
  if (n instanceof Response) return n
  const all = liveDocuments(companyId)
    .filter((t) => kinds.includes(t.kind))
    .filter((t) => accountId === null || t.bankAccountId === accountId || t.toBankAccountId === accountId)
    .filter((t) => categoryId === null || t.categoryId === categoryId)
    .filter((t) => (bounds.from === null || t.at >= bounds.from) && (bounds.to === null || t.at < bounds.to))
    .sort((a, b) => b.at.localeCompare(a.at) || b.id - a.id)
  const result = paged(all, n)
  return HttpResponse.json({ ...result, items: result.items.map(to) })
}

// accountStatementOf is the account's statement, the newest row first: each
// document with how it changed what the account holds and what the account
// held after it, and its other side.
function accountStatementOf(companyId: number, accountId: number): AccountStatementRow[] {
  let balance = 0
  const rows = accountDocumentsOf(accountId)
    .filter((t) => t.companyId === companyId)
    .map((t): AccountStatementRow => {
      const delta = round(accountDeltaOf(t, accountId), 2)
      balance = round(balance + delta, 2)
      const linked = t.linkedId === null ? undefined : db.transactions.find((x) => x.id === t.linkedId)
      return {
        id: t.id,
        kind: t.kind as AccountStatementRow["kind"],
        number: t.number,
        at: t.at,
        delta: asAmount(delta),
        balance: asAmount(balance),
        linked_id: t.linkedId,
        linked_number: linked?.number ?? null,
        party_name: partyNameOf(t, accountId),
        note: t.note,
        created_by_name: nameOf(t.by, t.companyId, t.byName),
      }
    })
  return rows.reverse()
}

function partyNameOf(t: TransactionRow, accountId: number): string | null {
  if (t.supplierId !== null) return db.suppliers.find((s) => s.id === t.supplierId)?.name ?? null
  if (t.customerId !== null) {
    const customer = db.customers.find((c) => c.id === t.customerId)
    return customer ? (customerNameOf(customer) ?? customer.phone) : null
  }
  if (t.categoryId !== null) return db.financeCategories.find((c) => c.id === t.categoryId)?.name ?? null
  const other = t.bankAccountId === accountId ? t.toBankAccountId : t.bankAccountId
  return other === null ? null : (accountOf(t.companyId, other)?.name ?? null)
}

// A kind of cash document as its handlers serve it: the kinds a path
// reads, the one it enters, how a body is checked and what it adds to the
// head, how a row is shown.
type Served<T extends JsonBodyType> = {
  path: string
  kinds: DocumentKind[]
  enters: (body: Record<string, unknown>) => DocumentKind | Response
  check: (companyId: number, body: Record<string, unknown>, by: string, was?: TransactionRow) => { head: Head; extra: Partial<TransactionRow> } | Response
  to: (t: TransactionRow) => T
}

const cashOpening: Served<CashOpening> = {
  path: "/app/cash-openings",
  kinds: ["cash_opening"],
  enters: () => "cash_opening",
  check: (companyId, body, by, was) => {
    const head = checkHead(companyId, body, by, body.bank_account_id, was ? accountsOf(was) : [])
    return head instanceof Response ? head : { head, extra: {} }
  },
  to: toCashOpening,
}

const expenseKindOf = (raw: unknown): DocumentKind | Response => (raw === "expense" ? "expense" : raw === "income" ? "income" : raw === undefined || raw === null || raw === "" ? invalid("Turni tanlang") : invalid("Tur noto'g'ri"))

const expense: Served<Expense> = {
  path: "/app/expenses",
  kinds: ["expense", "income"],
  enters: (body) => expenseKindOf(body.kind),
  check: (companyId, body, by, was) => {
    const kind = expenseKindOf(body.kind)
    if (kind instanceof Response) return kind
    if (was && kind !== was.kind) return invalid("Tur o'zgartirilmaydi")
    let categoryId = 0
    const head = checkHead(companyId, body, by, body.bank_account_id, was ? accountsOf(was) : [], () => {
      const category = categoryFor(companyId, body.category_id, String(kind), was?.categoryId ?? 0)
      if (category instanceof Response) return category
      categoryId = category.id
      return null
    })
    return head instanceof Response ? head : { head, extra: { categoryId } }
  },
  to: toExpense,
}

const moneyTransfer: Served<MoneyTransfer> = {
  path: "/app/money-transfers",
  kinds: ["money_transfer"],
  enters: () => "money_transfer",
  check: (companyId, body, by, was) => {
    let targetId = 0
    const kept = was ? accountsOf(was) : []
    const head = checkHead(companyId, body, by, body.from_account_id, kept, (source) => {
      const target = targetFor(companyId, source, body.to_account_id, kept)
      if (target instanceof Response) return target
      if (target.currency_id !== source.currency_id) return invalid("Valyutalar farq qilsa konvertatsiya kiriting")
      targetId = target.id
      return null
    })
    return head instanceof Response ? head : { head, extra: { toBankAccountId: targetId } }
  },
  to: toMoneyTransfer,
}

const conversion: Served<MoneyTransfer> = {
  path: "/app/conversions",
  kinds: ["conversion"],
  enters: () => "conversion",
  check: (companyId, body, by, was) => {
    let targetId = 0
    let arriving = 0
    const kept = was ? accountsOf(was) : []
    const head = checkHead(
      companyId,
      body,
      by,
      body.from_account_id,
      kept,
      (source) => {
        const target = targetFor(companyId, source, body.to_account_id, kept)
        if (target instanceof Response) return target
        if (target.currency_id === source.currency_id) return invalid("Bir xil valyutada o'tkazma kiriting")
        targetId = target.id
        return null
      },
      () => {
        const amount = arrivingAmount(body.to_amount)
        if (amount instanceof Response) return amount
        arriving = amount
        return null
      },
    )
    return head instanceof Response ? head : { head, extra: { toBankAccountId: targetId, toTotal: arriving } }
  },
  to: toMoneyTransfer,
}

// handlersOf serves a kind of cash document: its list (with the kinds the
// list shows), entering, reading, saving and deleting.
function handlersOf<T extends JsonBodyType>(served: Served<T>, listed: DocumentKind[] = served.kinds) {
  const permitted = (request: Request, permission: Permission) => permittedSession(request, permission)
  return [
    http.get(api(served.path), ({ request }) => {
      const member = permitted(request, "finance.view")
      if (member instanceof Response) return member
      const query = new URL(request.url).searchParams
      let kinds = listed
      if (served.path === "/app/expenses") {
        const raw = query.get("kind")
        if (raw !== null && raw !== "" && raw !== "expense" && raw !== "income") return invalid("Tur noto'g'ri")
        kinds = [raw === "income" ? "income" : "expense"]
      }
      return listCash(member.companyId, kinds, query, served.to)
    }),
    http.post(api(served.path), async ({ request }) => {
      const member = permitted(request, "finance.create")
      if (member instanceof Response) return member
      const body = (await request.json()) as Record<string, unknown>
      const kind = served.enters(body)
      if (kind instanceof Response) return kind
      const checked = served.check(member.companyId, body, member.phone)
      if (checked instanceof Response) return checked
      return HttpResponse.json(served.to(enter(member.companyId, member.phone, kind, checked.head, checked.extra)), { status: 201 })
    }),
    http.get(api(`${served.path}/:id`), ({ params, request }) => {
      const member = permitted(request, "finance.view")
      if (member instanceof Response) return member
      const row = documentOf(member.companyId, params.id, served.kinds)
      return row ? HttpResponse.json(served.to(row)) : documentNotFound()
    }),
    http.put(api(`${served.path}/:id`), async ({ params, request }) => {
      const member = permitted(request, "finance.edit")
      if (member instanceof Response) return member
      const row = documentOf(member.companyId, params.id, served.kinds)
      if (!row) return documentNotFound()
      const body = (await request.json()) as Record<string, unknown>
      const checked = served.check(member.companyId, body, member.phone, row)
      if (checked instanceof Response) return checked
      return HttpResponse.json(served.to(save(row, checked.head, checked.extra)))
    }),
    http.delete(api(`${served.path}/:id`), ({ params, request }) => {
      const member = permitted(request, "finance.delete")
      if (member instanceof Response) return member
      const row = documentOf(member.companyId, params.id, served.kinds)
      if (!row) return documentNotFound()
      row.deleted = true
      return new HttpResponse(null, { status: 204 })
    }),
  ]
}

export const cashHandlers = [
  http.get(api("/app/accounts"), ({ request }) => {
    const member = permittedSession(request, "finance.view")
    if (member instanceof Response) return member
    // The active first, then in the order added (the array's; the Go API's ids).
    const list: AccountBalance[] = [...(db.accounts[member.companyId] ?? [])]
      .sort((a, b) => Number(b.is_active) - Number(a.is_active))
      .map((a) => ({ ...a, balance: asAmount(accountBalanceOf(a.id)) }))
    return HttpResponse.json(list)
  }),
  http.get(api("/app/accounts/:id/statement"), ({ params, request }) => {
    const member = permittedSession(request, "finance.view")
    if (member instanceof Response) return member
    const n = page(new URL(request.url).searchParams)
    if (n instanceof Response) return n
    const account = accountOf(member.companyId, Number(params.id))
    if (!account) return accountNotFound()
    return HttpResponse.json(paged(accountStatementOf(member.companyId, account.id), n))
  }),
  ...handlersOf(cashOpening),
  ...handlersOf(expense),
  ...handlersOf(moneyTransfer, ["money_transfer", "conversion"]),
  ...handlersOf(conversion),
]
