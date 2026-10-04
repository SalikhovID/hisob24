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

test("on a wide screen the brand's panel stands beside the form, on a phone above it", async ({ page }) => {
  await page.goto("/login")
  await expect(page.getByRole("textbox", { name: "Kod" })).toBeVisible()
  const panel = (await page.getByRole("banner").boundingBox())!
  const form = (await page.getByRole("main").boundingBox())!
  const { width, height } = page.viewportSize()!

  if (width >= 1024) {
    // Side by side, each as tall as the screen.
    expect(panel.x).toBe(0)
    expect(Math.round(panel.x + panel.width)).toBe(Math.round(form.x))
    expect(Math.round(form.x + form.width)).toBe(width)
    expect(panel.y).toBe(0)
    expect(form.y).toBe(0)
    expect(Math.round(panel.height)).toBe(height)
    return
  }
  // A band across the top; the form is a sheet drawn over its lower edge.
  expect(panel.y).toBe(0)
  expect(Math.round(panel.width)).toBe(width)
  expect(Math.round(form.width)).toBe(width)
  expect(form.y).toBeGreaterThan(panel.y)
  expect(form.y).toBeLessThan(panel.y + panel.height)
})

test("everything the login asks a thumb to press is at least 44px tall", async ({ page }) => {
  await page.goto("/login")

  const controls = {
    "code field": page.getByRole("textbox", { name: "Kod" }),
    "the bot's link": page.getByRole("link", { name: "@hisob24_admin_bot" }),
  }
  for (const [what, control] of Object.entries(controls)) {
    expect((await control.boundingBox())!.height, what).toBeGreaterThanOrEqual(44)
  }
})
