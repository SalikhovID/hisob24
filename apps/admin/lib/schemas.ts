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

// memberSchema is the add-user dialog.
export const memberSchema = z.object({
  phone: phoneField("Telefon raqami noto'g'ri"),
  full_name: required("Ismni kiriting"),
  role: z.enum(["owner", "manager", "staff"], "Rolni tanlang"),
})

const DAYS_MESSAGE = "Kunlar soni 1 dan 3650 gacha bo'lishi kerak"

// billingSchema is the add-billing dialog: days become a number, an empty
// amount or note is left out.
export const billingSchema = z.object({
  days: z
    .string()
    .trim()
    .regex(/^\d+$/, DAYS_MESSAGE)
    .transform(Number)
    .refine((days) => days >= 1 && days <= 3650, DAYS_MESSAGE),
  amount: z
    .string()
    .trim()
    .refine((amount) => amount === "" || /^\d{1,12}(\.\d{1,2})?$/.test(amount), "Summa noto'g'ri: masalan 150000 yoki 150000.50")
    .transform((amount) => amount || undefined),
  note: z
    .string()
    .trim()
    .transform((note) => note || undefined),
})

const TELEGRAM_ID_MESSAGE = "Telegram ID musbat butun son bo'lishi kerak"

// adminSchema is the add-admin dialog.
export const adminSchema = z.object({
  telegram_id: z
    .string()
    .trim()
    .regex(/^\d+$/, TELEGRAM_ID_MESSAGE)
    .transform(Number)
    .refine((id) => id > 0 && Number.isSafeInteger(id), TELEGRAM_ID_MESSAGE),
  full_name: required("Adminning ismini kiriting"),
})
