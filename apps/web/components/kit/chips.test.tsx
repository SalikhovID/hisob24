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

const onRing = "shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--primary)_22%,transparent)]"

test("a chip is the prototype's small glass; on, it is the accent's tint with a faint ring of it", () => {
  render(
    <Chips>
      <Chip pressed onClick={() => {}}>
        Faol
      </Chip>
      <Chip pressed={false} onClick={() => {}}>
        Nofaol
      </Chip>
    </Chips>,
  )
  expect(screen.getByRole("button", { name: "Nofaol" })).toHaveClass("glass-chip")
  const on = screen.getByRole("button", { name: "Faol" })
  expect(on).toHaveClass("bg-primary-soft", onRing)
  expect(on).not.toHaveClass("glass-chip")
})

test("a choice chip is the same glass, the chosen one the accent's tint with its ring", () => {
  render(
    <ChoiceChips
      label="Holat"
      value="a"
      onChange={() => {}}
      options={[
        { value: "a", label: "Faol" },
        { value: "b", label: "Nofaol" },
      ]}
    />,
  )
  expect(screen.getByRole("radio", { name: "Nofaol" })).toHaveClass("not-data-checked:glass-chip", "data-checked:bg-primary-soft", `data-checked:${onRing}`)
})
