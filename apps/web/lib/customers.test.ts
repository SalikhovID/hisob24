import { expect, test } from "vitest"
import { customerName, customerSchema, fieldColumns, formDefaults, nameFieldOf } from "./customers"
import type { Customer, CustomerField, CustomerType } from "./types"

const field = (id: number, label: string, kind: CustomerField["kind"], rest: Partial<CustomerField> = {}): CustomerField => ({
  id,
  label,
  kind,
  required: false,
  is_unique: false,
  dropdown_id: null,
  ...rest,
})

const jismoniy: CustomerType = {
  id: 1,
  name: "Jismoniy",
  fields: [
    field(101, "Yoshi", "int"),
    field(102, "F.I.Sh.", "string", { required: true }),
    field(103, "Manzil", "string"),
    field(104, "Manba", "dropdown", { dropdown_id: 10 }),
    field(105, "Kanallar", "checkbox", { dropdown_id: 10 }),
  ],
}

test("a customer goes by the first text field of their type", () => {
  expect(nameFieldOf({ fields: [field(1, "Yoshi", "int"), field(2, "Ism", "string"), field(3, "Manzil", "string")] })?.id).toBe(2)
  expect(nameFieldOf({ fields: [field(1, "Yoshi", "int"), field(2, "Jinsi", "radio")] })).toBeUndefined()
  expect(nameFieldOf({ fields: [] })).toBeUndefined()
})

test("a customer goes by its answer to the type's first text field", () => {
  expect(customerName({ values: { 101: 30, 102: "Ali Valiyev", 103: "Toshkent" } }, jismoniy)).toBe("Ali Valiyev")
  // Left empty, the customer has no name: the phone stands for it.
  expect(customerName({ values: { 103: "Toshkent" } }, jismoniy)).toBeNull()
  expect(customerName({ values: { 101: 30 } }, { fields: [field(101, "Yoshi", "int")] })).toBeNull()
  // A type that was deleted meanwhile.
  expect(customerName({ values: { 102: "Ali" } }, undefined)).toBeNull()
})

const yuridik: CustomerType = {
  id: 2,
  name: "Yuridik",
  fields: [
    field(201, "Nomi", "string", { required: true }),
    field(202, "INN", "int", { required: true, is_unique: true }),
    field(203, "MANBA", "radio", { dropdown_id: 10 }),
    field(204, "F.I.Sh.", "string"),
  ],
}

test("the list has a column for every field name, shared by the types that have a field of that name", () => {
  const columns = fieldColumns([jismoniy, yuridik])

  // In the order of the types and of their fields; a name in another case is
  // the same name, spelled as the first type spells it.
  expect(columns.map((column) => [column.key, column.label])).toEqual([
    ["field:yoshi", "Yoshi"],
    ["field:manzil", "Manzil"],
    ["field:manba", "Manba"],
    ["field:kanallar", "Kanallar"],
    ["field:inn", "INN"],
    ["field:f.i.sh.", "F.I.Sh."],
  ])
  const manbaColumn = columns[2]
  expect([manbaColumn.fields[1].id, manbaColumn.fields[2].id]).toEqual([104, 203])
  // Each type's first text field is its customers' name, not a column: the
  // F.I.Sh. column is Yuridik's second text field alone.
  expect(Object.keys(columns[5].fields)).toEqual(["2"])
  expect(columns.some((column) => column.label === "Nomi")).toBe(false)
})

test("under one type the columns are that type's fields", () => {
  expect(fieldColumns([yuridik]).map((column) => column.label)).toEqual(["INN", "MANBA", "F.I.Sh."])
  expect(fieldColumns([])).toEqual([])
})

const ali: Customer = {
  id: 7,
  type_id: 1,
  phone: "998901234567",
  values: { 101: 30, 102: "Ali Valiyev", 104: 12, 105: [11, 13] },
  created_by_name: "Vali Aliyev",
  created_at: "2026-10-02T06:01:00.000Z",
  updated_at: "2026-10-02T06:01:00.000Z",
}

test("the form of a new customer opens empty; of one being edited, with its phone and answers", () => {
  expect(formDefaults(jismoniy)).toEqual({ phone: "", values: { f101: "", f102: "", f103: "", f104: "", f105: [] } })
  expect(formDefaults(jismoniy, ali)).toEqual({
    phone: "90 123 45 67",
    values: { f101: "30", f102: "Ali Valiyev", f103: "", f104: "12", f105: ["11", "13"] },
  })
  expect(formDefaults(jismoniy, { ...ali, values: { 101: 0 } }).values.f101).toBe("0")
})

test("a form that is filled in becomes what the API takes: the answers by the id of the field, the empty ones left out", () => {
  const schema = customerSchema(jismoniy)

  expect(
    schema.parse({ phone: "90 123 45 67", values: { f101: " 30 ", f102: "  Ali Valiyev ", f103: "", f104: "12", f105: ["13", "11"] } }),
  ).toEqual({ phone: "998901234567", values: { 101: 30, 102: "Ali Valiyev", 104: 12, 105: [13, 11] } })
  expect(schema.parse({ phone: "901234567", values: { f101: "", f102: "Ali", f103: "   ", f104: "", f105: [] } })).toEqual({
    phone: "998901234567",
    values: { 102: "Ali" },
  })
  // Zero and a number below it are answers; a field the form does not hold is an empty one.
  expect(schema.parse({ phone: "901234567", values: { f101: "0", f102: "Ali" } }).values).toEqual({ 101: 0, 102: "Ali" })
  expect(schema.parse({ phone: "901234567", values: { f101: "-5", f102: "Ali" } }).values).toEqual({ 101: -5, 102: "Ali" })
})

test("what is wrong with a form is said beside its field, in the API's words", () => {
  const must: CustomerType = { ...jismoniy, fields: jismoniy.fields.map((f) => ({ ...f, required: true })) }
  const issuesOf = (type: CustomerType, phone: string, values: Record<string, string | string[]>) => {
    const result = customerSchema(type).safeParse({ phone, values })
    return result.success ? [] : result.error.issues.map((issue) => [issue.path.join("."), issue.message])
  }
  const empty = { f101: "", f102: "", f103: "", f104: "", f105: [] }

  // Only what is required is asked for; every field says its own.
  expect(issuesOf(jismoniy, "90 123", empty)).toEqual([
    ["phone", "Telefon raqamini to'liq kiriting"],
    ["values.f102", "«F.I.Sh.» maydonini to'ldiring"],
  ])
  expect(issuesOf(must, "901234567", empty)).toEqual([
    ["values.f101", "«Yoshi» maydonini to'ldiring"],
    ["values.f102", "«F.I.Sh.» maydonini to'ldiring"],
    ["values.f103", "«Manzil» maydonini to'ldiring"],
    ["values.f104", "«Manba» ni tanlang"],
    ["values.f105", "«Kanallar» ni tanlang"],
  ])
  for (const number of ["30.5", "abc", "1e3", "3 0", "9007199254740992", "--5"]) {
    expect(issuesOf(jismoniy, "901234567", { ...empty, f101: number, f102: "Ali" }), number).toEqual([
      ["values.f101", "«Yoshi» butun son bo'lishi kerak"],
    ])
  }
  expect(issuesOf(jismoniy, "901234567", { ...empty, f101: "9007199254740991", f102: "Ali" })).toEqual([])
  expect(issuesOf(jismoniy, "901234567", { ...empty, f102: "ў".repeat(500) })).toEqual([])
  expect(issuesOf(jismoniy, "901234567", { ...empty, f102: "ў".repeat(501) })).toEqual([["values.f102", "«F.I.Sh.» 500 belgidan oshmasin"]])
})
