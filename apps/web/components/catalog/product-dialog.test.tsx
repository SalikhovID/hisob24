import { screen, waitFor, within } from "@testing-library/react"
import { type ComponentProps, useState } from "react"
import { expect, test } from "vitest"
import { toProduct } from "@/mocks/catalog"
import { ALI, db, seedCatalog, VALI } from "@/mocks/data"
import { chooseCurrency } from "@/test/currency"
import { renderWithProviders } from "@/test/render"
import { choose } from "@/test/select"
import { chooseCompany, signIn } from "@/test/session"
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
  expect(within(dialog).getByLabelText("Sotuv narxi")).toHaveValue("12 000,00")
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
  expect(within(dialog).getByText("Nom va birlik majburiy; kategoriya, sotuv narxi, artikul va izoh ixtiyoriy.")).toBeInTheDocument()
  expect(within(dialog).getByLabelText("Kategoriya")).toHaveTextContent("Kategoriyasiz")
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

// With more than the so'm the price's currency is chosen by the buttons of
// the codes, and the price is saved in it.
test("with more than the so'm the price's currency is chosen by its code's button", async () => {
  await signIn(VALI)
  await chooseCompany(2)
  const { user } = renderWithProviders(<Opened companyId={2} />)

  const dialog = await screen.findByRole("dialog", { name: "Mahsulot qo'shish" })
  await user.type(within(dialog).getByLabelText("Nomi"), "Kofe")
  await choose(user, within(dialog).getByLabelText("Birlik"), "dona")
  await user.type(within(dialog).getByLabelText("Sotuv narxi"), "5")
  await chooseCurrency(user, "USD")
  expect(within(dialog).getByText("$")).toBeInTheDocument()
  await user.click(within(dialog).getByRole("button", { name: "Qo'shish" }))

  await waitFor(() => expect(db.products.find((p) => p.name === "Kofe")).toMatchObject({ price: "5.00", currencyId: 2 }))
})

test("a product is filed under a category chosen from its row, the categories in the settings' order", async () => {
  db.productCategories.push({ id: 7001, companyId: 1, name: "Shirinliklar", position: 2 }, { id: 7002, companyId: 1, name: "Ichimliklar", position: 1 })
  await signIn(ALI)
  const { user } = renderWithProviders(<Opened companyId={1} />)

  const dialog = await screen.findByRole("dialog", { name: "Mahsulot qo'shish" })
  await user.type(within(dialog).getByLabelText("Nomi"), "Kola")
  await choose(user, within(dialog).getByLabelText("Birlik"), "dona")
  await user.click(within(dialog).getByLabelText("Kategoriya"))
  const sheet = await screen.findByRole("dialog", { name: "Kategoriya" })
  expect(within(sheet).getAllByRole("option").map((option) => option.textContent)).toEqual(["Kategoriyasiz", "Ichimliklar", "Shirinliklar"])
  expect(within(sheet).getByText("Kategoriyalar Sozlamalarda qo'shiladi")).toBeInTheDocument()
  await user.click(within(sheet).getByRole("option", { name: "Ichimliklar" }))
  expect(within(dialog).getByLabelText("Kategoriya")).toHaveTextContent("Ichimliklar")
  await user.click(within(dialog).getByRole("button", { name: "Qo'shish" }))

  await waitFor(() => expect(db.products.find((p) => p.name === "Kola")).toMatchObject({ categoryId: 7002 }))
})

test("an edited product starts from its category, and «Kategoriyasiz» takes it out", async () => {
  db.productCategories.push({ id: 7001, companyId: 1, name: "Mevalar", position: 1 })
  const { olma } = seedCatalog()
  olma.categoryId = 7001
  await signIn(ALI)
  const { user } = renderWithProviders(<Opened companyId={1} product={toProduct(olma)} />)

  const dialog = await screen.findByRole("dialog", { name: "Mahsulotni tahrirlash" })
  await waitFor(() => expect(within(dialog).getByLabelText("Kategoriya")).toHaveTextContent("Mevalar"))
  await choose(user, within(dialog).getByLabelText("Kategoriya"), "Kategoriyasiz")
  await user.click(within(dialog).getByRole("button", { name: "Saqlash" }))

  await waitFor(() => expect(db.products.find((p) => p.id === olma.id)?.categoryId).toBeNull())
})

test("with eight categories or more the category sheet searches them", async () => {
  const names = ["Ichimliklar", "Shirinliklar", "Xo'jalik", "Mevalar", "Sabzavotlar", "Non", "Go'sht", "Sut"]
  names.forEach((name, i) => db.productCategories.push({ id: 7100 + i, companyId: 1, name, position: i + 1 }))
  await signIn(ALI)
  const { user } = renderWithProviders(<Opened companyId={1} />)

  const dialog = await screen.findByRole("dialog", { name: "Mahsulot qo'shish" })
  await user.click(within(dialog).getByLabelText("Kategoriya"))
  const sheet = await screen.findByRole("dialog", { name: "Kategoriya" })
  await user.type(await within(sheet).findByRole("searchbox"), "sut")

  await waitFor(() => expect(within(sheet).getAllByRole("option").map((option) => option.textContent)).toEqual(["Sut"]))
})
