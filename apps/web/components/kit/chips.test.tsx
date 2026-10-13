import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { expect, test, vi } from "vitest"
import { Chip, Chips, ChoiceChips } from "./chips"

test("choice chips are one choice among several, the chosen one checked", async () => {
  const choose = vi.fn()
  render(
    <ChoiceChips
      label="Mijoz turi"
      value="all"
      onChange={choose}
      options={[
        { value: "all", label: "Barchasi" },
        { value: "1", label: "Jismoniy", count: 8 },
        { value: "2", label: "Yuridik", count: 2 },
      ]}
    />,
  )
  const group = screen.getByRole("radiogroup", { name: "Mijoz turi" })
  expect(group).toBeInTheDocument()
  expect(screen.getByRole("radio", { name: "Barchasi" })).toHaveAttribute("aria-checked", "true")
  await userEvent.click(screen.getByRole("radio", { name: "Jismoniy 8" }))
  expect(choose).toHaveBeenCalledWith("1")
})

test("a chip is a toggle button, pressed when on, and may open something with a chevron", async () => {
  const open = vi.fn()
  render(
    <Chips label="Filtrlar">
      <Chip pressed onClick={() => {}}>
        Faol
      </Chip>
      <Chip pressed={false} chevron onClick={open}>
        Barcha mas&apos;ullar
      </Chip>
    </Chips>,
  )
  expect(screen.getByRole("group", { name: "Filtrlar" })).toBeInTheDocument()
  expect(screen.getByRole("button", { name: "Faol" })).toHaveAttribute("aria-pressed", "true")
  const picker = screen.getByRole("button", { name: "Barcha mas'ullar" })
  expect(picker).toHaveAttribute("aria-pressed", "false")
  expect(picker.querySelector("svg")).toHaveAttribute("aria-hidden", "true")
  await userEvent.click(picker)
  expect(open).toHaveBeenCalledTimes(1)
})
