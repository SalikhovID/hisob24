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
