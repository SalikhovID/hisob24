import type { Page } from "@playwright/test"
import { addDays, db, DILNOZA, join, localToday } from "../mocks/data"
import { expect, test } from "./fixtures"
import { choose, onPhone, openSection, sideScroll, signIn } from "./helpers"

const today = localToday()

// openNok signs Vali in and opens Nok Market, which has two locations:
// Asosiy and Chilonzor (logic/locations.md).
async function openNok(page: Page) {
  await signIn(page, "902223344")
  await page.getByRole("button", { name: /Nok Market/ }).click()
  await expect(page.getByRole("heading", { name: "Salom, Vali Aliyev" })).toBeVisible()
}

const switcher = (page: Page) => page.getByRole("combobox", { name: "Lokatsiya" })

// The members are a table on a wide screen and cards on a phone.
const members = (page: Page) =>
  onPhone(page) ? page.getByRole("list", { name: "Xodimlar" }) : page.getByRole("table", { name: "Xodimlar" })

test("the owner switches between the locations: the tasks are the current one's, the customer's page shows them all, the task's page says its own", async ({
  page,
}) => {
  await openNok(page)
  await expect(switcher(page)).toContainText("Asosiy")
  expect(await sideScroll(page)).toBeLessThanOrEqual(0)

  // A task entered in Chilonzor.
  await choose(switcher(page), "Chilonzor")
  await expect(switcher(page)).toContainText("Chilonzor")
  await openSection(page, "Vazifalar")
  await expect(page.getByRole("region", { name: "Kanban" })).toBeVisible()
  await page.getByRole("button", { name: "Vazifa qo'shish", exact: true }).click()
  const dialog = page.getByRole("dialog", { name: "Vazifa qo'shish" })
  const customer = dialog.getByRole("group", { name: "Mijoz" })
  await customer.getByRole("combobox", { name: "Telefon raqami" }).fill("901112233")
  await customer.getByLabel("F.I.Sh.").fill("Chilonzor Mijozi")
  const task = dialog.getByRole("group", { name: "Vazifa" })
  await task.getByLabel("Nomi").fill("Chilonzorda")
  await task.getByLabel("Muddat").fill(addDays(today, 2))
  await dialog.getByRole("button", { name: "Qo'shish" }).click()
  await expect(dialog).toBeHidden()
  const yangi = page.getByRole("region", { name: "Kanban" }).getByRole("region", { name: "Yangi" })
  await expect(yangi.getByRole("listitem").filter({ hasText: "Chilonzorda" })).toBeVisible()
  const chilonzor = db.locations.find((l) => l.companyId === 2 && l.name === "Chilonzor")!
  expect(db.tasks.at(-1)?.locationId).toBe(chilonzor.id)

  // In Asosiy the task is out of sight.
  await choose(switcher(page), "Asosiy")
  await expect(yangi.getByText("Chilonzorda")).toHaveCount(0)
  await expect(yangi.getByText("Vazifa yo'q")).toBeVisible()
  expect(await sideScroll(page)).toBeLessThanOrEqual(0)

  // The customer's page shows its tasks of every location, each with its own.
  await openSection(page, "Mijozlar")
  await page.getByRole("link", { name: "Chilonzor Mijozi" }).click()
  await expect(page.getByRole("heading", { name: "Chilonzor Mijozi" })).toBeVisible()
  const tasks = page.getByRole("region", { name: "Vazifalar" })
  await expect(tasks.getByText("Chilonzorda").filter({ visible: true })).toBeVisible()
  await expect(tasks.getByText("Chilonzor", { exact: true }).filter({ visible: true })).toBeVisible()

  // The task's page says its location; the switch stays where it was.
  await tasks.getByRole("link", { name: "Chilonzorda" }).click()
  await expect(page.getByRole("heading", { level: 1, name: "Chilonzorda" })).toBeVisible()
  const info = page.getByRole("region", { name: "Ma'lumot" })
  await expect(info.getByText("Lokatsiya", { exact: true })).toBeVisible()
  await expect(info.getByText("Chilonzor", { exact: true })).toBeVisible()
  await expect(switcher(page)).toContainText("Asosiy")
})

test("with one location there is nothing to switch", async ({ page }) => {
  await signIn(page, "901234567")
  await expect(page.getByRole("heading", { name: "Salom, Ali Valiyev" })).toBeVisible()
  await expect(switcher(page)).toHaveCount(0)
})

// signOut leaves through the profile menu.
async function signOut(page: Page) {
  await page.getByRole("button", { name: "Profil" }).click()
  await page.getByRole("menuitem", { name: "Chiqish" }).click()
  await expect(page).toHaveURL(/\/login$/)
}

// enterTask enters a task with a new customer into the current location,
// assigned to whoever is named.
async function enterTask(page: Page, title: string, phone: string, assignee: string | null) {
  await page.getByRole("button", { name: "Vazifa qo'shish", exact: true }).click()
  const dialog = page.getByRole("dialog", { name: "Vazifa qo'shish" })
  const customer = dialog.getByRole("group", { name: "Mijoz" })
  await customer.getByRole("combobox", { name: "Telefon raqami" }).fill(phone)
  await customer.getByLabel("F.I.Sh.").fill(`Mijoz ${title}`)
  const task = dialog.getByRole("group", { name: "Vazifa" })
  await task.getByLabel("Nomi").fill(title)
  await task.getByLabel("Muddat").fill(addDays(today, 2))
  if (assignee) await choose(task.getByLabel("Mas'ul"), assignee)
  await dialog.getByRole("button", { name: "Qo'shish" }).click()
  await expect(dialog).toBeHidden()
}

test("the owner restricts an employee to one location: they see its tasks alone, with no switch, until the restriction is lifted", async ({
  page,
}) => {
  // Three sign-ins in one test: the mock's SMS minute is off.
  test.setTimeout(120_000)
  db.cooldown = false
  join(DILNOZA, 2, "Dilnoza Rahimova")
  await openNok(page)

  // A task in Asosiy, assigned to Dilnoza.
  await openSection(page, "Vazifalar")
  await expect(page.getByRole("region", { name: "Kanban" })).toBeVisible()
  await enterTask(page, "Asosiyda", "901112244", "Dilnoza Rahimova")

  // Restricted to Chilonzor: the dialog warns of the task left in Asosiy.
  await openSection(page, "Xodimlar")
  await members(page).getByRole("button", { name: "Lokatsiyalarni o'zgartirish: Dilnoza Rahimova" }).click()
  const dialog = page.getByRole("dialog", { name: "Lokatsiyalarni o'zgartirish" })
  await dialog.getByRole("checkbox", { name: "Barcha lokatsiyalar" }).click()
  await dialog.getByRole("checkbox", { name: "Chilonzor" }).click()
  await expect(dialog.getByText("Boshqa lokatsiyalarda 1 ta vazifaga mas'ul")).toBeVisible()
  await dialog.getByRole("button", { name: "Saqlash" }).click()
  await expect(dialog).toBeHidden()
  await expect(members(page).getByText("Chilonzor", { exact: true })).toBeVisible()

  // In Asosiy, Dilnoza is not offered for a task any more.
  await openSection(page, "Vazifalar")
  await page.getByRole("button", { name: "Vazifa qo'shish", exact: true }).click()
  const add = page.getByRole("dialog", { name: "Vazifa qo'shish" })
  await add.getByRole("group", { name: "Vazifa" }).getByLabel("Mas'ul").click()
  await expect(page.getByRole("option", { name: "Dilnoza Rahimova" })).toHaveCount(0)
  await expect(page.getByRole("option", { name: "Vali Aliyev" })).toBeVisible()
  await page.keyboard.press("Escape")
  await page.keyboard.press("Escape")
  await expect(add).toBeHidden()
  await signOut(page)

  // Dilnoza: no switch, Chilonzor's tasks alone; she enters one there.
  await signIn(page, "906667788")
  await expect(page.getByRole("heading", { name: "Salom, Dilnoza Rahimova" })).toBeVisible()
  await expect(switcher(page)).toHaveCount(0)
  await openSection(page, "Vazifalar")
  const yangi = page.getByRole("region", { name: "Kanban" }).getByRole("region", { name: "Yangi" })
  await expect(yangi.getByText("Vazifa yo'q")).toBeVisible()
  await expect(yangi.getByText("Asosiyda")).toHaveCount(0)
  await enterTask(page, "Chilonzorda", "901112255", null)
  await expect(yangi.getByRole("listitem").filter({ hasText: "Chilonzorda" })).toBeVisible()
  const chilonzor = db.locations.find((l) => l.companyId === 2 && l.name === "Chilonzor")!
  expect(db.tasks.at(-1)?.locationId).toBe(chilonzor.id)
  await signOut(page)

  // The restriction lifted, she sees both locations again.
  await openNok(page)
  await openSection(page, "Xodimlar")
  await members(page).getByRole("button", { name: "Lokatsiyalarni o'zgartirish: Dilnoza Rahimova" }).click()
  const again = page.getByRole("dialog", { name: "Lokatsiyalarni o'zgartirish" })
  await again.getByRole("checkbox", { name: "Barcha lokatsiyalar" }).click()
  await again.getByRole("button", { name: "Saqlash" }).click()
  await expect(again).toBeHidden()
  await expect(members(page).getByText("Barchasi").filter({ visible: true })).toHaveCount(2)
  await signOut(page)
  await signIn(page, "906667788")
  await expect(switcher(page)).toContainText("Asosiy")
  await openSection(page, "Vazifalar")
  await expect(yangi.getByRole("listitem").filter({ hasText: "Asosiyda" })).toBeVisible()
  await choose(switcher(page), "Chilonzor")
  await expect(yangi.getByRole("listitem").filter({ hasText: "Chilonzorda" })).toBeVisible()
})
