import { screen, waitFor } from "@testing-library/react"
import { expect, test } from "vitest"
import { ALI, db, seedWarehouse } from "@/mocks/data"
import { toSupplier } from "@/mocks/warehouse"
import { renderWithProviders } from "@/test/render"
import { signIn } from "@/test/session"
import { SupplierActiveButton } from "./supplier-active-button"

test("a supplier is turned off, and the button says so", async () => {
  const { bozor } = seedWarehouse()
  await signIn(ALI)
  const { user } = renderWithProviders(<SupplierActiveButton companyId={1} supplier={toSupplier(bozor, true)} />)

  await user.click(screen.getByRole("button", { name: "Nofaol qilish" }))

  await waitFor(() => expect(db.suppliers.find((s) => s.id === bozor.id)?.active).toBe(false))
  expect(await screen.findByText("Ta'minotchi nofaol qilindi")).toBeInTheDocument()
})

test("an inactive supplier offers to turn it on, from the row by its icon", async () => {
  const { dehqon } = seedWarehouse()
  await signIn(ALI)
  const { user } = renderWithProviders(<SupplierActiveButton companyId={1} supplier={toSupplier(dehqon, true)} iconOnly />)

  await user.click(screen.getByRole("button", { name: "Faollashtirish: Dehqon" }))

  await waitFor(() => expect(db.suppliers.find((s) => s.id === dehqon.id)?.active).toBe(true))
  expect(await screen.findByText("Ta'minotchi faollashtirildi")).toBeInTheDocument()
})
