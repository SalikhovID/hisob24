import { z } from "zod"
import { isChoice, kinds } from "./customer-fields"
import { phoneDigits } from "./phone"

// required is a text field that must hold more than spaces.
const required = (message: string) => z.string().trim().min(1, message)

// phone is the phone field's value (90 123 45 67), whole, as the API takes
// it (998901234567).
const phone = (message: string) =>
  z.string().transform((value, context) => {
    const digits = phoneDigits(value)
    if (digits === null) {
      context.addIssue({ code: "custom", message })
      return z.NEVER
    }
    return digits
  })

// employeeSchema is the add-employee dialog; the messages match the API's.
export const employeeSchema = z.object({
  phone: phone("Telefon raqamini to'liq kiriting"),
  full_name: required("Ismni kiriting"),
})

// renameSchema is the rename-employee dialog.
export const renameSchema = z.object({
  full_name: required("Ismni kiriting"),
})

// name is a name as the API takes it: trimmed, not empty and sixty
// characters at most, counted as the API counts them.
const name = () =>
  z
    .string()
    .trim()
    .min(1, "Nomni kiriting")
    .refine((value) => [...value].length <= 60, "Nom 60 belgidan oshmasin")

// nameSchema is a dialog that asks for one name: of a customer type, a
// dropdown or an option. The messages match the API's.
export const nameSchema = z.object({
  name: name(),
})

// fieldSchema is the add-field dialog: the name, the kind, the dropdown of a
// choice (the select's value, an id or nothing) and the two marks.
export const fieldSchema = z
  .object({
    label: name(),
    kind: z.enum(kinds),
    dropdown_id: z.string(),
    required: z.boolean(),
    is_unique: z.boolean(),
  })
  .superRefine((field, context) => {
    if (isChoice(field.kind) && field.dropdown_id === "") {
      context.addIssue({ code: "custom", message: "Dropdownni tanlang", path: ["dropdown_id"] })
    }
  })
  .transform((field) => {
    // Only a choice has a dropdown, and only text and numbers may be told
    // not to repeat: what the dialog held for the other kind is left behind.
    const choice = isChoice(field.kind)
    return {
      label: field.label,
      kind: field.kind,
      required: field.required,
      is_unique: !choice && field.is_unique,
      dropdown_id: choice ? Number(field.dropdown_id) : null,
    }
  })
