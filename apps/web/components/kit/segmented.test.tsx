import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { expect, test, vi } from "vitest"
import { Segmented } from "./segmented"

test("a segmented control is a tab list; the chosen segment is selected and a press chooses another", async () => {
  const change = vi.fn()
  render(
    <Segmented
      label="Ko'rinish"
      value="board"
      onChange={change}
      options={[
        { value: "board", label: "Kanban" },
        { value: "list", label: "Ro'yxat" },
      ]}
    />,
  )
  const list = screen.getByRole("tablist", { name: "Ko'rinish" })
  expect(list.style.getPropertyValue("--n")).toBe("2")
  expect(screen.getByRole("tab", { name: "Kanban" })).toHaveAttribute("aria-selected", "true")
  expect(screen.getByRole("tab", { name: "Ro'yxat" })).toHaveAttribute("aria-selected", "false")
  await userEvent.click(screen.getByRole("tab", { name: "Ro'yxat" }))
  expect(change).toHaveBeenCalledWith("list")
})

test("the segmented control is the prototype's: a recessed track and its thumb, the chosen word in the thumb's ink", () => {
  render(
    <Segmented
      label="Ko'rinish"
      value="board"
      onChange={() => {}}
      options={[
        { value: "board", label: "Kanban" },
        { value: "list", label: "Ro'yxat" },
      ]}
    />,
  )
  const list = screen.getByRole("tablist", { name: "Ko'rinish" })
  expect(list).toHaveClass("bg-muted", "shadow-[inset_0_1px_2px_rgba(60,40,120,.06)]")
  const thumb = list.querySelector('[data-slot="segmented-thumb"]')
  expect(thumb).toHaveClass("bg-(--seg-thumb)", "shadow-(--seg-shadow)")
  expect(thumb).not.toHaveClass("bg-card")
  expect(screen.getByRole("tab", { name: "Kanban" })).toHaveClass("data-active:text-(--seg-on)")
})

test("on a wide screen the segmented control keeps to 420px, as the prototype's web view", () => {
  render(
    <Segmented
      label="Ko'rinish"
      value="board"
      onChange={() => {}}
      options={[
        { value: "board", label: "Kanban" },
        { value: "list", label: "Ro'yxat" },
      ]}
    />,
  )
  expect(screen.getByRole("tablist", { name: "Ko'rinish" }).parentElement).toHaveClass("md:max-w-[420px]")
})
