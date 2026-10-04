import { expect, test } from "vitest"
import type { z } from "zod"
import { employeeSchema, fieldSchema, nameSchema, renameSchema } from "./schemas"

// problems lists the messages a schema gives for input; none means valid.
function problems(schema: z.ZodType, input: unknown): string[] {
  const result = schema.safeParse(input)
  return result.success ? [] : result.error.issues.map((issue) => issue.message)
}

test("employeeSchema turns the dialog into what the API takes", () => {
  expect(employeeSchema.parse({ phone: "90 222 33 44", full_name: " Vali Aliyev " })).toEqual({
    phone: "998902223344",
    full_name: "Vali Aliyev",
  })
})

test("employeeSchema names a number that is not whole and a name that is missing", () => {
  expect(problems(employeeSchema, { phone: "90 222", full_name: " " })).toEqual([
    "Telefon raqamini to'liq kiriting",
    "Ismni kiriting",
  ])
})

test("renameSchema trims the name and refuses an empty one", () => {
  expect(renameSchema.parse({ full_name: " Vali (hisobchi) " })).toEqual({ full_name: "Vali (hisobchi)" })
  expect(problems(renameSchema, { full_name: "  " })).toEqual(["Ismni kiriting"])
})

test("nameSchema trims a name, and refuses an empty one and one over sixty characters", () => {
  expect(nameSchema.parse({ name: " Jismoniy " })).toEqual({ name: "Jismoniy" })
  expect(problems(nameSchema, { name: "  " })).toEqual(["Nomni kiriting"])
  expect(problems(nameSchema, { name: "ў".repeat(61) })).toEqual(["Nom 60 belgidan oshmasin"])
  expect(problems(nameSchema, { name: "ў".repeat(60) })).toEqual([])
})

test("fieldSchema turns the field dialog into what the API takes", () => {
  expect(fieldSchema.parse({ label: " INN ", kind: "int", dropdown_id: "", required: true, is_unique: true })).toEqual({
    label: "INN",
    kind: "int",
    required: true,
    is_unique: true,
    dropdown_id: null,
  })
  // A choice takes its dropdown and is never told not to repeat.
  expect(fieldSchema.parse({ label: "Manba", kind: "radio", dropdown_id: "7", required: false, is_unique: true })).toEqual({
    label: "Manba",
    kind: "radio",
    required: false,
    is_unique: false,
    dropdown_id: 7,
  })
  // A dropdown picked before the kind was changed to text is left behind.
  expect(fieldSchema.parse({ label: "Izoh", kind: "string", dropdown_id: "7", required: false, is_unique: false }).dropdown_id).toBeNull()
})

test("fieldSchema names a missing name and a choice without a dropdown", () => {
  expect(problems(fieldSchema, { label: " ", kind: "dropdown", dropdown_id: "", required: false, is_unique: false })).toEqual([
    "Nomni kiriting",
    "Dropdownni tanlang",
  ])
  expect(problems(fieldSchema, { label: "Yoshi", kind: "int", dropdown_id: "", required: false, is_unique: false })).toEqual([])
})
