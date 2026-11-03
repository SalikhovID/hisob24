import { render, screen } from "@testing-library/react"
import { expect, test } from "vitest"
import { Toolbar } from "./toolbar"

test("a toolbar holds a list's search at the left and its filters at the right on the web, one over the other on a phone", () => {
  render(
    <Toolbar end={<span>Barchasi</span>}>
      <input aria-label="Qidirish" />
    </Toolbar>,
  )
  const bar = screen.getByRole("textbox", { name: "Qidirish" }).closest('[data-slot="toolbar"]')
  expect(bar).toHaveClass("grid", "md:flex", "md:items-center", "md:justify-between")
  expect(screen.getByText("Barchasi").parentElement).toHaveAttribute("data-slot", "toolbar-end")
})
