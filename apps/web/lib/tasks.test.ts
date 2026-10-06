import { expect, test } from "vitest"
import type { Customer, CustomerType, Task, TaskType } from "./types"
import { deadlineOf, taskDefaults, taskSchema, todayISO } from "./tasks"

test("todayISO is the day where the browser stands, as YYYY-MM-DD", () => {
  const now = new Date()
  const expected = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`
  expect(todayISO()).toBe(expected)
})

test("a deadline reads as a date with how far off it is; a done task's has no distance and is never late", () => {
  const today = "2026-10-06"
  expect(deadlineOf("2026-10-06", false, today)).toEqual({ date: "06.10.2026", relative: "Bugun", overdue: false })
  expect(deadlineOf("2026-10-07", false, today)).toEqual({ date: "07.10.2026", relative: "1 kun qoldi", overdue: false })
  expect(deadlineOf("2026-10-18", false, today)).toEqual({ date: "18.10.2026", relative: "12 kun qoldi", overdue: false })
  expect(deadlineOf("2026-11-05", false, today)).toEqual({ date: "05.11.2026", relative: "30 kun qoldi", overdue: false })
  expect(deadlineOf("2026-10-05", false, today)).toEqual({ date: "05.10.2026", relative: "1 kun kechikdi", overdue: true })
  expect(deadlineOf("2026-09-26", false, today)).toEqual({ date: "26.09.2026", relative: "10 kun kechikdi", overdue: true })
  // In a done stage the day is all that is said.
  expect(deadlineOf("2026-09-26", true, today)).toEqual({ date: "26.09.2026", relative: null, overdue: false })
  expect(deadlineOf("2026-10-06", true, today)).toEqual({ date: "06.10.2026", relative: null, overdue: false })
})

// Olma Savdo's type Buyurtma, with a required text, a number and a choice,
// and the customer type Jismoniy with a required name.
const buyurtma: TaskType = {
  id: 7,
  name: "Buyurtma",
  fields: [
    { id: 71, label: "Izoh", kind: "string", required: true, dropdown_id: null },
    { id: 72, label: "Summa", kind: "int", required: false, dropdown_id: null },
    { id: 73, label: "Kanal", kind: "checkbox", required: false, dropdown_id: 3 },
  ],
}
const jismoniy: CustomerType = {
  id: 5,
  name: "Jismoniy",
  fields: [
    { id: 51, label: "F.I.Sh.", kind: "string", required: true, is_unique: false, dropdown_id: null },
    { id: 52, label: "Yoshi", kind: "int", required: false, is_unique: false, dropdown_id: null },
  ],
}

// filled is a form filled in whole, for a new customer.
const filled = {
  title: " Qo'ng'iroq qilish ",
  deadline: "2026-10-10",
  stage_id: "12",
  assignee_phone: "998902223344",
  values: { f71: " Ertalab ", f72: "45000", f73: ["31", "32"] },
  customer: { type_id: "5", phone: "90 111 22 33", values: { f51: " Zarina Karimova ", f52: "" } },
}

// issuesOf is what the schema refuses, by path.
function issuesOf(schema: ReturnType<typeof taskSchema>, form: unknown): Record<string, string> {
  const result = schema.safeParse(form)
  if (result.success) return {}
  return Object.fromEntries(result.error.issues.map((issue) => [issue.path.join("."), issue.message]))
}

test("the schema turns a form with a new customer into what the API takes", () => {
  const schema = taskSchema(buyurtma, jismoniy, null)

  expect(schema.parse(filled)).toEqual({
    title: "Qo'ng'iroq qilish",
    deadline: "2026-10-10",
    stage_id: 12,
    assignee_phone: "998902223344",
    values: { 71: "Ertalab", 72: 45000, 73: [31, 32] },
    customer: { type_id: 5, phone: "998901112233", values: { 51: "Zarina Karimova" } },
  })
  // Nobody assigned is null, and an answer left empty is left out.
  expect(schema.parse({ ...filled, assignee_phone: "", values: { f71: "X", f72: "", f73: [] } })).toMatchObject({
    assignee_phone: null,
    values: { 71: "X" },
  })
})

test("a customer that is there is sent by its id, and its fields are not checked", () => {
  const schema = taskSchema(buyurtma, jismoniy, 42)

  expect(schema.parse({ ...filled, customer: { type_id: "5", phone: "", values: { f51: "" } } })).toMatchObject({
    customer: { id: 42 },
  })
})

test("what is wrong with the form is said in the API's words, all at once", () => {
  const schema = taskSchema(buyurtma, jismoniy, null)

  expect(
    issuesOf(schema, {
      title: "  ",
      deadline: "",
      stage_id: "",
      assignee_phone: "",
      values: { f71: "", f72: "ko'p", f73: [] },
      customer: { type_id: "5", phone: "90 111", values: { f51: "", f52: "1.5" } },
    }),
  ).toEqual({
    title: "Vazifa nomini kiriting",
    deadline: "Muddatni kiriting",
    stage_id: "Bosqichni tanlang",
    "values.f71": "«Izoh» maydonini to'ldiring",
    "values.f72": "«Summa» butun son bo'lishi kerak",
    "customer.phone": "Telefon raqamini to'liq kiriting",
    "customer.values.f51": "«F.I.Sh.» maydonini to'ldiring",
    "customer.values.f52": "«Yoshi» butun son bo'lishi kerak",
  })
  expect(issuesOf(schema, { ...filled, title: "ў".repeat(201) })).toEqual({ title: "Vazifa nomi 200 belgidan oshmasin" })
  expect(issuesOf(schema, { ...filled, title: "ў".repeat(200) })).toEqual({})
})

test("with no customer type to enter a customer under, only a customer that is there will do", () => {
  expect(issuesOf(taskSchema(buyurtma, null, null), filled)).toEqual({ "customer.phone": "Mijozni tanlang" })
  expect(taskSchema(buyurtma, null, 42).parse(filled)).toMatchObject({ customer: { id: 42 } })
})

test("the form opens empty for a new task, in the stage it was opened for, and filled for one being edited", () => {
  expect(taskDefaults(buyurtma, jismoniy, 12)).toEqual({
    title: "",
    deadline: "",
    stage_id: "12",
    assignee_phone: "",
    values: { f71: "", f72: "", f73: [] },
    customer: { type_id: "5", phone: "", values: { f51: "", f52: "" } },
  })
  expect(taskDefaults(buyurtma, null, null).customer).toEqual({ type_id: "", phone: "", values: {} })

  const task: Task = {
    id: 1,
    type_id: 7,
    stage_id: 13,
    title: "Qo'ng'iroq qilish",
    deadline: "2026-10-10",
    customer: { id: 42, phone: "998901112233", name: "Zarina Karimova" },
    assignee: { phone: "998902223344", full_name: "Vali Aliyev" },
    values: { 71: "Ertalab", 73: [32] },
    created_by_name: null,
    created_at: "2026-10-02T06:01:00.000Z",
    updated_at: "2026-10-02T06:01:00.000Z",
  }
  expect(taskDefaults(buyurtma, jismoniy, 12, task)).toEqual({
    title: "Qo'ng'iroq qilish",
    deadline: "2026-10-10",
    stage_id: "13",
    assignee_phone: "998902223344",
    values: { f71: "Ertalab", f72: "", f73: ["32"] },
    customer: { type_id: "5", phone: "", values: { f51: "", f52: "" } },
  })
  const unassigned: Customer = { id: 42, type_id: 5, phone: "998901112233", values: {}, created_by_name: null, created_at: "", updated_at: "" }
  expect(unassigned.id).toBe(42)
  expect(taskDefaults(buyurtma, jismoniy, 12, { ...task, assignee: null }).assignee_phone).toBe("")
})
