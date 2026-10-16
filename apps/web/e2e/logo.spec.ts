import { expect, test } from "./fixtures"

test("on the login the logo stands white on the brand's panel: glossy black in the light, lavender in the dark", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" })
  await page.goto("/login")
  const panel = page.getByRole("banner")
  const logo = panel.getByRole("img", { name: "Hisob24" })

  await expect(panel).toHaveCSS("background-color", "rgb(14, 15, 17)")
  await expect(panel).toHaveCSS("background-image", "linear-gradient(rgb(46, 47, 52) 0%, rgb(14, 15, 17) 100%)")
  await expect(logo).toHaveCSS("color", "rgb(255, 255, 255)")
  await page.emulateMedia({ colorScheme: "dark" })
  await expect(panel).toHaveCSS("background-color", "rgb(100, 83, 211)")
  await expect(panel).toHaveCSS("background-image", "linear-gradient(150deg, rgb(164, 151, 247) 0%, rgb(100, 83, 211) 100%)")
  await expect(logo).toHaveCSS("color", "rgb(255, 255, 255)")
})
