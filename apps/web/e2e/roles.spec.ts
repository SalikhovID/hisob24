import type { Locator, Page } from "@playwright/test"
import { db } from "../mocks/data"
import { expect, test } from "./fixtures"
import { homeHead, openSection, sections, sideScroll, signIn, signOut } from "./helpers"

// The whole way of a role (logic/roles.md): the owner makes one in the
// settings, gives it to an employee in the employees, the employee works by
// it alone, and the owner takes it away again.

// memberRow is an employee's row of the members: it opens their sheet.
const memberRow = (page: Page, name: string): Locator => page.getByRole("list", { name: "Xodimlar" }).getByRole("button", { name: new RegExp(`^${name}`) })

// pickRole gives the employee a role in their sheet's picker, and closes the sheet.
async function pickRole(page: Page, name: string, role: RegExp, shown: string) {
  await memberRow(page, name).click()
  const sheet = page.getByRole("dialog", { name: "Xodim" })
  await sheet.getByRole("button", { name: /^Rol/ }).click()
  await page.getByRole("dialog", { name: "Rolni o'zgartirish" }).getByRole("option", { name: role }).click()
  await expect(page.getByRole("dialog", { name: "Rolni o'zgartirish" })).toBeHidden()
  await expect(sheet.getByRole("button", { name: /^Rol/ })).toContainText(shown)
  await page.keyboard.press("Escape")
  await expect(sheet).toBeHidden()
}

// tick ticks an action of a section in the role's matrix.
const tick = (page: Page, section: string, action: string) =>
  page.getByRole("group", { name: section }).getByRole("checkbox", { name: action }).click()

test("the owner makes a role and gives it to an employee, who then sees and does what the role allows alone", async ({ page }) => {
  // Three sign-ins and a dozen pages, each compiled on its first visit by the dev server.
  test.setTimeout(120_000)
  // The owner signs in twice: the mock's minute between two codes is off.
  db.cooldown = false
  await signIn(page, "901234567")
  await expect(page.getByRole("heading", { name: "Salom, Ali Valiyev" })).toBeVisible()

  // The roles are a tab of the settings, the owner's alone.
  await openSection(page, "Sozlamalar")
  await page.getByRole("tab", { name: "Rollar" }).click()
  await expect(page).toHaveURL(/\/settings\?tab=roles$/)
  await expect(page.getByText("Hali rol yo'q")).toBeVisible()
  await page.getByRole("link", { name: "Rol qo'shish" }).click()
  await expect(page).toHaveURL(/\/settings\/roles\/new$/)
  await expect(page.getByRole("heading", { level: 1, name: "Yangi rol" })).toBeVisible()
  expect(await sideScroll(page)).toBeLessThanOrEqual(0)

  // An action brings its section's view with it.
  await page.getByLabel("Rol nomi").fill("Sotuvchi")
  await tick(page, "Mijozlar", "Qo'shish")
  await expect(page.getByRole("group", { name: "Mijozlar" }).getByRole("checkbox", { name: "Ko'rish" })).toBeChecked()
  await tick(page, "Vazifalar", "Ko'rish")
  await page.getByRole("button", { name: "Yaratish" }).click()
  await expect(page).toHaveURL(/\/settings\?tab=roles$/)
  const roles = page.getByRole("list", { name: "Rollar" })
  await expect(roles.getByRole("link", { name: "Sotuvchi" })).toBeVisible()
  await expect(roles.getByText("Mijozlar, Vazifalar · Hech kimda")).toBeVisible()

  // The employee takes the role.
  await openSection(page, "Xodimlar")
  await expect(page.getByRole("heading", { name: "Xodimlar" })).toBeVisible()
  await pickRole(page, "Vali Aliyev", /^Sotuvchi/, "Sotuvchi")
  await expect(memberRow(page, "Vali Aliyev")).toContainText("Sotuvchi")
  await signOut(page)

  // The employee sees the sections the role opens, and nothing else.
  await signIn(page, "902223344")
  await page.getByRole("button", { name: /Olma Savdo/ }).click()
  await expect(page.getByRole("heading", { name: "Salom, Vali Aliyev" })).toBeVisible()
  await expect(homeHead(page)).toHaveAccessibleName("Olma Savdo Vali A. · Sotuvchi")
  const shown = await sections(page)
  await expect(shown.getByRole("link")).toHaveText(["Bosh sahifa", "Mijozlar", "Vazifalar"])
  await shown.getByRole("link", { name: "Mijozlar" }).click()
  await expect(page.getByRole("heading", { level: 1, name: "Mijozlar" })).toBeVisible()
  await expect(page.getByRole("button", { name: "Mijoz qo'shish" }).first()).toBeVisible()
  await openSection(page, "Vazifalar")
  await expect(page.getByRole("heading", { level: 1, name: "Vazifalar" })).toBeVisible()
  await expect(page.getByRole("button", { name: "Vazifa qo'shish" })).toHaveCount(0)
  // The settings are not theirs: the address leads home.
  await page.goto("/settings")
  await expect(page).toHaveURL(/\/$/)
  await expect(page.getByRole("heading", { name: "Salom, Vali Aliyev" })).toBeVisible()
  await signOut(page)

  // The owner takes the role away: the role is held by nobody and may go.
  await signIn(page, "901234567")
  await openSection(page, "Xodimlar")
  await pickRole(page, "Vali Aliyev", /^Rolsiz$/, "Rolsiz")
  await expect(memberRow(page, "Vali Aliyev")).toContainText("Xodim")
  await page.goto("/settings?tab=roles")
  await page.getByRole("list", { name: "Rollar" }).getByRole("button", { name: "O'chirish: Sotuvchi" }).click()
  await page.getByRole("alertdialog", { name: "Rolni o'chirasizmi?" }).getByRole("button", { name: "O'chirish" }).click()
  await expect(page.getByText("Hali rol yo'q")).toBeVisible()
})
