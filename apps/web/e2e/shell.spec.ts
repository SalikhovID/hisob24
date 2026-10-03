import type { Page } from "@playwright/test"
import { LOGIN_CODE } from "../mocks/data"
import { expect, test } from "./fixtures"

// signIn goes through the login page: the number without +998, then the code.
async function signIn(page: Page, number: string) {
  await page.goto("/login")
  await page.getByRole("textbox", { name: "Telefon raqami" }).fill(number)
  await page.getByRole("button", { name: "Kodni olish" }).click()
  await page.getByRole("textbox", { name: "Kod" }).fill(LOGIN_CODE)
}

// The sidebar is a column from the md breakpoint up, a sheet below it.
const onPhone = (page: Page) => (page.viewportSize()?.width ?? 0) < 768

const width = (page: Page) => async () => (await page.getByRole("complementary", { name: "Menyu" }).boundingBox())?.width

test("the sections are a folding sidebar on a wide screen and a sheet on a phone", async ({ page }) => {
  await signIn(page, "901234567")
  await expect(page.getByRole("heading", { name: "Salom, Ali Valiyev" })).toBeVisible()
  const sidebar = page.getByRole("complementary", { name: "Menyu" })

  if (onPhone(page)) {
    await expect(sidebar).toBeHidden()
    await page.getByRole("button", { name: "Menyu", exact: true }).click()
    const sheet = page.getByRole("dialog", { name: "Olma Savdo" })
    await expect(sheet.getByRole("link", { name: "Bosh sahifa" })).toHaveAttribute("aria-current", "page")
    await expect(sheet.getByRole("link", { name: "Xodimlar" })).toBeVisible()
    await sheet.getByRole("link", { name: "Bosh sahifa" }).click()
    await expect(sheet).toBeHidden()
    return
  }

  await expect(page.getByRole("button", { name: "Menyu", exact: true })).toBeHidden()
  await expect(sidebar.getByRole("link", { name: "Bosh sahifa" })).toHaveAttribute("aria-current", "page")
  await expect(sidebar.getByRole("link", { name: "Xodimlar" })).toBeVisible()
  await expect(sidebar.getByText("Olma Savdo")).toBeVisible()
  await expect.poll(width(page)).toBe(256)

  await sidebar.getByRole("button", { name: "Menyuni yig'ish" }).click()
  await expect.poll(width(page)).toBe(64)
  await expect(sidebar.getByText("Olma Savdo")).toHaveCount(0)
  await sidebar.getByRole("link", { name: "Xodimlar" }).hover()
  await expect(page.locator('[data-slot="tooltip-content"]')).toHaveText("Xodimlar")

  // The fold is the browser's to remember.
  await page.reload()
  await expect(sidebar.getByRole("button", { name: "Menyuni yoyish" })).toBeVisible()
  await expect.poll(width(page)).toBe(64)
  await sidebar.getByRole("button", { name: "Menyuni yoyish" }).click()
  await expect.poll(width(page)).toBe(256)
  await expect(sidebar.getByText("Olma Savdo")).toBeVisible()
})

test("an employee sees no section of the owner's", async ({ page }) => {
  await signIn(page, "902223344")
  await page.getByRole("button", { name: /Olma Savdo/ }).click()
  await expect(page.getByRole("heading", { name: "Salom, Vali Aliyev" })).toBeVisible()

  if (onPhone(page)) await page.getByRole("button", { name: "Menyu", exact: true }).click()
  const sections = page.getByRole("navigation", { name: "Bo'limlar" }).filter({ visible: true })
  await expect(sections.getByRole("link", { name: "Bosh sahifa" })).toBeVisible()
  await expect(sections.getByRole("link", { name: "Xodimlar" })).toHaveCount(0)
})

test("the profile menu says who is signed in and leads to their other company", async ({ page }) => {
  await signIn(page, "902223344")
  await page.getByRole("button", { name: /Olma Savdo/ }).click()
  await expect(page.getByRole("heading", { name: "Salom, Vali Aliyev" })).toBeVisible()

  await page.getByRole("button", { name: "Profil" }).click()
  const menu = page.getByRole("menu")
  await expect(menu.getByText("Vali Aliyev")).toBeVisible()
  await expect(menu.getByText("+998 90 222 33 44")).toBeVisible()
  await menu.getByRole("menuitem", { name: "Kompaniyani almashtirish" }).click()

  await expect(page).toHaveURL(/\/select-company$/)
})
