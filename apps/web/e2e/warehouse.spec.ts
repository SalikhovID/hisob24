import type { Page } from "@playwright/test"
import { seedCatalog, seedWarehouse } from "../mocks/data"
import { addLocation } from "../test/locations"
import { giveRole } from "../test/roles"
import { expect, test } from "./fixtures"
import { choose, chooseLocation, days, list, openSection, pick, sections, settle, sideScroll, signIn } from "./helpers"

// hub is the warehouse's own page: a row for each of its parts.
const hub = (page: Page) => page.getByRole("list", { name: "Ombor bo'limlari" })

// openWarehouse goes to a part of the warehouse through its hub: from a
// part's list by its «‹ Ombor», from elsewhere through the sections.
async function openWarehouse(page: Page, name: string) {
  if (!/\/warehouse$/.test(page.url())) {
    const back = page.getByRole("main").getByRole("link", { name: "Ombor", exact: true })
    if ((await back.count()) > 0) await back.click()
    else await openSection(page, "Ombor")
    await expect(page).toHaveURL(/\/warehouse$/)
  }
  await hub(page).getByRole("link", { name, exact: true }).click()
}

test("the owner keeps the warehouse: a supplier, a purchase into the stock, the balance and a payment, an edit and a deletion", async ({ page }) => {
  test.setTimeout(150_000)
  seedCatalog()
  await signIn(page, "901234567")
  await expect(page.getByRole("heading", { name: "Salom, Ali Valiyev" })).toBeVisible()

  // The warehouse opens at its hub; the purchases: none yet. The suppliers are the hub's too.
  await openWarehouse(page, "Xaridlar")
  await expect(page).toHaveURL(/\/purchases$/)
  await expect(page.getByRole("heading", { level: 1, name: "Xaridlar" })).toBeVisible()
  await expect(page.getByText("Hali xarid yo'q")).toBeVisible()
  expect(await sideScroll(page)).toBeLessThanOrEqual(0)
  await openWarehouse(page, "Ta'minotchilar")
  await expect(page).toHaveURL(/\/suppliers$/)
  await expect(page.getByText("Hali ta'minotchi yo'q")).toBeVisible()
  await page.getByRole("button", { name: "Ta'minotchi qo'shish" }).click()
  const supplierDialog = page.getByRole("dialog", { name: "Ta'minotchi qo'shish" })
  await supplierDialog.getByLabel("Nomi").fill("Bozor")
  await supplierDialog.getByLabel("Telefon").fill("90 123 45 67")
  await supplierDialog.getByRole("button", { name: "Qo'shish" }).click()
  await expect(supplierDialog).toBeHidden()
  await expect(list(page, "Ta'minotchilar").getByRole("link", { name: /Bozor/ })).toBeVisible()
  await settle(page)

  // A purchase of two products into Asosiy, 5 000 paid with it.
  await openWarehouse(page, "Xaridlar")
  await page.getByRole("link", { name: "Xarid qo'shish" }).click()
  await expect(page).toHaveURL(/\/purchases\/new$/)
  await expect(page.getByRole("heading", { level: 1, name: "Yangi xarid" })).toBeVisible()
  await pick(page, page, "Ta'minotchi", "bo", /Bozor/)
  const first = page.getByRole("group", { name: "1-qator" })
  await pick(page, first, "Mahsulot", "ol", /Olma/)
  await first.getByLabel("Miqdor").fill("10")
  await first.getByLabel("Narx").fill("1000")
  await page.getByRole("button", { name: "Qator qo'shish" }).click()
  const second = page.getByRole("group", { name: "2-qator" })
  await pick(page, second, "Mahsulot", "n", /Nok/)
  await second.getByLabel("Miqdor").fill("3")
  await second.getByLabel("Narx").fill("2500,5")
  await expect(page.getByText("17 501,5 so'm")).toBeVisible()
  await page.getByRole("button", { name: "To'lov qo'shish" }).click()
  const payment = page.getByRole("group", { name: "1-to'lov" })
  await payment.getByRole("button", { name: "To'liq" }).click()
  await expect(payment.getByLabel("Summa")).toHaveValue("17501.5")
  await payment.getByLabel("Summa").fill("5000")
  expect(await sideScroll(page)).toBeLessThanOrEqual(0)
  await page.getByRole("button", { name: "Saqlash" }).click()
  await expect(page).toHaveURL(/\/purchases\/\d+$/)
  await expect(page.getByRole("heading", { level: 1, name: "Xarid № 1" })).toBeVisible()
  const info = page.getByRole("region", { name: "Ma'lumot" })
  await expect(info.getByText("17 501,50 so'm")).toBeVisible()
  await expect(info.getByText("5 000 so'm")).toBeVisible()
  await expect(list(page, "Mahsulotlar").getByText("10 kg")).toBeVisible()
  await expect(page.getByRole("list", { name: "To'lovlar" }).getByText("Naqd")).toBeVisible()
  await settle(page)

  // The stock: in the products' list and on the product's page, with the
  // last price and the purchase.
  await openSection(page, "Mahsulotlar")
  await expect(list(page, "Mahsulotlar").getByText("10 kg")).toBeVisible()
  await list(page, "Mahsulotlar").getByRole("link", { name: "Olma" }).click()
  await expect(page.getByRole("heading", { level: 1, name: "Olma" })).toBeVisible()
  await expect(page.getByRole("region", { name: "Ma'lumot" }).getByText("1 000 so'm")).toBeVisible()
  await expect(page.getByRole("region", { name: "Qoldiq" }).getByText("10 kg")).toBeVisible()
  await expect(list(page, "Xaridlar").getByRole("link", { name: /№ 1 · Bozor/ })).toBeVisible()

  // The supplier is owed the rest; a payment settles it.
  await openWarehouse(page, "Ta'minotchilar")
  await list(page, "Ta'minotchilar").getByRole("link", { name: /Bozor/ }).click()
  await expect(page.getByRole("heading", { level: 1, name: "Bozor" })).toBeVisible()
  const balance = page.getByRole("region", { name: "Balans" })
  await expect(balance.locator("[data-slot=hero]")).toContainText(/Qarz\s*12\s501,50\s*so'm/)
  const statement = days(page, "Hisob harakati")
  await expect(statement.getByRole("link", { name: "Xarid № 1" })).toHaveCount(2)
  await page.getByRole("group", { name: "Amallar" }).getByRole("button", { name: "To'lov" }).click()
  const paymentDialog = page.getByRole("dialog", { name: "To'lov qo'shish" })
  // What is owed is offered whole.
  await paymentDialog.getByRole("button", { name: "To'liq" }).click()
  await paymentDialog.getByRole("button", { name: "Qo'shish" }).click()
  await expect(paymentDialog).toBeHidden()
  await expect(balance.getByText("Qarz yo'q")).toBeVisible()
  await settle(page)

  // An edit: fewer Olma; the total and the stock follow.
  await statement.getByRole("link", { name: "Xarid № 1" }).first().click()
  await expect(page.getByRole("heading", { level: 1, name: "Xarid № 1" })).toBeVisible()
  await page.getByRole("link", { name: "Tahrirlash" }).click()
  await expect(page.getByRole("heading", { level: 1, name: "Xaridni tahrirlash" })).toBeVisible()
  await page.getByRole("group", { name: "1-qator" }).getByLabel("Miqdor").fill("4")
  await page.getByRole("button", { name: "Saqlash" }).click()
  await expect(page.getByRole("heading", { level: 1, name: "Xarid № 1" })).toBeVisible()
  await expect(page.getByRole("region", { name: "Ma'lumot" }).getByText("11 501,50 so'm")).toBeVisible()
  await expect(list(page, "Mahsulotlar").getByText("4 kg")).toBeVisible()
  await settle(page)

  // A deletion gives the stock back; the next purchase is № 2.
  await page.getByRole("button", { name: "O'chirish" }).click()
  await page.getByRole("alertdialog", { name: "Xaridni o'chirasizmi?" }).getByRole("button", { name: "O'chirish" }).click()
  await expect(page).toHaveURL(/\/purchases$/)
  await expect(page.getByText("Hali xarid yo'q")).toBeVisible()
  await settle(page)
  await page.getByRole("link", { name: "Xarid qo'shish" }).click()
  await pick(page, page, "Ta'minotchi", "bo", /Bozor/)
  const line = page.getByRole("group", { name: "1-qator" })
  await pick(page, line, "Mahsulot", "ol", /Olma/)
  // The deleted purchase no longer tells a last price: the price is typed.
  await expect(line.getByLabel("Narx")).toHaveValue("")
  await line.getByLabel("Narx").fill("1000")
  await line.getByLabel("Miqdor").fill("1")
  await page.getByRole("button", { name: "Saqlash" }).click()
  await expect(page.getByRole("heading", { level: 1, name: "Xarid № 2" })).toBeVisible()
  await settle(page)

  // A product in a purchase is kept; it may be turned off instead.
  await openSection(page, "Mahsulotlar")
  await list(page, "Mahsulotlar").getByRole("link", { name: "Olma" }).click()
  await page.getByRole("button", { name: "Mahsulotni o'chirish" }).click()
  await page.getByRole("alertdialog", { name: "Mahsulotni o'chirasizmi?" }).getByRole("button", { name: "O'chirish" }).click()
  await expect(page.getByText("Bu mahsulot 1 ta hujjatda bor")).toBeVisible()
  await expect(page.getByRole("heading", { level: 1, name: "Olma" })).toBeVisible()
  expect(await sideScroll(page)).toBeLessThanOrEqual(0)
})

test("the owner keeps the stock documents: a transfer between the locations, a count, an opening stock, the product's moves, a supplier's opening debt", async ({ page }) => {
  test.setTimeout(180_000)
  const catalog = seedCatalog()
  // Asosiy holds 12,5 kg Olma and 3 Nok, bought from Bozor; Chilonzor is empty.
  seedWarehouse(catalog)
  addLocation(1, "Chilonzor")
  await signIn(page, "901234567")
  await expect(page.getByRole("heading", { name: "Salom, Ali Valiyev" })).toBeVisible()
  await openSection(page, "Ombor")
  await expect(hub(page).getByRole("link")).toHaveText(["Xaridlar", "Ko'chirishlar", "Inventarizatsiya", "Boshlang'ich qoldiq", "Ta'minotchilar"])

  // A transfer of 4 kg Olma to Chilonzor: it leaves Asosiy and arrives there.
  await openWarehouse(page, "Ko'chirishlar")
  await expect(page).toHaveURL(/\/transfers$/)
  await expect(page.getByText("Hali ko'chirish yo'q")).toBeVisible()
  await page.getByRole("link", { name: "Ko'chirish qo'shish" }).click()
  await expect(page.getByRole("heading", { level: 1, name: "Yangi ko'chirish" })).toBeVisible()
  await choose(page.getByLabel("Qayerga"), "Chilonzor")
  const moved = page.getByRole("group", { name: "1-qator" })
  await pick(page, moved, "Mahsulot", "ol", /Olma/)
  await moved.getByLabel("Miqdor").fill("4")
  expect(await sideScroll(page)).toBeLessThanOrEqual(0)
  await page.getByRole("button", { name: "Saqlash" }).click()
  await expect(page).toHaveURL(/\/transfers\/\d+$/)
  await expect(page.getByRole("heading", { level: 1, name: "Ko'chirish № 1" })).toBeVisible()
  await expect(page.getByRole("region", { name: "Ma'lumot" }).getByText("Chilonzor")).toBeVisible()
  await expect(list(page, "Mahsulotlar").getByText("4 kg")).toBeVisible()
  await settle(page)
  await page.getByRole("main").getByRole("link", { name: "Ko'chirishlar" }).click()
  const transfers = page.getByRole("region", { name: "Ko'chirishlar" })
  await expect(transfers.getByText("Chiqim")).toBeVisible()
  await chooseLocation(page, "Chilonzor")
  await expect(transfers.getByText("Kirim")).toBeVisible()
  await chooseLocation(page, "Asosiy")
  await expect(transfers.getByText("Chiqim")).toBeVisible()

  // A count of Asosiy: everything in stock at once, Olma half a kilo short.
  await openWarehouse(page, "Inventarizatsiya")
  await page.getByRole("link", { name: "Inventarizatsiya qo'shish" }).click()
  await expect(page.getByRole("heading", { level: 1, name: "Yangi inventarizatsiya" })).toBeVisible()
  await page.getByRole("button", { name: "Hammasini qo'shish" }).click()
  const olma = page.getByRole("group", { name: "2-qator" })
  await expect(olma.getByText("Olma")).toBeVisible()
  await expect(olma.getByLabel("Sanalgan")).toHaveValue("8.500")
  await olma.getByLabel("Sanalgan").fill("8")
  await expect(olma.getByText("−0,5 kg")).toBeVisible()
  await page.getByRole("button", { name: "Saqlash" }).click()
  await expect(page.getByRole("heading", { level: 1, name: "Inventarizatsiya № 1" })).toBeVisible()
  await expect(list(page, "Mahsulotlar").getByText("−0,5 kg")).toBeVisible()
  await settle(page)

  // The stock Chilonzor started with: 10 Nok at 2 000. The hub is a list
  // away: back to the counts first.
  await page.getByRole("main").getByRole("link", { name: "Inventarizatsiya", exact: true }).click()
  await expect(page).toHaveURL(/\/inventories$/)
  await chooseLocation(page, "Chilonzor")
  await openWarehouse(page, "Boshlang'ich qoldiq")
  await page.getByRole("link", { name: "Boshlang'ich qoldiq qo'shish" }).click()
  await expect(page.getByRole("heading", { level: 1, name: "Yangi boshlang'ich qoldiq" })).toBeVisible()
  const opening = page.getByRole("group", { name: "1-qator" })
  await pick(page, opening, "Mahsulot", "n", /Nok/)
  await opening.getByLabel("Miqdor").fill("10")
  await opening.getByLabel("Narx").fill("2000")
  await expect(page.getByText("20 000 so'm")).toBeVisible()
  await page.getByRole("button", { name: "Saqlash" }).click()
  await expect(page.getByRole("heading", { level: 1, name: "Boshlang'ich qoldiq № 1" })).toBeVisible()
  await expect(page.getByRole("region", { name: "Ma'lumot" }).getByText("20 000 so'm")).toBeVisible()
  await settle(page)

  // The product's page tells its moves: the count, the transfer's two ends, the purchase.
  await openSection(page, "Mahsulotlar")
  await list(page, "Mahsulotlar").getByRole("link", { name: "Olma" }).click()
  await expect(page.getByRole("heading", { level: 1, name: "Olma" })).toBeVisible()
  const moves = list(page, "Harakatlar")
  await expect(moves.getByRole("link", { name: "Inventarizatsiya № 1" })).toBeVisible()
  await expect(moves.getByText("−0,5 kg")).toBeVisible()
  await expect(moves.getByRole("link", { name: "Ko'chirish № 1" })).toHaveCount(2)
  await expect(moves.getByRole("link", { name: "Xarid № 1" })).toBeVisible()
  await expect(page.getByRole("region", { name: "Qoldiq" }).getByText("8 kg")).toBeVisible()

  // What the supplier was owed before the books began: in the balance and the statement.
  await openWarehouse(page, "Ta'minotchilar")
  await list(page, "Ta'minotchilar").getByRole("link", { name: /Bozor/ }).click()
  await expect(page.getByRole("heading", { level: 1, name: "Bozor" })).toBeVisible()
  await page.getByRole("button", { name: "Boshlang'ich", exact: true }).click()
  const dialog = page.getByRole("dialog", { name: "Boshlang'ich qarz yoki avans" })
  await dialog.getByRole("radiogroup", { name: "Tur" }).getByRole("radio", { name: "Qarz" }).click()
  await dialog.getByLabel("Summa").fill("1000000")
  await dialog.getByRole("button", { name: "Qo'shish" }).click()
  await expect(dialog).toBeHidden()
  await expect(page.getByRole("region", { name: "Balans" }).locator("[data-slot=hero]")).toContainText(/Qarz\s*1\s015\s001,50\s*so'm/)
  await expect(days(page, "Hisob harakati").getByText("Boshlang'ich qarz")).toBeVisible()
  expect(await sideScroll(page)).toBeLessThanOrEqual(0)
})

test("an employee whose role lacks the warehouse has no way to it, and the addresses lead home", async ({ page }) => {
  seedCatalog()
  giveRole("998902223344", 1, "Kuzatuvchi", ["customers.view"])
  await signIn(page, "902223344")
  await page.getByRole("button", { name: /Olma Savdo/ }).click()
  await expect(page.getByRole("heading", { name: "Salom, Vali Aliyev" })).toBeVisible()

  await expect((await sections(page)).getByRole("link", { name: "Ombor" })).toHaveCount(0)
  await page.goto("/purchases")
  await expect(page).toHaveURL(/\/$/)
  await page.goto("/suppliers")
  await expect(page).toHaveURL(/\/$/)
  await expect(page.getByRole("heading", { name: "Salom, Vali Aliyev" })).toBeVisible()
})
