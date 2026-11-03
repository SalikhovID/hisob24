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


test("a chip is the prototype's: white on a phone, ringed on the web; on, the accent on a phone and the ink on the web", () => {
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
  const off = screen.getByRole("button", { name: "Nofaol" })
  expect(off).toHaveClass("h-8", "px-3.5", "text-[15px]", "md:h-7", "md:px-3", "md:text-[12.5px]", "bg-card", "md:shadow-[0_0_0_1px_var(--ink-4)]")
  const on = screen.getByRole("button", { name: "Faol" })
  expect(on).toHaveClass("bg-primary", "text-primary-foreground", "md:bg-foreground", "md:text-background")
  expect(on).not.toHaveClass("bg-card")
})

test("a choice chip is the same: the chosen one the accent on a phone and the ink on the web", () => {
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
  expect(screen.getByRole("radio", { name: "Nofaol" })).toHaveClass("not-data-checked:bg-card", "data-checked:bg-primary", "md:data-checked:bg-foreground")
})

test("on a phone the strip scrolls out to the page's edges; on a wide screen it stays in the page's column", () => {
  render(
    <Chips label="Turlar">
      <Chip pressed={false} onClick={() => {}}>
        Hammasi
      </Chip>
    </Chips>,
  )
  expect(screen.getByRole("group", { name: "Turlar" })).toHaveClass("-mx-4", "px-4", "md:mx-0", "md:px-0")
})
