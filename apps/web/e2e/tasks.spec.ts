import type { Page } from "@playwright/test"
import { addDays, db, localToday, seedTasks } from "../mocks/data"
import { expect, test } from "./fixtures"
import { choose, onPhone, openSection, sideScroll, signIn } from "./helpers"

const today = localToday()

// openTasks signs the owner of Olma Savdo in and opens the tasks: the board,
// the first time.
async function openTasks(page: Page) {
  await signIn(page, "901234567")
  await expect(page.getByRole("heading", { name: "Salom, Ali Valiyev" })).toBeVisible()
  await openSection(page, "Vazifalar")
  await expect(page).toHaveURL(/\/tasks$/)
  await expect(page.getByRole("region", { name: "Kanban" })).toBeVisible()
}

// column is a stage's column of the board; cards are the titles in it.
const column = (page: Page, name: string) => page.getByRole("region", { name: "Kanban" }).getByRole("region", { name })
const cards = (page: Page, name: string) => column(page, name).getByRole("listitem").getByRole("link")

// The list is a table on wide screens and cards on a phone.
const list = (page: Page) =>
  onPhone(page) ? page.getByRole("list", { name: "Vazifalar" }) : page.getByRole("table", { name: "Vazifalar" })

test("an employee enters a task with a new customer; the board opens first, and the list stays chosen once chosen", async ({ page }) => {
  await signIn(page, "902223344")
  await page.getByRole("button", { name: /Olma Savdo/ }).click()
  await expect(page.getByRole("heading", { name: "Salom, Vali Aliyev" })).toBeVisible()
  await openSection(page, "Vazifalar")
  await expect(page.getByRole("region", { name: "Kanban" })).toBeVisible()
  await expect(column(page, "Yangi").getByText("Vazifa yo'q")).toBeVisible()
  expect(await sideScroll(page)).toBeLessThanOrEqual(0)

  await page.getByRole("button", { name: "Vazifa qo'shish", exact: true }).click()
  const dialog = page.getByRole("dialog", { name: "Vazifa qo'shish" })
  const customer = dialog.getByRole("group", { name: "Mijoz" })
  await customer.getByRole("combobox", { name: "Telefon raqami" }).fill("901112233")
  await customer.getByLabel("F.I.Sh.").fill("Yangi Mijoz")
  await choose(customer.getByLabel("Manba"), "LinkedIn")
  const task = dialog.getByRole("group", { name: "Vazifa" })
  await task.getByLabel("Nomi").fill("Shartnoma tuzish")
  await task.getByLabel("Muddat").fill(addDays(today, 2))
  await choose(task.getByLabel("Mas'ul"), "Vali Aliyev")
  expect(await sideScroll(page)).toBeLessThanOrEqual(0)
  await dialog.getByRole("button", { name: "Qo'shish" }).click()
  await expect(dialog).toBeHidden()

  const card = column(page, "Yangi").getByRole("listitem").filter({ hasText: "Shartnoma tuzish" })
  await expect(card).toBeVisible()
  await expect(card).toContainText("Yangi Mijoz")
  await expect(card).toContainText("2 kun qoldi")
  await expect(card).toContainText("Vali Aliyev")
  await expect(page.getByText("Kompaniyangiz vazifalari · 1 ta")).toBeVisible()
  expect(db.customers.filter((c) => c.companyId === 1).map((c) => c.phone)).toEqual(["998901112233"])

  // The list, once chosen, is what opens next time.
  await page.getByRole("radiogroup", { name: "Ko'rinish" }).getByRole("radio", { name: "Ro'yxat" }).click()
  await expect(page).toHaveURL(/view=list/)
  await expect(list(page).getByRole("link", { name: "Shartnoma tuzish" })).toBeVisible()
  // The table links the customer; a card only names it, its whole face being
  // the task's link (a second link under a thumb would open the customer).
  if (onPhone(page)) {
    await expect(list(page).getByText("Yangi Mijoz")).toBeVisible()
    await expect(list(page).getByRole("link", { name: "Yangi Mijoz" })).toHaveCount(0)
  } else {
    await expect(list(page).getByRole("link", { name: "Yangi Mijoz" })).toBeVisible()
  }
  expect(await sideScroll(page)).toBeLessThanOrEqual(0)
  await page.goto("/tasks")
  await expect(list(page).getByRole("link", { name: "Shartnoma tuzish" })).toBeVisible()
  await expect(page.getByRole("region", { name: "Kanban" })).toHaveCount(0)
})

test("a customer that is there is picked from the suggestions; the + of a column opens the form for that stage", async ({ page }) => {
  const { jarayonda, anor } = seedTasks()
  await openTasks(page)
  await expect(cards(page, "Yangi")).toHaveText(["Hisob-faktura", "Qo'ng'iroq qilish"])

  await column(page, "Jarayonda").getByRole("button", { name: "Vazifa qo'shish: Jarayonda" }).click()
  const dialog = page.getByRole("dialog", { name: "Vazifa qo'shish" })
  const task = dialog.getByRole("group", { name: "Vazifa" })
  await expect(task.getByLabel("Bosqich")).toContainText("Jarayonda")

  const customer = dialog.getByRole("group", { name: "Mijoz" })
  await customer.getByRole("combobox", { name: "Telefon raqami" }).fill("933")
  await page.getByRole("option", { name: /Anor Tekstil MChJ/ }).click()

  await expect(customer.getByRole("region", { name: "Mavjud mijoz" })).toContainText("Anor Tekstil MChJ")
  await expect(customer.getByRole("combobox", { name: "Telefon raqami" })).toHaveValue("93 333 44 55")
  await expect(customer.getByRole("combobox", { name: "Telefon raqami" })).toBeDisabled()
  await expect(customer.getByRole("radio", { name: "Yuridik" })).toHaveAttribute("aria-checked", "true")
  await expect(customer.getByLabel("Nomi")).toHaveValue("Anor Tekstil MChJ")
  await expect(customer.getByLabel("Nomi")).toBeDisabled()
  await expect(customer.getByLabel("INN")).toHaveValue("301234567")
  await expect(customer.getByLabel("INN")).toBeDisabled()
  expect(await sideScroll(page)).toBeLessThanOrEqual(0)

  await task.getByLabel("Nomi").fill("Hisobni tekshirish")
  await task.getByLabel("Muddat").fill(today)
  await dialog.getByRole("button", { name: "Qo'shish" }).click()
  await expect(dialog).toBeHidden()

  const card = column(page, "Jarayonda").getByRole("listitem").filter({ hasText: "Hisobni tekshirish" })
  await expect(card).toBeVisible()
  await expect(card).toContainText("Anor Tekstil MChJ")
  await expect(card).toContainText("Bugun")
  expect(db.tasks.at(-1)).toMatchObject({ title: "Hisobni tekshirish", customerId: anor.id, stageId: jarayonda.id })
})

test("on the board a card is moved to another column, from its menu or by dragging; the done column opens; a late task is marked", async ({ page }) => {
  const { invoice, jarayonda } = seedTasks()
  await openTasks(page)
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
  await expect.poll(() => db.tasks.find((t) => t.id === invoice.id)?.stageId).toBe(jarayonda.id)
  await expect(column(page, "Yangi").getByText("Jami: 1")).toBeVisible()
  await expect(page.getByText("Kompaniyangiz vazifalari · 4 ta")).toBeVisible()

  // The done column stands folded; opened, it shows its task by the day alone.
  await expect(cards(page, "Bajarildi")).toHaveCount(0)
  await column(page, "Bajarildi").getByRole("button", { name: "Bajarildi (1)" }).click()
  await expect(cards(page, "Bajarildi")).toHaveText(["Eski buyurtma"])
  await expect(column(page, "Bajarildi").getByText(/kechikdi/)).toHaveCount(0)
  expect(await sideScroll(page)).toBeLessThanOrEqual(0)
  await column(page, "Bajarildi").getByRole("button", { name: "Bajarildi (1)" }).click()
  await expect(cards(page, "Bajarildi")).toHaveCount(0)
})

test("the owner edits a task, reads its history, finds it on the customer's page, cannot delete the customer or the stage, and deletes the task", async ({ page }) => {
  const { call } = seedTasks()
  await openTasks(page)
  await page.getByRole("radiogroup", { name: "Ko'rinish" }).getByRole("radio", { name: "Ro'yxat" }).click()
  await list(page).getByRole("link", { name: "Qo'ng'iroq qilish" }).click()
  await expect(page).toHaveURL(new RegExp(`/tasks/${call.id}$`))
  await expect(page.getByRole("heading", { level: 1, name: "Qo'ng'iroq qilish" })).toBeVisible()
  await expect(page.getByRole("region", { name: "Ma'lumot" }).getByText("Ertalab qo'ng'iroq")).toBeVisible()
  expect(await sideScroll(page)).toBeLessThanOrEqual(0)

  await choose(page.getByRole("combobox", { name: "Bosqich" }), "Jarayonda")
  await expect(page.getByText("Bosqich o'zgartirildi")).toBeVisible()

  await page.getByRole("button", { name: "Tahrirlash" }).click()
  const dialog = page.getByRole("dialog", { name: "Vazifani tahrirlash" })
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

  // The customer's page shows the task; the customer is not deleted while it has one.
  await page.getByRole("region", { name: "Mijoz" }).getByRole("link", { name: "Dilshod Karimov" }).click()
  await expect(page.getByRole("heading", { level: 1, name: "Dilshod Karimov" })).toBeVisible()
  const tasks = page.getByRole("region", { name: "Vazifalar" })
  await expect(tasks.getByRole("link", { name: "Qayta qo'ng'iroq" })).toBeVisible()
  await expect(tasks.getByText("Jami: 2")).toBeVisible()
  await page.getByRole("button", { name: "O'chirish" }).click()
  await page.getByRole("alertdialog", { name: "Mijozni o'chirasizmi?" }).getByRole("button", { name: "O'chirish" }).click()
  await expect(page.getByText("Bu mijozda 2 ta vazifa bor")).toBeVisible()
  await expect(page.getByRole("heading", { level: 1, name: "Dilshod Karimov" })).toBeVisible()

  // Nor is a stage with a task in it (the stages are on the tasks' tab).
  await openSection(page, "Sozlamalar")
  await page.getByRole("tab", { name: "Vazifalar" }).click()
  await page.getByRole("list", { name: "Bosqichlar" }).getByRole("button", { name: "O'chirish: Jarayonda" }).click()
  await page.getByRole("alertdialog", { name: "Bosqichni o'chirasizmi?" }).getByRole("button", { name: "O'chirish" }).click()
  await expect(page.getByText("Bu bosqichda 2 ta vazifa bor")).toBeVisible()

  await page.goto(`/tasks/${call.id}`)
  await expect(page.getByRole("heading", { level: 1, name: "Qayta qo'ng'iroq" })).toBeVisible()
  await page.getByRole("button", { name: "O'chirish" }).click()
  await page.getByRole("alertdialog", { name: "Vazifani o'chirasizmi?" }).getByRole("button", { name: "O'chirish" }).click()
  await expect(page).toHaveURL(/\/tasks$/)
  await expect(list(page).getByRole("link", { name: "Qayta qo'ng'iroq" })).toHaveCount(0)
})
