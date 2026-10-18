import { screen, waitFor, within } from "@testing-library/react"
import { expect, test } from "vitest"
import { allPermissions } from "@/lib/permissions"
import type { Permission } from "@/lib/types"
import { ALI, db, seedOrders, seedWarehouse, VALI } from "@/mocks/data"
import { asosiyOf } from "@/test/locations"
import { press } from "@/test/keypad"
import { renderWithProviders } from "@/test/render"
import { chooseCompany, signIn } from "@/test/session"
import { QuickTiles } from "./quick-tiles"

const tiles = () => within(screen.getByRole("group", { name: "Tezkor amallar" }))
const names = () => Array.from(screen.getByRole("group", { name: "Tezkor amallar" }).querySelectorAll("a, button"), (tile) => tile.textContent)

test("the tiles are the first four of Buyurtma, Mijoz, Sotuv, Xarid, To'lov the member may use", async () => {
  await signIn(ALI)
  const { rerender } = renderWithProviders(<QuickTiles companyId={1} locationId={asosiyOf(1).id} permissions={allPermissions} />)

  expect(names()).toEqual(["Buyurtma", "Mijoz", "Sotuv", "Xarid"])

  // With no location, nothing that goes into one.
  rerender(<QuickTiles companyId={1} locationId={null} permissions={allPermissions} />)
  expect(names()).toEqual(["Mijoz", "To'lov"])

  const role: Permission[] = ["orders.view", "orders.create", "customers.view", "purchases.view", "purchases.create", "suppliers.view"]
  rerender(<QuickTiles companyId={1} locationId={asosiyOf(1).id} permissions={role} />)
  expect(names()).toEqual(["Buyurtma", "Xarid", "To'lov"])

  rerender(<QuickTiles companyId={1} locationId={asosiyOf(1).id} permissions={["orders.view"]} />)
  expect(screen.queryByRole("group", { name: "Tezkor amallar" })).not.toBeInTheDocument()
})

test("Sotuv and Xarid lead to their new documents", async () => {
  await signIn(ALI)
  renderWithProviders(<QuickTiles companyId={1} locationId={asosiyOf(1).id} permissions={allPermissions} />)

  expect(tiles().getByRole("link", { name: "Sotuv" })).toHaveAttribute("href", "/sales/new")
  expect(tiles().getByRole("link", { name: "Xarid" })).toHaveAttribute("href", "/purchases/new")
})

test("Buyurtma enters an order right from the home", async () => {
  seedOrders()
  await signIn(ALI)
  const { user } = renderWithProviders(<QuickTiles companyId={1} locationId={asosiyOf(1).id} permissions={allPermissions} />)

  await user.click(tiles().getByRole("button", { name: "Buyurtma" }))

  expect(await screen.findByRole("dialog", { name: "Buyurtma qo'shish" })).toBeInTheDocument()
})

test("Mijoz enters a customer right from the home", async () => {
  await signIn(ALI)
  const { user } = renderWithProviders(<QuickTiles companyId={1} locationId={asosiyOf(1).id} permissions={allPermissions} />)

  await user.click(tiles().getByRole("button", { name: "Mijoz" }))

  expect(await screen.findByRole("dialog", { name: "Mijoz qo'shish" })).toBeInTheDocument()
})

test("To'lov picks the supplier among the active ones, then takes the payment to it", async () => {
  const { bozor } = seedWarehouse()
  await signIn(VALI)
  await chooseCompany(1)
  const role: Permission[] = ["purchases.view", "purchases.create", "suppliers.view"]
  const { user } = renderWithProviders(<QuickTiles companyId={1} locationId={null} permissions={role} />)

  await user.click(tiles().getByRole("button", { name: "To'lov" }))
  const picker = await screen.findByRole("dialog", { name: "Ta'minotchi" })
  expect(await within(picker).findByRole("option", { name: /Bozor/ })).toBeInTheDocument()
  expect(within(picker).queryByRole("option", { name: /Dehqon/ })).not.toBeInTheDocument()
  await user.click(within(picker).getByRole("option", { name: /Bozor/ }))

  const payment = await screen.findByRole("dialog", { name: "To'lov qo'shish" })
  await press(user, payment, "5000")
  await user.click(within(payment).getByRole("button", { name: "Qo'shish" }))

  await waitFor(() => expect(db.transactions.some((t) => t.kind === "supplier_payment" && t.supplierId === bozor.id && t.total === 5000)).toBe(true))
})
