import { render, screen } from "@testing-library/react"
import { expect, test } from "vitest"
import { ProductStock } from "./product-stock"

test("a location's stock is a card of frosted glass", () => {
  render(<ProductStock stock={[{ location_id: 1, location_name: "Asosiy", quantity: "4.000" }]} unit="kg" currentId={1} />)
  const card = screen.getByText("Asosiy").closest("dt")!.parentElement
  expect(card).toHaveClass("surface", "rounded-group")
  expect(card).not.toHaveClass("bg-card")
})
