import type { Customer, CustomerDropdown, CustomerField, CustomerFieldKind } from "./types"

// What a form of fields the owner sets up is made of, shared by the
// customers and the tasks: the kinds, how an answer reads, the columns a
// list of answers has, and how a form holds and reads the answers.

// FormField is a field of a form the owner set up, of a customer type or of
// a task type: what showing and reading an answer needs of it. (A customer
// field may also be told not to repeat; that is the customers' own.)
export type FormField = Pick<CustomerField, "id" | "label" | "kind" | "required" | "dropdown_id">

// kindLabels are the field kinds' Uzbek names, in the order a form offers
// them.
export const kindLabels: Record<CustomerFieldKind, string> = {
  string: "Matn",
  int: "Butun son",
  dropdown: "Dropdown (bitta tanlov)",
  multi_dropdown: "Dropdown (bir nechta tanlov)",
  radio: "Radio (bitta tanlov)",
  checkbox: "Checkbox (bir nechta tanlov)",
}

export const kinds = Object.keys(kindLabels) as CustomerFieldKind[]

// isChoice tells a field that takes its options from a dropdown.
export const isChoice = (kind: CustomerFieldKind): boolean => kind !== "string" && kind !== "int"

// Answer is an answer to one field: a text, a whole number or the id of the
// one option chosen, or the ids of several.
export type Answer = Customer["values"][string]

// answerText writes an answer for people to read: a text and a number as
// they are, the options by their names. "" for a field left empty.
export function answerText(field: FormField, answer: Answer | undefined, dropdowns: CustomerDropdown[]): string {
  if (answer === undefined) return ""
  if (!isChoice(field.kind)) return String(answer)
  const options = dropdowns.find((dropdown) => dropdown.id === field.dropdown_id)?.options ?? []
  const chosen = Array.isArray(answer) ? answer : [answer]
  return chosen.flatMap((id) => options.find((option) => option.id === id)?.label ?? []).join(", ")
}

// FieldColumn is a column of a list that shows answers. Fields of one name
// share a column, whatever the type: fields holds each type's field of that
// name, by the id of the type.
export interface FieldColumn {
  key: string
  label: string
  fields: Record<number, FormField>
}

// fieldColumns are a list's answer columns for the types it shows, in the
// order of the types and of their fields. A name counts whatever its case,
// and is spelled as the first type spells it.
export function fieldColumns(types: { id: number; fields: FormField[] }[]): FieldColumn[] {
  const columns = new Map<string, FieldColumn>()
  for (const type of types) {
    for (const field of type.fields) {
      const key = `field:${field.label.toLowerCase()}`
      const column = columns.get(key) ?? { key, label: field.label, fields: {} }
      column.fields[type.id] = field
      columns.set(key, column)
    }
  }
  return [...columns.values()]
}

// fieldKey names a field's entry in a form. A bare number would not do:
// react-hook-form reads a numeric key as a place in an array.
export const fieldKey = (field: Pick<FormField, "id">) => `f${field.id}`

// isSeveral tells a choice of several options from a choice of one.
const isSeveral = (field: FormField) => field.kind === "multi_dropdown" || field.kind === "checkbox"

// Entries is what a form holds for the fields of a type, by fieldKey: a
// text, a number and a single choice are a string (an option's id, "" for
// none), a choice of several the ids.
export type Entries = Record<string, string | string[]>

// answersDefaults is the entries of a form as it opens: empty for a new
// record, holding the answers of one being edited.
export function answersDefaults(fields: FormField[], values?: Record<string, Answer>): Entries {
  const entries: Entries = {}
  for (const field of fields) {
    const answer = values?.[field.id]
    if (isSeveral(field)) entries[fieldKey(field)] = Array.isArray(answer) ? answer.map(String) : []
    else entries[fieldKey(field)] = answer === undefined || Array.isArray(answer) ? "" : String(answer)
  }
  return entries
}

// How long a text answer may be, in characters, as the API counts them.
const MAX_TEXT = 500

// readAnswer reads a field's entry of the form: the answer as the API takes
// it, undefined for a field left empty, or what is wrong with it, in the
// API's words.
function readAnswer(field: FormField, entry: string | string[] | undefined): Answer | undefined | { error: string } {
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

// readAnswers reads the entries of a form: the answers as the API takes
// them, by the id of the field, with the empty ones left out. What is wrong
// with an entry is told to refuse, under the entry's key and in the API's
// words, and that entry is left out too.
export function readAnswers(
  fields: FormField[],
  entries: Entries,
  refuse: (key: string, message: string) => void,
): Record<string, Answer> {
  const answers: Record<string, Answer> = {}
  for (const field of fields) {
    const answer = readAnswer(field, entries[fieldKey(field)])
    if (answer === undefined) {
      if (field.required) refuse(fieldKey(field), isChoice(field.kind) ? `«${field.label}» ni tanlang` : `«${field.label}» maydonini to'ldiring`)
    } else if (typeof answer === "object" && !Array.isArray(answer)) refuse(fieldKey(field), answer.error)
    else answers[field.id] = answer
  }
  return answers
}
