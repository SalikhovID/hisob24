import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { useForm } from "react-hook-form"
import { expect, test, vi } from "vitest"
import { MultiPickerSheet, PickerSheet, SearchPickerSheet, SelectRow } from "./picker-sheet"

const stages = [
  { value: "1", label: "Yangi" },
  { value: "2", label: "Jarayonda", sub: "3 ta vazifa" },
  { value: "3", label: "Bajarildi" },
]

test("a picker sheet lists the options; the chosen one is selected, a press chooses another and closes the sheet", async () => {
  const change = vi.fn()
  const open = vi.fn()
  render(<PickerSheet open onOpenChange={open} title="Bosqich" options={stages} value="1" onChange={change} />)
  const list = within(await screen.findByRole("dialog", { name: "Bosqich" })).getByRole("listbox", { name: "Bosqich" })
  expect(within(list).getByRole("option", { name: "Yangi" })).toHaveAttribute("aria-selected", "true")
  await userEvent.click(within(list).getByRole("option", { name: /Jarayonda/ }))
  expect(change).toHaveBeenCalledWith("2")
  expect(open).toHaveBeenCalledWith(false)
})

test("a search narrows the options; «none» clears the choice", async () => {
  const change = vi.fn()
  render(
    <PickerSheet open onOpenChange={() => {}} title="Mas'ul" options={stages} value="2" onChange={change} none="Tanlanmagan" search="Ism bo'yicha" />,
  )
  await userEvent.type(screen.getByRole("searchbox", { name: "Qidirish" }), "baj")
  expect(screen.getAllByRole("option").map((o) => o.textContent)).toEqual(["Bajarildi"])
  await userEvent.clear(screen.getByRole("searchbox", { name: "Qidirish" }))
  await userEvent.click(screen.getByRole("option", { name: "Tanlanmagan" }))
  expect(change).toHaveBeenCalledWith("")
})

test("a multi picker keeps the sheet open while options are taken and put back, and hands them over on «Tayyor»", async () => {
  const change = vi.fn()
  const open = vi.fn()
  render(<MultiPickerSheet open onOpenChange={open} title="Kanallar" options={stages} value={["1"]} onChange={change} />)
  await userEvent.click(screen.getByRole("option", { name: "Bajarildi" }))
  await userEvent.click(screen.getByRole("option", { name: "Yangi" }))
  expect(open).not.toHaveBeenCalled()
  await userEvent.click(screen.getByRole("button", { name: "Tayyor" }))
  expect(change).toHaveBeenCalledWith(["3"])
  expect(open).toHaveBeenCalledWith(false)
})

function Form({ onSubmit }: { onSubmit: (values: { stage: string }) => void }) {
  const form = useForm<{ stage: string }>({ defaultValues: { stage: "" } })
  return (
    <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
      <SelectRow control={form.control} name="stage" label="Bosqich" options={stages} />
      <button type="submit">Saqlash</button>
    </form>
  )
}

test("a select row opens the picker and shows the choice", async () => {
  const submit = vi.fn()
  render(<Form onSubmit={submit} />)
  await userEvent.click(screen.getByRole("button", { name: "Bosqich Tanlang" }))
  await userEvent.click(await screen.findByRole("option", { name: "Yangi" }))
  expect(screen.getByRole("button", { name: "Bosqich Yangi" })).toBeInTheDocument()
  await userEvent.click(screen.getByRole("button", { name: "Saqlash" }))
  expect(submit).toHaveBeenCalledWith({ stage: "1" }, expect.anything())
})

test("a search picker asks its owner for the matches of what is typed", async () => {
  const query = vi.fn()
  render(
    <SearchPickerSheet
      open
      onOpenChange={() => {}}
      title="Ta'minotchi"
      placeholder="Nom bo'yicha"
      query=""
      onQuery={query}
      options={[]}
      value=""
      onChange={() => {}}
      loading={false}
    />,
  )
  await userEvent.type(screen.getByRole("searchbox", { name: "Qidirish" }), "ag")
  await vi.waitFor(() => expect(query).toHaveBeenLastCalledWith("ag"))
  expect(screen.getByText("Hech narsa topilmadi")).toBeInTheDocument()
})

test("a picker's options stand on frosted glass, a sheet cell's", async () => {
  render(<PickerSheet open onOpenChange={() => {}} title="Bosqich" options={stages} value="1" onChange={() => {}} />)
  const listbox = await screen.findByRole("listbox", { name: "Bosqich" })
  expect(listbox).toHaveClass("surface", "rounded-group")
  expect(listbox).not.toHaveClass("bg-sheet-cell")
})
