import { expect, test } from "vitest"
import { answerText, customerName } from "./customers"
import type { CustomerDropdown, CustomerField, CustomerType } from "./types"

const field = (id: number, label: string, kind: CustomerField["kind"], rest: Partial<CustomerField> = {}): CustomerField => ({
  id,
  label,
  kind,
  required: false,
  is_unique: false,
  dropdown_id: null,
  ...rest,
})

// Manba's options in their order; YouTube is turned off.
const manba: CustomerDropdown = {
  id: 10,
  name: "Manba",
  options: [
    { id: 11, label: "Instagram", is_active: true },
    { id: 12, label: "LinkedIn", is_active: true },
    { id: 13, label: "YouTube", is_active: false },
  ],
}
const dropdowns = [manba]

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

test("a customer goes by its answer to the type's first text field", () => {
  expect(customerName({ values: { 101: 30, 102: "Ali Valiyev", 103: "Toshkent" } }, jismoniy)).toBe("Ali Valiyev")
  // Left empty, the customer has no name: the phone stands for it.
  expect(customerName({ values: { 103: "Toshkent" } }, jismoniy)).toBeNull()
  expect(customerName({ values: { 101: 30 } }, { fields: [field(101, "Yoshi", "int")] })).toBeNull()
  // A type that was deleted meanwhile.
  expect(customerName({ values: { 102: "Ali" } }, undefined)).toBeNull()
})

test("an answer is written for people to read: options by their names", () => {
  const [yosh, fish, , source, channels] = jismoniy.fields
  expect(answerText(fish, "Ali Valiyev", dropdowns)).toBe("Ali Valiyev")
  expect(answerText(yosh, 30, dropdowns)).toBe("30")
  expect(answerText(yosh, 0, dropdowns)).toBe("0")
  expect(answerText(source, 12, dropdowns)).toBe("LinkedIn")
  // An option that is turned off is still the customer's answer.
  expect(answerText(source, 13, dropdowns)).toBe("YouTube")
  expect(answerText(channels, [11, 13], dropdowns)).toBe("Instagram, YouTube")
  // No answer, or one whose option is not there any more.
  expect(answerText(fish, undefined, dropdowns)).toBe("")
  expect(answerText(source, 99, dropdowns)).toBe("")
  expect(answerText(channels, [11, 99], dropdowns)).toBe("Instagram")
  expect(answerText(source, 12, [])).toBe("")
})
