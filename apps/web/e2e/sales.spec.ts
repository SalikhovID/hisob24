import { seedCatalog, seedCustomers, seedWarehouse } from "../mocks/data"
import { giveRole } from "../test/roles"
import { expect, test } from "./fixtures"
import { days, list, openSection, pick, sections, settle, sideScroll, signIn } from "./helpers"

test("the owner sells: to a customer with a service and a part payment, the customer's debt and its settling, a retail sale paid in full, an edit, the product's moves and a deletion", async ({ page }) => {
  test.setTimeout(180_000)
  const catalog = seedCatalog()
  // Asosiy holds 12,5 kg Olma and 3 Nok, bought from Bozor.
  seedWarehouse(catalog)
  seedCustomers()
  await signIn(page, "901234567")
  await expect(page.getByRole("heading", { name: "Salom, Ali Valiyev" })).toBeVisible()

  // The sales open empty.
  await openSection(page, "Sotuv")
  await expect(page).toHaveURL(/\/sales$/)
  await expect(page.getByRole("heading", { level: 1, name: "Sotuvlar" })).toBeVisible()
  await expect(page.getByText("Hali sotuv yo'q")).toBeVisible()
  expect(await sideScroll(page)).toBeLessThanOrEqual(0)

  // A sale to Dilshod: 2 kg Olma at its sale price and the delivery, 50 000
  // paid with it. Without a customer the form says the sale is retail.
  await page.getByRole("link", { name: "Sotuv qo'shish" }).click()
  await expect(page).toHaveURL(/\/sales\/new$/)
  await expect(page.getByRole("heading", { level: 1, name: "Yangi sotuv" })).toBeVisible()
  await expect(page.getByText("Chakana sotuv: to'liq to'langan bo'lishi shart")).toBeVisible()
  await pick(page, page, "Mijoz", "dil", /Dilshod/)
  await expect(page.getByText("Chakana sotuv: to'liq to'langan bo'lishi shart")).toBeHidden()
  const first = page.getByRole("group", { name: "1-qator" })
  await pick(page, first, "Mahsulot", "ol", /Olma/)
  await expect(first.getByLabel("Narx")).toHaveValue("12000.00")
  await first.getByLabel("Miqdor").fill("2")
  await page.getByRole("button", { name: "Qator qo'shish" }).click()
  const second = page.getByRole("group", { name: "2-qator" })
  await pick(page, second, "Mahsulot", "yet", /Yetkazish/)
  await expect(second.getByLabel("Narx")).toHaveValue("50000.00")
  await second.getByLabel("Miqdor").fill("1")
  await expect(page.getByText("74 000 so'm")).toBeVisible()
  await page.getByRole("button", { name: "To'lov qo'shish" }).click()
  await page.getByRole("group", { name: "1-to'lov" }).getByLabel("Summa").fill("50000")
  expect(await sideScroll(page)).toBeLessThanOrEqual(0)
  await page.getByRole("button", { name: "Saqlash" }).click()
  // The sale's page is compiled on its first visit: the dev server takes a while.
  await expect(page).toHaveURL(/\/sales\/\d+$/, { timeout: 15_000 })
  await expect(page.getByRole("heading", { level: 1, name: "Sotuv № 1" })).toBeVisible()
  const info = page.getByRole("region", { name: "Ma'lumot" })
  await expect(info.getByText("74 000 so'm")).toBeVisible()
  await expect(info.getByText("50 000 so'm")).toBeVisible()
  await expect(list(page, "Mahsulotlar").getByText("2 kg")).toBeVisible()
  await expect(list(page, "Mahsulotlar").getByText("Yetkazish")).toBeVisible()
  await expect(list(page, "To'lovlar").getByText("Naqd")).toBeVisible()
  await settle(page)

  // The customer owes the rest: in the customers' list and on their page,
  // where the statement tells the sale and its payment. A payment settles it.
  await openSection(page, "Mijozlar")
  // A string matcher folds the amount's no-break space; a regex would not.
  await expect(list(page, "Mijozlar").getByText("Qarz: 24 000 so'm")).toBeVisible()
  await list(page, "Mijozlar").getByRole("link", { name: "Dilshod Karimov" }).click()
  await expect(page.getByRole("heading", { level: 1, name: "Dilshod Karimov" })).toBeVisible()
  const balance = page.getByRole("region", { name: "Balans" })
  await expect(balance.locator("[data-slot=hero]")).toContainText(/Qarz\s*24\s000\s*so'm/)
  const statement = page.getByRole("list", { name: "Hisob harakati" })
  await expect(statement.getByRole("link", { name: "Sotuv № 1" })).toHaveCount(2)
  await page.getByRole("group", { name: "Amallar" }).getByRole("button", { name: "To'lov" }).click()
  const paymentDialog = page.getByRole("dialog", { name: "To'lov qo'shish" })
  // What the customer owes is offered whole.
  await paymentDialog.getByRole("button", { name: "To'liq" }).click()
  await paymentDialog.getByRole("button", { name: "Qo'shish" }).click()
  await expect(paymentDialog).toBeHidden()
  await expect(balance.getByText("Qarz yo'q")).toBeVisible()
  await expect(statement.getByText("To'lov", { exact: true })).toBeVisible()
  await settle(page)

  // A retail sale names nobody and is paid in full: «To'liq» puts the whole
  // total into the payment. Nok has no sale price: it is typed.
  await openSection(page, "Sotuv")
  await expect(days(page, "Sotuvlar").getByRole("link", { name: /№ 1 · Dilshod Karimov/ })).toBeVisible()
  await page.getByRole("link", { name: "Sotuv qo'shish" }).click()
  await expect(page.getByRole("heading", { level: 1, name: "Yangi sotuv" })).toBeVisible()
  const line = page.getByRole("group", { name: "1-qator" })
  await pick(page, line, "Mahsulot", "n", /Nok/)
  await expect(line.getByLabel("Narx")).toHaveValue("")
  await line.getByLabel("Narx").fill("2000")
  await line.getByLabel("Miqdor").fill("1")
  await page.getByRole("button", { name: "Saqlash" }).click()
  await expect(page.getByText("Mijozsiz sotuv to'liq to'langan bo'lsin")).toBeVisible()
  await page.getByRole("button", { name: "To'lov qo'shish" }).click()
  const payment = page.getByRole("group", { name: "1-to'lov" })
  await payment.getByRole("button", { name: "To'liq" }).click()
  await expect(payment.getByLabel("Summa")).toHaveValue("2000")
  await page.getByRole("button", { name: "Saqlash" }).click()
  await expect(page.getByRole("heading", { level: 1, name: "Sotuv № 2" })).toBeVisible()
  await expect(page.getByText(/^Chakana · /)).toBeVisible()
  await settle(page)

  // An edit: one kilo of Olma on the first sale; the total follows.
  await page.getByRole("main").getByRole("link", { name: "Sotuvlar" }).click()
  await expect(page).toHaveURL(/\/sales$/)
  await days(page, "Sotuvlar").getByRole("link", { name: /№ 1 · Dilshod Karimov/ }).click()
  await expect(page.getByRole("heading", { level: 1, name: "Sotuv № 1" })).toBeVisible()
  await page.getByRole("link", { name: "Tahrirlash" }).click()
  await expect(page.getByRole("heading", { level: 1, name: "Sotuvni tahrirlash" })).toBeVisible({ timeout: 15_000 })
  await page.getByRole("group", { name: "1-qator" }).getByLabel("Miqdor").fill("1")
  await page.getByRole("button", { name: "Saqlash" }).click()
  await expect(page.getByRole("heading", { level: 1, name: "Sotuv № 1" })).toBeVisible()
  await expect(page.getByRole("region", { name: "Ma'lumot" }).getByText("62 000 so'm")).toBeVisible()
  await expect(list(page, "Mahsulotlar").getByText("1 kg")).toBeVisible()
  await settle(page)

  // The product's page tells the sale among its moves and what is left.
  await openSection(page, "Mahsulotlar")
  await list(page, "Mahsulotlar").getByRole("link", { name: "Olma" }).click()
  await expect(page.getByRole("heading", { level: 1, name: "Olma" })).toBeVisible()
  const moves = list(page, "Harakatlar")
  await expect(moves.getByRole("link", { name: "Sotuv № 1" })).toBeVisible()
  await expect(moves.getByText("−1 kg")).toBeVisible()
  await expect(page.getByRole("region", { name: "Qoldiq" }).getByText("11,5 kg")).toBeVisible()

  // A deletion gives the product back and takes the sale off the list.
  await moves.getByRole("link", { name: "Sotuv № 1" }).click()
  await expect(page.getByRole("heading", { level: 1, name: "Sotuv № 1" })).toBeVisible()
  await page.getByRole("button", { name: "O'chirish" }).click()
  await page.getByRole("alertdialog", { name: "Sotuvni o'chirasizmi?" }).getByRole("button", { name: "O'chirish" }).click()
  await expect(page).toHaveURL(/\/sales$/)
  await expect(days(page, "Sotuvlar").getByRole("link", { name: /№ 2 · Chakana/ })).toBeVisible()
  await expect(days(page, "Sotuvlar").getByRole("link", { name: /№ 1 · / })).toHaveCount(0)
  await settle(page)
  await openSection(page, "Mahsulotlar")
  await expect(list(page, "Mahsulotlar").getByText("12,5 kg")).toBeVisible()
  expect(await sideScroll(page)).toBeLessThanOrEqual(0)
})

test("an employee whose role lacks the sales has no way to them, and the addresses lead home", async ({ page }) => {
  seedCatalog()
  giveRole("998902223344", 1, "Kuzatuvchi", ["customers.view"])
  await signIn(page, "902223344")
  await page.getByRole("button", { name: /Olma Savdo/ }).click()
  await expect(page.getByRole("heading", { name: "Salom, Vali Aliyev" })).toBeVisible()

  await expect((await sections(page)).getByRole("link", { name: "Sotuv" })).toHaveCount(0)
  await page.goto("/sales")
  await expect(page).toHaveURL(/\/$/)
  // The way home is a navigation of its own: let it land before the next address.
  await expect(page.getByRole("heading", { name: "Salom, Vali Aliyev" })).toBeVisible()
  await page.goto("/sales/new")
  await expect(page).toHaveURL(/\/$/)
  await expect(page.getByRole("heading", { name: "Salom, Vali Aliyev" })).toBeVisible()
})
