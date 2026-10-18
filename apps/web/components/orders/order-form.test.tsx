import { render, screen } from "@testing-library/react"
import { expect, test } from "vitest"
import { LinkedCustomerCard } from "./order-form"

test("the customer an order is for stands on a card of frosted glass, the way to let it go a small glass button", () => {
  render(<LinkedCustomerCard name="Dilshod Karimov" phone="998901112233" href="/customers/1" onUnlink={() => {}} />)
  const card = screen.getByRole("region", { name: "Mavjud mijoz" })
  expect(card).toHaveClass("surface", "rounded-group")
  expect(card).not.toHaveClass("bg-card")
  expect(screen.getByRole("button", { name: "Boshqa mijoz" })).toHaveClass("glass-chip", "text-primary")
  expect(screen.getByRole("button", { name: "Boshqa mijoz" })).not.toHaveClass("bg-primary-soft")
})
