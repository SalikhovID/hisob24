import { LOGIN_CODE } from "../mocks/data"
import { expect, test } from "./fixtures"

test("an admin signs in with the bot's code and lands on the companies", async ({ page }) => {
  await page.goto("/companies")
  await expect(page).toHaveURL(/\/login$/)
  await expect(page.getByRole("link", { name: "@hisob24_admin_bot" })).toHaveAttribute(
    "href",
    "https://t.me/hisob24_admin_bot",
  )

  await page.getByRole("textbox", { name: "Kod" }).fill(LOGIN_CODE)

  await expect(page).toHaveURL(/\/companies$/)
  await expect(page.getByRole("heading", { name: "Kompaniyalar" })).toBeVisible()
})

test("a wrong code is cleared and explained", async ({ page }) => {
  await page.goto("/login")
  const code = page.getByRole("textbox", { name: "Kod" })

  await code.fill("000000")

  // Next keeps an empty role="alert" route announcer on every page.
  await expect(page.getByRole("alert").filter({ hasText: "Kod noto'g'ri yoki muddati o'tgan" })).toBeVisible()
  await expect(code).toHaveValue("")
  await expect(page).toHaveURL(/\/login$/)
})
