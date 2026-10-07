import { screen, waitFor, within } from "@testing-library/react"
import { expect, test } from "vitest"
import { toProduct } from "@/mocks/catalog"
import { ALI, db, seedCatalog } from "@/mocks/data"
import { renderWithProviders } from "@/test/render"
import { signIn } from "@/test/session"
import { ServiceDialog } from "./service-dialog"

test("a service is entered with its name and price; no unit, no SKU", async () => {
  await signIn(ALI)
  const { user } = renderWithProviders(<ServiceDialog companyId={1} />)

  await user.click(screen.getByRole("button", { name: "Xizmat qo'shish" }))
  const dialog = await screen.findByRole("dialog", { name: "Xizmat qo'shish" })
  expect(within(dialog).queryByLabelText("Birlik")).not.toBeInTheDocument()
  expect(within(dialog).queryByLabelText("Artikul")).not.toBeInTheDocument()
  await user.type(within(dialog).getByLabelText("Nomi"), "Ta'mirlash")
  await user.type(within(dialog).getByLabelText("Narx"), "30000")
  await user.click(within(dialog).getByRole("button", { name: "Qo'shish" }))

  await waitFor(() => expect(db.products.find((p) => p.name === "Ta'mirlash")).toMatchObject({ kind: "service", unit: null, sku: null, price: "30000.00" }))
  expect(await screen.findByText("Xizmat qo'shildi")).toBeInTheDocument()
})

test("a service is edited from the row, by its icon", async () => {
  const { yetkazish } = seedCatalog()
  await signIn(ALI)
  const { user } = renderWithProviders(<ServiceDialog companyId={1} service={toProduct(yetkazish)} iconOnly />)

  await user.click(screen.getByRole("button", { name: "Tahrirlash: Yetkazish" }))
  const dialog = await screen.findByRole("dialog", { name: "Xizmatni tahrirlash" })
  await user.clear(within(dialog).getByLabelText("Narx"))
  await user.type(within(dialog).getByLabelText("Narx"), "55 000")
  await user.click(within(dialog).getByRole("button", { name: "Saqlash" }))

  await waitFor(() => expect(db.products.find((p) => p.id === yetkazish.id)?.price).toBe("55000.00"))
  expect(await screen.findByText("Xizmat saqlandi")).toBeInTheDocument()
})
