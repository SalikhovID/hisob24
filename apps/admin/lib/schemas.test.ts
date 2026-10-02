import { expect, test } from "vitest"
import type { z } from "zod"
import { companySchema, memberSchema, phoneField } from "./schemas"

// problems lists the messages a schema gives for input; none means valid.
function problems(schema: z.ZodType, input: unknown): string[] {
  const result = schema.safeParse(input)
  return result.success ? [] : result.error.issues.map((issue) => issue.message)
}

test.each(["+998 90 123 45 67", "998901234567", "90 123-45-67", "(90) 1234567"])(
  "phoneField accepts %s, normalized",
  (raw) => {
    expect(problems(phoneField("Telefon raqami noto'g'ri"), raw)).toEqual([])
    expect(phoneField("x").parse(raw)).toBe("998901234567")
  },
)

test.each(["", "12ab", "12345678", "1234567890123456"])("phoneField refuses %j", (raw) => {
  expect(problems(phoneField("Telefon raqami noto'g'ri"), raw)).toEqual(["Telefon raqami noto'g'ri"])
})

test("companySchema trims a complete company and normalizes the phone", () => {
  expect(
    companySchema.parse({ name: " Olma ", end_date: "2026-11-01", owner_phone: "90 123 45 67", owner_full_name: " Ali " }),
  ).toEqual({ name: "Olma", end_date: "2026-11-01", owner_phone: "998901234567", owner_full_name: "Ali" })
})

test("companySchema names every missing field", () => {
  expect(problems(companySchema, { name: " ", end_date: "", owner_phone: "", owner_full_name: " " })).toEqual([
    "Kompaniya nomini kiriting",
    "Tugash sanasini tanlang",
    "Egasining telefon raqami noto'g'ri",
    "Egasining ismini kiriting",
  ])
})

test("memberSchema takes a phone, a name and a role", () => {
  expect(memberSchema.parse({ phone: "+998 90 222 33 44", full_name: " Xodim ", role: "staff" })).toEqual({
    phone: "998902223344",
    full_name: "Xodim",
    role: "staff",
  })
})

test("memberSchema refuses a bad phone, no name and an unknown role", () => {
  expect(problems(memberSchema, { phone: "12ab", full_name: "", role: "boss" })).toEqual([
    "Telefon raqami noto'g'ri",
    "Ismni kiriting",
    "Rolni tanlang",
  ])
})
