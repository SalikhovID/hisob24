import type { Page } from "@playwright/test"
import { addDays, db, localToday } from "../mocks/data"
import { expect, test } from "./fixtures"
import { choose, openSection, sideScroll, signIn } from "./helpers"

const today = localToday()

// openNok signs Vali in and opens Nok Market, which has two locations:
// Asosiy and Chilonzor (logic/locations.md).
async function openNok(page: Page) {
  await signIn(page, "902223344")
  await page.getByRole("button", { name: /Nok Market/ }).click()
  await expect(page.getByRole("heading", { name: "Salom, Vali Aliyev" })).toBeVisible()
}

const switcher = (page: Page) => page.getByRole("combobox", { name: "Lokatsiya" })

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
