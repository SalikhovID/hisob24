import type { Page } from "@playwright/test"
import { addDays, db, DILNOZA, join, localToday } from "../mocks/data"
import { expect, test } from "./fixtures"
import { choose, chooseLocation, goHome, locationSwitch, openSection, sideScroll, signIn, signOut } from "./helpers"

const today = localToday()

// openNok signs Vali in and opens Nok Market, which has two locations:
// Asosiy and Chilonzor (logic/locations.md).
async function openNok(page: Page) {
  await signIn(page, "902223344")
  await page.getByRole("button", { name: /Nok Market/ }).click()
  await expect(page.getByRole("heading", { name: "Salom, Vali Aliyev" })).toBeVisible()
}

// The members are the prototype's rows on any screen.
const members = (page: Page) => page.getByRole("list", { name: "Xodimlar" })

// placesOf opens a member's locations sheet: their row opens their sheet, its row the locations'.
async function placesOf(page: Page, name: RegExp) {
  await members(page).getByRole("button", { name }).click()
  await page.getByRole("dialog", { name: "Xodim" }).getByRole("button", { name: /^Lokatsiyalar/ }).click()
  return page.getByRole("dialog", { name: "Lokatsiyalarni o'zgartirish" })
}

test("the owner switches between the locations: the tasks are the current one's, the customer's page shows them all, the task's page says its own", async ({
  page,
}) => {
  await openNok(page)
  await expect(locationSwitch(page)).toHaveAccessibleName("Lokatsiya: Asosiy")
  expect(await sideScroll(page)).toBeLessThanOrEqual(0)

  // A task entered in Chilonzor.
  await chooseLocation(page, "Chilonzor")
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
  await chooseLocation(page, "Asosiy")
  await expect(yangi.getByText("Chilonzorda")).toHaveCount(0)
  await expect(yangi.getByText(/^(Kartani shu yerga suring|Bo'sh)$/)).toBeVisible()
  expect(await sideScroll(page)).toBeLessThanOrEqual(0)

  // The customer's page shows its tasks of every location, each with its own.
  await openSection(page, "Mijozlar")
  await page.getByRole("link", { name: "Chilonzor Mijozi" }).click()
  await expect(page.getByRole("heading", { name: "Chilonzor Mijozi" })).toBeVisible()
  const tasks = page.getByRole("region", { name: "Vazifalar" })
  await expect(tasks.getByRole("link", { name: /^Chilonzorda/ }).locator("[data-slot=row-sub]")).toHaveText("Yangi · Chilonzor")

  // The task's page says its location; the current one stays where it was.
  await tasks.getByRole("link", { name: "Chilonzorda" }).click()
  await expect(page.getByRole("heading", { level: 1, name: "Chilonzorda" })).toBeVisible()
  const info = page.getByRole("region", { name: "Ma'lumot" })
  await expect(info.getByText("Lokatsiya", { exact: true })).toBeVisible()
  await expect(info.getByText("Chilonzor", { exact: true })).toBeVisible()
  await goHome(page)
  await expect(locationSwitch(page)).toHaveAccessibleName("Lokatsiya: Asosiy")
})

test("with one location there is nothing to switch", async ({ page }) => {
  await signIn(page, "901234567")
  await expect(page.getByRole("heading", { name: "Salom, Ali Valiyev" })).toBeVisible()
  await expect(locationSwitch(page)).toHaveCount(0)
})

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

  // Restricted to Chilonzor: the sheet warns of the task left in Asosiy.
  await openSection(page, "Xodimlar")
  const dialog = await placesOf(page, /^Dilnoza Rahimova/)
  await dialog.getByRole("switch", { name: "Barcha lokatsiyalar" }).click()
  await dialog.getByRole("checkbox", { name: "Asosiy" }).click()
  await expect(dialog.getByText("Boshqa lokatsiyalarda 1 ta vazifaga mas'ul. Saqlash baribir mumkin.")).toBeVisible()
  await dialog.getByRole("button", { name: "Saqlash" }).click()
  await expect(dialog).toBeHidden()
  await page.keyboard.press("Escape")
  await expect(page.getByRole("dialog", { name: "Xodim" })).toBeHidden()
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
  await expect(locationSwitch(page)).toHaveCount(0)
  await openSection(page, "Vazifalar")
  const yangi = page.getByRole("region", { name: "Kanban" }).getByRole("region", { name: "Yangi" })
  await expect(yangi.getByText(/^(Kartani shu yerga suring|Bo'sh)$/)).toBeVisible()
  await expect(yangi.getByText("Asosiyda")).toHaveCount(0)
  await enterTask(page, "Chilonzorda", "901112255", null)
  await expect(yangi.getByRole("listitem").filter({ hasText: "Chilonzorda" })).toBeVisible()
  const chilonzor = db.locations.find((l) => l.companyId === 2 && l.name === "Chilonzor")!
  expect(db.tasks.at(-1)?.locationId).toBe(chilonzor.id)
  await signOut(page)

  // The restriction lifted, she sees both locations again.
  await openNok(page)
  await openSection(page, "Xodimlar")
  const again = await placesOf(page, /^Dilnoza Rahimova/)
  await again.getByRole("switch", { name: "Barcha lokatsiyalar" }).click()
  await again.getByRole("button", { name: "Saqlash" }).click()
  await expect(again).toBeHidden()
  await page.keyboard.press("Escape")
  await expect(page.getByRole("dialog", { name: "Xodim" })).toBeHidden()
  await expect(members(page).getByText("Barchasi")).toHaveCount(2)
  await signOut(page)
  await signIn(page, "906667788")
  await expect(locationSwitch(page)).toHaveAccessibleName("Lokatsiya: Asosiy")
  await openSection(page, "Vazifalar")
  await expect(yangi.getByRole("listitem").filter({ hasText: "Asosiyda" })).toBeVisible()
  await chooseLocation(page, "Chilonzor")
  await expect(yangi.getByRole("listitem").filter({ hasText: "Chilonzorda" })).toBeVisible()
})
