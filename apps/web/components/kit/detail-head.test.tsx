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
