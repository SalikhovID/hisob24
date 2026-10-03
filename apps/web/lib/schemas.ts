import { z } from "zod"
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
