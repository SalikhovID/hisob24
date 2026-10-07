import { screen, within } from "@testing-library/react"
import { useState } from "react"
import { expect, test } from "vitest"
import { renderWithProviders } from "@/test/render"
import { Picker, type PickerItem } from "./picker"

const items: PickerItem[] = [
  { id: 1, name: "Bozor", meta: "+998 90 123 45 67" },
  { id: 2, name: "Dehqon" },
]

function Harness({ initial = null }: { initial?: PickerItem | null }) {
  const [typed, setTyped] = useState("")
  const [selected, setSelected] = useState<PickerItem | null>(initial)
  return (
    <Picker
      label="Ta'minotchi"
      placeholder="Nom bo'yicha qidiring"
      listLabel="Ta'minotchi takliflari"
      typed={typed}
      onTyped={setTyped}
      items={typed.length > 0 ? items.filter((i) => i.name.toLowerCase().includes(typed.toLowerCase())) : []}
      selected={selected}
      onSelect={setSelected}
      onClear={() => setSelected(null)}
    />
  )
}

test("typing shows the matches; a click takes one, which stands as a chip the × clears", async () => {
  const { user } = renderWithProviders(<Harness />)
  const box = screen.getByRole("combobox", { name: "Ta'minotchi" })
  await user.type(box, "bo")
  const list = await screen.findByRole("listbox", { name: "Ta'minotchi takliflari" })
  expect(within(list).getAllByRole("option").map((o) => o.textContent)).toEqual(["Bozor+998 90 123 45 67"])
  await user.click(within(list).getByRole("option", { name: /Bozor/ }))
  expect(screen.queryByRole("listbox")).not.toBeInTheDocument()
  expect(within(screen.getByRole("group", { name: "Ta'minotchi" })).getByText("Bozor")).toBeInTheDocument()
  expect(screen.queryByRole("combobox", { name: "Ta'minotchi" })).not.toBeInTheDocument()
  await user.click(screen.getByRole("button", { name: "Ta'minotchi: bekor qilish" }))
  expect(screen.getByRole("combobox", { name: "Ta'minotchi" })).toHaveValue("")
})

test("the keyboard walks the list: ArrowDown and Enter take; Escape puts it away; nothing typed, nothing offered", async () => {
  const { user } = renderWithProviders(<Harness />)
  const box = screen.getByRole("combobox", { name: "Ta'minotchi" })
  await user.click(box)
  expect(screen.queryByRole("listbox")).not.toBeInTheDocument()
  await user.type(box, "d")
  await screen.findByRole("listbox")
  await user.keyboard("{ArrowDown}{Enter}")
  expect(within(screen.getByRole("group", { name: "Ta'minotchi" })).getByText("Dehqon")).toBeInTheDocument()
  await user.click(screen.getByRole("button", { name: "Ta'minotchi: bekor qilish" }))
  await user.type(screen.getByRole("combobox", { name: "Ta'minotchi" }), "o")
  await screen.findByRole("listbox")
  await user.keyboard("{Escape}")
  expect(screen.queryByRole("listbox")).not.toBeInTheDocument()
})

test("a selection given at the start stands as a chip; an error is told under the field", () => {
  renderWithProviders(
    <Picker
      label="Mahsulot"
      placeholder="Nom yoki artikul"
      listLabel="Mahsulot takliflari"
      typed=""
      onTyped={() => {}}
      items={[]}
      selected={{ id: 2, name: "Dehqon", meta: "kg" }}
      onSelect={() => {}}
      onClear={() => {}}
      error="Mahsulotni tanlang"
    />,
  )
  const chip = screen.getByRole("group", { name: "Mahsulot" })
  expect(within(chip).getByText("Dehqon")).toBeInTheDocument()
  expect(within(chip).getByText("kg")).toBeInTheDocument()
  expect(screen.getByText("Mahsulotni tanlang")).toBeInTheDocument()
})
