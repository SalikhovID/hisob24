import { seedCatalog, seedOrders, seedWarehouse } from "../mocks/data"
import { giveRole } from "../test/roles"
import { expect, test } from "./fixtures"
import { expectSignedIn, onPhone, press, sideScroll, signIn } from "./helpers"

// The home at a glance (docs/superpowers/specs/2026-10-13-mini-app-ui-design.md):
// the hero, the quick tiles, the overview and the nearest deadlines, each
// from GET /app/dashboard as the member may see it.

test("the owner's home: what the suppliers are owed, the quick tiles, the overview, the nearest deadlines leading to an order", async ({ page }) => {
  seedOrders()
  seedWarehouse(seedCatalog())
  await signIn(page, "901234567")
  await expect(page.getByRole("heading", { name: "Salom, Ali Valiyev" })).toBeVisible()
  const main = page.getByRole("main")

  const hero = main.getByRole("link", { name: /^Ta'minotchilarga qarz/ })
  await expect(hero).toContainText("15 001,50")
  await expect(hero).toContainText("1 ta ta'minotchi")
  await expect(main.getByRole("group", { name: "Tezkor amallar" }).locator("a, button")).toHaveText(["Buyurtma", "Mijoz", "Sotuv", "Xarid"])
  await expect(main.getByRole("heading", { level: 2, name: "Umumiy holat" })).toBeVisible()
  await expect(main.getByRole("link", { name: /^Buyurtmalar/ })).toContainText("3 ta faol")
  // The month's priced orders stand beside the orders' count: none yet.
  await expect(main.getByRole("link", { name: /^Buyurtma summasi/ })).toContainText("0 so'm")
  const deadlines = main.getByRole("list", { name: "Yaqin muddatlar" })
  await expect(deadlines.getByRole("link")).toHaveCount(4)
  expect(await sideScroll(page)).toBeLessThanOrEqual(0)

  await deadlines.getByRole("link", { name: /^Buyurtma № 2/ }).click()
  await expect(page.getByRole("heading", { level: 1, name: "Buyurtma № 2" })).toBeVisible()
})

test("an employee who keeps the purchases pays a supplier from the home and sees the debt go down at once", async ({ page }) => {
  seedWarehouse(seedCatalog())
  giveRole("998902223344", 1, "Omborchi", ["purchases.view", "purchases.create", "suppliers.view"])
  await signIn(page, "902223344")
  await page.getByRole("button", { name: /Olma Savdo/ }).click()
  await expectSignedIn(page, { company: "Olma Savdo", short: "Vali A.", role: "Omborchi" })
  const main = page.getByRole("main")
  const hero = main.getByRole("link", { name: /^Ta'minotchilarga qarz/ })
  await expect(hero).toContainText("15 001,50")

  await main.getByRole("button", { name: "To'lov" }).click()
  await page.getByRole("dialog", { name: "Ta'minotchi" }).getByRole("option", { name: /Bozor/ }).click()
  const payment = page.getByRole("dialog", { name: "To'lov qo'shish" })
  await press(payment, "1001,5")
  await payment.getByRole("button", { name: "Qo'shish" }).click()
  await expect(payment).toBeHidden()

  await expect(hero).toContainText("14 000")
  if (onPhone(page)) expect(await sideScroll(page)).toBeLessThanOrEqual(0)
})
