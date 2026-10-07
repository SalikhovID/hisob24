import type { Locator, Page } from "@playwright/test"
import { seedCatalog } from "../mocks/data"
import { giveRole } from "../test/roles"
import { expect, test } from "./fixtures"
import { onPhone, openSection, sections, sideScroll, signIn } from "./helpers"

// The lists are tables on wide screens and cards on a phone: the one on
// screen is the one a test reads.
const list = (page: Page, name: string) => (onPhone(page) ? page.getByRole("list", { name }) : page.getByRole("table", { name }))
const sectionTabs = (page: Page) => page.getByRole("navigation", { name: "Ombor bo'limi" })

// pick finds an item in a picker by what is typed and takes the option.
async function pick(page: Page, scope: Page | Locator, label: string, typed: string, option: RegExp) {
  await scope.getByRole("combobox", { name: label }).fill(typed)
  await page.getByRole("listbox").getByRole("option", { name: option }).click()
}

// settle waits for the toasts of the last step to go: on a phone they stand
// over the page's header, and they wait while the pointer rests on them.
async function settle(page: Page) {
  await page.mouse.move(8, 300)
  await expect(page.locator("[data-sonner-toast]")).toHaveCount(0, { timeout: 15_000 })
}

test("the owner keeps the warehouse: a supplier, a purchase into the stock, the balance and a payment, an edit and a deletion", async ({ page }) => {
  test.setTimeout(150_000)
  seedCatalog()
  await signIn(page, "901234567")
  await expect(page.getByRole("heading", { name: "Salom, Ali Valiyev" })).toBeVisible()

  // The warehouse opens at the purchases: none yet. The suppliers are a tab away.
  await openSection(page, "Ombor")
  await expect(page).toHaveURL(/\/purchases$/)
  await expect(page.getByRole("heading", { level: 1, name: "Xaridlar" })).toBeVisible()
  await expect(page.getByText("Hali xarid yo'q")).toBeVisible()
  expect(await sideScroll(page)).toBeLessThanOrEqual(0)
  await sectionTabs(page).getByRole("link", { name: "Ta'minotchilar" }).click()
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
  await sectionTabs(page).getByRole("link", { name: "Xaridlar" }).click()
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
  await page.getByRole("button", { name: "To'liq" }).click()
  await expect(page.getByLabel("To'langan")).toHaveValue("17501.5")
  await page.getByLabel("To'langan").fill("5000")
  expect(await sideScroll(page)).toBeLessThanOrEqual(0)
  await page.getByRole("button", { name: "Saqlash" }).click()
  await expect(page).toHaveURL(/\/purchases\/\d+$/)
  await expect(page.getByRole("heading", { level: 1, name: "Xarid № 1" })).toBeVisible()
  const info = page.getByRole("region", { name: "Ma'lumot" })
  await expect(info.getByText("17 501,50 so'm")).toBeVisible()
  await expect(info.getByText("5 000 so'm")).toBeVisible()
  await expect(list(page, "Qatorlar").getByText("10 kg")).toBeVisible()
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
  await openSection(page, "Ombor")
  await sectionTabs(page).getByRole("link", { name: "Ta'minotchilar" }).click()
  await list(page, "Ta'minotchilar").getByRole("link", { name: /Bozor/ }).click()
  await expect(page.getByRole("heading", { level: 1, name: "Bozor" })).toBeVisible()
  const balance = page.getByRole("region", { name: "Balans" })
  await expect(balance.getByText("Qarz: 12 501,50 so'm")).toBeVisible()
  await expect(list(page, "To'lovlar").getByRole("link", { name: "Xarid № 1" })).toBeVisible()
  await page.getByRole("button", { name: "To'lov qo'shish" }).click()
  const paymentDialog = page.getByRole("dialog", { name: "To'lov qo'shish" })
  await paymentDialog.getByLabel("Summa").fill("12501,5")
  await paymentDialog.getByRole("button", { name: "Qo'shish" }).click()
  await expect(paymentDialog).toBeHidden()
  await expect(balance.getByText("Qarz yo'q")).toBeVisible()
  await settle(page)

  // An edit: fewer Olma; the total and the stock follow.
  await list(page, "Xaridlar").getByRole("link", { name: "№ 1" }).click()
  await expect(page.getByRole("heading", { level: 1, name: "Xarid № 1" })).toBeVisible()
  await page.getByRole("link", { name: "Tahrirlash" }).click()
  await expect(page.getByRole("heading", { level: 1, name: "Xaridni tahrirlash" })).toBeVisible()
  await page.getByRole("group", { name: "1-qator" }).getByLabel("Miqdor").fill("4")
  await page.getByRole("button", { name: "Saqlash" }).click()
  await expect(page.getByRole("heading", { level: 1, name: "Xarid № 1" })).toBeVisible()
  await expect(page.getByRole("region", { name: "Ma'lumot" }).getByText("11 501,50 so'm")).toBeVisible()
  await expect(list(page, "Qatorlar").getByText("4 kg")).toBeVisible()
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
  await page.getByRole("button", { name: "O'chirish" }).click()
  await page.getByRole("alertdialog", { name: "Mahsulotni o'chirasizmi?" }).getByRole("button", { name: "O'chirish" }).click()
  await expect(page.getByText("Bu mahsulot 1 ta xaridda bor")).toBeVisible()
  await expect(page.getByRole("heading", { level: 1, name: "Olma" })).toBeVisible()
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
