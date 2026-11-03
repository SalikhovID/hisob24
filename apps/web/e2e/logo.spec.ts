import { expect, test } from "./fixtures"

test("on the login the logo stands on the brand's flat panel in the panel's other end: white on the ink in the light, the ink on near white in the dark", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" })
  await page.goto("/login")
  const panel = page.getByRole("banner")
  const logo = panel.getByRole("img", { name: "Hisob24" })

  await expect(panel).toHaveCSS("background-color", "rgb(23, 24, 27)")
  await expect(panel).toHaveCSS("background-image", "none")
  await expect(logo).toHaveCSS("color", "rgb(255, 255, 255)")
  await page.emulateMedia({ colorScheme: "dark" })
  await expect(panel).toHaveCSS("background-color", "rgb(236, 236, 238)")
  await expect(panel).toHaveCSS("background-image", "none")
  await expect(logo).toHaveCSS("color", "rgb(26, 26, 29)")
})
