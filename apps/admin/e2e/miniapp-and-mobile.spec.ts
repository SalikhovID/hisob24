import { expect, signIn, test } from "./fixtures"

// fakeTelegram does what telegram-web-app.js does inside a Telegram chat:
// it defines the WebApp with signed initData and publishes the chat's
// colors as --tg-theme-* variables on <html>.
const fakeTelegram = `
  const themeParams = {
    bg_color: "#17212b",
    text_color: "#f5f5f5",
    hint_color: "#708499",
    button_color: "#5288c1",
    button_text_color: "#ffffff",
    secondary_bg_color: "#232e3c",
  }
  window.Telegram = {
    WebApp: {
      initData: "query_id=AA&user=%7B%22id%22%3A461603558%7D&auth_date=1790000000&hash=abc",
      initDataUnsafe: { user: { id: 461603558, first_name: "Owner" } },
      colorScheme: "dark",
      themeParams,
      platform: "tdesktop",
      ready() {},
      expand() {},
      close() {},
      onEvent() {},
      offEvent() {},
    },
  }
  for (const [key, value] of Object.entries(themeParams)) {
    document.documentElement.style.setProperty("--tg-theme-" + key.replaceAll("_", "-"), value)
  }
`

test.describe("inside Telegram", () => {
  test.use({ telegramScript: fakeTelegram })

  test("the Mini App signs the admin in by itself and wears the chat's colors", async ({ page }) => {
    await page.goto("/companies")

    await expect(page).toHaveURL(/\/companies$/)
    await expect(page.getByRole("heading", { name: "Kompaniyalar" })).toBeVisible()
    await expect(page.locator("html")).toHaveAttribute("data-telegram", "")
    await expect(page.locator("body")).toHaveCSS("background-color", "rgb(23, 33, 43)")
    await expect(page.getByRole("button", { name: "Chiqish" })).toHaveCount(0)
    await expect(page.getByRole("button", { name: "Mavzuni almashtirish" })).toHaveCount(0)
  })

  test("the brand's logo takes the chat's text color", async ({ page }) => {
    await page.goto("/companies")

    await expect(page.getByRole("heading", { name: "Kompaniyalar" })).toBeVisible()
    // One brand shows at a time: the sidebar's on a wide screen, the top bar's on a phone.
    await expect(page.getByRole("img", { name: "Hisob24" })).toHaveCSS("color", "rgb(245, 245, 245)")
  })
})

test("every page fits the screen without sideways scrolling", async ({ page, context, baseURL }) => {
  for (const path of ["/login"]) {
    await page.goto(path)
    await expect(page.getByRole("heading").first()).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth), path).toBeLessThanOrEqual(0)
  }
  await signIn(context, baseURL)
  for (const path of ["/companies", "/companies/new", "/companies/1", "/admins"]) {
    await page.goto(path)
    await expect(page.getByRole("heading").first()).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth), path).toBeLessThanOrEqual(0)
  }
})

test("lists are tables on wide screens and cards on phones", async ({ page, context, baseURL }) => {
  await signIn(context, baseURL)
  await page.goto("/companies")
  const phone = (page.viewportSize()?.width ?? 0) < 768

  const table = page.getByRole("table", { name: "Kompaniyalar" })
  const cards = page.getByRole("list", { name: "Kompaniyalar" })
  await expect(phone ? cards : table).toBeVisible()
  await expect(phone ? table : cards).toBeHidden()
})

test("on a phone the sections are in the menu; on a wide screen in the sidebar", async ({ page, context, baseURL }) => {
  await signIn(context, baseURL)
  await page.goto("/companies")
  const phone = (page.viewportSize()?.width ?? 0) < 1024

  if (phone) {
    await page.getByRole("button", { name: "Menyu" }).click()
    await page.getByRole("dialog").getByRole("link", { name: "Adminlar" }).click()
    await expect(page.getByRole("dialog")).toBeHidden()
  } else {
    await expect(page.getByRole("button", { name: "Menyu" })).toBeHidden()
    await page.getByRole("link", { name: "Adminlar" }).click()
  }
  await expect(page).toHaveURL(/\/admins$/)
  await expect(page.getByRole("heading", { name: "Adminlar" })).toBeVisible()
})

test("in the shell the logo wears the brand's color, white in the dark", async ({ page, context, baseURL }) => {
  await page.emulateMedia({ colorScheme: "light" })
  await signIn(context, baseURL)
  await page.goto("/companies")
  await expect(page.getByRole("heading", { name: "Kompaniyalar" })).toBeVisible()
  // One brand shows at a time: the sidebar's on a wide screen, the top bar's on a phone.
  const logo = page.getByRole("img", { name: "Hisob24" })

  await expect(logo).toHaveCSS("color", "rgb(23, 68, 73)")
  await page.emulateMedia({ colorScheme: "dark" })
  await expect(logo).toHaveCSS("color", "rgb(255, 255, 255)")
})
