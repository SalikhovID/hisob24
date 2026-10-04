import { z } from "zod"
import { isChoice, nameFieldOf } from "./customer-fields"
import { formatPhoneInput, phoneDigits } from "./phone"
import type { Customer, CustomerAnswers, CustomerDropdown, CustomerField, CustomerType } from "./types"

// Answer is a customer's answer to one field: a text, a whole number or the
// id of the one option chosen, or the ids of several.
export type Answer = Customer["values"][string]

// customerName is the name a customer goes by: its answer to its type's
// first text field (logic/customers.md, 3.3). null when it has none: the
// phone then stands for the name.
export function customerName(customer: Pick<Customer, "values">, type: Pick<CustomerType, "fields"> | undefined): string | null {
  const field = type && nameFieldOf(type)
  const answer = field ? customer.values[field.id] : undefined
  return typeof answer === "string" && answer !== "" ? answer : null
}

// answerText writes an answer for people to read: a text and a number as
// they are, the options by their names. "" for a field left empty.
export function answerText(field: CustomerField, answer: Answer | undefined, dropdowns: CustomerDropdown[]): string {
  if (answer === undefined) return ""
  if (!isChoice(field.kind)) return String(answer)
  const options = dropdowns.find((dropdown) => dropdown.id === field.dropdown_id)?.options ?? []
  const chosen = Array.isArray(answer) ? answer : [answer]
  return chosen.flatMap((id) => options.find((option) => option.id === id)?.label ?? []).join(", ")
}

// FieldColumn is a column of the customers list that shows answers. Fields
// of one name share a column, whatever the type: fields holds each type's
// field of that name, by the id of the type.
export interface FieldColumn {
  key: string
  label: string
  fields: Record<number, CustomerField>
}

// fieldColumns are the list's answer columns for the types it shows, in the
// order of the types and of their fields. A name counts whatever its case,
// and is spelled as the first type spells it. The field a type's customers
// go by is not a column: it is the customer's name.
export function fieldColumns(types: CustomerType[]): FieldColumn[] {
  const columns = new Map<string, FieldColumn>()
  for (const type of types) {
    const nameField = nameFieldOf(type)
    for (const field of type.fields) {
      if (field === nameField) continue
      const key = `field:${field.label.toLowerCase()}`
      const column = columns.get(key) ?? { key, label: field.label, fields: {} }
      column.fields[type.id] = field
      columns.set(key, column)
    }
  }
  return [...columns.values()]
}

// CustomerForm is what the customer form holds: the phone field's value and
// an entry for each field of the type. A text, a number and a single choice
// are a string (an option's id, "" for none), a choice of several the ids.
export type CustomerForm = { phone: string; values: Record<string, string | string[]> }

// fieldKey names a field's entry in the form. A bare number would not do:
// react-hook-form reads a numeric key as a place in an array.
export const fieldKey = (field: Pick<CustomerField, "id">) => `f${field.id}`

// isSeveral tells a choice of several options from a choice of one.
const isSeveral = (field: CustomerField) => field.kind === "multi_dropdown" || field.kind === "checkbox"

// formDefaults is the form as it opens: empty for a new customer, with the
// phone and the answers of one being edited.
export function formDefaults(type: CustomerType, customer?: Customer): CustomerForm {
  const values: CustomerForm["values"] = {}
  for (const field of type.fields) {
    const answer = customer?.values[field.id]
    if (isSeveral(field)) values[fieldKey(field)] = Array.isArray(answer) ? answer.map(String) : []
    else values[fieldKey(field)] = answer === undefined || Array.isArray(answer) ? "" : String(answer)
  }
  return { phone: customer ? formatPhoneInput(customer.phone) : "", values }
}

// How long a text answer may be, in characters, as the API counts them.
const MAX_TEXT = 500

// readAnswer reads a field's entry of the form: the answer as the API takes
// it, undefined for a field left empty, or what is wrong with it, in the
// API's words.
function readAnswer(field: CustomerField, entry: string | string[] | undefined): Answer | undefined | { error: string } {
  if (isSeveral(field)) return Array.isArray(entry) && entry.length > 0 ? entry.map(Number) : undefined
  const text = typeof entry === "string" ? entry.trim() : ""
  if (text === "") return undefined
  switch (field.kind) {
    case "string":
      return [...text].length > MAX_TEXT ? { error: `«${field.label}» ${MAX_TEXT} belgidan oshmasin` } : text
    case "int":
      // Digits with or without a minus, and no more of them than a number
      // carries exactly.
      return /^-?\d+$/.test(text) && Number.isSafeInteger(Number(text))
        ? Number(text)
        : { error: `«${field.label}» butun son bo'lishi kerak` }
    default:
      return Number(text)
  }
}

// customerSchema checks the form of a type's customer, each field in the
// API's words, and turns it into what the API takes: the phone, and the
// answers by the id of the field with the empty ones left out.
export function customerSchema(type: CustomerType) {
  return z
    .object({ phone: z.string(), values: z.record(z.string(), z.union([z.string(), z.array(z.string())])) })
    .transform((form, context): { phone: string; values: CustomerAnswers } => {
      const phone = phoneDigits(form.phone)
      if (phone === null) context.addIssue({ code: "custom", message: "Telefon raqamini to'liq kiriting", path: ["phone"] })
      const values: CustomerAnswers = {}
      for (const field of type.fields) {
        const refuse = (message: string) => context.addIssue({ code: "custom", message, path: ["values", fieldKey(field)] })
        const answer = readAnswer(field, form.values[fieldKey(field)])
        if (answer === undefined) {
          if (field.required) refuse(isChoice(field.kind) ? `«${field.label}» ni tanlang` : `«${field.label}» maydonini to'ldiring`)
        } else if (typeof answer === "object" && !Array.isArray(answer)) refuse(answer.error)
        else values[field.id] = answer
      }
      return { phone: phone ?? "", values }
    })
}
