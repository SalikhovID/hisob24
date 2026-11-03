import type { Page } from "@playwright/test"
import { addDays, db, localToday, seedCatalog, seedOrders, seedWarehouse } from "../mocks/data"
import { expect, test } from "./fixtures"
import { boardOf, choose, days, onPhone, openSection, pick, press, settle, sideScroll, signIn, tab } from "./helpers"

const today = localToday()

// openOrders signs the owner of Olma Savdo in and opens the orders: the board,
// the first time.
async function openOrders(page: Page) {
  await signIn(page, "901234567")
  await expect(page.getByRole("heading", { name: "Salom, Ali Valiyev" })).toBeVisible()
  await openSection(page, "Buyurtmalar")
  await expect(page).toHaveURL(/\/orders$/)
  await expect(boardOf(page)).toBeVisible()
}

// column is a stage's orders as the screen shows them: its column on the
// web; on a phone the board, the stage's chip chosen first. cards are the
// titles in it.
async function column(page: Page, name: string) {
  if (!onPhone(page)) return page.getByRole("region", { name: "Kanban" }).getByRole("region", { name })
  const board = page.locator('[data-slot="phone-board"]')
  await board.getByRole("radio", { name: new RegExp(`^${name}`) }).click()
  return board
}
const cards = async (page: Page, name: string) => (await column(page, name)).getByRole("listitem").locator("[data-slot=card-title]")

// The list is a table on the web (a row named by its number) and on a
// phone the rows grouped by how far their deadlines are (named by the
// title first).
const list = (page: Page) => (onPhone(page) ? page.getByRole("region", { name: "Buyurtmalar" }) : page.getByRole("table", { name: "Buyurtmalar" }))
const row = (page: Page, title: string) =>
  onPhone(page)
    ? list(page).getByRole("link", { name: new RegExp(`^${title}`) })
    : list(page).getByRole("row").filter({ has: page.getByRole("link", { name: title.replace("Buyurtma ", ""), exact: true }) })
// view picks Kanban or Ro'yxat.
const view = (page: Page, name: "Kanban" | "Ro'yxat") => page.getByRole("tablist", { name: "Ko'rinish" }).getByRole("tab", { name }).click()

test("an employee enters an order with a new customer; the board opens first, and the list stays chosen once chosen", async ({ page }) => {
  await signIn(page, "902223344")
  await page.getByRole("button", { name: /Olma Savdo/ }).click()
  await expect(page.getByRole("heading", { name: "Salom, Vali Aliyev" })).toBeVisible()
  await openSection(page, "Buyurtmalar")
  await expect(boardOf(page)).toBeVisible()
  await expect((await column(page, "Yangi")).getByText(/^(Kartani shu yerga suring|Bo'sh)$/)).toBeVisible()
  expect(await sideScroll(page)).toBeLessThanOrEqual(0)

  await page.getByRole("button", { name: "Buyurtma qo'shish", exact: true }).click()
  const dialog = page.getByRole("dialog", { name: "Buyurtma qo'shish" })
  const customer = dialog.getByRole("group", { name: "Mijoz" })
  await customer.getByRole("combobox", { name: "Telefon raqami" }).fill("901112233")
  await customer.getByLabel("F.I.Sh.").fill("Yangi Mijoz")
  await choose(customer.getByLabel("Manba"), "LinkedIn")
  const order = dialog.getByRole("group", { name: "Buyurtma" })
  await order.getByLabel("Muddat").fill(addDays(today, 2))
  await choose(order.getByLabel("Mas'ul"), "Vali Aliyev")
  expect(await sideScroll(page)).toBeLessThanOrEqual(0)
  await dialog.getByRole("button", { name: "Qo'shish", exact: true }).click()
  await expect(dialog).toBeHidden()

  const card = (await column(page, "Yangi")).getByRole("listitem").filter({ hasText: "Buyurtma № 1" })
  await expect(card).toBeVisible()
  await expect(card).toContainText("Yangi Mijoz")
  await expect(card).toContainText("2 kun qoldi")
  await expect(card).toContainText("Vali A.")
  await expect(page.getByText("1 ta", { exact: true })).toBeVisible()
  expect(db.customers.filter((c) => c.companyId === 1).map((c) => c.phone)).toEqual(["998901112233"])

  // The list, once chosen, is what opens next time.
  await view(page, "Ro'yxat")
  await expect(page).toHaveURL(/view=list/)
  await expect(row(page, "Buyurtma № 1")).toBeVisible()
  // A row only names the customer, its whole face being the order's link (a
  // second link under a thumb would open the customer).
  await expect(row(page, "Buyurtma № 1")).toContainText("Yangi Mijoz")
  await expect(list(page).getByRole("link", { name: /^Yangi Mijoz/ })).toHaveCount(0)
  expect(await sideScroll(page)).toBeLessThanOrEqual(0)
  await page.goto("/orders")
  await expect(row(page, "Buyurtma № 1")).toBeVisible()
  await expect(boardOf(page)).toHaveCount(0)
})

test("a customer that is there is picked from the suggestions; the + of a column opens the form for that stage", async ({ page }) => {
  const { jarayonda, anor } = seedOrders()
  await openOrders(page)
  await expect(await cards(page, "Yangi")).toHaveText(["Buyurtma № 2", "Buyurtma № 4"])

  await (await column(page, "Jarayonda")).getByRole("button", { name: "Buyurtma qo'shish: Jarayonda" }).click()
  const dialog = page.getByRole("dialog", { name: "Buyurtma qo'shish" })
  const order = dialog.getByRole("group", { name: "Buyurtma" })
  await expect(order.getByLabel("Bosqich")).toContainText("Jarayonda")

  const customer = dialog.getByRole("group", { name: "Mijoz" })
  await customer.getByRole("combobox", { name: "Telefon raqami" }).fill("933")
  await page.getByRole("option", { name: /Anor Tekstil MChJ/ }).click()

  // The customer that is there stands in a card of its own: nothing more is asked about it.
  const linked = customer.getByRole("region", { name: "Mavjud mijoz" })
  await expect(linked).toContainText("Anor Tekstil MChJ")
  await expect(linked).toContainText("Yuridik · +998 93 333 44 55")
  await expect(customer.getByRole("combobox", { name: "Telefon raqami" })).toHaveCount(0)
  await expect(customer.getByLabel("INN")).toHaveCount(0)
  expect(await sideScroll(page)).toBeLessThanOrEqual(0)

  await order.getByLabel("Muddat").fill(today)
  await dialog.getByRole("button", { name: "Qo'shish", exact: true }).click()
  await expect(dialog).toBeHidden()

  const card = (await column(page, "Jarayonda")).getByRole("listitem").filter({ hasText: "Buyurtma № 5" })
  await expect(card).toBeVisible()
  await expect(card).toContainText("Anor Tekstil MChJ")
  await expect(card).toContainText("Bugun")
  expect(db.orders.at(-1)).toMatchObject({ number: 5, customerId: anor.id, stageId: jarayonda.id })
})

test("on the board a card is moved to another column, from its menu or by dragging; the done column opens; a late order is marked", async ({ page }) => {
  const { invoice, jarayonda } = seedOrders()
  await openOrders(page)
  await expect(await cards(page, "Yangi")).toHaveText(["Buyurtma № 2", "Buyurtma № 4"])
  await expect(await cards(page, "Jarayonda")).toHaveText(["Buyurtma № 3"])
  const late = (await column(page, "Yangi")).getByRole("listitem").filter({ hasText: "Buyurtma № 2" })
  await expect(late.getByText("2 kun kechikdi")).toBeVisible()
  expect(await sideScroll(page)).toBeLessThanOrEqual(0)

  if (onPhone(page)) {
    await late.getByRole("button", { name: "Bosqich: Buyurtma № 2" }).click()
    await page.getByRole("menuitemradio", { name: "Jarayonda" }).click()
  } else {
    const from = await late.boundingBox()
    const to = await (await column(page, "Jarayonda")).boundingBox()
    if (!from || !to) throw new Error("the card or the column is not on screen")
    await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2)
    await page.mouse.down()
    await page.mouse.move(to.x + to.width / 2, to.y + 80, { steps: 12 })
    await page.mouse.up()
  }

  await expect(await cards(page, "Jarayonda")).toHaveText(["Buyurtma № 2", "Buyurtma № 3"])
  await expect(await cards(page, "Yangi")).toHaveText(["Buyurtma № 4"])
  await expect.poll(() => db.orders.find((t) => t.id === invoice.id)?.stageId).toBe(jarayonda.id)
  if (onPhone(page)) {
    // A phone counts each stage on its chip; the done stage is a chip too.
    await expect(boardOf(page).getByRole("radio", { name: /^Yangi/ })).toHaveText("Yangi 1")
    await expect(page.getByText("4 ta", { exact: true })).toBeVisible()
    await expect(await cards(page, "Bajarildi")).toHaveText(["Buyurtma № 1"])
    await expect(boardOf(page).getByText(/kechikdi/)).toHaveCount(0)
    expect(await sideScroll(page)).toBeLessThanOrEqual(0)
    return
  }
  await expect((await column(page, "Yangi")).getByText("Jami: 1")).toBeVisible()
  await expect(page.getByText("4 ta", { exact: true })).toBeVisible()

  // The done column stands folded; opened, it shows its order by the day alone.
  await expect(await cards(page, "Bajarildi")).toHaveCount(0)
  await (await column(page, "Bajarildi")).getByRole("button", { name: "Bajarildi (1)" }).click()
  await expect(await cards(page, "Bajarildi")).toHaveText(["Buyurtma № 1"])
  await expect((await column(page, "Bajarildi")).getByText(/kechikdi/)).toHaveCount(0)
  expect(await sideScroll(page)).toBeLessThanOrEqual(0)
  await (await column(page, "Bajarildi")).getByRole("button", { name: "Bajarildi (1)" }).click()
  await expect(await cards(page, "Bajarildi")).toHaveCount(0)
})

test("the owner edits an order, reads its history, finds it on the customer's page, cannot delete the customer or the stage, and deletes the order", async ({ page }) => {
  const { call } = seedOrders()
  await openOrders(page)
  await view(page, "Ro'yxat")
  await row(page, "Buyurtma № 4").click()
  await expect(page).toHaveURL(new RegExp(`/orders/${call.id}$`))
  await expect(page.getByRole("heading", { level: 1, name: "Buyurtma № 4" })).toBeVisible()
  await expect(page.getByRole("region", { name: "Ma'lumot" }).getByText("Ertalab qo'ng'iroq")).toBeVisible()
  expect(await sideScroll(page)).toBeLessThanOrEqual(0)

  // The stage is moved right on its track.
  await page.getByRole("radiogroup", { name: "Bosqich" }).getByRole("radio", { name: "Jarayonda" }).click()
  await expect(page.getByText("Bosqich o'zgartirildi")).toBeVisible()

  await page.getByRole("button", { name: "Tahrirlash" }).click()
  const dialog = page.getByRole("dialog", { name: "Buyurtmani tahrirlash" })
  await expect(dialog.getByRole("region", { name: "Mavjud mijoz" })).toContainText("Dilshod Karimov")
  await dialog.getByLabel("Muddat").fill(addDays(today, 5))
  await dialog.getByRole("button", { name: "Saqlash" }).click()
  await expect(dialog).toBeHidden()
  await expect(page.getByRole("heading", { level: 1, name: "Buyurtma № 4" })).toBeVisible()

  await tab(page, "Tarix")
  const history = page.getByRole("list", { name: "Tarix" })
  const [edited, moved, entered] = [0, 1, 2].map((n) => history.getByRole("listitem").nth(n))
  await expect(edited).toContainText("Tahrirlandi")
  await expect(edited).toContainText("Muddat")
  await expect(moved).toContainText("Bosqich")
  await expect(moved).toContainText("Jarayonda")
  await expect(entered).toContainText("Qo'shildi")

  // The customer's page shows the order; the customer is not deleted while it has one.
  await tab(page, "Ma'lumot")
  await page.getByRole("region", { name: "Mijoz" }).getByRole("link", { name: /^Dilshod Karimov/ }).click()
  await expect(page.getByRole("heading", { level: 1, name: "Dilshod Karimov" })).toBeVisible()
  await tab(page, "Buyurtmalar")
  const orders = page.getByRole("region", { name: "Buyurtmalar" })
  await expect(orders.getByRole("link", { name: /^Buyurtma № 4/ })).toBeVisible()
  await expect(orders.getByRole("link")).toHaveCount(2)
  await page.getByRole("button", { name: "Mijozni o'chirish" }).click()
  await page.getByRole("alertdialog", { name: "Mijozni o'chirasizmi?" }).getByRole("button", { name: "O'chirish" }).click()
  await expect(page.getByText("Bu mijozda 2 ta buyurtma bor")).toBeVisible()
  await expect(page.getByRole("heading", { level: 1, name: "Dilshod Karimov" })).toBeVisible()

  // Nor is a stage with an order in it (the stages are a part of the settings).
  await openSection(page, "Sozlamalar")
  await page.getByRole("main").getByRole("link", { name: /^Bosqichlar/ }).click()
  await page.getByRole("list", { name: "Bosqichlar" }).getByRole("button", { name: /^Jarayonda/ }).click()
  await page.getByRole("dialog", { name: "Bosqichni tahrirlash" }).getByRole("button", { name: "Bosqichni o'chirish" }).click()
  await page.getByRole("alertdialog", { name: "Bosqichni o'chirasizmi?" }).getByRole("button", { name: "O'chirish" }).click()
  await expect(page.getByText("Bu bosqichda 2 ta buyurtma bor")).toBeVisible()
  await page.keyboard.press("Escape")

  await page.goto(`/orders/${call.id}`)
  await expect(page.getByRole("heading", { level: 1, name: "Buyurtma № 4" })).toBeVisible()
  await page.getByRole("button", { name: "Buyurtmani o'chirish" }).click()
  await page.getByRole("alertdialog", { name: "Buyurtmani o'chirasizmi?" }).getByRole("button", { name: "O'chirish" }).click()
  await expect(page).toHaveURL(/\/orders$/)
  await expect(row(page, "Buyurtma № 2")).toBeVisible()
  await expect(row(page, "Buyurtma № 4")).toHaveCount(0)
})

// An order's money (logic/orders.md, 4.3–4.4): the price, a product from
// the stock and an advance entered with it; the card, the page, a payment
// on its own and the customer's debt.
test("the owner enters an order with a price, a product and an advance; the page says the money and the cost; a payment settles part; the customer's debt follows", async ({ page }) => {
  test.setTimeout(120_000)
  seedOrders()
  // Asosiy holds 12,5 kg Olma bought at 1 000.
  seedWarehouse(seedCatalog())
  await openOrders(page)

  await page.getByRole("button", { name: "Buyurtma qo'shish", exact: true }).click()
  const dialog = page.getByRole("dialog", { name: "Buyurtma qo'shish" })
  const customer = dialog.getByRole("group", { name: "Mijoz" })
  await customer.getByRole("combobox", { name: "Telefon raqami" }).fill("911")
  await page.getByRole("option", { name: /Dilshod Karimov/ }).click()
  const order = dialog.getByRole("group", { name: "Buyurtma" })
  await order.getByLabel("Muddat").fill(addDays(today, 3))
  // The money: the price in so'm, a product without a price, the advance.
  const money = dialog.getByRole("group", { name: "Narx" })
  await money.getByLabel("Narx").fill("5000")
  await dialog.getByRole("button", { name: "Qator qo'shish" }).click()
  const line = dialog.getByRole("group", { name: "1-qator" })
  await pick(page, line, "Mahsulot", "ol", /Olma/)
  await line.getByLabel("Miqdor").fill("2")
  await expect(line.getByLabel("Narx")).toHaveCount(0)
  await dialog.getByRole("button", { name: "To'lov qo'shish" }).click()
  await dialog.getByRole("group", { name: "1-to'lov" }).getByLabel("Summa").fill("400")
  await expect(dialog.getByText("Qolgan: 4 600 so'm")).toBeVisible()
  expect(await sideScroll(page)).toBeLessThanOrEqual(0)
  await dialog.getByRole("button", { name: "Qo'shish", exact: true }).click()
  await expect(dialog).toBeHidden()

  // The card says the price and what is left; the page says it all.
  const card = (await column(page, "Yangi")).getByRole("listitem").filter({ hasText: "Buyurtma № 5" })
  await expect(card).toContainText("5 000 so'm · qolgan 4 600 so'm")
  await settle(page)
  await card.getByRole("link").click()
  await expect(page).toHaveURL(/\/orders\/\d+$/, { timeout: 15_000 })
  await expect(page.getByRole("heading", { level: 1, name: "Buyurtma № 5" })).toBeVisible()
  const pul = page.getByRole("region", { name: "Pul" })
  await expect(pul).toContainText("Narx 5 000 so'm")
  await expect(pul).toContainText("To'langan 400 so'm")
  await expect(pul).toContainText("Qoldiq 4 600 so'm")
  await tab(page, "Tovarlar")
  const goods = page.getByRole("region", { name: "Mahsulotlar" })
  await expect(goods).toContainText("Olma")
  await expect(goods).toContainText("2 kg")
  await expect(goods).toContainText("Tan narxi2 000 so'm")
  await expect(goods).toContainText("Foyda3 000 so'm")
  await tab(page, "To'lovlar")
  await expect(page.getByRole("region", { name: "To'lovlar" }).getByRole("listitem")).toHaveCount(1)
  expect(await sideScroll(page)).toBeLessThanOrEqual(0)

  // A payment on its own, from the page's tile: typed on the keypad.
  await page.getByRole("group", { name: "Amallar" }).getByRole("button", { name: "To'lov" }).click()
  const paymentDialog = page.getByRole("dialog", { name: "To'lov qo'shish" })
  await press(paymentDialog, "300")
  await paymentDialog.getByRole("button", { name: "Qo'shish" }).click()
  await expect(paymentDialog).toBeHidden()
  await expect(pul).toContainText("Qoldiq 4 300 so'm")
  await expect(page.getByRole("region", { name: "To'lovlar" }).getByRole("listitem")).toHaveCount(2)
  await settle(page)

  // The customer owes the rest; the statement names the order and its payments.
  await tab(page, "Ma'lumot")
  await page.getByRole("region", { name: "Mijoz" }).getByRole("link", { name: /^Dilshod Karimov/ }).click()
  await expect(page.getByRole("heading", { level: 1, name: "Dilshod Karimov" })).toBeVisible()
  await expect(page.locator('[data-slot="stat-card"]').filter({ hasText: "Balans" })).toContainText(/4\s300\s*so'm\s*Qarz/)
  await tab(page, "Hisob harakati")
  const statement = days(page, "Hisob harakati")
  await expect(statement.getByRole("link", { name: /^Buyurtma № 5/ })).toBeVisible()
  await expect(statement.getByRole("link", { name: /^To'lov · № 5/ })).toHaveCount(2)
})

test("the orders' old addresses lead to their pages, the query kept", async ({ page }) => {
  await signIn(page, "901234567")
  await expect(page.getByRole("heading", { name: "Salom, Ali Valiyev" })).toBeVisible()

  for (const [old, now] of [
    ["/tasks", "/orders"],
    ["/tasks?view=list", "/orders?view=list"],
    ["/tasks/5", "/orders/5"],
    ["/settings/task-types", "/settings/order-types"],
    ["/settings/task-types/7", "/settings/order-types/7"],
  ]) {
    await page.goto(old)
    await expect(page, old).toHaveURL((url) => url.pathname + url.search === now)
  }
})
