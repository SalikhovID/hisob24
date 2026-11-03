import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { PencilIcon, Trash2Icon } from "lucide-react"
import { expect, test, vi } from "vitest"
import { PageAction, PageActions } from "./page-actions"

test("a record's actions are buttons named in full, a press does the action", async () => {
  const edit = vi.fn()
  render(
    <PageActions>
      <PageAction icon={PencilIcon} label="Tahrirlash" onClick={edit} />
      <PageAction icon={Trash2Icon} label="O'chirish" variant="ghost" iconOnly onClick={() => {}} />
    </PageActions>,
  )
  await userEvent.click(screen.getByRole("button", { name: "Tahrirlash" }))
  expect(edit).toHaveBeenCalledTimes(1)
  expect(screen.getByRole("button", { name: "O'chirish" })).toBeInTheDocument()
})

test("on the web an action is the prototype's button, its icon beside its name (or the icon alone); on a phone every action is the prototype's tile under the title: its icon in an accent circle over its name, a danger one's red", () => {
  const { container } = render(
    <PageActions>
      <PageAction icon={PencilIcon} label="Tahrirlash" onClick={() => {}} />
      <PageAction icon={Trash2Icon} label="O'chirish" variant="danger" iconOnly onClick={() => {}} />
    </PageActions>,
  )
  const row = container.querySelector('[data-slot="page-actions"]') as HTMLElement
  expect(row).toHaveClass("max-md:grid", "max-md:w-full")
  expect(row.style.getPropertyValue("--n")).toBe("2")
  const edit = screen.getByRole("button", { name: "Tahrirlash" })
  expect(edit).toHaveClass("max-md:flex-col", "max-md:rounded-group", "max-md:text-[12px]")
  expect(edit.querySelector('[data-slot="action-icon"]')).toHaveClass("max-md:size-9", "max-md:rounded-full", "max-md:bg-primary")
  expect(screen.getByText("Tahrirlash")).not.toHaveClass("max-md:sr-only")
  // An icon alone on the web says its name on a phone's tile.
  expect(screen.getByText("O'chirish")).toHaveClass("md:sr-only")
  expect(screen.getByRole("button", { name: "O'chirish" }).querySelector('[data-slot="action-icon"]')).toHaveClass("max-md:bg-destructive")
})

test("a primary action is the accent on the web; an action may lead somewhere, a call by a plain link", () => {
  render(
    <PageActions>
      <PageAction label="To'lov berish" variant="primary" onClick={() => {}} />
      <PageAction icon={PencilIcon} label="Tahrirlash" href="/customers/1/edit" />
      <PageAction icon={PencilIcon} label="Qo'ng'iroq" href="tel:+998911112233" />
    </PageActions>,
  )
  expect(screen.getByRole("button", { name: "To'lov berish" })).toHaveClass("bg-primary")
  expect(screen.getByRole("link", { name: "Tahrirlash" })).toHaveAttribute("href", "/customers/1/edit")
  expect(screen.getByRole("link", { name: "Qo'ng'iroq" })).toHaveAttribute("href", "tel:+998911112233")
})

test("the actions are a group named «Amallar», as the record pages' tiles were", () => {
  render(
    <PageActions>
      <PageAction label="Tahrirlash" icon={PencilIcon} onClick={() => {}} />
    </PageActions>,
  )

  expect(within(screen.getByRole("group", { name: "Amallar" })).getByRole("button", { name: "Tahrirlash" })).toBeInTheDocument()
})

test("on a phone an action that is its icon alone on the web is a whole tile like the others, its name under its icon", () => {
  render(
    <PageActions>
      <PageAction label="Tahrirlash" icon={PencilIcon} />
      <PageAction label="O'chirish" icon={Trash2Icon} variant="danger" iconOnly />
    </PageActions>,
  )

  expect(screen.getByRole("button", { name: "O'chirish" })).toHaveClass("max-md:w-auto")
})
