import { screen, waitFor, within } from "@testing-library/react"
import { type ComponentProps, useState } from "react"
import { expect, test } from "vitest"
import { toProduct } from "@/mocks/catalog"
import { ALI, db, seedCatalog } from "@/mocks/data"
import { renderWithProviders } from "@/test/render"
import { signIn } from "@/test/session"
import { ServiceDialog } from "./service-dialog"

// Opened is the sheet as the list opens it (its round + or a service's
// «Tahrirlash»): open from the start, closed when it says so.
function Opened(props: Omit<ComponentProps<typeof ServiceDialog>, "open" | "onOpenChange">) {
  const [open, setOpen] = useState(true)
  return <ServiceDialog {...props} open={open} onOpenChange={setOpen} />
}

test("a service is entered with its name and price; no unit, no SKU", async () => {
  await signIn(ALI)
  const { user } = renderWithProviders(<Opened companyId={1} />)

  const dialog = await screen.findByRole("dialog", { name: "Xizmat qo'shish" })
  expect(within(dialog).getByText("Nom majburiy; narx va izoh ixtiyoriy.")).toBeInTheDocument()
  expect(within(dialog).getByLabelText("Nomi")).toHaveAttribute("placeholder", "Masalan, Yetkazib berish")
  expect(within(dialog).getByLabelText("Narx")).toHaveAttribute("placeholder", "ixtiyoriy")
  expect(within(dialog).getByLabelText("Izoh")).toHaveAttribute("placeholder", "ixtiyoriy")
  expect(within(dialog).queryByLabelText("Birlik")).not.toBeInTheDocument()
  expect(within(dialog).queryByLabelText("Artikul")).not.toBeInTheDocument()
  await user.type(within(dialog).getByLabelText("Nomi"), "Ta'mirlash")
  await user.type(within(dialog).getByLabelText("Narx"), "30000")
  await user.click(within(dialog).getByRole("button", { name: "Qo'shish" }))

  await waitFor(() => expect(db.products.find((p) => p.name === "Ta'mirlash")).toMatchObject({ kind: "service", unit: null, sku: null, price: "30000.00" }))
  expect(await screen.findByText("Xizmat qo'shildi")).toBeInTheDocument()
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument())
})

test("a service is edited from its fields as they are", async () => {
  const { yetkazish } = seedCatalog()
  await signIn(ALI)
  const { user } = renderWithProviders(<Opened companyId={1} service={toProduct(yetkazish)} />)

  const dialog = await screen.findByRole("dialog", { name: "Xizmatni tahrirlash" })
  expect(within(dialog).getByLabelText("Nomi")).toHaveValue("Yetkazish")
  await user.clear(within(dialog).getByLabelText("Narx"))
  await user.type(within(dialog).getByLabelText("Narx"), "55 000")
  await user.click(within(dialog).getByRole("button", { name: "Saqlash" }))

  await waitFor(() => expect(db.products.find((p) => p.id === yetkazish.id)?.price).toBe("55000.00"))
  expect(await screen.findByText("Xizmat saqlandi")).toBeInTheDocument()
})
