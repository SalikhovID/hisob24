import { ALI, TG_ALI, TG_STRANGER, TG_UNLINKED } from "../mocks/data"
import type { Page } from "@playwright/test"
import { expect, test } from "./fixtures"

const fits = async (page: Page) =>
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0)

// fakeTelegram does what telegram-web-app.js does inside a Telegram chat: it
// defines the WebApp with the account's initData and publishes the chat's
// colors as --tg-theme-* variables. Its requestContact stands for Telegram
// and the user bot: the shared contact gets linked to the account.
function fakeTelegram(telegramId: number) {
  return `
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
      initData: "query_id=AA&user=%7B%22id%22%3A${telegramId}%7D&auth_date=1790000000&hash=abc",
      initDataUnsafe: { user: { id: ${telegramId}, first_name: "Test" } },
      colorScheme: "dark",
      themeParams,
      platform: "android",
      ready() {},
      expand() {},
      close() {},
      onEvent() {},
      offEvent() {},
      requestContact(callback) {
        fetch("/api/__mock/contacts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ telegram_id: ${telegramId}, phone: "${ALI}" }),
        }).then(() => callback(true))
      },
    },
  }
  for (const [key, value] of Object.entries(themeParams)) {
    document.documentElement.style.setProperty("--tg-theme-" + key.replaceAll("_", "-"), value)
  }
`
}

test.describe("a linked user", () => {
  test.use({ telegramScript: fakeTelegram(TG_ALI) })

  test("opens the Mini App and is in, in the chat's colors and with no sign-out", async ({ page }) => {
    await page.goto("/")

    await expect(page.getByRole("heading", { name: "Salom, Ali Valiyev" })).toBeVisible()
    await expect(page).toHaveURL(/\/$/)
    await expect(page.locator("html")).toHaveAttribute("data-telegram", "")
    await expect(page.locator("body")).toHaveCSS("background-color", "rgb(23, 33, 43)")
    await expect(page.getByRole("button", { name: "Mavzuni almashtirish" })).toHaveCount(0)
    await fits(page)
    // Closing the Mini App is the way out: the profile menu offers none.
    await page.getByRole("button", { name: "Profil" }).click()
    await expect(page.getByRole("menu").getByText("+998 90 123 45 67")).toBeVisible()
    await expect(page.getByRole("menuitem", { name: "Chiqish" })).toHaveCount(0)
  })
})

test.describe("a phone that is no user's", () => {
  test.use({ telegramScript: fakeTelegram(TG_STRANGER) })

  test("is told there is no access, with the number", async ({ page }) => {
    await page.goto("/")

    await expect(page.getByRole("heading", { name: "Kirish huquqi yo'q" })).toBeVisible()
    await expect(page.getByText("Raqamingiz: +998 90 555 66 77")).toBeVisible()
    await expect(page.getByRole("button", { name: "Yopish" })).toBeVisible()
    await fits(page)
  })

  test("sees the logo in the chat's text color", async ({ page }) => {
    await page.goto("/")

    await expect(page.getByRole("heading", { name: "Kirish huquqi yo'q" })).toBeVisible()
    await expect(page.getByRole("img", { name: "Hisob24" })).toHaveCSS("color", "rgb(245, 245, 245)")
  })
})

test.describe("an account that never shared its phone", () => {
  test.use({ telegramScript: fakeTelegram(TG_UNLINKED) })

  test("shares it from the Mini App and is then in", async ({ page }) => {
    await page.goto("/")
    await expect(page.getByRole("heading", { name: "Telefon raqamingiz ulanmagan" })).toBeVisible()
    await fits(page)

    await page.getByRole("button", { name: "Raqamni yuborish" }).click()

    await expect(page.getByRole("heading", { name: "Salom, Ali Valiyev" })).toBeVisible()
  })
})


test.describe("a Mini App whose sign-in fails", () => {
  // hash=bad stands for forged initData: the API refuses it.
  test.use({ telegramScript: fakeTelegram(TG_ALI).replace("hash=abc", "hash=bad") })

  test("falls back to the SMS form, its panel in the chat's colors", async ({ page }) => {
    await page.goto("/")

    await expect(page.getByRole("alert").filter({ hasText: "Telegram ma'lumoti yaroqsiz" })).toBeVisible()
    await expect(page.getByRole("textbox", { name: "Telefon raqami" })).toBeVisible()
    const panel = page.getByRole("banner")
    await expect(panel).toHaveCSS("background-color", "rgb(35, 46, 60)")
    await expect(panel.getByRole("img", { name: "Hisob24" })).toHaveCSS("color", "rgb(245, 245, 245)")
    await fits(page)
  })
})
