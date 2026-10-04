import { expect, test } from "vitest"
import { isChoice, kindLabels, kinds, nameFieldOf } from "./customer-fields"
import type { CustomerField } from "./types"

test("the six kinds of field have Uzbek names, in the order a form offers them", () => {
  expect(kinds.map((kind) => [kind, kindLabels[kind]])).toEqual([
    ["string", "Matn"],
    ["int", "Butun son"],
    ["dropdown", "Dropdown (bitta tanlov)"],
    ["multi_dropdown", "Dropdown (bir nechta tanlov)"],
    ["radio", "Radio (bitta tanlov)"],
    ["checkbox", "Checkbox (bir nechta tanlov)"],
  ])
})

test("a choice is a field that takes its options from a dropdown: neither text nor a number", () => {
  expect(kinds.filter(isChoice)).toEqual(["dropdown", "multi_dropdown", "radio", "checkbox"])
})

const field = (id: number, kind: CustomerField["kind"]): CustomerField => ({
  id,
  label: `Maydon ${id}`,
  kind,
  required: false,
  is_unique: false,
  dropdown_id: null,
})

test("a customer goes by the first text field of their type", () => {
  expect(nameFieldOf({ fields: [field(1, "int"), field(2, "string"), field(3, "string")] })?.id).toBe(2)
  expect(nameFieldOf({ fields: [field(1, "int"), field(2, "radio")] })).toBeUndefined()
  expect(nameFieldOf({ fields: [] })).toBeUndefined()
})
