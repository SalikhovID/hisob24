import type { CustomerField, CustomerFieldKind, CustomerType } from "./types"

// kindLabels are the field kinds' Uzbek names, in the order a form offers
// them.
export const kindLabels: Record<CustomerFieldKind, string> = {
  string: "Matn",
  int: "Butun son",
  dropdown: "Dropdown (bitta tanlov)",
  multi_dropdown: "Dropdown (bir nechta tanlov)",
  radio: "Radio (bitta tanlov)",
  checkbox: "Checkbox (bir nechta tanlov)",
}

export const kinds = Object.keys(kindLabels) as CustomerFieldKind[]

// isChoice tells a field that takes its options from a dropdown.
export const isChoice = (kind: CustomerFieldKind): boolean => kind !== "string" && kind !== "int"

// nameFieldOf is the field a customer of the type goes by: the type's first
// text field (logic/customers.md, 3.3). A type with no text field has none.
export const nameFieldOf = (type: Pick<CustomerType, "fields">): CustomerField | undefined =>
  type.fields.find((field) => field.kind === "string")
