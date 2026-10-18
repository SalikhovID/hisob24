import { render, screen } from "@testing-library/react"
import { expect, test } from "vitest"
import { DeadlineCard } from "./deadline-card"

test("the deadline card is frosted glass, 22px round", () => {
  render(<DeadlineCard deadline="2026-10-20" done={false} />)
  const card = screen.getByRole("region", { name: "Muddat" })
  expect(card).toHaveClass("surface", "rounded-[22px]")
  expect(card).not.toHaveClass("bg-card")
})
