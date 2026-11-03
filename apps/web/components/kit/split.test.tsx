import { render, screen } from "@testing-library/react"
import { expect, test } from "vitest"
import { Split } from "./split"

test("a split puts a list beside its record on the web (280px and the rest), one over the other on a phone", () => {
  render(<Split aside={<p>Turlar</p>}>Maydonlar</Split>)
  const split = screen.getByText("Turlar").closest('[data-slot="split"]')
  expect(split).toHaveClass("grid", "md:grid-cols-[280px_minmax(0,1fr)]", "md:items-start")
  expect(screen.getByText("Turlar").parentElement).toHaveAttribute("data-slot", "split-aside")
  expect(screen.getByText("Maydonlar")).toHaveAttribute("data-slot", "split-main")
})
