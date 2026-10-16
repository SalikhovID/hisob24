import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { PencilIcon, PhoneIcon, Trash2Icon } from "lucide-react"
import { expect, test, vi } from "vitest"
import { DetailHead, Tile, Tiles } from "./detail-head"

test("a detail head names the record, with its mark and badges outside the heading", () => {
  render(
    <DetailHead media={<span aria-hidden="true">AV</span>} title="Ali Valiyev" description="Jismoniy · +998 90 123 45 67" badges={<span>Nofaol</span>} />,
  )
  const heading = screen.getByRole("heading", { level: 1, name: "Ali Valiyev" })
  expect(heading).toHaveTextContent(/^Ali Valiyev$/)
  expect(screen.getByText("Jismoniy · +998 90 123 45 67")).toBeInTheDocument()
  expect(screen.getByText("Nofaol")).toBeInTheDocument()
})

test("in a sheet over a page the head's name is a second-level heading: the page keeps its own", () => {
  render(<DetailHead title="Vali Aliyev" description="+998 90 222 33 44" heading="h2" />)
  expect(screen.getByRole("heading", { level: 2, name: "Vali Aliyev" })).toBeInTheDocument()
  expect(screen.queryByRole("heading", { level: 1 })).not.toBeInTheDocument()
})

test("the tiles are the record's actions: buttons, a link to call, a red one to delete", async () => {
  const edit = vi.fn()
  render(
    <Tiles>
      <Tile icon={PencilIcon} label="Tahrirlash" onClick={edit} />
      <Tile icon={PhoneIcon} label="Qo'ng'iroq" href="tel:+998901234567" />
      {false}
      <Tile icon={Trash2Icon} label="O'chirish" onClick={() => {}} danger />
    </Tiles>,
  )
  const group = screen.getByRole("group", { name: "Amallar" })
  // Three tiles share the width: the false child does not count.
  expect(group.style.getPropertyValue("--n")).toBe("3")
  await userEvent.click(within(group).getByRole("button", { name: "Tahrirlash" }))
  expect(edit).toHaveBeenCalledTimes(1)
  expect(within(group).getByRole("link", { name: "Qo'ng'iroq" })).toHaveAttribute("href", "tel:+998901234567")
  expect(within(group).getByRole("button", { name: "O'chirish" })).toHaveAttribute("data-danger", "true")
})

test("a tile is frosted glass with a glossy round icon, flat on it with no glow; a red tile's icon is the red gradient", () => {
  render(
    <Tiles>
      <Tile icon={PencilIcon} label="Tahrirlash" onClick={() => {}} />
      <Tile icon={Trash2Icon} label="O'chirish" onClick={() => {}} danger />
    </Tiles>,
  )
  const edit = screen.getByRole("button", { name: "Tahrirlash" })
  expect(edit).toHaveClass("surface", "rounded-tile")
  expect(edit).not.toHaveClass("bg-card")
  const icon = edit.querySelector("[aria-hidden=true]")
  expect(icon).toHaveClass("bg-primary", "bg-(image:--btn)", "text-primary-foreground")
  expect(icon).not.toHaveClass("glossy")
  const red = screen.getByRole("button", { name: "O'chirish" }).querySelector("[aria-hidden=true]")
  expect(red).toHaveClass("bg-[linear-gradient(180deg,#F2847A,#CF3F37)]", "text-white")
  expect(red).not.toHaveClass("glossy-red")
})

test("the tiles share the row alike; on a wide screen they keep to 680px, as the prototype's web view", () => {
  render(
    <Tiles>
      <Tile icon={PencilIcon} label="Tahrirlash" onClick={() => {}} />
      <Tile icon={Trash2Icon} label="O'chirish" onClick={() => {}} danger />
    </Tiles>,
  )
  const tiles = screen.getByRole("group", { name: "Amallar" })
  expect(tiles).toHaveClass("grid-cols-[repeat(var(--n),minmax(0,1fr))]", "md:max-w-[680px]")
  expect(tiles).not.toHaveClass("md:grid-cols-[repeat(var(--n),minmax(0,10rem))]")
})
