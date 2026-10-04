import { expect, test } from "./fixtures"

// A browser asks for the icons by itself, signed in or not: request carries
// no session, and a redirect to /login would count as no icon.
test("the tab's icon is Hisob24's mark, and it needs no session", async ({ page, request }) => {
  await page.goto("/login")

  const linked = async (selector: string) => {
    await expect(page.locator(selector), selector).toHaveCount(1)
    return request.get((await page.locator(selector).getAttribute("href"))!, { maxRedirects: 0 })
  }
  const icon = await linked('link[rel="icon"][type="image/svg+xml"]')
  expect(icon.status()).toBe(200)
  expect(icon.headers()["content-type"]).toContain("image/svg+xml")
  // The brand's own color: it is our icon, not a placeholder.
  expect(await icon.text()).toContain("#174449")

  const apple = await linked('link[rel="apple-touch-icon"]')
  expect(apple.status()).toBe(200)
  expect(apple.headers()["content-type"]).toContain("image/png")

  const favicon = await request.get("/favicon.ico", { maxRedirects: 0 })
  expect(favicon.status()).toBe(200)
  expect(favicon.headers()["content-type"]).toMatch(/image\/(x-icon|vnd\.microsoft\.icon)/)
})
