// The task settings of the mock API: the stages (the columns of the board)
// and the task types with their fields, under the Go API's rules
// (logic/tasks.md; backend/internal/task).
import { http, HttpResponse } from "msw"
import type { CustomerFieldKind, StageColor } from "@/lib/types"
import {
  db,
  nextId,
  type StageRow,
  stagesOf,
  type TaskFieldRow,
  type TaskTypeRow,
  taskTypesOf,
  toStage,
  toTaskField,
  toTaskType,
} from "./data"
import { api, fail, memberSession, ownerSession } from "./gate"

// cleanName is the API's rule for a name: trimmed, not empty, sixty
// characters at most.
function cleanName(raw: unknown): string | Response {
  const name = typeof raw === "string" ? raw.trim() : ""
  if (!name) return fail(400, "validation_error", "Nomni kiriting")
  if ([...name].length > 60) return fail(400, "validation_error", "Nom 60 belgidan oshmasin")
  return name
}

// same tells two names apart as the API does: whatever the case.
const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase()

const invalid = (message: string) => fail(400, "validation_error", message)
const orderChanged = () => fail(409, "order_changed", "Ro'yxat o'zgargan. Sahifani yangilang")

// sameIds tells whether ids names each of live once and nothing else.
function sameIds(ids: unknown, live: number[]): ids is number[] {
  if (!Array.isArray(ids) || ids.length !== live.length) return false
  return new Set(ids).size === live.length && ids.every((id) => live.includes(id))
}

// inOrder puts rows in the order of ids, with the deleted ones after them.
function inOrder<T extends { id: number; deleted?: boolean }>(rows: T[], ids: number[]): T[] {
  return [...ids.map((id) => rows.find((row) => row.id === id)!), ...rows.filter((row) => row.deleted)]
}

// The colors a stage may be shown in.
const colors: StageColor[] = ["slate", "red", "orange", "amber", "green", "teal", "blue", "violet", "pink"]
const isColor = (raw: unknown): raw is StageColor => typeof raw === "string" && (colors as string[]).includes(raw)

const stageNotFound = () => fail(404, "not_found", "Bosqich topilmadi")
const stageTaken = () => fail(409, "name_taken", "Bu nomli bosqich allaqachon bor")

function liveStage(companyId: number, id: number): StageRow | undefined {
  return db.stages.find((s) => s.id === id && s.companyId === companyId && !s.deleted)
}

const typeNotFound = () => fail(404, "not_found", "Tur topilmadi")
const typeTaken = () => fail(409, "name_taken", "Bu nomli tur allaqachon bor")

function liveType(companyId: number, id: number): TaskTypeRow | undefined {
  return db.taskTypes.find((t) => t.id === id && t.companyId === companyId && !t.deleted)
}

const fieldNotFound = () => fail(404, "not_found", "Maydon topilmadi")
const fieldTaken = () => fail(409, "name_taken", "Bu nomli maydon allaqachon bor")

const kinds: Record<CustomerFieldKind, { choice: boolean }> = {
  string: { choice: false },
  int: { choice: false },
  dropdown: { choice: true },
  multi_dropdown: { choice: true },
  radio: { choice: true },
  checkbox: { choice: true },
}

const liveDropdown = (companyId: number, id: number) =>
  db.dropdowns.find((d) => d.id === id && d.companyId === companyId && !d.deleted)

// What the tasks use is not deleted; the deleted tasks use nothing.
const liveTasks = () => db.tasks.filter((t) => !t.deleted)

export const taskSettingsHandlers = [
  http.get(api("/app/task-stages"), ({ request }) => {
    const member = memberSession(request)
    if (member instanceof Response) return member
    return HttpResponse.json(stagesOf(member.companyId))
  }),

  http.post(api("/app/task-stages"), async ({ request }) => {
    const owner = ownerSession(request)
    if (owner instanceof Response) return owner
    const body = (await request.json()) as { name?: unknown; color?: unknown; is_done?: boolean }
    const name = cleanName(body.name)
    if (name instanceof Response) return name
    if (!isColor(body.color)) return invalid("Rangni tanlang")
    if (stagesOf(owner.companyId).some((s) => same(s.name, name))) return stageTaken()
    const stage: StageRow = { id: nextId(), companyId: owner.companyId, name, color: body.color, done: body.is_done ?? false }
    db.stages.push(stage)
    return HttpResponse.json(toStage(stage), { status: 201 })
  }),

  http.put(api("/app/task-stages/order"), async ({ request }) => {
    const owner = ownerSession(request)
    if (owner instanceof Response) return owner
    const { ids } = (await request.json()) as { ids?: unknown }
    const live = stagesOf(owner.companyId).map((s) => s.id)
    if (!sameIds(ids, live)) return orderChanged()
    const others = db.stages.filter((s) => !ids.includes(s.id))
    db.stages = [...ids.map((id) => db.stages.find((s) => s.id === id)!), ...others]
    return new HttpResponse(null, { status: 204 })
  }),

  http.patch(api("/app/task-stages/:id"), async ({ params, request }) => {
    const owner = ownerSession(request)
    if (owner instanceof Response) return owner
    const body = (await request.json()) as { name?: unknown; color?: unknown; is_done?: boolean }
    const name = body.name === undefined ? undefined : cleanName(body.name)
    if (name instanceof Response) return name
    if (body.color !== undefined && !isColor(body.color)) return invalid("Rangni tanlang")
    const stage = liveStage(owner.companyId, Number(params.id))
    if (!stage) return stageNotFound()
    if (name !== undefined) {
      if (stagesOf(owner.companyId).some((s) => s.id !== stage.id && same(s.name, name))) return stageTaken()
      stage.name = name
    }
    if (isColor(body.color)) stage.color = body.color
    if (body.is_done !== undefined) stage.done = body.is_done
    return HttpResponse.json(toStage(stage))
  }),

  http.delete(api("/app/task-stages/:id"), ({ params, request }) => {
    const owner = ownerSession(request)
    if (owner instanceof Response) return owner
    const stage = liveStage(owner.companyId, Number(params.id))
    if (!stage) return stageNotFound()
    const used = liveTasks().filter((t) => t.stageId === stage.id).length
    if (used > 0) return fail(409, "stage_in_use", `Bu bosqichda ${used} ta vazifa bor`)
    stage.deleted = true
    return new HttpResponse(null, { status: 204 })
  }),

  http.get(api("/app/task-types"), ({ request }) => {
    const member = memberSession(request)
    if (member instanceof Response) return member
    return HttpResponse.json(taskTypesOf(member.companyId))
  }),

  http.post(api("/app/task-types"), async ({ request }) => {
    const owner = ownerSession(request)
    if (owner instanceof Response) return owner
    const name = cleanName(((await request.json()) as { name?: unknown }).name)
    if (name instanceof Response) return name
    if (taskTypesOf(owner.companyId).some((t) => same(t.name, name))) return typeTaken()
    const type: TaskTypeRow = { id: nextId(), companyId: owner.companyId, name, fields: [] }
    db.taskTypes.push(type)
    return HttpResponse.json(toTaskType(type), { status: 201 })
  }),

  http.put(api("/app/task-types/order"), async ({ request }) => {
    const owner = ownerSession(request)
    if (owner instanceof Response) return owner
    const { ids } = (await request.json()) as { ids?: unknown }
    const live = taskTypesOf(owner.companyId).map((t) => t.id)
    if (!sameIds(ids, live)) return orderChanged()
    const others = db.taskTypes.filter((t) => !ids.includes(t.id))
    db.taskTypes = [...ids.map((id) => db.taskTypes.find((t) => t.id === id)!), ...others]
    return new HttpResponse(null, { status: 204 })
  }),

  http.patch(api("/app/task-types/:id"), async ({ params, request }) => {
    const owner = ownerSession(request)
    if (owner instanceof Response) return owner
    const name = cleanName(((await request.json()) as { name?: unknown }).name)
    if (name instanceof Response) return name
    const type = liveType(owner.companyId, Number(params.id))
    if (!type) return typeNotFound()
    if (taskTypesOf(owner.companyId).some((t) => t.id !== type.id && same(t.name, name))) return typeTaken()
    type.name = name
    return HttpResponse.json(toTaskType(type))
  }),

  http.delete(api("/app/task-types/:id"), ({ params, request }) => {
    const owner = ownerSession(request)
    if (owner instanceof Response) return owner
    const type = liveType(owner.companyId, Number(params.id))
    if (!type) return typeNotFound()
    const used = liveTasks().filter((t) => t.typeId === type.id).length
    if (used > 0) return fail(409, "type_in_use", `Bu turda ${used} ta vazifa bor`)
    // Its fields go with it.
    type.deleted = true
    type.fields.forEach((f) => (f.deleted = true))
    return new HttpResponse(null, { status: 204 })
  }),

  http.post(api("/app/task-types/:id/fields"), async ({ params, request }) => {
    const owner = ownerSession(request)
    if (owner instanceof Response) return owner
    const body = (await request.json()) as { label?: unknown; kind?: string; required?: boolean; dropdown_id?: number | null }
    const label = cleanName(body.label)
    if (label instanceof Response) return label
    const kind = kinds[body.kind as CustomerFieldKind]
    const dropdownId = body.dropdown_id ?? null
    if (!kind) return invalid("Maydon turini tanlang")
    if (kind.choice && dropdownId === null) return invalid("Dropdownni tanlang")
    if (!kind.choice && dropdownId !== null) return invalid("Matn va son maydoniga dropdown ulanmaydi")
    if (dropdownId !== null && !liveDropdown(owner.companyId, dropdownId)) return invalid("Dropdownni tanlang")
    const type = liveType(owner.companyId, Number(params.id))
    if (!type) return typeNotFound()
    if (type.fields.some((f) => !f.deleted && same(f.label, label))) return fieldTaken()
    const field: TaskFieldRow = { id: nextId(), label, kind: body.kind as CustomerFieldKind, required: body.required ?? false, dropdownId }
    type.fields.push(field)
    return HttpResponse.json(toTaskField(field), { status: 201 })
  }),

  http.put(api("/app/task-types/:id/fields/order"), async ({ params, request }) => {
    const owner = ownerSession(request)
    if (owner instanceof Response) return owner
    const { ids } = (await request.json()) as { ids?: unknown }
    const type = liveType(owner.companyId, Number(params.id))
    if (!type) return typeNotFound()
    const live = type.fields.filter((f) => !f.deleted).map((f) => f.id)
    if (!sameIds(ids, live)) return orderChanged()
    type.fields = inOrder(type.fields, ids)
    return new HttpResponse(null, { status: 204 })
  }),

  http.patch(api("/app/task-types/:id/fields/:fieldId"), async ({ params, request }) => {
    const owner = ownerSession(request)
    if (owner instanceof Response) return owner
    const body = (await request.json()) as { label?: unknown; required?: boolean }
    const label = body.label === undefined ? undefined : cleanName(body.label)
    if (label instanceof Response) return label
    const type = liveType(owner.companyId, Number(params.id))
    const field = type?.fields.find((f) => f.id === Number(params.fieldId) && !f.deleted)
    if (!type || !field) return fieldNotFound()
    if (label !== undefined) {
      if (type.fields.some((f) => f !== field && !f.deleted && same(f.label, label))) return fieldTaken()
      field.label = label
    }
    if (body.required !== undefined) field.required = body.required
    return HttpResponse.json(toTaskField(field))
  }),

  http.delete(api("/app/task-types/:id/fields/:fieldId"), ({ params, request }) => {
    const owner = ownerSession(request)
    if (owner instanceof Response) return owner
    const field = liveType(owner.companyId, Number(params.id))?.fields.find((f) => f.id === Number(params.fieldId) && !f.deleted)
    if (!field) return fieldNotFound()
    const used = liveTasks().filter((t) => t.values[field.id] !== undefined).length
    if (used > 0) return fail(409, "field_in_use", `Bu maydon ${used} ta vazifada to'ldirilgan`)
    field.deleted = true
    return new HttpResponse(null, { status: 204 })
  }),
]
