import { screen, waitFor, within } from "@testing-library/react"
import { expect, test } from "vitest"
import { ALI, VALI } from "@/mocks/data"
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
  giveRole(VALI, 1, "Kuzatuvchi", ["tasks.view"])
  await signIn(VALI)
  await chooseCompany(1)
  renderWithProviders(<WarehouseHub />)

  await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/"))
  expect(screen.queryByRole("list", { name: "Ombor bo'limlari" })).not.toBeInTheDocument()
})
