import type { Page } from "@playwright/test"
import { expect, test } from "./fixtures"
import { onPhone, openProfile, sections, signIn } from "./helpers"

const width = (page: Page) => async () => (await page.getByRole("complementary", { name: "Menyu" }).boundingBox())?.width

// tabBar is the phone's sections: the navigation that is shown, the
// sidebar's being hidden there.
const tabBar = (page: Page) => page.getByRole("navigation", { name: "Bo'limlar" }).filter({ visible: true })

test("the sections are a folding sidebar on a wide screen and a floating tab bar on a phone, the rest on the home", async ({ page }) => {
  await signIn(page, "901234567")
  await expect(page.getByRole("heading", { name: "Salom, Ali Valiyev" })).toBeVisible()
  const sidebar = page.getByRole("complementary", { name: "Menyu" })

  if (onPhone(page)) {
    await expect(sidebar).toBeHidden()
    await expect(page.getByRole("banner")).toHaveCount(0)
    const bar = tabBar(page)
    // Nine sections: the home and four in the bar, the rest a row each on the home.
    await expect(bar.getByRole("link")).toHaveText(["Bosh sahifa", "Mijozlar", "Vazifalar", "Mahsulotlar", "Sotuv"])
    await expect(bar.getByRole("link", { name: "Bosh sahifa" })).toHaveAttribute("aria-current", "page")
    // The bar floats over the page, clear of the bottom edge, and the page fits its width.
    const box = (await bar.boundingBox())!
    const viewport = page.viewportSize()!
    expect(box.y + box.height).toBeLessThanOrEqual(viewport.height - 20)
    expect(box.x).toBeGreaterThanOrEqual(0)
    expect(box.x + box.width).toBeLessThanOrEqual(viewport.width)
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0)
    const more = page.getByRole("main").getByRole("list", { name: "Bo'limlar" })
    await expect(more.getByRole("link")).toHaveText(["Ombor", "Moliya", "Xodimlar", "Sozlamalar"])
    await more.getByRole("link", { name: "Xodimlar" }).click()
    await expect(page).toHaveURL(/\/employees$/)
    // A section past the bar is a section's own page too: the bar stays, with no tab its own.
    await expect(bar.getByRole("link", { name: "Bosh sahifa" })).not.toHaveAttribute("aria-current", "page")
    await expect(bar.locator('[aria-current="page"]')).toHaveCount(0)
    // On a record or the profile the bar steps aside.
    await openProfile(page)
    await expect(page.getByRole("navigation", { name: "Bo'limlar" })).toHaveCount(0)
    return
  }

  await expect(page.getByRole("button", { name: "Menyu", exact: true })).toHaveCount(0)
  await expect(sidebar.getByRole("link", { name: "Bosh sahifa" })).toHaveAttribute("aria-current", "page")
  await expect(sidebar.getByRole("link", { name: "Xodimlar" })).toBeVisible()
  await expect(sidebar.getByText("Olma Savdo")).toBeVisible()
  await expect.poll(width(page)).toBe(256)
  // A wide screen has every section in the sidebar: the home lists none of them.
  await expect(page.getByRole("main").getByRole("list", { name: "Bo'limlar" })).toBeHidden()

  await sidebar.getByRole("button", { name: "Menyuni yig'ish" }).click()
  await expect.poll(width(page)).toBe(64)
  await expect(sidebar.getByText("Olma Savdo")).toHaveCount(0)
  await sidebar.getByRole("link", { name: "Xodimlar" }).hover()
  await expect(page.locator('[data-slot="tooltip-content"]')).toHaveText("Xodimlar")

  // The fold is the browser's to remember.
  await page.reload()
  await expect(sidebar.getByRole("button", { name: "Menyuni yoyish" })).toBeVisible()
  await expect.poll(width(page)).toBe(64)
  await expect(sidebar.getByRole("link", { name: "Profil: Ali Valiyev" })).toBeVisible()
  await sidebar.getByRole("button", { name: "Menyuni yoyish" }).click()
  await expect.poll(width(page)).toBe(256)
  await expect(sidebar.getByText("Olma Savdo")).toBeVisible()
})

test("an employee sees no section of the owner's", async ({ page }) => {
  await signIn(page, "902223344")
  await page.getByRole("button", { name: /Olma Savdo/ }).click()
  await expect(page.getByRole("heading", { name: "Salom, Vali Aliyev" })).toBeVisible()

  const bar = await sections(page)
  await expect(bar.getByRole("link", { name: "Bosh sahifa" })).toBeVisible()
  await expect(bar.getByRole("link", { name: "Xodimlar" })).toHaveCount(0)
})

test("the home's head is the way to the profile, which says who is signed in and leads to their other company and back", async ({ page }) => {
  await signIn(page, "902223344")
  await page.getByRole("button", { name: /Olma Savdo/ }).click()
  await expect(page.getByRole("heading", { name: "Salom, Vali Aliyev" })).toBeVisible()

  await page.getByRole("main").getByRole("link", { name: "Olma Savdo Vali A. · Xodim" }).click()
  await expect(page).toHaveURL(/\/profile$/)
  await expect(page.getByRole("heading", { level: 1, name: "Vali Aliyev" })).toBeVisible()
  await expect(page.getByText("+998 90 222 33 44")).toBeVisible()
  await page.getByRole("link", { name: "Kompaniyani almashtirish" }).click()

  await expect(page).toHaveURL(/\/select-company$/)
  await expect(page.getByRole("button", { name: /Olma Savdo/ })).toContainText("Joriy")
  await page.getByRole("link", { name: "Profil" }).click()
  await expect(page).toHaveURL(/\/profile$/)
  await page.getByRole("link", { name: "Bosh sahifa" }).filter({ visible: true }).first().click()
  await expect(page).toHaveURL(/\/$/)
})

test("the shell is headed by Hisob24's logo on a wide screen, the company's name under it, its mark when folded; a phone shows the company on the home", async ({
  page,
}) => {
  await signIn(page, "901234567")
  await expect(page.getByRole("heading", { name: "Salom, Ali Valiyev" })).toBeVisible()
  const logo = { name: "Hisob24" }

  if (onPhone(page)) {
    // No top bar: the home's head says the company, and the tab bar has the sections alone.
    await expect(page.getByRole("banner")).toHaveCount(0)
    await expect(page.getByRole("main").getByText("Olma Savdo")).toBeVisible()
    await expect(tabBar(page).getByRole("img", logo)).toHaveCount(0)
    return
  }

  const sidebar = page.getByRole("complementary", { name: "Menyu" })
  await expect(sidebar.getByRole("img", logo)).toBeVisible()
  const logoBox = (await sidebar.getByRole("img", logo).boundingBox())!
  const nameBox = (await sidebar.getByText("Olma Savdo").boundingBox())!
  expect(nameBox.y).toBeGreaterThanOrEqual(logoBox.y + logoBox.height)

  await sidebar.getByRole("button", { name: "Menyuni yig'ish" }).click()
  await expect(sidebar.getByRole("img", logo)).toHaveCount(0)
  await expect(sidebar.getByRole("button", { name: "Menyuni yoyish" }).locator('[data-slot="logo-mark"]')).toBeVisible()
})

test("the member puts the sections in their own order on the profile's page, which the menu keeps after a reload", async ({ page }) => {
  await signIn(page, "901234567")
  await expect(page.getByRole("heading", { name: "Salom, Ali Valiyev" })).toBeVisible()

  await openProfile(page)
  await page.getByRole("link", { name: "Pastki menyu 5 ta bo'lim" }).click()
  await expect(page).toHaveURL(/\/profile\/menu$/)
  const list = page.getByRole("list", { name: "Bo'limlar tartibi" })
  await expect(list.locator('[data-slot="row-title"]')).toHaveText(["Mijozlar", "Vazifalar", "Mahsulotlar", "Sotuv", "Ombor", "Moliya", "Xodimlar", "Sozlamalar"])
  await list.getByRole("button", { name: "Sozlamalar: tartibini o'zgartirish" }).focus()
  await page.keyboard.press("Home")
  await expect(list.locator('[data-slot="row-title"]').first()).toHaveText("Sozlamalar")
  await page.getByRole("button", { name: "Saqlash" }).click()
  await expect(page.getByText("Menyu tartibi saqlandi")).toBeVisible()
  await expect(page).toHaveURL(/\/profile$/)

  // The home first, then the member's own order.
  await page.getByRole("link", { name: "Bosh sahifa" }).filter({ visible: true }).first().click()
  await expect(page).toHaveURL(/\/$/)
  const second = async () => (await sections(page)).getByRole("link").nth(1)
  await expect(await second()).toHaveText("Sozlamalar")
  await page.reload()
  await expect(page.getByRole("heading", { name: "Salom, Ali Valiyev" })).toBeVisible()
  await expect(await second()).toHaveText("Sozlamalar")
})
