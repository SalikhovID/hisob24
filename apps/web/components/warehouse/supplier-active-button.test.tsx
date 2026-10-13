import { screen, waitFor } from "@testing-library/react"
import { expect, test } from "vitest"
import { ALI, db, seedWarehouse } from "@/mocks/data"
import { toSupplier } from "@/mocks/warehouse"
import { renderWithProviders } from "@/test/render"
import { signIn } from "@/test/session"
import { SupplierActiveButton } from "./supplier-active-button"

test("a supplier is turned off from the accent row at its page's foot, and the row says so", async () => {
  const { bozor } = seedWarehouse()
  await signIn(ALI)
  const { user } = renderWithProviders(<SupplierActiveButton companyId={1} supplier={toSupplier(bozor, true)} />)

  const row = screen.getByRole("button", { name: "Nofaol qilish" })
  expect(row).toHaveAttribute("data-variant", "accent")
  await user.click(row)

  await waitFor(() => expect(db.suppliers.find((s) => s.id === bozor.id)?.active).toBe(false))
  expect(await screen.findByText("Ta'minotchi nofaol qilindi")).toBeInTheDocument()
})

test("an inactive supplier's row turns it on", async () => {
  const { dehqon } = seedWarehouse()
  await signIn(ALI)
  const { user } = renderWithProviders(<SupplierActiveButton companyId={1} supplier={toSupplier(dehqon, true)} />)

  await user.click(screen.getByRole("button", { name: "Faollashtirish" }))

  await waitFor(() => expect(db.suppliers.find((s) => s.id === dehqon.id)?.active).toBe(true))
  expect(await screen.findByText("Ta'minotchi faollashtirildi")).toBeInTheDocument()
})
