import { expect, test } from "./fixtures"

test("on the login the logo stands white on the brand's panel, in light and in dark", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" })
  await page.goto("/login")
  const panel = page.getByRole("banner")
  const logo = panel.getByRole("img", { name: "Hisob24" })

  await expect(panel).toHaveCSS("background-color", "rgb(23, 68, 73)")
  await expect(logo).toHaveCSS("color", "rgb(255, 255, 255)")
  await page.emulateMedia({ colorScheme: "dark" })
  await expect(panel).toHaveCSS("background-color", "rgb(23, 68, 73)")
  await expect(logo).toHaveCSS("color", "rgb(255, 255, 255)")
})
