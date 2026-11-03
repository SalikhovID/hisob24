import { screen, waitFor, within } from "@testing-library/react"
import { expect, test } from "vitest"
import { ALI, seedCatalog, seedWarehouse, VALI } from "@/mocks/data"
import { router } from "@/test/navigation"
import { renderWithProviders } from "@/test/render"
import { giveRole } from "@/test/roles"
import { chooseCompany, signIn } from "@/test/session"
import { WarehouseHub } from "./warehouse-hub"

const pages = async () =>
  within(await screen.findByRole("list", { name: "Ombor bo'limlari" }))
    .getAllByRole("link")
    .map((link) => [link.textContent, link.getAttribute("href")])

test("the warehouse's hub leads to its five pages, for the owner", async () => {
  await signIn(ALI)
  renderWithProviders(<WarehouseHub />)

  expect(await pages()).toEqual([
    ["Xaridlar", "/purchases"],
    ["Ko'chirishlar", "/transfers"],
    ["Inventarizatsiya", "/inventories"],
    ["Boshlang'ich qoldiq", "/opening-stock"],
    ["Ta'minotchilar", "/suppliers"],
  ])
  expect(screen.getByRole("heading", { level: 1, name: "Ombor" })).toBeInTheDocument()
})

test("an employee sees the warehouse's pages their role opens", async () => {
  giveRole(VALI, 1, "Ta'minot", ["suppliers.view"])
  await signIn(VALI)
  await chooseCompany(1)
  renderWithProviders(<WarehouseHub />)

  expect(await pages()).toEqual([["Ta'minotchilar", "/suppliers"]])
})

test("someone with no page of the warehouse is sent home", async () => {
  giveRole(VALI, 1, "Kuzatuvchi", ["orders.view"])
  await signIn(VALI)
  await chooseCompany(1)
  renderWithProviders(<WarehouseHub />)

  await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/"))
  expect(screen.queryByRole("list", { name: "Ombor bo'limlari" })).not.toBeInTheDocument()
})

test("whoever sees the stock finds the «Qoldiq» table on the warehouse's page; its parts stay a list on a phone, the sidebar's on the web", async () => {
  seedWarehouse(seedCatalog())
  await signIn(ALI)
  renderWithProviders(<WarehouseHub />)

  expect(await screen.findByRole("table", { name: "Qoldiq" })).toBeInTheDocument()
  expect(screen.getByRole("list", { name: "Ombor bo'limlari" }).closest('[data-slot="warehouse-parts"]')).toHaveClass("md:hidden")
})

test("without the stock the warehouse's page is its parts alone", async () => {
  giveRole(VALI, 1, "Ta'minot", ["suppliers.view"])
  await signIn(VALI)
  await chooseCompany(1)
  renderWithProviders(<WarehouseHub />)

  await pages()
  expect(screen.queryByRole("table", { name: "Qoldiq" })).not.toBeInTheDocument()
  expect(screen.getByRole("list", { name: "Ombor bo'limlari" }).closest('[data-slot="warehouse-parts"]')).not.toHaveClass("md:hidden")
})
