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

test("the segmented control is the prototype's: a faint track 2px round its segments, the chosen one white and ringed, its word in the ink", () => {
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
  expect(list).toHaveClass("bg-muted", "p-0.5", "rounded-[9px]", "md:rounded-lg")
  const thumb = list.querySelector('[data-slot="segmented-thumb"]')
  expect(thumb).toHaveClass("bg-(--seg-thumb)", "shadow-(--seg-shadow)", "rounded-[7px]", "md:rounded-md")
  const tab = screen.getByRole("tab", { name: "Kanban" })
  expect(tab).toHaveClass("min-h-8", "text-[13px]", "md:min-h-7", "md:text-[12.5px]", "text-muted-foreground", "data-active:text-foreground")
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
