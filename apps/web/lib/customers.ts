import { isChoice, nameFieldOf } from "./customer-fields"
import type { Customer, CustomerDropdown, CustomerField, CustomerType } from "./types"

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
