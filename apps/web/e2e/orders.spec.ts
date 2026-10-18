import type { Page } from "@playwright/test"
import { addDays, db, localToday, seedOrders } from "../mocks/data"
import { expect, test } from "./fixtures"
import { choose, onPhone, openSection, sideScroll, signIn } from "./helpers"

const today = localToday()

// openOrders signs the owner of Olma Savdo in and opens the orders: the board,
// the first time.
async function openOrders(page: Page) {
  await signIn(page, "901234567")
  await expect(page.getByRole("heading", { name: "Salom, Ali Valiyev" })).toBeVisible()
  await openSection(page, "Buyurtmalar")
  await expect(page).toHaveURL(/\/orders$/)
  await expect(page.getByRole("region", { name: "Kanban" })).toBeVisible()
}

// column is a stage's column of the board; cards are the titles in it.
const column = (page: Page, name: string) => page.getByRole("region", { name: "Kanban" }).getByRole("region", { name })
const cards = (page: Page, name: string) => column(page, name).getByRole("listitem").locator("[data-slot=card-title]")

// The list is the orders' rows, grouped by how far their deadlines are, on
// any screen; a row is named by its title first.
const list = (page: Page) => page.getByRole("region", { name: "Buyurtmalar" })
const row = (page: Page, title: string) => list(page).getByRole("link", { name: new RegExp(`^${title}`) })
// view picks Kanban or Ro'yxat.
const view = (page: Page, name: "Kanban" | "Ro'yxat") => page.getByRole("tablist", { name: "Ko'rinish" }).getByRole("tab", { name }).click()

test("an employee enters an order with a new customer; the board opens first, and the list stays chosen once chosen", async ({ page }) => {
  await signIn(page, "902223344")
  await page.getByRole("button", { name: /Olma Savdo/ }).click()
  await expect(page.getByRole("heading", { name: "Salom, Vali Aliyev" })).toBeVisible()
  await openSection(page, "Buyurtmalar")
  await expect(page.getByRole("region", { name: "Kanban" })).toBeVisible()
  await expect(column(page, "Yangi").getByText(/^(Kartani shu yerga suring|Bo'sh)$/)).toBeVisible()
  expect(await sideScroll(page)).toBeLessThanOrEqual(0)

  await page.getByRole("button", { name: "Buyurtma qo'shish", exact: true }).click()
  const dialog = page.getByRole("dialog", { name: "Buyurtma qo'shish" })
  const customer = dialog.getByRole("group", { name: "Mijoz" })
  await customer.getByRole("combobox", { name: "Telefon raqami" }).fill("901112233")
  await customer.getByLabel("F.I.Sh.").fill("Yangi Mijoz")
  await choose(customer.getByLabel("Manba"), "LinkedIn")
  const order = dialog.getByRole("group", { name: "Buyurtma" })
  await order.getByLabel("Nomi").fill("Shartnoma tuzish")
  await order.getByLabel("Muddat").fill(addDays(today, 2))
  await choose(order.getByLabel("Mas'ul"), "Vali Aliyev")
  expect(await sideScroll(page)).toBeLessThanOrEqual(0)
  await dialog.getByRole("button", { name: "Qo'shish" }).click()
  await expect(dialog).toBeHidden()

  const card = column(page, "Yangi").getByRole("listitem").filter({ hasText: "Shartnoma tuzish" })
  await expect(card).toBeVisible()
  await expect(card).toContainText("Yangi Mijoz")
  await expect(card).toContainText("2 kun qoldi")
  await expect(card).toContainText("Vali A.")
  await expect(page.getByText("1 ta", { exact: true })).toBeVisible()
  expect(db.customers.filter((c) => c.companyId === 1).map((c) => c.phone)).toEqual(["998901112233"])

  // The list, once chosen, is what opens next time.
  await view(page, "Ro'yxat")
  await expect(page).toHaveURL(/view=list/)
  await expect(row(page, "Shartnoma tuzish")).toBeVisible()
  // A row only names the customer, its whole face being the order's link (a
  // second link under a thumb would open the customer).
  await expect(row(page, "Shartnoma tuzish")).toContainText("Yangi Mijoz")
  await expect(list(page).getByRole("link", { name: /^Yangi Mijoz/ })).toHaveCount(0)
  expect(await sideScroll(page)).toBeLessThanOrEqual(0)
  await page.goto("/orders")
  await expect(row(page, "Shartnoma tuzish")).toBeVisible()
  await expect(page.getByRole("region", { name: "Kanban" })).toHaveCount(0)
})

test("a customer that is there is picked from the suggestions; the + of a column opens the form for that stage", async ({ page }) => {
  const { jarayonda, anor } = seedOrders()
  await openOrders(page)
  await expect(cards(page, "Yangi")).toHaveText(["Hisob-faktura", "Qo'ng'iroq qilish"])

  await column(page, "Jarayonda").getByRole("button", { name: "Buyurtma qo'shish: Jarayonda" }).click()
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

  await order.getByLabel("Nomi").fill("Hisobni tekshirish")
  await order.getByLabel("Muddat").fill(today)
  await dialog.getByRole("button", { name: "Qo'shish" }).click()
  await expect(dialog).toBeHidden()

  const card = column(page, "Jarayonda").getByRole("listitem").filter({ hasText: "Hisobni tekshirish" })
  await expect(card).toBeVisible()
  await expect(card).toContainText("Anor Tekstil MChJ")
  await expect(card).toContainText("Bugun")
  expect(db.orders.at(-1)).toMatchObject({ title: "Hisobni tekshirish", customerId: anor.id, stageId: jarayonda.id })
})

test("on the board a card is moved to another column, from its menu or by dragging; the done column opens; a late order is marked", async ({ page }) => {
  const { invoice, jarayonda } = seedOrders()
  await openOrders(page)
  await expect(cards(page, "Yangi")).toHaveText(["Hisob-faktura", "Qo'ng'iroq qilish"])
  await expect(cards(page, "Jarayonda")).toHaveText(["Shartnoma yuborish"])
  const late = column(page, "Yangi").getByRole("listitem").filter({ hasText: "Hisob-faktura" })
  await expect(late.getByText("2 kun kechikdi")).toBeVisible()
  expect(await sideScroll(page)).toBeLessThanOrEqual(0)

  if (onPhone(page)) {
    await late.getByRole("button", { name: "Bosqich: Hisob-faktura" }).click()
    await page.getByRole("menuitemradio", { name: "Jarayonda" }).click()
  } else {
    const from = await late.boundingBox()
    const to = await column(page, "Jarayonda").boundingBox()
    if (!from || !to) throw new Error("the card or the column is not on screen")
    await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2)
    await page.mouse.down()
    await page.mouse.move(to.x + to.width / 2, to.y + 80, { steps: 12 })
    await page.mouse.up()
  }

  await expect(cards(page, "Jarayonda")).toHaveText(["Hisob-faktura", "Shartnoma yuborish"])
  await expect(cards(page, "Yangi")).toHaveText(["Qo'ng'iroq qilish"])
  await expect.poll(() => db.orders.find((t) => t.id === invoice.id)?.stageId).toBe(jarayonda.id)
  await expect(column(page, "Yangi").getByText("Jami: 1")).toBeVisible()
  await expect(page.getByText("4 ta", { exact: true })).toBeVisible()

  // The done column stands folded; opened, it shows its order by the day alone.
  await expect(cards(page, "Bajarildi")).toHaveCount(0)
  await column(page, "Bajarildi").getByRole("button", { name: "Bajarildi (1)" }).click()
  await expect(cards(page, "Bajarildi")).toHaveText(["Eski buyurtma"])
  await expect(column(page, "Bajarildi").getByText(/kechikdi/)).toHaveCount(0)
  expect(await sideScroll(page)).toBeLessThanOrEqual(0)
  await column(page, "Bajarildi").getByRole("button", { name: "Bajarildi (1)" }).click()
  await expect(cards(page, "Bajarildi")).toHaveCount(0)
})

test("the owner edits an order, reads its history, finds it on the customer's page, cannot delete the customer or the stage, and deletes the order", async ({ page }) => {
  const { call } = seedOrders()
  await openOrders(page)
  await view(page, "Ro'yxat")
  await row(page, "Qo'ng'iroq qilish").click()
  await expect(page).toHaveURL(new RegExp(`/orders/${call.id}$`))
  await expect(page.getByRole("heading", { level: 1, name: "Qo'ng'iroq qilish" })).toBeVisible()
  await expect(page.getByRole("region", { name: "Ma'lumot" }).getByText("Ertalab qo'ng'iroq")).toBeVisible()
  expect(await sideScroll(page)).toBeLessThanOrEqual(0)

  // The stage is moved right on its track.
  await page.getByRole("radiogroup", { name: "Bosqich" }).getByRole("radio", { name: "Jarayonda" }).click()
  await expect(page.getByText("Bosqich o'zgartirildi")).toBeVisible()

  await page.getByRole("button", { name: "Tahrirlash" }).click()
  const dialog = page.getByRole("dialog", { name: "Buyurtmani tahrirlash" })
  await expect(dialog.getByRole("region", { name: "Mavjud mijoz" })).toContainText("Dilshod Karimov")
  await dialog.getByLabel("Nomi").fill("Qayta qo'ng'iroq")
  await dialog.getByRole("button", { name: "Saqlash" }).click()
  await expect(dialog).toBeHidden()
  await expect(page.getByRole("heading", { level: 1, name: "Qayta qo'ng'iroq" })).toBeVisible()

  const history = page.getByRole("list", { name: "Tarix" })
  const [edited, moved, entered] = [0, 1, 2].map((n) => history.getByRole("listitem").nth(n))
  await expect(edited).toContainText("Tahrirlandi")
  await expect(edited).toContainText("Nomi")
  await expect(moved).toContainText("Bosqich")
  await expect(moved).toContainText("Jarayonda")
  await expect(entered).toContainText("Qo'shildi")

  // The customer's page shows the order; the customer is not deleted while it has one.
  await page.getByRole("region", { name: "Mijoz" }).getByRole("link", { name: /^Dilshod Karimov/ }).click()
  await expect(page.getByRole("heading", { level: 1, name: "Dilshod Karimov" })).toBeVisible()
  const orders = page.getByRole("region", { name: "Buyurtmalar" })
  await expect(orders.getByRole("link", { name: /^Qayta qo'ng'iroq/ })).toBeVisible()
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
  await expect(page.getByRole("heading", { level: 1, name: "Qayta qo'ng'iroq" })).toBeVisible()
  await page.getByRole("button", { name: "Buyurtmani o'chirish" }).click()
  await page.getByRole("alertdialog", { name: "Buyurtmani o'chirasizmi?" }).getByRole("button", { name: "O'chirish" }).click()
  await expect(page).toHaveURL(/\/orders$/)
  await expect(row(page, "Hisob-faktura")).toBeVisible()
  await expect(row(page, "Qayta qo'ng'iroq")).toHaveCount(0)
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
