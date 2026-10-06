import type { Locator, Page } from "@playwright/test"
import { db } from "../mocks/data"
import { expect, test } from "./fixtures"
import { choose, onPhone, openSection, sections, sideScroll, signIn } from "./helpers"

// The whole way of a role (logic/roles.md): the owner makes one in the
// settings, gives it to an employee in the employees, the employee works by
// it alone, and the owner takes it away again.

async function signOut(page: Page) {
  await page.getByRole("button", { name: "Profil" }).click()
  await page.getByRole("menuitem", { name: "Chiqish" }).click()
  await expect(page).toHaveURL(/\/login$/)
}

// memberRow is an employee's row of the members: a table row on a wide
// screen, a card on a phone.
function memberRow(page: Page, name: string): Locator {
  const members = onPhone(page) ? page.getByRole("list", { name: "Xodimlar" }) : page.getByRole("table", { name: "Xodimlar" })
  return members.getByRole(onPhone(page) ? "listitem" : "row").filter({ hasText: name })
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
  const vali = memberRow(page, "Vali Aliyev")
  await vali.getByRole("button", { name: "Rolni o'zgartirish: Vali Aliyev" }).click()
  const dialog = page.getByRole("dialog", { name: "Rolni o'zgartirish" })
  await choose(dialog.getByRole("combobox", { name: "Rol" }), "Sotuvchi")
  await dialog.getByRole("button", { name: "Saqlash" }).click()
  await expect(dialog).toBeHidden()
  await expect(vali.getByText("Sotuvchi")).toBeVisible()
  await signOut(page)

  // The employee sees the sections the role opens, and nothing else.
  await signIn(page, "902223344")
  await page.getByRole("button", { name: /Olma Savdo/ }).click()
  await expect(page.getByRole("heading", { name: "Salom, Vali Aliyev" })).toBeVisible()
  await expect(page.getByText("Sotuvchi")).toBeVisible()
  const shown = await sections(page)
  await expect(shown.getByRole("link")).toHaveText(["Bosh sahifa", "Mijozlar", "Vazifalar"])
  await shown.getByRole("link", { name: "Mijozlar" }).click()
  await expect(page.getByRole("heading", { level: 1, name: "Mijozlar" })).toBeVisible()
  await expect(page.getByRole("button", { name: "Mijoz qo'shish" })).toBeVisible()
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
  const again = memberRow(page, "Vali Aliyev")
  await again.getByRole("button", { name: "Rolni o'zgartirish: Vali Aliyev" }).click()
  const taking = page.getByRole("dialog", { name: "Rolni o'zgartirish" })
  await choose(taking.getByRole("combobox", { name: "Rol" }), "Rolsiz")
  await taking.getByRole("button", { name: "Saqlash" }).click()
  await expect(taking).toBeHidden()
  await expect(again.getByText("Xodim", { exact: true })).toBeVisible()
  await page.goto("/settings?tab=roles")
  await page.getByRole("list", { name: "Rollar" }).getByRole("button", { name: "O'chirish: Sotuvchi" }).click()
  await page.getByRole("alertdialog", { name: "Rolni o'chirasizmi?" }).getByRole("button", { name: "O'chirish" }).click()
  await expect(page.getByText("Hali rol yo'q")).toBeVisible()
})
