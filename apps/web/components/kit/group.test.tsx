import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { expect, test, vi } from "vitest"
import { Foot, Group, KeyValue, Row, SectionHeading } from "./group"

test("a group with a label is a list, its rows the items; a row with a way in is a link named by its title", () => {
  render(
    <Group label="Mijozlar" inset="icon">
      <Row href="/customers/1" media={<span>AV</span>} title="Ali Valiyev" sub="+998 90 123 45 67" end="2 vazifa" />
      <Row href="/customers/2" title="Bahor Agro XK" />
    </Group>,
  )
  const list = screen.getByRole("list", { name: "Mijozlar" })
  expect(list).toHaveAttribute("data-inset", "icon")
  expect(within(list).getAllByRole("listitem")).toHaveLength(2)
  const link = within(list).getByRole("link", { name: /Ali Valiyev/ })
  expect(link).toHaveAttribute("href", "/customers/1")
  expect(link).toHaveTextContent("+998 90 123 45 67")
  expect(link).toHaveTextContent("2 vazifa")
  // The chevron is decoration.
  expect(link.querySelector("svg")).toHaveAttribute("aria-hidden", "true")
})

test("a row that does something is a button; a plain row is neither", async () => {
  const open = vi.fn()
  render(
    <Group>
      <Row onClick={open} title="Lokatsiya" end="Chilonzor" />
      <Row title="Telefon" end="+998 90 123 45 67" />
    </Group>,
  )
  await userEvent.click(screen.getByRole("button", { name: /Lokatsiya/ }))
  expect(open).toHaveBeenCalledTimes(1)
  expect(screen.queryByRole("list")).not.toBeInTheDocument()
  expect(screen.getAllByRole("button")).toHaveLength(1)
})

test("a danger row is centered red text, a link row the accent, both buttons", () => {
  render(
    <Group>
      <Row variant="danger" onClick={() => {}} title="Mijozni o'chirish" />
      <Row variant="link" onClick={() => {}} title="Barcha vazifalar" />
    </Group>,
  )
  expect(screen.getByRole("button", { name: "Mijozni o'chirish" })).toHaveAttribute("data-variant", "danger")
  expect(screen.getByRole("button", { name: "Barcha vazifalar" })).toHaveAttribute("data-variant", "link")
})

test("a key-value row shows a dash for a value that is not there", () => {
  render(
    <Group as="dl">
      <KeyValue label="Izoh" value="" />
      <KeyValue label="Birlik" value="kg" />
    </Group>,
  )
  const terms = screen.getAllByRole("term")
  expect(terms.map((term) => term.textContent)).toEqual(["Izoh", "Birlik"])
  expect(screen.getAllByRole("definition").map((d) => d.textContent)).toEqual(["—", "kg"])
})

test("a section heading is a heading with a hint or an action beside it; a foot is a note", () => {
  render(
    <>
      <SectionHeading hint="Jami: 5">Yaqin muddatlar</SectionHeading>
      <SectionHeading action={<button type="button">Tartiblash</button>}>Maydonlar</SectionHeading>
      <Foot>Nofaol variant yangi tanlovlarda chiqmaydi.</Foot>
    </>,
  )
  expect(screen.getByRole("heading", { level: 2, name: "Yaqin muddatlar" })).toBeInTheDocument()
  expect(screen.getByText("Jami: 5")).toBeInTheDocument()
  expect(screen.getByRole("button", { name: "Tartiblash" })).toBeInTheDocument()
  expect(screen.getByText("Nofaol variant yangi tanlovlarda chiqmaydi.")).toHaveAttribute("data-slot", "foot")
})
