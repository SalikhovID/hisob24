import { screen, waitFor, within } from "@testing-library/react"
import { expect, test } from "vitest"
import { ALI, db, seedWarehouse } from "@/mocks/data"
import { toSupplier } from "@/mocks/warehouse"
import { renderWithProviders } from "@/test/render"
import { signIn } from "@/test/session"
import { SupplierDialog } from "./supplier-dialog"

test("a supplier is entered with its phone and a note", async () => {
  await signIn(ALI)
  const { user } = renderWithProviders(<SupplierDialog companyId={1} />)

  await user.click(screen.getByRole("button", { name: "Ta'minotchi qo'shish" }))
  const dialog = await screen.findByRole("dialog", { name: "Ta'minotchi qo'shish" })
  await user.type(within(dialog).getByLabelText("Nomi"), " Dehqon bozori ")
  await user.type(within(dialog).getByLabelText("Telefon"), "90 777 66 55")
  await user.type(within(dialog).getByLabelText("Izoh"), "Toshkent")
  await user.click(within(dialog).getByRole("button", { name: "Qo'shish" }))

  await waitFor(() => expect(db.suppliers.find((s) => s.name === "Dehqon bozori")).toMatchObject({ phone: "998907776655", note: "Toshkent", active: true }))
  expect(await screen.findByText("Ta'minotchi qo'shildi")).toBeInTheDocument()
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument())
})

test("the form refuses in the API's words before asking, and shows the API's refusal", async () => {
  seedWarehouse()
  await signIn(ALI)
  const { user } = renderWithProviders(<SupplierDialog companyId={1} />)

  await user.click(screen.getByRole("button", { name: "Ta'minotchi qo'shish" }))
  const dialog = await screen.findByRole("dialog", { name: "Ta'minotchi qo'shish" })
  await user.type(within(dialog).getByLabelText("Telefon"), "90 12")
  await user.click(within(dialog).getByRole("button", { name: "Qo'shish" }))
  expect(await within(dialog).findByText("Nomni kiriting")).toBeInTheDocument()
  expect(within(dialog).getByText("Telefon raqami noto'g'ri")).toBeInTheDocument()

  await user.clear(within(dialog).getByLabelText("Telefon"))
  await user.type(within(dialog).getByLabelText("Nomi"), "bozor")
  await user.click(within(dialog).getByRole("button", { name: "Qo'shish" }))
  expect(await within(dialog).findByText("Bu nomli ta'minotchi allaqachon bor")).toBeInTheDocument()
  expect(db.suppliers.filter((s) => s.name.toLowerCase() === "bozor")).toHaveLength(1)
})

test("a supplier is edited from its fields as they are; a phone cleared is none", async () => {
  const { bozor } = seedWarehouse()
  await signIn(ALI)
  const { user } = renderWithProviders(<SupplierDialog companyId={1} supplier={toSupplier(bozor, true)} />)

  await user.click(screen.getByRole("button", { name: "Tahrirlash" }))
  const dialog = await screen.findByRole("dialog", { name: "Ta'minotchini tahrirlash" })
  expect(within(dialog).getByLabelText("Nomi")).toHaveValue("Bozor")
  expect(within(dialog).getByLabelText("Telefon")).toHaveValue("90 123 45 67")
  expect(within(dialog).getByLabelText("Izoh")).toHaveValue("Chorsu")
  await user.clear(within(dialog).getByLabelText("Nomi"))
  await user.type(within(dialog).getByLabelText("Nomi"), "Eski bozor")
  await user.clear(within(dialog).getByLabelText("Telefon"))
  await user.click(within(dialog).getByRole("button", { name: "Saqlash" }))

  await waitFor(() => expect(db.suppliers.find((s) => s.id === bozor.id)).toMatchObject({ name: "Eski bozor", phone: null, note: "Chorsu" }))
  expect(await screen.findByText("Ta'minotchi saqlandi")).toBeInTheDocument()
})

test("in a row the edit is an icon named after the supplier", async () => {
  const { bozor } = seedWarehouse()
  await signIn(ALI)
  const { user } = renderWithProviders(<SupplierDialog companyId={1} supplier={toSupplier(bozor, true)} iconOnly />)

  await user.click(screen.getByRole("button", { name: "Tahrirlash: Bozor" }))
  expect(await screen.findByRole("dialog", { name: "Ta'minotchini tahrirlash" })).toBeInTheDocument()
})
