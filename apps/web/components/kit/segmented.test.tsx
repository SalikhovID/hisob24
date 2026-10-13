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
