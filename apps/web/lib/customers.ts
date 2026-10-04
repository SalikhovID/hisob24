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
