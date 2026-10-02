import { z } from "zod"

// phoneField accepts a phone the way the API's NormalizePhone does: spaces,
// "+", "-" and brackets dropped, 9 to 15 digits, and a bare 9-digit number
// taken as Uzbek (998 in front).
export function phoneField(message: string) {
  return z
    .string()
    .transform((raw) => raw.replace(/[+\-()\s]/g, ""))
    .refine((digits) => /^\d{9,15}$/.test(digits), message)
    .transform((digits) => (digits.length === 9 ? `998${digits}` : digits))
}

// required is a text field that must hold more than spaces.
const required = (message: string) => z.string().trim().min(1, message)

// companySchema is the new-company form; the messages match the API's.
export const companySchema = z.object({
  name: required("Kompaniya nomini kiriting"),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Tugash sanasini tanlang"),
  owner_phone: phoneField("Egasining telefon raqami noto'g'ri"),
  owner_full_name: required("Egasining ismini kiriting"),
})
