import { render, screen } from "@testing-library/react"
import { expect, test } from "vitest"
import { SumBar } from "./sum-bar"

test("a sum bar sticks to the bottom of a form: its total at the left under its label, its button at the right", () => {
  render(
    <SumBar label="Jami" total="430 000 so'm">
      <button type="submit">Saqlash</button>
    </SumBar>,
  )
  const bar = screen.getByRole("button", { name: "Saqlash" }).closest('[data-slot="sum-bar"]')
  expect(bar).toHaveClass("sticky", "bottom-0", "flex", "justify-between", "shadow-float", "rounded-2xl", "md:rounded-lg")
  expect(screen.getByText("430 000 so'm")).toHaveClass("font-semibold", "tabular-nums")
  expect(screen.getByText("Jami")).toHaveClass("text-muted-foreground")
})
