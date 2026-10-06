import { expect, test } from "vitest"
import { answersDefaults, answerText, fieldColumns, fieldKey, isChoice, kindLabels, kinds, readAnswers } from "./fields"
import type { CustomerDropdown, CustomerField } from "./types"

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

const jismoniy = [
  field(101, "Yoshi", "int"),
  field(102, "F.I.Sh.", "string", { required: true }),
  field(103, "Manzil", "string"),
  field(104, "Manba", "dropdown", { dropdown_id: 10 }),
  field(105, "Kanallar", "checkbox", { dropdown_id: 10 }),
]

test("an answer is written for people to read: options by their names", () => {
  const [yosh, fish, , source, channels] = jismoniy
  expect(answerText(fish, "Ali Valiyev", dropdowns)).toBe("Ali Valiyev")
  expect(answerText(yosh, 30, dropdowns)).toBe("30")
  expect(answerText(yosh, 0, dropdowns)).toBe("0")
  expect(answerText(source, 12, dropdowns)).toBe("LinkedIn")
  // An option that is turned off is still the answer.
  expect(answerText(source, 13, dropdowns)).toBe("YouTube")
  expect(answerText(channels, [11, 13], dropdowns)).toBe("Instagram, YouTube")
  // No answer, or one whose option is not there any more.
  expect(answerText(fish, undefined, dropdowns)).toBe("")
  expect(answerText(source, 99, dropdowns)).toBe("")
  expect(answerText(channels, [11, 99], dropdowns)).toBe("Instagram")
  expect(answerText(source, 12, [])).toBe("")
})

test("a field's entry in a form is named by its id, with a letter in front", () => {
  expect(fieldKey({ id: 7 })).toBe("f7")
})

test("the list has a column for every field name, shared by the types that have a field of that name", () => {
  const yuridik = [
    field(201, "Nomi", "string", { required: true }),
    field(202, "INN", "int", { required: true, is_unique: true }),
    field(203, "MANBA", "radio", { dropdown_id: 10 }),
    field(204, "F.I.Sh.", "string"),
  ]
  const columns = fieldColumns([
    { id: 1, fields: jismoniy },
    { id: 2, fields: yuridik },
  ])

  // In the order of the types and of their fields; a name in another case is
  // the same name, spelled as the first type spells it.
  expect(columns.map((column) => [column.key, column.label])).toEqual([
    ["field:yoshi", "Yoshi"],
    ["field:f.i.sh.", "F.I.Sh."],
    ["field:manzil", "Manzil"],
    ["field:manba", "Manba"],
    ["field:kanallar", "Kanallar"],
    ["field:nomi", "Nomi"],
    ["field:inn", "INN"],
  ])
  expect([columns[3].fields[1].id, columns[3].fields[2].id]).toEqual([104, 203])
  expect([columns[1].fields[1].id, columns[1].fields[2].id]).toEqual([102, 204])
  expect(fieldColumns([])).toEqual([])
})

test("a form opens with an entry for every field: empty, or holding the answers given", () => {
  expect(answersDefaults(jismoniy)).toEqual({ f101: "", f102: "", f103: "", f104: "", f105: [] })
  expect(answersDefaults(jismoniy, { 101: 30, 102: "Ali Valiyev", 104: 12, 105: [11, 13] })).toEqual({
    f101: "30",
    f102: "Ali Valiyev",
    f103: "",
    f104: "12",
    f105: ["11", "13"],
  })
  expect(answersDefaults(jismoniy, { 101: 0 }).f101).toBe("0")
})

// issuesOf reads the entries and collects what is wrong with them.
function issuesOf(fields: CustomerField[], entries: Record<string, string | string[]>) {
  const issues: [string, string][] = []
  readAnswers(fields, entries, (key, message) => issues.push([key, message]))
  return issues
}

test("a form that is filled in becomes what the API takes: the answers by the id of the field, the empty ones left out", () => {
  const refuse = () => {
    throw new Error("nothing is wrong here")
  }
  expect(readAnswers(jismoniy, { f101: " 30 ", f102: "  Ali Valiyev ", f103: "", f104: "12", f105: ["13", "11"] }, refuse)).toEqual({
    101: 30,
    102: "Ali Valiyev",
    104: 12,
    105: [13, 11],
  })
  expect(readAnswers(jismoniy, { f101: "", f102: "Ali", f103: "   ", f104: "", f105: [] }, refuse)).toEqual({ 102: "Ali" })
  // Zero and a number below it are answers; a field the form does not hold is an empty one.
  expect(readAnswers(jismoniy, { f101: "0", f102: "Ali" }, refuse)).toEqual({ 101: 0, 102: "Ali" })
  expect(readAnswers(jismoniy, { f101: "-5", f102: "Ali" }, refuse)).toEqual({ 101: -5, 102: "Ali" })
})

test("what is wrong with an entry is told beside its key, in the API's words", () => {
  const must = jismoniy.map((f) => ({ ...f, required: true }))
  const empty = { f101: "", f102: "", f103: "", f104: "", f105: [] }

  // Only what is required is asked for; every field says its own.
  expect(issuesOf(jismoniy, empty)).toEqual([["f102", "«F.I.Sh.» maydonini to'ldiring"]])
  expect(issuesOf(must, empty)).toEqual([
    ["f101", "«Yoshi» maydonini to'ldiring"],
    ["f102", "«F.I.Sh.» maydonini to'ldiring"],
    ["f103", "«Manzil» maydonini to'ldiring"],
    ["f104", "«Manba» ni tanlang"],
    ["f105", "«Kanallar» ni tanlang"],
  ])
  for (const number of ["30.5", "abc", "1e3", "3 0", "9007199254740992", "--5"]) {
    expect(issuesOf(jismoniy, { ...empty, f101: number, f102: "Ali" }), number).toEqual([["f101", "«Yoshi» butun son bo'lishi kerak"]])
  }
  expect(issuesOf(jismoniy, { ...empty, f101: "9007199254740991", f102: "Ali" })).toEqual([])
  expect(issuesOf(jismoniy, { ...empty, f102: "ў".repeat(500) })).toEqual([])
  expect(issuesOf(jismoniy, { ...empty, f102: "ў".repeat(501) })).toEqual([["f102", "«F.I.Sh.» 500 belgidan oshmasin"]])
})
