import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { expect, test, vi } from "vitest"
import { Foot, Group, KeyValue, Row, SectionHeading } from "./group"

test("a group with a label is a list, its rows the items; a row with a way in is a link named by its title", () => {
  render(
    <Group label="Mijozlar" inset="icon">
      <Row href="/customers/1" media={<span>AV</span>} title="Ali Valiyev" sub="+998 90 123 45 67" end="2 buyurtma" />
      <Row href="/customers/2" title="Bahor Agro XK" />
    </Group>,
  )
  const list = screen.getByRole("list", { name: "Mijozlar" })
  expect(list).toHaveAttribute("data-inset", "icon")
  expect(within(list).getAllByRole("listitem")).toHaveLength(2)
  const link = within(list).getByRole("link", { name: /Ali Valiyev/ })
  expect(link).toHaveAttribute("href", "/customers/1")
  expect(link).toHaveTextContent("+998 90 123 45 67")
  expect(link).toHaveTextContent("2 buyurtma")
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
      <Row variant="link" onClick={() => {}} title="Barcha buyurtmalar" />
    </Group>,
  )
  expect(screen.getByRole("button", { name: "Mijozni o'chirish" })).toHaveAttribute("data-variant", "danger")
  expect(screen.getByRole("button", { name: "Barcha buyurtmalar" })).toHaveAttribute("data-variant", "link")
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

test("a row's parts read as words apart: the title, the line under it, the value and its line", () => {
  render(
    <Group label="Ro'yxat">
      <Row href="/customers/1" title="Ali Valiyev" sub="+998 90 123 45 67" end="12 000" endSub="so'm" />
    </Group>,
  )
  expect(screen.getByRole("link", { name: "Ali Valiyev +998 90 123 45 67 12 000 so'm" })).toBeInTheDocument()
})

test("a group is the prototype's flat card: 12px round on a phone, 10px with its rows 4px in on the web", () => {
  render(
    <Group label="Mijozlar">
      <Row title="Ali Valiyev" />
    </Group>,
  )
  const group = screen.getByRole("list", { name: "Mijozlar" })
  expect(group).toHaveClass("surface", "rounded-group", "md:rounded-lg", "md:p-1")
})

test("the hairline between rows starts 16px in whatever leads them, as the prototype's: a group sets no inset of its own", () => {
  render(
    <Group label="Sozlamalar" inset="tile">
      <Row title="Mijoz turlari" />
    </Group>,
  )
  expect(screen.getByRole("list", { name: "Sozlamalar" }).style.getPropertyValue("--inset")).toBe("")
})

test("a row is the prototype's: 52px with a 17px plain title on a phone, a 48px round row with a medium 13px one on the web", () => {
  render(
    <Group label="Mijozlar">
      <Row href="/customers/1" title="Ali Valiyev" sub="+998 90 123 45 67" />
    </Group>,
  )
  const row = screen.getByRole("link", { name: /Ali Valiyev/ })
  expect(row).toHaveClass("min-h-[52px]", "px-4", "md:min-h-12", "md:rounded-md", "md:px-3", "md:hover:bg-ink-1")
  expect(row.querySelector('[data-slot="row-title"]')).toHaveClass("font-normal", "md:font-medium")
  expect(row.querySelector('[data-slot="row-sub"]')).toHaveClass("text-md", "text-muted-foreground")
})

test("a key-value row names in the ink and answers in grey on a phone, the other way round on the web", () => {
  render(
    <Group as="dl">
      <KeyValue label="Telefon" value="+998 90 123 45 67" />
    </Group>,
  )
  expect(screen.getByRole("term")).toHaveClass("text-foreground", "md:text-muted-foreground")
  expect(screen.getByRole("definition")).toHaveClass("text-muted-foreground", "md:text-foreground")
})

test("a section heading is the prototype's group title: 13px grey on a phone, 12px medium on the web", () => {
  render(<SectionHeading>Umumiy holat</SectionHeading>)
  const heading = screen.getByRole("heading", { level: 2, name: "Umumiy holat" })
  expect(heading).toHaveClass("text-[13px]", "font-normal", "md:text-[12px]", "md:font-medium")
  expect(heading.closest('[data-slot="section-heading"]')).toHaveClass("text-muted-foreground", "px-4", "md:px-0")
})

test("a foot is the prototype's faint 12px note", () => {
  render(<Foot>Nofaol variant yangi tanlovlarda chiqmaydi.</Foot>)
  expect(screen.getByText("Nofaol variant yangi tanlovlarda chiqmaydi.")).toHaveClass("text-[12px]", "text-faint")
})
