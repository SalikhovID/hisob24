import { expect, test } from "./fixtures"

test("on the login the logo stands on the brand's panel in the panel's other end: white on glossy black in the light, black on glossy white in the dark", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" })
  await page.goto("/login")
  const panel = page.getByRole("banner")
  const logo = panel.getByRole("img", { name: "Hisob24" })

  await expect(panel).toHaveCSS("background-color", "rgb(14, 15, 17)")
  await expect(panel).toHaveCSS("background-image", "linear-gradient(rgb(46, 47, 52) 0%, rgb(14, 15, 17) 100%)")
  await expect(logo).toHaveCSS("color", "rgb(255, 255, 255)")
  await page.emulateMedia({ colorScheme: "dark" })
  await expect(panel).toHaveCSS("background-color", "rgb(226, 227, 230)")
  await expect(panel).toHaveCSS("background-image", "linear-gradient(rgb(255, 255, 255) 0%, rgb(226, 227, 230) 100%)")
  await expect(logo).toHaveCSS("color", "rgb(14, 15, 18)")
})
