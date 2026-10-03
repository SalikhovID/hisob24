import type { Page } from "@playwright/test"
import { db, LOGIN_CODE } from "../mocks/data"
import { expect, test } from "./fixtures"

// signIn goes through the login page: the number without +998, then the code.
async function signIn(page: Page, number: string) {
  await page.goto("/login")
  await page.getByRole("textbox", { name: "Telefon raqami" }).fill(number)
  await page.getByRole("button", { name: "Kodni olish" }).click()
  await page.getByRole("textbox", { name: "Kod" }).fill(LOGIN_CODE)
}

// main is the page itself: the shell around it names the company too.
const main = (page: Page) => page.getByRole("main")

// Next keeps an empty role="alert" route announcer on every page.
const alert = (page: Page, text: string) => page.getByRole("alert").filter({ hasText: text })

test("someone in one company signs in with an SMS code and lands on the dashboard", async ({ page }) => {
  await page.goto("/")
  await expect(page).toHaveURL(/\/login$/)

  const phone = page.getByRole("textbox", { name: "Telefon raqami" })
  await expect(page.getByText("+998", { exact: true })).toBeVisible()
  await expect(phone).toHaveValue("")
  await phone.pressSequentially("901234567")
  await expect(phone).toHaveValue("90 123 45 67")
  await page.getByRole("button", { name: "Kodni olish" }).click()
  await expect(page.getByText("Kod +998 90 123 45 67 raqamiga yuborildi")).toBeVisible()
  await page.getByRole("textbox", { name: "Kod" }).fill(LOGIN_CODE)

  await expect(page).toHaveURL(/\/$/)
  await expect(page.getByRole("heading", { name: "Salom, Ali Valiyev" })).toBeVisible()
  await expect(main(page).getByText("Olma Savdo")).toBeVisible()
  await expect(main(page).getByText("Egasi", { exact: true })).toBeVisible()
  await expect(page.getByRole("link", { name: "Kompaniyani almashtirish" })).toHaveCount(0)

  // The way out is in the profile menu.
  await page.getByRole("button", { name: "Profil" }).click()
  await page.getByRole("menuitem", { name: "Chiqish" }).click()
  await expect(page).toHaveURL(/\/login$/)
  await page.goto("/")
  await expect(page).toHaveURL(/\/login$/)
})

test("someone in two companies chooses one and can switch to the other", async ({ page }) => {
  await signIn(page, "902223344")

  await expect(page).toHaveURL(/\/select-company$/)
  await page.getByRole("button", { name: /Olma Savdo/ }).click()
  await expect(page).toHaveURL(/\/$/)
  await expect(main(page).getByText("Olma Savdo")).toBeVisible()
  await expect(main(page).getByText("Xodim", { exact: true })).toBeVisible()

  const switchLink = page.getByRole("link", { name: "Kompaniyani almashtirish" })
  // It reads as an outlined button, not as bare text.
  await expect(switchLink).not.toHaveCSS("border-top-color", "rgba(0, 0, 0, 0)")
  await switchLink.click()
  await expect(page).toHaveURL(/\/select-company$/)
  await page.getByRole("button", { name: /Nok Market/ }).click()
  await expect(page).toHaveURL(/\/$/)
  await expect(main(page).getByText("Nok Market")).toBeVisible()
  await expect(main(page).getByText("Egasi", { exact: true })).toBeVisible()
})

test("a company that expires while in use leads to /expired and on to another", async ({ page }) => {
  await signIn(page, "902223344")
  await page.getByRole("button", { name: /Nok Market/ }).click()
  await expect(main(page).getByText("Nok Market")).toBeVisible()

  db.companies.find((company) => company.name === "Nok Market")!.end_date = "2026-10-01"
  await page.reload()

  await expect(page).toHaveURL(/\/expired$/)
  await expect(page.getByRole("heading", { name: "Obuna muddati tugagan" })).toBeVisible()
  await page.getByRole("button", { name: "Boshqa kompaniyani tanlash" }).click()
  await expect(page).toHaveURL(/\/select-company$/)
  await expect(page.getByRole("button", { name: /Nok Market/ })).toBeDisabled()
  await expect(page.getByRole("button", { name: /Nok Market/ })).toContainText("Muddati o'tgan")
  await page.getByRole("button", { name: /Olma Savdo/ }).click()
  await expect(page).toHaveURL(/\/$/)
  await expect(main(page).getByText("Olma Savdo")).toBeVisible()
})

test("with only an expired company there is nothing to choose but signing out", async ({ page }) => {
  await signIn(page, "904445566")

  await expect(page).toHaveURL(/\/expired$/)
  await page.getByRole("button", { name: "Boshqa kompaniyani tanlash" }).click()
  await expect(page).toHaveURL(/\/select-company$/)
  await expect(page.getByText("Faol kompaniya yo'q")).toBeVisible()
  await expect(page.getByRole("button", { name: /Anor Servis/ })).toBeDisabled()

  await page.getByRole("button", { name: "Chiqish" }).click()
  await expect(page).toHaveURL(/\/login$/)
})

test("the code can be asked for again once the minute is over; a wrong one is cleared", async ({ page }) => {
  // The mock counts its minute on the test's clock, which page.clock does not move.
  db.cooldown = false
  await page.clock.install()
  await page.goto("/login")
  await page.getByRole("textbox", { name: "Telefon raqami" }).fill("901234567")
  await page.getByRole("button", { name: "Kodni olish" }).click()

  const resend = page.getByRole("button", { name: /^Kodni qayta yuborish/ })
  await expect(resend).toHaveText("Kodni qayta yuborish (60)")
  await expect(resend).toBeDisabled()
  await page.clock.runFor(60_000)
  await expect(resend).toHaveText("Kodni qayta yuborish")
  await resend.click()
  await expect(resend).toHaveText("Kodni qayta yuborish (60)")

  const code = page.getByRole("textbox", { name: "Kod" })
  await code.fill("000000")
  await expect(alert(page, "Kod noto'g'ri yoki muddati o'tgan")).toBeVisible()
  await expect(code).toHaveValue("")
  await code.fill(LOGIN_CODE)
  await expect(page.getByRole("heading", { name: "Salom, Ali Valiyev" })).toBeVisible()
})

test("changing the number goes back with the number kept", async ({ page }) => {
  await page.goto("/login")
  await page.getByRole("textbox", { name: "Telefon raqami" }).fill("901234567")
  await page.getByRole("button", { name: "Kodni olish" }).click()

  await page.getByRole("button", { name: "Raqamni o'zgartirish" }).click()

  await expect(page.getByRole("textbox", { name: "Telefon raqami" })).toHaveValue("90 123 45 67")
})

test("a reload keeps the user signed in through the refresh cookie", async ({ page }) => {
  await signIn(page, "901234567")
  await expect(page.getByRole("heading", { name: "Salom, Ali Valiyev" })).toBeVisible()

  await page.reload()

  await expect(page.getByRole("heading", { name: "Salom, Ali Valiyev" })).toBeVisible()
  await expect(page).toHaveURL(/\/$/)
})

test("every page fits the screen without sideways scrolling", async ({ page }) => {
  const fits = async (what: string) =>
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth), what).toBeLessThanOrEqual(0)

  await page.goto("/login")
  await fits("phone step")
  await page.getByRole("textbox", { name: "Telefon raqami" }).fill("902223344")
  await page.getByRole("button", { name: "Kodni olish" }).click()
  await expect(page.getByRole("textbox", { name: "Kod" })).toBeVisible()
  await fits("code step")
  await page.getByRole("textbox", { name: "Kod" }).fill(LOGIN_CODE)
  await expect(page.getByRole("heading", { name: "Kompaniyani tanlang" })).toBeVisible()
  await fits("company list")
  await page.getByRole("button", { name: /Nok Market/ }).click()
  await expect(page.getByRole("heading", { name: "Salom, Vali Aliyev" })).toBeVisible()
  await fits("dashboard")
  db.companies.find((company) => company.name === "Nok Market")!.end_date = "2026-10-01"
  await page.reload()
  await expect(page.getByRole("heading", { name: "Obuna muddati tugagan" })).toBeVisible()
  await fits("expired")
})

test("a number typed before the page comes alive is kept, and sent the right way", async ({ page }) => {
  // Slow scripts: the server's HTML is up well before React takes it over.
  await page.route("**/_next/static/chunks/**", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 1500))
    await route.continue()
  })
  // People act on what they see, without waiting for the page to finish loading.
  await page.goto("/login", { waitUntil: "domcontentloaded" })

  await page.getByRole("textbox", { name: "Telefon raqami" }).fill("901234567")
  await page.getByRole("button", { name: "Kodni olish" }).click()

  await expect(page.getByText("Kod +998 90 123 45 67 raqamiga yuborildi")).toBeVisible()
  await expect(page).toHaveURL(/\/login$/)
})
