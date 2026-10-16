import { ALI, seedTasks, TG_ALI, TG_STRANGER, TG_UNLINKED } from "../mocks/data"
import type { Page } from "@playwright/test"
import { expect, test } from "./fixtures"
import { homeHead, onPhone, openSection } from "./helpers"

const fits = async (page: Page) =>
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0)

// wentFullscreen says whether the app asked the fake Telegram for full screen.
const wentFullscreen = (page: Page) =>
  page.evaluate(() => (window as unknown as { __fullscreen?: boolean }).__fullscreen === true)

// fakeTelegram does what telegram-web-app.js does inside a Telegram chat: it
// defines the WebApp with the account's initData and publishes the chat's
// colors as --tg-theme-* variables. Its requestContact stands for Telegram
// and the user bot: the shared contact gets linked to the account. Its
// requestFullscreen (Bot API 8.0) does what a phone's client does: the app
// takes the whole screen and the status bar (47px) and Telegram's floating
// controls (46px) now lie over its top, published as the safe area insets.
// Its BackButton keeps whether it is shown and what a press does; its home
// screen (Bot API 8.0) has not got the app yet, and adding it is noted; the
// colors the app paints its header, background and bottom bar are noted.
function fakeTelegram(telegramId: number, platform = "android") {
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
      platform: "${platform}",
      isFullscreen: false,
      isVersionAtLeast() { return true },
      ready() {},
      expand() {},
      close() {},
      requestFullscreen() {
        window.Telegram.WebApp.isFullscreen = true
        window.__fullscreen = true
        document.documentElement.style.setProperty("--tg-safe-area-inset-top", "47px")
        document.documentElement.style.setProperty("--tg-content-safe-area-inset-top", "46px")
      },
      onEvent() {},
      offEvent() {},
      setHeaderColor(color) { window.__chrome = { ...window.__chrome, header: color } },
      setBackgroundColor(color) { window.__chrome = { ...window.__chrome, background: color } },
      setBottomBarColor(color) { window.__chrome = { ...window.__chrome, bottomBar: color } },
      BackButton: {
        isVisible: false,
        show() { window.Telegram.WebApp.BackButton.isVisible = true },
        hide() { window.Telegram.WebApp.BackButton.isVisible = false },
        onClick(handler) { window.__back = handler },
        offClick(handler) { if (window.__back === handler) window.__back = undefined },
      },
      checkHomeScreenStatus(callback) { callback("missed") },
      addToHomeScreen() { window.__addedToHome = true },
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

  test("opens the Mini App and is in, in the app's own colors of the chat's scheme and with no sign-out", async ({ page }) => {
    await page.goto("/")

    await expect(page.getByRole("heading", { name: "Salom, Ali Valiyev" })).toBeVisible()
    await expect(page).toHaveURL(/\/$/)
    await expect(page.locator("html")).toHaveAttribute("data-telegram", "")
    // The chat gives the scheme (dark), not its theme's colors: the page
    // is the app's own night glass (docs: 2026-10-16 liquid glass).
    await expect(page.locator("body")).toHaveCSS("background-color", "rgb(21, 18, 30)")
    // Telegram's own chrome round the app wears its night base too.
    await expect
      .poll(() => page.evaluate(() => (window as unknown as { __chrome?: Record<string, string> }).__chrome))
      .toEqual({ header: "#15121E", background: "#15121E", bottomBar: "#15121E" })
    await fits(page)
    // On a phone the sections are a floating bar of the app's own glass,
    // see-through.
    if (onPhone(page)) {
      const bar = page.getByRole("navigation", { name: "Bo'limlar" }).filter({ visible: true })
      await expect(bar.getByRole("link")).toHaveText(["Bosh sahifa", "Mijozlar", "Vazifalar", "Mahsulotlar"])
      await expect(bar.getByRole("button", { name: "Sozlama" })).toBeVisible()
      await expect(bar).toHaveCSS("background-color", "rgba(44, 38, 64, 0.5)")
    }
    // Full screen on a phone's client: the page starts under the status bar
    // and Telegram's controls (47px + 46px), the shell no taller than the
    // screen.
    expect(await wentFullscreen(page)).toBe(true)
    await expect(page.locator('[data-slot="app-shell"]')).toHaveCSS("padding-top", "93px")
    expect((await homeHead(page).boundingBox())?.y).toBeGreaterThanOrEqual(93)
    await fits(page)
    // Closing the Mini App is the way out: the profile offers no sign-out,
    // and the chat sets the theme.
    await homeHead(page).click()
    await expect(page).toHaveURL(/\/profile$/)
    await expect(page.getByText("+998 90 123 45 67")).toBeVisible()
    await expect(page.getByText(/Telegram ichida chiqish uchun ilovani yoping/)).toBeVisible()
    await expect(page.getByRole("button", { name: "Chiqish" })).toHaveCount(0)
    await expect(page.getByRole("button", { name: /^Mavzu/ })).toHaveCount(0)
  })

  test("shows Telegram's back button inside a section and goes back with it; the home hides it", async ({ page }) => {
    await page.goto("/")
    await expect(page.getByRole("heading", { name: "Salom, Ali Valiyev" })).toBeVisible()
    const backShown = () => page.evaluate(() => window.Telegram?.WebApp?.BackButton?.isVisible ?? false)
    expect(await backShown()).toBe(false)

    await homeHead(page).click()
    await expect(page).toHaveURL(/\/profile$/)
    await expect.poll(backShown).toBe(true)
    await page.evaluate(() => (window as unknown as { __back: () => void }).__back())

    await expect(page).toHaveURL(/\/$/)
    await expect.poll(backShown).toBe(false)
  })

  test("offers to put the app on the home screen, and asks Telegram for it", async ({ page }) => {
    await page.goto("/")
    await expect(page.getByRole("heading", { name: "Salom, Ali Valiyev" })).toBeVisible()

    await page.getByRole("button", { name: /Hisob24'ni bosh ekranga qo'shing/ }).click()

    expect(await page.evaluate(() => (window as unknown as { __addedToHome?: boolean }).__addedToHome)).toBe(true)
  })

  // openList goes to the tasks as a list, the way a thumb does: the tab bar,
  // then the view switch.
  const openList = async (page: Page) => {
    await page.goto("/")
    await expect(page.getByRole("heading", { name: "Salom, Ali Valiyev" })).toBeVisible()
    await openSection(page, "Vazifalar")
    await page.getByRole("tablist", { name: "Ko'rinish" }).getByRole("tab", { name: "Ro'yxat" }).click()
    await expect(page).toHaveURL(/view=list/)
  }
  const tasks = (page: Page) => page.getByRole("region", { name: "Vazifalar" })
  const rowOf = (page: Page, title: string) => tasks(page).getByRole("link", { name: new RegExp(`^${title}`) })

  test("opens a task from anywhere on its row in the list", async ({ page }) => {
    const { call } = seedTasks()
    await openList(page)

    // A thumb lands on the row's body (its middle), not on the title: the
    // task opens all the same.
    await rowOf(page, "Qo'ng'iroq qilish").click()

    await expect(page).toHaveURL(new RegExp(`/tasks/${call.id}$`))
    await expect(page.getByRole("heading", { level: 1, name: "Qo'ng'iroq qilish" })).toBeVisible()
  })

  test("names a task's customer on its row without a link of its own", async ({ page }) => {
    seedTasks()
    await openList(page)

    await expect(rowOf(page, "Qo'ng'iroq qilish")).toContainText("Dilshod Karimov")
    await expect(tasks(page).getByRole("link", { name: /^Dilshod Karimov/ })).toHaveCount(0)
  })
})

test.describe("a phone that is no user's", () => {
  test.use({ telegramScript: fakeTelegram(TG_STRANGER) })

  test("is told there is no access, with the number", async ({ page }) => {
    await page.goto("/")

    await expect(page.getByRole("heading", { name: "Kirish huquqi yo'q" })).toBeVisible()
    await expect(page.getByText("Raqamingiz: +998 90 555 66 77")).toBeVisible()
    await expect(page.getByRole("button", { name: "Yopish" })).toBeVisible()
    // Full screen too: the screen's padding keeps its top clear (24px + 93px).
    await expect(page.getByRole("main")).toHaveCSS("padding-top", "117px")
    await fits(page)
  })

  test("sees the logo in the app's own color of the chat's scheme", async ({ page }) => {
    await page.goto("/")

    await expect(page.getByRole("heading", { name: "Kirish huquqi yo'q" })).toBeVisible()
    await expect(page.getByRole("img", { name: "Hisob24" })).toHaveCSS("color", "rgb(255, 255, 255)")
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

  test("falls back to the SMS form, its panel in the brand's own colors", async ({ page }) => {
    await page.goto("/")

    await expect(page.getByRole("alert").filter({ hasText: "Telegram ma'lumoti yaroqsiz" })).toBeVisible()
    await expect(page.getByRole("textbox", { name: "Telefon raqami" })).toBeVisible()
    const panel = page.getByRole("banner")
    await expect(panel).toHaveCSS("background-color", "rgb(23, 68, 73)")
    await expect(panel.getByRole("img", { name: "Hisob24" })).toHaveCSS("color", "rgb(255, 255, 255)")
    // Full screen: the panel's own padding (40px on a phone, 48px from lg)
    // grows by the insets (93px), so the logo stays clear of the controls.
    await expect(panel).toHaveCSS("padding-top", onPhone(page) ? "133px" : "141px")
    await fits(page)
  })
})

test.describe("a desktop Telegram", () => {
  test.use({ telegramScript: fakeTelegram(TG_ALI, "tdesktop") })

  test("keeps the client's header: full screen there would be the whole window", async ({ page }) => {
    await page.goto("/")

    await expect(page.getByRole("heading", { name: "Salom, Ali Valiyev" })).toBeVisible()
    expect(await wentFullscreen(page)).toBe(false)
    await expect(page.locator('[data-slot="app-shell"]')).toHaveCSS("padding-top", "0px")
    expect((await homeHead(page).boundingBox())?.y).toBeLessThan(93)
  })
})
