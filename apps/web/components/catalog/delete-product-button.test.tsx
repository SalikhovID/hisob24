import { screen, waitFor, within } from "@testing-library/react"
import { expect, test, vi } from "vitest"
import { toProduct } from "@/mocks/catalog"
import { ALI, db, seedCatalog } from "@/mocks/data"
import { renderWithProviders } from "@/test/render"
import { signIn } from "@/test/session"
import { DeleteProductButton } from "./delete-product-button"

test("a product is deleted after asking, and the caller is told", async () => {
  const { olma } = seedCatalog()
  const afterDelete = vi.fn()
  await signIn(ALI)
  const { user } = renderWithProviders(<DeleteProductButton companyId={1} product={toProduct(olma)} afterDelete={afterDelete} />)

  await user.click(screen.getByRole("button", { name: "O'chirish" }))
  const dialog = await screen.findByRole("alertdialog", { name: "Mahsulotni o'chirasizmi?" })
  expect(within(dialog).getByText("Olma ro'yxatdan olib tashlanadi. Qayta tiklab bo'lmaydi.")).toBeInTheDocument()
  await user.click(within(dialog).getByRole("button", { name: "O'chirish" }))

  await waitFor(() => expect(db.products.find((p) => p.id === olma.id)?.deleted).toBe(true))
  expect(await screen.findByText("Mahsulot o'chirildi")).toBeInTheDocument()
  await waitFor(() => expect(afterDelete).toHaveBeenCalledOnce())
})

test("a service is deleted from the row, by its icon", async () => {
  const { yetkazish } = seedCatalog()
  await signIn(ALI)
  const { user } = renderWithProviders(<DeleteProductButton companyId={1} product={toProduct(yetkazish)} iconOnly />)

  await user.click(screen.getByRole("button", { name: "O'chirish: Yetkazish" }))
  await user.click(within(await screen.findByRole("alertdialog", { name: "Xizmatni o'chirasizmi?" })).getByRole("button", { name: "O'chirish" }))

  await waitFor(() => expect(db.products.find((p) => p.id === yetkazish.id)?.deleted).toBe(true))
  expect(await screen.findByText("Xizmat o'chirildi")).toBeInTheDocument()
})
