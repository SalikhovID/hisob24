import { zodResolver } from "@hookform/resolvers/zod"
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { useForm } from "react-hook-form"
import { expect, test, vi } from "vitest"
import { z } from "zod"
import { MultiSelectBox, SelectBox, SelectField } from "./select-field"

const options = [
  { value: "1", label: "Instagram" },
  { value: "2", label: "LinkedIn" },
]

test("SelectBox says the chosen option by name, and the placeholder while nothing is chosen", () => {
  const { rerender } = render(
    <>
      <label htmlFor="src">Manba</label>
      <SelectBox id="src" value="" placeholder="Tanlang" options={options} onChange={() => {}} />
    </>,
  )
  const box = screen.getByRole("combobox", { name: "Manba" })
  expect(box).toHaveTextContent("Tanlang")
  expect(box).toHaveAttribute("data-placeholder")

  rerender(
    <>
      <label htmlFor="src">Manba</label>
      <SelectBox id="src" value="2" placeholder="Tanlang" options={options} onChange={() => {}} />
    </>,
  )
  expect(box).toHaveTextContent("LinkedIn")
  expect(box).not.toHaveAttribute("data-placeholder")
})

test("SelectBox opens the options, the placeholder not among them, and tells the choice", async () => {
  const user = userEvent.setup()
  const onChange = vi.fn()
  render(<SelectBox aria-label="Manba" value="" placeholder="Tanlang" options={options} onChange={onChange} />)

  await user.click(screen.getByRole("combobox", { name: "Manba" }))
  const list = await screen.findByRole("listbox")
  expect(within(list).getAllByRole("option").map((option) => option.textContent)).toEqual(["Instagram", "LinkedIn"])

  await user.click(within(list).getByRole("option", { name: "LinkedIn" }))
  expect(onChange).toHaveBeenCalledWith("2")
  // A choice of one closes the list.
  await waitFor(() => expect(screen.queryByRole("listbox")).not.toBeInTheDocument())
})

test("SelectBox offers the empty choice as an option of its own, which clears the field", async () => {
  const user = userEvent.setup()
  const onChange = vi.fn()
  const { rerender } = render(<SelectBox aria-label="Manba" value="2" empty="Tanlanmagan" options={options} onChange={onChange} />)

  await user.click(screen.getByRole("combobox", { name: "Manba" }))
  const list = await screen.findByRole("listbox")
  expect(within(list).getAllByRole("option").map((option) => option.textContent)).toEqual(["Tanlanmagan", "Instagram", "LinkedIn"])
  expect(within(list).getByRole("option", { name: "LinkedIn" })).toHaveAttribute("aria-selected", "true")
  await user.click(within(list).getByRole("option", { name: "Tanlanmagan" }))
  expect(onChange).toHaveBeenCalledWith("")

  rerender(<SelectBox aria-label="Manba" value="" empty="Tanlanmagan" options={options} onChange={onChange} />)
  expect(screen.getByRole("combobox", { name: "Manba" })).toHaveTextContent("Tanlanmagan")
})

test("SelectBox can be disabled, marked invalid and described", () => {
  render(
    <>
      <span id="hint">ixtiyoriy</span>
      <SelectBox aria-label="Manba" aria-invalid aria-describedby="hint" disabled value="" options={options} onChange={() => {}} />
    </>,
  )

  const box = screen.getByRole("combobox", { name: "Manba" })
  expect(box).toBeDisabled()
  expect(box).toHaveAttribute("aria-invalid", "true")
  expect(box).toHaveAccessibleDescription("ixtiyoriy")
})

const schema = z.object({ kind: z.string().min(1, "Turni tanlang") })

function Form({ onSubmit }: { onSubmit: (values: z.infer<typeof schema>) => void }) {
  const form = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema), defaultValues: { kind: "" } })
  return (
    <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
      <SelectField control={form.control} name="kind" label="Turi" placeholder="Tanlang" options={options} />
      <button type="submit">Saqlash</button>
    </form>
  )
}

test("SelectField is a labeled select bound to a form field, with its error under it", async () => {
  const user = userEvent.setup()
  const onSubmit = vi.fn()
  render(<Form onSubmit={onSubmit} />)

  await user.click(screen.getByRole("button", { name: "Saqlash" }))
  expect(await screen.findByText("Turni tanlang")).toBeInTheDocument()
  const box = screen.getByLabelText("Turi")
  expect(box).toHaveAttribute("aria-invalid", "true")

  await user.click(box)
  await user.click(await screen.findByRole("option", { name: "Instagram" }))
  expect(box).toHaveTextContent("Instagram")
  await user.click(screen.getByRole("button", { name: "Saqlash" }))

  await waitFor(() => expect(onSubmit).toHaveBeenCalledWith({ kind: "1" }, expect.anything()))
  expect(screen.queryByText("Turni tanlang")).not.toBeInTheDocument()
})

test("MultiSelectBox says the chosen options, marks them in the open list, and toggles them one by one", async () => {
  const user = userEvent.setup()
  const onChange = vi.fn()
  const { rerender } = render(<MultiSelectBox aria-label="Kanallar" value={["1"]} options={options} onChange={onChange} />)

  const box = screen.getByRole("combobox", { name: "Kanallar" })
  expect(box).toHaveTextContent("Instagram")
  await user.click(box)
  const list = await screen.findByRole("listbox")
  expect(within(list).getByRole("option", { name: "Instagram" })).toHaveAttribute("aria-selected", "true")
  expect(within(list).getByRole("option", { name: "LinkedIn" })).toHaveAttribute("aria-selected", "false")

  await user.click(within(list).getByRole("option", { name: "LinkedIn" }))
  expect(onChange).toHaveBeenLastCalledWith(["1", "2"])
  // The list stays open for the next choice; a chosen option is taken back.
  expect(screen.getByRole("listbox")).toBeInTheDocument()
  await user.click(within(list).getByRole("option", { name: "Instagram" }))
  expect(onChange).toHaveBeenLastCalledWith([])

  rerender(<MultiSelectBox aria-label="Kanallar" value={["1", "2"]} options={options} onChange={onChange} />)
  expect(box).toHaveTextContent("Instagram, LinkedIn")
  rerender(<MultiSelectBox aria-label="Kanallar" value={[]} options={options} onChange={onChange} />)
  expect(box).toHaveTextContent("Tanlanmagan")
})
