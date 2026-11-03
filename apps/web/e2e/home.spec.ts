import { addDays, ALI, db, localToday, nextId, seedCatalog, seedOrders, seedWarehouse } from "../mocks/data"
import { giveRole } from "../test/roles"
import { expect, test } from "./fixtures"
import { choose, expectSignedIn, onPhone, sideScroll, signIn } from "./helpers"

// The home at a glance (docs/superpowers/specs/2026-11-03-flat-redesign-design.md):
// the head, what the cash holds, the quick tiles, the cards and the nearest
// deadlines, each from GET /app/dashboard as the member may see it.

// cashOpening puts what Olma Savdo's Naqd held at the start, yesterday.
function cashOpening(amount: number) {
  const at = `${addDays(localToday(), -1)}T05:00:00Z`
  const rateId = nextId()
  db.rates.push({ id: rateId, companyId: 1, usd: "0.0000", eur: "0.0000", rub: "0.0000", status: 1, setBy: ALI, setAt: at })
  db.transactions.push({
    id: nextId(), companyId: 1, kind: "cash_opening", number: 1, at, locationId: null, toLocationId: null, supplierId: null, customerId: null,
    bankAccountId: db.accounts[1][0].id, toBankAccountId: null, categoryId: null, linkedId: null, currencyId: 1, rateId, total: amount, toTotal: null,
    note: null, by: ALI, byName: null, createdAt: at, updatedAt: at,
  })
}

test("the owner's home: what the cash holds, the quick tiles, the cards, the nearest deadlines leading to an order", async ({ page }) => {
  seedOrders()
  seedWarehouse(seedCatalog())
  cashOpening(500000)
  await signIn(page, "901234567")
  await expect(page.getByRole("heading", { name: "Salom, Ali Valiyev" })).toBeAttached()
  const main = page.getByRole("main")

  const hero = main.locator('[data-slot="hero"]')
  await expect(hero).toContainText("Kassadagi pul")
  await expect(hero.getByRole("link", { name: "Kassa →" })).toHaveAttribute("href", "/accounts")
  await expect(hero).toContainText("1 ta akkaunt")
  await expect(main.getByRole("group", { name: "Tezkor amallar" }).locator("a, button")).toHaveText(["Buyurtma", "Sotuv", "Xarid", "Xarajat", "Mijoz"])
  const orders = main.getByRole("link", { name: /^Faol buyurtmalar/ })
  await expect(orders.locator('[data-slot="stat-value"]')).toHaveText("3")
  await expect(orders.getByRole("img", { name: /^Bosqichlar: / })).toBeAttached()
  await expect(main.getByRole("link", { name: /^Mijozlar qarzi/ })).toHaveAttribute("href", "/customers")
  await expect(main.getByRole("link", { name: /sotuvlari/ })).toHaveAttribute("href", "/sales")
  await expect(main.getByRole("link", { name: /^Kam qolgan tovarlar/ })).toHaveAttribute("href", "/warehouse")
  const deadlines = main.getByRole("list", { name: "Yaqin muddatlar" })
  await expect(deadlines.getByRole("link")).toHaveCount(3)
  expect(await sideScroll(page)).toBeLessThanOrEqual(0)

  await deadlines.getByRole("link").first().click()
  await expect(page.getByRole("heading", { level: 1, name: "Buyurtma № 2" })).toBeVisible()
})

test("an employee who keeps the cash enters an expense from the home and sees what the cash holds go down at once", async ({ page }) => {
  db.financeCategories.push({ id: nextId(), companyId: 1, name: "Ijara", kind: "expense", position: 1, active: true })
  cashOpening(100000)
  giveRole("998902223344", 1, "Kassir", ["finance.view", "finance.create"])
  await signIn(page, "902223344")
  await page.getByRole("button", { name: /Olma Savdo/ }).click()
  await expectSignedIn(page, { company: "Olma Savdo", name: "Vali Aliyev", role: "Kassir" })
  const main = page.getByRole("main")
  const hero = main.locator('[data-slot="hero"]')
  await expect(hero).toContainText("100 000")
  await expect(main.getByRole("group", { name: "Tezkor amallar" }).locator("a, button")).toHaveText(["Xarajat"])

  await main.getByRole("button", { name: "Xarajat" }).click()
  const dialog = page.getByRole("dialog", { name: "Xarajat qo'shish" })
  await choose(dialog.getByRole("button", { name: /^Kategoriya/ }), "Ijara")
  await dialog.getByLabel("Summa").fill("1500")
  await dialog.getByRole("button", { name: "Qo'shish", exact: true }).click()
  await expect(dialog).toBeHidden()

  await expect(hero).toContainText("98 500")
  if (onPhone(page)) expect(await sideScroll(page)).toBeLessThanOrEqual(0)
})
