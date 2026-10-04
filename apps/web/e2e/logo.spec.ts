import { expect, test } from "./fixtures"

test("the logo wears the brand's color on a light page and white on a dark one", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" })
  await page.goto("/login")
  const logo = page.getByRole("img", { name: "Hisob24" })

  await expect(logo).toHaveCSS("color", "rgb(23, 68, 73)")
  await page.emulateMedia({ colorScheme: "dark" })
  await expect(logo).toHaveCSS("color", "rgb(255, 255, 255)")
})
