import { screen, waitFor } from "@testing-library/react"
import { expect, test } from "vitest"
import { toProduct } from "@/mocks/catalog"
import { ALI, db, seedCatalog } from "@/mocks/data"
import { renderWithProviders } from "@/test/render"
import { signIn } from "@/test/session"
import { ActiveButton } from "./active-button"

test("a product is turned off and on again, and the button says which", async () => {
  const { olma } = seedCatalog()
  await signIn(ALI)
  const { user } = renderWithProviders(<ActiveButton companyId={1} product={toProduct(olma)} />)

  await user.click(screen.getByRole("button", { name: "Nofaol qilish" }))

  await waitFor(() => expect(db.products.find((p) => p.id === olma.id)?.active).toBe(false))
  expect(await screen.findByText("Mahsulot nofaol qilindi")).toBeInTheDocument()
})

test("an inactive service offers to turn it on, from the row by its icon", async () => {
  const { yetkazish } = seedCatalog()
  yetkazish.active = false
  await signIn(ALI)
  const { user } = renderWithProviders(<ActiveButton companyId={1} product={toProduct(yetkazish)} iconOnly />)

  await user.click(screen.getByRole("button", { name: "Faollashtirish: Yetkazish" }))

  await waitFor(() => expect(db.products.find((p) => p.id === yetkazish.id)?.active).toBe(true))
  expect(await screen.findByText("Xizmat faollashtirildi")).toBeInTheDocument()
})
