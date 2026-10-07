// The tasks of the mock API, under the Go API's rules (logic/tasks.md;
// backend/internal/task).
import { http, HttpResponse } from "msw"
import { formatDate } from "@/lib/format"
import type { Task } from "@/lib/types"
import { asText, checkValues, diffValues, enterCustomer, liveCustomers, nameOf } from "./customers"
import {
  type Answer,
  customerNameOf,
  db,
  liveLocations,
  nameIn,
  nextId,
  now,
  type StageRow,
  type TaskHistoryRow,
  type TaskRow,
  type TaskTypeRow,
  permissionsOf,
} from "./data"
import { api, fail, forbidden, isMember, normalizePhone, permittedSession } from "./gate"

const invalid = (message: string) => fail(400, "validation_error", message)
const taskNotFound = () => fail(404, "not_found", "Vazifa topilmadi")

// liveTasks is a company's tasks, without the deleted.
export const liveTasks = (companyId: number) => db.tasks.filter((t) => t.companyId === companyId && !t.deleted)

const liveStage = (companyId: number, id: unknown): StageRow | undefined =>
  db.stages.find((s) => s.id === id && s.companyId === companyId && !s.deleted)
const liveTaskType = (companyId: number, id: unknown): TaskTypeRow | undefined =>
  db.taskTypes.find((t) => t.id === id && t.companyId === companyId && !t.deleted)
const liveFields = (type: TaskTypeRow) => type.fields.filter((f) => !f.deleted)

const PAGE_SIZE = 20

// toTask is a task as the API answers it: with its customer by its name and
// phone, and its assignee by the name they go by now (the name of then,
// once they have left the company).
export const toTask = (t: TaskRow): Task => {
  const customer = db.customers.find((c) => c.id === t.customerId)!
  return {
    id: t.id,
    type_id: t.typeId,
    stage_id: t.stageId,
    location_id: t.locationId,
    title: t.title,
    deadline: t.deadline,
    customer: { id: customer.id, phone: customer.phone, name: customerNameOf(customer) },
    assignee: t.assignee === null ? null : { phone: t.assignee, full_name: nameOf(t.assignee, t.companyId, t.assigneeName) },
    values: { ...t.values },
    created_by_name: nameOf(t.by, t.companyId, t.byName),
    created_at: t.createdAt,
    updated_at: t.updatedAt,
  }
}

// taskTitle is the API's rule for a title: trimmed, not empty, two hundred
// characters at most.
function taskTitle(raw: unknown): string | Response {
  const title = typeof raw === "string" ? raw.trim() : ""
  if (!title) return invalid("Vazifa nomini kiriting")
  if ([...title].length > 200) return invalid("Vazifa nomi 200 belgidan oshmasin")
  return title
}

// taskDeadline is a deadline as the API takes it: a day written YYYY-MM-DD,
// one that exists; a day that is past is taken too.
function taskDeadline(raw: unknown): string | Response {
  const day = typeof raw === "string" ? raw : ""
  if (day.trim() === "") return invalid("Muddatni kiriting")
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return invalid("Muddat noto'g'ri")
  const date = new Date(`${day}T00:00:00Z`)
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== day) return invalid("Muddat noto'g'ri")
  return day
}

// An assignee as a task keeps them: nobody, or a member's phone and the
// name they go by.
type Assignee = { phone: string | null; name: string | null }

// assigneeOf reads the phone a client sent as the assignee: nothing for
// nobody, otherwise a member of the company.
function assigneeOf(companyId: number, raw: unknown): Assignee | Response {
  if (raw === undefined || raw === null || (typeof raw === "string" && raw.trim() === "")) return { phone: null, name: null }
  const phone = typeof raw === "string" ? normalizePhone(raw) : null
  if (!phone || !isMember(phone, companyId)) return invalid("Mas'ul kompaniya a'zosi emas")
  return { phone, name: nameIn(phone, companyId) }
}

// sameAssignee tells whether the phone a client sent names the member the
// task is assigned to already (or nobody, when it is assigned to nobody).
function sameAssignee(raw: unknown, task: TaskRow): boolean {
  if (raw === undefined || raw === null || (typeof raw === "string" && raw.trim() === "")) return task.assignee === null
  return typeof raw === "string" && task.assignee !== null && normalizePhone(raw) === task.assignee
}

// customerOf is a new task's customer: the one named, which has to be the
// company's own and not deleted, or a new one entered with the task under
// the customers' rules. Nothing named is refused.
function customerOf(member: { phone: string; companyId: number }, raw: unknown): number | Response {
  const sent = (raw ?? {}) as { id?: unknown; type_id?: unknown; phone?: unknown; values?: unknown }
  if (sent.id !== undefined && sent.id !== null) {
    const customer = liveCustomers(member.companyId).find((c) => c.id === sent.id)
    return customer ? customer.id : invalid("Mijozni tanlang")
  }
  if (sent.type_id === undefined && sent.phone === undefined && sent.values === undefined) return invalid("Mijozni tanlang")
  const entered = enterCustomer(member, sent)
  return entered instanceof Response ? entered : entered.id
}

// stageName is the name of the stage a task stands in, "" once the stage
// is gone.
const stageName = (id: number) => db.stages.find((s) => s.id === id)?.name ?? ""

// record writes down what a member did to a task.
function record(task: TaskRow, action: TaskHistoryRow["action"], by: string, at: string, changes: TaskHistoryRow["changes"]) {
  db.taskHistory.push({ id: nextId(), taskId: task.id, action, by, byName: nameIn(by, task.companyId), createdAt: at, changes })
}

// found tells whether a search finds the task: the text in its title, its
// text answers and its customer's text answers, whatever the case; the
// digits of a search written as a number or a phone is in the customer's
// phone and in the task's and the customer's whole number answers too. The
// names of the options are not searched.
function found(task: TaskRow, search: string): boolean {
  const text = search.trim().toLowerCase()
  if (!text) return true
  const digits = /^[\d\s+\-()]+$/.test(text) ? text.replace(/\D/g, "") : ""
  const customer = db.customers.find((c) => c.id === task.customerId)!
  const customerFields = db.types.find((t) => t.id === customer.typeId)?.fields ?? []
  const taskFields = db.taskTypes.find((t) => t.id === task.typeId)?.fields ?? []
  const inTexts = (fields: { id: number; kind: string }[], values: Record<number, Answer>) =>
    fields.some((f) => {
      const answer = values[f.id]
      return f.kind === "string" && typeof answer === "string" && answer.toLowerCase().includes(text)
    })
  const inNumbers = (fields: { id: number; kind: string }[], values: Record<number, Answer>) =>
    fields.some((f) => {
      const answer = values[f.id]
      return f.kind === "int" && typeof answer === "number" && String(answer).includes(digits)
    })
  return (
    task.title.toLowerCase().includes(text) ||
    inTexts(taskFields, task.values) ||
    inTexts(customerFields, customer.values) ||
    (digits !== "" && (customer.phone.includes(digits) || inNumbers(taskFields, task.values) || inNumbers(customerFields, customer.values)))
  )
}

export const tasksHandlers = [
  http.get(api("/app/tasks"), ({ request }) => {
    const member = permittedSession(request, "tasks.view")
    if (member instanceof Response) return member
    const query = new URL(request.url).searchParams
    const page = query.has("page") ? Number(query.get("page")) : 1
    if (!Number.isInteger(page) || page < 1) return invalid("Sahifa raqami noto'g'ri")
    // one is a filter by id: none, the id, or what is wrong with it.
    const one = (name: string, message: string): number | null | Response => {
      if (!query.has(name)) return null
      const id = Number(query.get(name))
      return Number.isInteger(id) && id >= 1 ? id : invalid(message)
    }
    const typeId = one("type_id", "Vazifa turi noto'g'ri")
    if (typeId instanceof Response) return typeId
    const stageId = one("stage_id", "Bosqich noto'g'ri")
    if (stageId instanceof Response) return stageId
    const customerId = one("customer_id", "Mijoz noto'g'ri")
    if (customerId instanceof Response) return customerId
    let assignee: string | null = null
    if (query.get("assignee")) {
      assignee = normalizePhone(query.get("assignee")!)
      if (!assignee) return invalid("Mas'ul noto'g'ri")
    }
    const all = liveTasks(member.companyId)
      .filter(
        (t) =>
          (typeId === null || t.typeId === typeId) &&
          (stageId === null || t.stageId === stageId) &&
          (customerId === null || t.customerId === customerId) &&
          (assignee === null || t.assignee === assignee) &&
          found(t, query.get("search") ?? ""),
      )
      // The one due soonest first, the older before the newer of one day.
      .sort((a, b) => a.deadline.localeCompare(b.deadline) || a.id - b.id)
    return HttpResponse.json({
      items: all.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE).map(toTask),
      total: all.length,
      page,
      page_size: PAGE_SIZE,
    })
  }),

  http.post(api("/app/tasks"), async ({ request }) => {
    const member = permittedSession(request, "tasks.create")
    if (member instanceof Response) return member
    const body = (await request.json()) as {
      type_id?: unknown
      location_id?: unknown
      title?: unknown
      deadline?: unknown
      stage_id?: unknown
      assignee_phone?: unknown
      values?: unknown
      customer?: unknown
    }
    // What is wrong is said in this order: the title, the deadline, the
    // location, the type, the stage, the assignee, the answers, the customer.
    const title = taskTitle(body.title)
    if (title instanceof Response) return title
    const deadline = taskDeadline(body.deadline)
    if (deadline instanceof Response) return deadline
    // The task stands in the location named; until the app names one, in
    // the company's ready location.
    const location =
      body.location_id === undefined ? liveLocations(member.companyId)[0] : liveLocations(member.companyId).find((l) => l.id === body.location_id)
    if (!location) return invalid("Lokatsiyani tanlang")
    const type = liveTaskType(member.companyId, body.type_id)
    if (!type) return invalid("Vazifa turini tanlang")
    const stage = liveStage(member.companyId, body.stage_id)
    if (!stage) return invalid("Bosqichni tanlang")
    const assignee = assigneeOf(member.companyId, body.assignee_phone)
    if (assignee instanceof Response) return assignee
    const values = checkValues(liveFields(type), {}, body.values)
    if (values instanceof Response) return values
    // A customer entered with the task is a customer entered: that takes
    // its own permission (logic/roles.md, section 4.3).
    const wanted = body.customer as { id?: unknown } | null | undefined
    if (wanted && typeof wanted === "object" && wanted.id === undefined && !permissionsOf(member.phone, member.companyId).includes("customers.create")) {
      return forbidden()
    }
    // A new customer is entered last: nothing after it can refuse the task.
    const customerId = customerOf(member, body.customer)
    if (customerId instanceof Response) return customerId
    const at = now()
    const task: TaskRow = {
      id: nextId(),
      companyId: member.companyId,
      typeId: type.id,
      stageId: stage.id,
      locationId: location.id,
      customerId,
      title,
      deadline,
      assignee: assignee.phone,
      assigneeName: assignee.name,
      values,
      by: member.phone,
      byName: nameIn(member.phone, member.companyId),
      createdAt: at,
      updatedAt: at,
    }
    db.tasks.push(task)
    record(task, "created", member.phone, at, [])
    return HttpResponse.json(toTask(task), { status: 201 })
  }),

  http.get(api("/app/tasks/:id"), ({ params, request }) => {
    const member = permittedSession(request, "tasks.view")
    if (member instanceof Response) return member
    const task = liveTasks(member.companyId).find((t) => t.id === Number(params.id))
    return task ? HttpResponse.json(toTask(task)) : taskNotFound()
  }),

  http.put(api("/app/tasks/:id"), async ({ params, request }) => {
    const member = permittedSession(request, "tasks.edit")
    if (member instanceof Response) return member
    const body = (await request.json()) as { title?: unknown; deadline?: unknown; stage_id?: unknown; assignee_phone?: unknown; values?: unknown }
    // A task that is not there is said first, whatever is sent.
    const task = liveTasks(member.companyId).find((t) => t.id === Number(params.id))
    if (!task) return taskNotFound()
    const title = taskTitle(body.title)
    if (title instanceof Response) return title
    const deadline = taskDeadline(body.deadline)
    if (deadline instanceof Response) return deadline
    const stage = liveStage(member.companyId, body.stage_id)
    if (!stage) return invalid("Bosqichni tanlang")
    // The assignee the task has stays as they are, a member no more too;
    // another one has to be a member.
    const assignee = sameAssignee(body.assignee_phone, task)
      ? { phone: task.assignee, name: task.assignee === null ? null : nameOf(task.assignee, task.companyId, task.assigneeName) }
      : assigneeOf(member.companyId, body.assignee_phone)
    if (assignee instanceof Response) return assignee
    const fields = liveFields(db.taskTypes.find((t) => t.id === task.typeId)!)
    const values = checkValues(fields, task.values, body.values)
    if (values instanceof Response) return values
    const changes: TaskHistoryRow["changes"] = []
    if (task.title !== title) changes.push({ label: "Nomi", old: task.title, new: title })
    if (task.deadline !== deadline) changes.push({ label: "Muddat", old: formatDate(task.deadline), new: formatDate(deadline) })
    if (task.stageId !== stage.id) changes.push({ label: "Bosqich", old: stageName(task.stageId), new: stage.name })
    const wasAssignee = task.assignee === null ? "" : (nameOf(task.assignee, task.companyId, task.assigneeName) ?? "")
    if (wasAssignee !== (assignee.name ?? "")) changes.push({ label: "Mas'ul", old: wasAssignee, new: assignee.name ?? "" })
    changes.push(...diffValues(fields, task.values, values))
    // A save that changes nothing writes nothing.
    if (changes.length > 0) {
      const at = now()
      task.title = title
      task.deadline = deadline
      task.stageId = stage.id
      task.assignee = assignee.phone
      task.assigneeName = assignee.name
      task.values = values
      task.updatedAt = at
      record(task, "updated", member.phone, at, changes)
    }
    return HttpResponse.json(toTask(task))
  }),

  http.patch(api("/app/tasks/:id/stage"), async ({ params, request }) => {
    const member = permittedSession(request, "tasks.edit")
    if (member instanceof Response) return member
    const { stage_id: stageId } = (await request.json()) as { stage_id?: unknown }
    const task = liveTasks(member.companyId).find((t) => t.id === Number(params.id))
    if (!task) return taskNotFound()
    // The same stage changes nothing.
    if (task.stageId === stageId) return HttpResponse.json(toTask(task))
    const stage = liveStage(member.companyId, stageId)
    if (!stage) return invalid("Bosqichni tanlang")
    const at = now()
    const changes = [{ label: "Bosqich", old: stageName(task.stageId), new: stage.name }]
    task.stageId = stage.id
    task.updatedAt = at
    record(task, "updated", member.phone, at, changes)
    return HttpResponse.json(toTask(task))
  }),

  http.delete(api("/app/tasks/:id"), ({ params, request }) => {
    const member = permittedSession(request, "tasks.delete")
    if (member instanceof Response) return member
    const task = liveTasks(member.companyId).find((t) => t.id === Number(params.id))
    if (!task) return taskNotFound()
    // Hidden, not removed: its answers and its history stay.
    task.deleted = true
    record(task, "deleted", member.phone, now(), [])
    return new HttpResponse(null, { status: 204 })
  }),

  http.get(api("/app/tasks/:id/history"), ({ params, request }) => {
    const member = permittedSession(request, "tasks.history")
    if (member instanceof Response) return member
    const task = liveTasks(member.companyId).find((t) => t.id === Number(params.id))
    if (!task) return taskNotFound()
    return HttpResponse.json(
      db.taskHistory
        .filter((entry) => entry.taskId === task.id)
        // The latest first.
        .sort((a, b) => b.id - a.id)
        .map((entry) => ({
          id: entry.id,
          action: entry.action,
          actor_name: nameOf(entry.by, task.companyId, entry.byName),
          created_at: entry.createdAt,
          changes: entry.changes,
        })),
    )
  }),
]

// taskAnswerText writes a task's answer for people to read, as the history
// keeps it: the mock pages' tests compare against it.
export const taskAnswerText = asText
