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

test("on the web an action says its name beside its icon (unless it is an icon alone); on a phone it is a 36px round icon", () => {
  render(
    <PageActions>
      <PageAction icon={PencilIcon} label="Tahrirlash" onClick={() => {}} />
      <PageAction icon={Trash2Icon} label="O'chirish" variant="ghost" iconOnly onClick={() => {}} />
    </PageActions>,
  )
  const edit = screen.getByRole("button", { name: "Tahrirlash" })
  expect(edit).toHaveClass("max-md:size-9", "max-md:rounded-full", "max-md:p-0")
  expect(screen.getByText("Tahrirlash")).toHaveClass("max-md:sr-only")
  expect(screen.getByText("O'chirish")).toHaveClass("sr-only")
})

test("a primary action is the accent and keeps its words on a phone; an action may be a link", () => {
  render(
    <PageActions>
      <PageAction label="To'lov berish" variant="primary" onClick={() => {}} />
      <PageAction icon={PencilIcon} label="Tahrirlash" href="/customers/1/edit" />
    </PageActions>,
  )
  const pay = screen.getByRole("button", { name: "To'lov berish" })
  expect(pay).toHaveClass("bg-primary")
  expect(pay).not.toHaveClass("max-md:size-9")
  expect(screen.getByRole("link", { name: "Tahrirlash" })).toHaveAttribute("href", "/customers/1/edit")
})

test("the actions are a group named «Amallar», as the record pages' tiles were", () => {
  render(
    <PageActions>
      <PageAction label="Tahrirlash" icon={PencilIcon} onClick={() => {}} />
    </PageActions>,
  )

  expect(within(screen.getByRole("group", { name: "Amallar" })).getByRole("button", { name: "Tahrirlash" })).toBeInTheDocument()
})
