import { z } from "zod"
import { answersDefaults, type Entries, readAnswers } from "./fields"
import { formatDate } from "./format"
import { phoneDigits } from "./phone"
import type { CustomerAnswers, CustomerType, Task, TaskType } from "./types"

const pad = (n: number) => String(n).padStart(2, "0")

// todayISO is the day it is where the browser stands, as YYYY-MM-DD: what
// a deadline is measured against.
export function todayISO(): string {
  const date = new Date()
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

const DAY = 24 * 60 * 60 * 1000

// DeadlineInfo is a deadline as people read it: the day (dd.mm.yyyy), how
// far off it is ("Bugun", "3 kun qoldi", "2 kun kechikdi"; null in a done
// stage, where the day is all that is said) and whether the task is late
// (past its day and not done).
export interface DeadlineInfo {
  date: string
  relative: string | null
  overdue: boolean
}

// deadlineOf reads a deadline (YYYY-MM-DD) against today, the browser's day.
export function deadlineOf(deadline: string, done: boolean, today = todayISO()): DeadlineInfo {
  const days = Math.round((Date.parse(`${deadline}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / DAY)
  const relative = done ? null : days === 0 ? "Bugun" : days > 0 ? `${days} kun qoldi` : `${-days} kun kechikdi`
  return { date: formatDate(deadline), relative, overdue: !done && days < 0 }
}

// TaskForm is what the task form holds: the task's own fields (the stage
// and the assignee as a select's value, "" for none), an entry for each
// field of the type and, for a new customer, its type, phone and entries.
export type TaskForm = {
  title: string
  deadline: string
  stage_id: string
  assignee_phone: string
  values: Entries
  customer: { type_id: string; phone: string; values: Entries }
}

// TaskOutput is the form as the API takes it: the customer either one that
// is there, by its id, or a new one to enter with the task.
export type TaskOutput = {
  title: string
  deadline: string
  stage_id: number
  assignee_phone: string | null
  values: CustomerAnswers
  customer: { id: number } | { type_id: number; phone: string; values: CustomerAnswers }
}

// How long a title may be, in characters, as the API counts them.
const MAX_TITLE = 200

const entries = z.record(z.string(), z.union([z.string(), z.array(z.string())]))

// taskSchema checks the task form in the API's words, all of it at once,
// and turns it into what the API takes. customerType is the type a new
// customer is entered under (null when the company has none: then only a
// customer that is there will do); linked is the id of the customer that
// is there, whose fields are then not checked.
export function taskSchema(type: TaskType, customerType: CustomerType | null, linked: number | null) {
  return z
    .object({
      title: z.string(),
      deadline: z.string(),
      stage_id: z.string(),
      assignee_phone: z.string(),
      values: entries,
      customer: z.object({ type_id: z.string(), phone: z.string(), values: entries }),
    })
    .transform((form, context): TaskOutput => {
      const refuse = (path: string[], message: string) => context.addIssue({ code: "custom", message, path })
      const title = form.title.trim()
      if (title === "") refuse(["title"], "Vazifa nomini kiriting")
      else if ([...title].length > MAX_TITLE) refuse(["title"], "Vazifa nomi 200 belgidan oshmasin")
      if (form.deadline === "") refuse(["deadline"], "Muddatni kiriting")
      if (form.stage_id === "") refuse(["stage_id"], "Bosqichni tanlang")
      const values = readAnswers(type.fields, form.values, (key, message) => refuse(["values", key], message))

      let customer: TaskOutput["customer"]
      if (linked !== null) {
        customer = { id: linked }
      } else if (customerType === null) {
        refuse(["customer", "phone"], "Mijozni tanlang")
        customer = { id: 0 }
      } else {
        const phone = phoneDigits(form.customer.phone)
        if (phone === null) refuse(["customer", "phone"], "Telefon raqamini to'liq kiriting")
        const answers = readAnswers(customerType.fields, form.customer.values, (key, message) =>
          refuse(["customer", "values", key], message),
        )
        customer = { type_id: customerType.id, phone: phone ?? "", values: answers }
      }
      return {
        title,
        deadline: form.deadline,
        stage_id: Number(form.stage_id),
        assignee_phone: form.assignee_phone || null,
        values,
        customer,
      }
    })
}

// taskDefaults is the form as it opens: empty for a new task, in the stage
// it was opened for (stageId), with the fields of the task being edited.
// The customer part is for a new customer of customerType, always empty.
export function taskDefaults(type: TaskType, customerType: CustomerType | null, stageId: number | null, task?: Task): TaskForm {
  return {
    title: task?.title ?? "",
    deadline: task?.deadline ?? "",
    stage_id: String(task?.stage_id ?? stageId ?? ""),
    assignee_phone: task?.assignee?.phone ?? "",
    values: answersDefaults(type.fields, task?.values),
    customer: {
      type_id: customerType ? String(customerType.id) : "",
      phone: "",
      values: answersDefaults(customerType?.fields ?? []),
    },
  }
}
