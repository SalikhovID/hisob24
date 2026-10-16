import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { useForm } from "react-hook-form"
import { expect, test, vi } from "vitest"
import { AmountRow, OptionChips, PhoneRow, PickRow, SwitchRow, TextRow } from "./form-row"

type Values = { name: string; phone: string; price: string; required: boolean; source: string; langs: string[] }

// Form renders the rows bound to a form and submits what the form holds.
function Form({ onSubmit, defaults }: { onSubmit: (values: Values) => void; defaults?: Partial<Values> }) {
  const form = useForm<Values>({ defaultValues: { name: "", phone: "", price: "", required: false, source: "", langs: [], ...defaults } })
  return (
    <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
      <TextRow control={form.control} name="name" label="Nomi" placeholder="Masalan, Olma" />
      <PhoneRow control={form.control} name="phone" />
      <AmountRow control={form.control} name="price" label="Sotuv narxi" />
      <SwitchRow control={form.control} name="required" label="Majburiy" />
      <OptionChips
        control={form.control}
        name="source"
        label="Manba"
        options={[
          { value: "1", label: "Instagram" },
          { value: "2", label: "YouTube" },
        ]}
      />
      <OptionChips
        control={form.control}
        name="langs"
        label="Tillar"
        multiple
        options={[
          { value: "uz", label: "O'zbek" },
          { value: "ru", label: "Rus" },
        ]}
      />
      <button type="submit">Saqlash</button>
    </form>
  )
}

test("the rows are labeled fields bound to the form; the phone is masked and the +998 sits beside it", async () => {
  const submit = vi.fn()
  render(<Form onSubmit={submit} />)
  await userEvent.type(screen.getByRole("textbox", { name: "Nomi" }), "Olma")
  const phone = screen.getByRole("textbox", { name: "Telefon" })
  await userEvent.type(phone, "901234567")
  expect(phone).toHaveValue("90 123 45 67")
  expect(screen.getByText("+998")).toBeInTheDocument()
  await userEvent.type(screen.getByRole("textbox", { name: "Sotuv narxi" }), "12000")
  expect(screen.getByText("so'm")).toBeInTheDocument()
  await userEvent.click(screen.getByRole("switch", { name: "Majburiy" }))
  await userEvent.click(screen.getByRole("radio", { name: "Instagram" }))
  await userEvent.click(screen.getByRole("checkbox", { name: "O'zbek" }))
  await userEvent.click(screen.getByRole("checkbox", { name: "Rus" }))
  await userEvent.click(screen.getByRole("checkbox", { name: "O'zbek" }))
  await userEvent.click(screen.getByRole("button", { name: "Saqlash" }))
  expect(submit).toHaveBeenCalledWith(
    { name: "Olma", phone: "90 123 45 67", price: "12000", required: true, source: "1", langs: ["ru"] },
    expect.anything(),
  )
})

test("a chosen radio chip pressed again is unchosen", async () => {
  const submit = vi.fn()
  render(<Form onSubmit={submit} defaults={{ source: "2" }} />)
  const chosen = screen.getByRole("radio", { name: "YouTube" })
  expect(chosen).toHaveAttribute("aria-checked", "true")
  await userEvent.click(chosen)
  expect(chosen).toHaveAttribute("aria-checked", "false")
})

test("a pick row is a button that says its label and its value, or a prompt while there is none", async () => {
  const open = vi.fn()
  const { rerender } = render(<PickRow label="Bosqich" onClick={open} />)
  const row = screen.getByRole("button", { name: "Bosqich Tanlang" })
  expect(row).toHaveAttribute("aria-haspopup", "dialog")
  await userEvent.click(row)
  expect(open).toHaveBeenCalledTimes(1)
  rerender(<PickRow label="Bosqich" value="Yangi" onClick={open} error="Bosqichni tanlang" />)
  expect(screen.getByRole("button", { name: "Bosqich Yangi" })).toHaveAccessibleDescription("Bosqichni tanlang")
  expect(screen.getByRole("alert")).toHaveTextContent("Bosqichni tanlang")
})

test("a chosen option is the prototype's glossy capsule; the others are the plain fill", async () => {
  render(<Form onSubmit={() => {}} defaults={{ source: "1" }} />)
  const chosen = screen.getByRole("radio", { name: "Instagram" })
  expect(chosen).toHaveClass("glossy")
  expect(chosen).not.toHaveClass("bg-muted")
  const other = screen.getByRole("radio", { name: "YouTube" })
  expect(other).toHaveClass("bg-muted")
  expect(other).not.toHaveClass("glossy")
})
