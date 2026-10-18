import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { useForm } from "react-hook-form"
import { expect, test, vi } from "vitest"
import type { CustomerField, CustomerOption } from "@/lib/types"
import { choose, optionsOf } from "@/test/select"
import { FieldAnswer } from "./field-answer"

const manba: CustomerField = { id: 3, label: "Manba", kind: "dropdown", required: false, is_unique: false, dropdown_id: 10 }
const tillar: CustomerField = { id: 5, label: "Tillar", kind: "checkbox", required: true, is_unique: false, dropdown_id: 20 }
const sources: CustomerOption[] = [
  { id: 11, label: "Instagram", is_active: true },
  { id: 12, label: "LinkedIn", is_active: true },
]
const languages: CustomerOption[] = [
  { id: 22, label: "Rus", is_active: true },
  { id: 21, label: "O'zbek", is_active: true },
]

// Form holds a customer's answers under a path of its own, the way an order's
// form holds the customer it is entered with.
type Form = { customer: { values: { f3: string; f5: string[] } } }

function Harness({ onSubmit, options = sources }: { onSubmit: (form: Form) => void; options?: CustomerOption[] }) {
  const form = useForm<Form>({ defaultValues: { customer: { values: { f3: "", f5: [] } } } })
  return (
    <form onSubmit={form.handleSubmit(onSubmit)}>
      <FieldAnswer control={form.control} name="customer.values.f3" field={manba} options={options} />
      <FieldAnswer control={form.control} name="customer.values.f5" field={tillar} options={languages} />
      <button type="submit">Saqlash</button>
    </form>
  )
}

test("an answer lands at the form path the field is given", async () => {
  const user = userEvent.setup()
  const onSubmit = vi.fn()
  render(<Harness onSubmit={onSubmit} />)

  await choose(user, screen.getByLabelText("Manba"), "LinkedIn")
  await user.click(within(screen.getByRole("group", { name: "Tillar" })).getByRole("checkbox", { name: "Rus" }))
  await user.click(screen.getByRole("button", { name: "Saqlash" }))

  expect(onSubmit).toHaveBeenCalledWith({ customer: { values: { f3: "12", f5: ["22"] } } }, expect.anything())
})

test("a field says whether it may be left empty, as the prototype's rows do", () => {
  function Texts() {
    const form = useForm({ defaultValues: { ismi: "", yoshi: "", f3: "", f5: [] as string[] } })
    return (
      <>
        <FieldAnswer control={form.control} name="ismi" field={{ id: 1, label: "Ismi", kind: "string", required: true, dropdown_id: null }} options={[]} />
        <FieldAnswer control={form.control} name="yoshi" field={{ id: 2, label: "Yoshi", kind: "int", required: false, dropdown_id: null }} options={[]} />
        <FieldAnswer control={form.control} name="f3" field={manba} options={sources} />
        <FieldAnswer control={form.control} name="f5" field={{ ...tillar, required: false }} options={languages} />
      </>
    )
  }
  render(<Texts />)

  // A line of text says it in its placeholder.
  expect(screen.getByLabelText("Ismi")).toHaveAttribute("placeholder", "Majburiy")
  expect(screen.getByLabelText("Yoshi")).toHaveAttribute("placeholder", "ixtiyoriy")
  expect(screen.getByLabelText("Yoshi")).toHaveAttribute("inputmode", "numeric")
  // A choice made in a sheet says «Tanlanmagan» while there is none.
  expect(screen.getByLabelText("Manba")).toHaveTextContent("Tanlanmagan")
  // Chips say it beside the name.
  expect(screen.getByText("· ixtiyoriy")).toBeInTheDocument()
})

test("a choice with nothing to choose from says where the options come from", async () => {
  const user = userEvent.setup()
  render(<Harness onSubmit={() => {}} options={[]} />)

  expect(screen.getByText("Faol variant yo'q. Variantlar Sozlamalarda qo'shiladi.")).toBeInTheDocument()
  expect(await optionsOf(user, screen.getByLabelText("Manba"))).toEqual(["Tanlanmagan"])
})
