import { screen, waitFor, within } from "@testing-library/react"
import { type ComponentProps, useState } from "react"
import { expect, test } from "vitest"
import { toProduct } from "@/mocks/catalog"
import { ALI, db, seedCatalog } from "@/mocks/data"
import { renderWithProviders } from "@/test/render"
import { choose } from "@/test/select"
import { signIn } from "@/test/session"
import { ProductDialog } from "./product-dialog"

// Opened is the sheet as a page opens it (its round + or its «Tahrirlash»
// tile): open from the start, closed when it says so.
function Opened(props: Omit<ComponentProps<typeof ProductDialog>, "open" | "onOpenChange">) {
  const [open, setOpen] = useState(true)
  return <ProductDialog {...props} open={open} onOpenChange={setOpen} />
}

test("a product is entered with its unit, its price typed the Uzbek way, and its SKU", async () => {
  await signIn(ALI)
  const { user } = renderWithProviders(<Opened companyId={1} />)

  const dialog = await screen.findByRole("dialog", { name: "Mahsulot qo'shish" })
  await user.type(within(dialog).getByLabelText("Nomi"), " Anor ")
  // The unit is chosen in a sheet of its own, from its row.
  await choose(user, within(dialog).getByLabelText("Birlik"), "kg")
  expect(within(dialog).getByLabelText("Birlik")).toHaveTextContent("kg")
  await user.type(within(dialog).getByLabelText("Sotuv narxi"), "8 000,5")
  await user.type(within(dialog).getByLabelText("Artikul"), "AN-1")
  await user.type(within(dialog).getByLabelText("Izoh"), "Shirin")
  await user.click(within(dialog).getByRole("button", { name: "Qo'shish" }))

  await waitFor(() => expect(db.products.find((p) => p.name === "Anor")).toMatchObject({ kind: "product", unit: "kg", sku: "AN-1", price: "8000.50", note: "Shirin" }))
  expect(await screen.findByText("Mahsulot qo'shildi")).toBeInTheDocument()
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument())
})

test("the form refuses in the API's words before asking, and shows the API's refusal", async () => {
  seedCatalog()
  await signIn(ALI)
  const { user } = renderWithProviders(<Opened companyId={1} />)

  const dialog = await screen.findByRole("dialog", { name: "Mahsulot qo'shish" })
  await user.click(within(dialog).getByRole("button", { name: "Qo'shish" }))
  expect(await within(dialog).findByText("Nomni kiriting")).toBeInTheDocument()
  expect(within(dialog).getByText("Birlikni tanlang")).toBeInTheDocument()

  await user.type(within(dialog).getByLabelText("Nomi"), "olma")
  await choose(user, within(dialog).getByLabelText("Birlik"), "dona")
  await user.click(within(dialog).getByRole("button", { name: "Qo'shish" }))
  expect(await within(dialog).findByText("Bu nomli mahsulot allaqachon bor")).toBeInTheDocument()
  expect(db.products.filter((p) => p.name.toLowerCase() === "olma")).toHaveLength(1)
})

test("a product is edited from its fields as they are; its kind stays", async () => {
  const { olma } = seedCatalog()
  await signIn(ALI)
  const { user } = renderWithProviders(<Opened companyId={1} product={toProduct(olma)} />)

  const dialog = await screen.findByRole("dialog", { name: "Mahsulotni tahrirlash" })
  expect(within(dialog).getByLabelText("Nomi")).toHaveValue("Olma")
  expect(within(dialog).getByLabelText("Artikul")).toHaveValue("OL-1")
  expect(within(dialog).getByLabelText("Sotuv narxi")).toHaveValue("12000.00")
  expect(within(dialog).getByLabelText("Birlik")).toHaveTextContent("kg")
  await user.clear(within(dialog).getByLabelText("Nomi"))
  await user.type(within(dialog).getByLabelText("Nomi"), "Qizil olma")
  await user.clear(within(dialog).getByLabelText("Artikul"))
  await user.click(within(dialog).getByRole("button", { name: "Saqlash" }))

  await waitFor(() => expect(db.products.find((p) => p.id === olma.id)).toMatchObject({ kind: "product", name: "Qizil olma", sku: null, price: "12000.00" }))
  expect(await screen.findByText("Mahsulot saqlandi")).toBeInTheDocument()
})

test("the sheet's rows say what may be left empty, the price its currency", async () => {
  await signIn(ALI)
  renderWithProviders(<Opened companyId={1} />)

  const dialog = await screen.findByRole("dialog", { name: "Mahsulot qo'shish" })
  expect(within(dialog).getByText("Nom va birlik majburiy; sotuv narxi, artikul va izoh ixtiyoriy.")).toBeInTheDocument()
  expect(within(dialog).getByLabelText("Nomi")).toHaveAttribute("placeholder", "Masalan, Olma")
  expect(within(dialog).getByLabelText("Birlik")).toHaveTextContent("Tanlang")
  for (const label of ["Sotuv narxi", "Artikul", "Izoh"]) {
    expect(within(dialog).getByLabelText(label), label).toHaveAttribute("placeholder", "ixtiyoriy")
  }
  expect(within(dialog).getByLabelText("Sotuv narxi")).toHaveAttribute("inputmode", "decimal")
  expect(within(dialog).getByText("so'm")).toBeInTheDocument()
})

test("the sheet closes after a save; the page that opened it is told", async () => {
  const { olma } = seedCatalog()
  await signIn(ALI)
  const { user } = renderWithProviders(<Opened companyId={1} product={toProduct(olma)} />)

  const dialog = await screen.findByRole("dialog", { name: "Mahsulotni tahrirlash" })
  await user.click(within(dialog).getByRole("button", { name: "Saqlash" }))

  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument())
})
