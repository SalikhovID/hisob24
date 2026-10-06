import { z } from "zod"
import { answersDefaults, type Entries, type FieldColumn, fieldColumns as columnsOf, readAnswers } from "./fields"
import { formatPhoneInput, phoneDigits } from "./phone"
import type { Customer, CustomerAnswers, CustomerField, CustomerType } from "./types"

// nameFieldOf is the field a customer of the type goes by: the type's first
// text field (logic/customers.md, 3.3). A type with no text field has none.
export const nameFieldOf = (type: Pick<CustomerType, "fields">): CustomerField | undefined =>
  type.fields.find((field) => field.kind === "string")

// customerName is the name a customer goes by: its answer to its type's
// first text field. null when it has none: the phone then stands for the
// name.
export function customerName(customer: Pick<Customer, "values">, type: Pick<CustomerType, "fields"> | undefined): string | null {
  const field = type && nameFieldOf(type)
  const answer = field ? customer.values[field.id] : undefined
  return typeof answer === "string" && answer !== "" ? answer : null
}

// fieldColumns are the customers list's answer columns for the types it
// shows. The field a type's customers go by is not a column: it is the
// customer's name.
export function fieldColumns(types: CustomerType[]): FieldColumn[] {
  return columnsOf(
    types.map((type) => {
      const nameField = nameFieldOf(type)
      return { id: type.id, fields: type.fields.filter((field) => field !== nameField) }
    }),
  )
}

// CustomerForm is what the customer form holds: the phone field's value and
// an entry for each field of the type.
export type CustomerForm = { phone: string; values: Entries }

// CustomerOutput is the form as the API takes it: the phone, and the answers
// by the id of the field.
export type CustomerOutput = { phone: string; values: CustomerAnswers }

// formDefaults is the form as it opens: empty for a new customer, with the
// phone and the answers of one being edited.
export function formDefaults(type: CustomerType, customer?: Customer): CustomerForm {
  return { phone: customer ? formatPhoneInput(customer.phone) : "", values: answersDefaults(type.fields, customer?.values) }
}

// customerSchema checks the form of a type's customer, each field in the
// API's words, and turns it into what the API takes: the phone, and the
// answers by the id of the field with the empty ones left out.
export function customerSchema(type: CustomerType) {
  return z
    .object({ phone: z.string(), values: z.record(z.string(), z.union([z.string(), z.array(z.string())])) })
    .transform((form, context): CustomerOutput => {
      const phone = phoneDigits(form.phone)
      if (phone === null) context.addIssue({ code: "custom", message: "Telefon raqamini to'liq kiriting", path: ["phone"] })
      const values = readAnswers(type.fields, form.values, (key, message) =>
        context.addIssue({ code: "custom", message, path: ["values", key] }),
      )
      return { phone: phone ?? "", values }
    })
}
