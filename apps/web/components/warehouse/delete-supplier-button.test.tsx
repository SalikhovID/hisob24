import { screen, waitFor, within } from "@testing-library/react"
import { expect, test, vi } from "vitest"
import { ALI, db, seedCatalog, seedWarehouse } from "@/mocks/data"
import { toSupplier } from "@/mocks/warehouse"
import { renderWithProviders } from "@/test/render"
import { signIn } from "@/test/session"
import { DeleteSupplierButton } from "./delete-supplier-button"

test("a supplier with a purchase is kept: the API's refusal is told", async () => {
  const { bozor } = seedWarehouse(seedCatalog())
  await signIn(ALI)
  const { user } = renderWithProviders(<DeleteSupplierButton companyId={1} supplier={toSupplier(bozor, true)} />)

  const row = screen.getByRole("button", { name: "Ta'minotchini o'chirish" })
  expect(row).toHaveAttribute("data-variant", "danger")
  await user.click(row)
  const dialog = await screen.findByRole("alertdialog", { name: "Ta'minotchini o'chirasizmi?" })
  expect(within(dialog).getByText("Bozor ro'yxatdan olib tashlanadi. Qayta tiklab bo'lmaydi.")).toBeInTheDocument()
  await user.click(within(dialog).getByRole("button", { name: "O'chirish" }))

  expect(await screen.findByText("Bu ta'minotchida 2 ta hujjat bor")).toBeInTheDocument()
  expect(db.suppliers.find((s) => s.id === bozor.id)?.deleted).toBeUndefined()
})

test("a supplier is deleted from its danger row, and the caller is told", async () => {
  const { dehqon } = seedWarehouse()
  const afterDelete = vi.fn()
  await signIn(ALI)
  const { user } = renderWithProviders(<DeleteSupplierButton companyId={1} supplier={toSupplier(dehqon, true)} afterDelete={afterDelete} />)

  await user.click(screen.getByRole("button", { name: "Ta'minotchini o'chirish" }))
  await user.click(within(await screen.findByRole("alertdialog", { name: "Ta'minotchini o'chirasizmi?" })).getByRole("button", { name: "O'chirish" }))

  await waitFor(() => expect(db.suppliers.find((s) => s.id === dehqon.id)?.deleted).toBe(true))
  expect(await screen.findByText("Ta'minotchi o'chirildi")).toBeInTheDocument()
  await waitFor(() => expect(afterDelete).toHaveBeenCalledOnce())
})
