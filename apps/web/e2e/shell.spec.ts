import type { Page } from "@playwright/test"
import { seedCustomers } from "../mocks/data"
import { expect, test } from "./fixtures"
import { onPhone, openProfile, sections, signIn } from "./helpers"

const width = (page: Page) => async () => (await page.getByRole("complementary", { name: "Menyu" }).boundingBox())?.width

// tabBar is the phone's sections: the navigation that is shown, the
// sidebar's being hidden there.
const tabBar = (page: Page) => page.getByRole("navigation", { name: "Bo'limlar" }).filter({ visible: true })

test("the sections are a folding sidebar on a wide screen and a floating tab bar on a phone, the rest under «Sozlama»", async ({ page }) => {
  await signIn(page, "901234567")
  await expect(page.getByRole("heading", { name: "Salom, Ali Valiyev" })).toBeVisible()
  const sidebar = page.getByRole("complementary", { name: "Menyu" })

  if (onPhone(page)) {
    await expect(sidebar).toBeHidden()
    await expect(page.getByRole("banner")).toHaveCount(0)
    const bar = tabBar(page)
    // The default bar: four pages, «Sozlama» last with the rest.
    await expect(bar.getByRole("link")).toHaveText(["Bosh sahifa", "Mijozlar", "Vazifalar", "Mahsulotlar"])
    await expect(bar.getByRole("link", { name: "Bosh sahifa" })).toHaveAttribute("aria-current", "page")
    await expect(bar.getByRole("button", { name: "Sozlama" })).toBeVisible()
    // The bar floats over the page, clear of the bottom edge, and the page fits its width.
    const box = (await bar.boundingBox())!
    const viewport = page.viewportSize()!
    expect(box.y + box.height).toBeLessThanOrEqual(viewport.height - 20)
    expect(box.x).toBeGreaterThanOrEqual(0)
    expect(box.x + box.width).toBeLessThanOrEqual(viewport.width)
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0)
    // A narrower phone (360px, 320px) still has the whole bar on screen.
    for (const narrow of [360, 320]) {
      await page.setViewportSize({ width: narrow, height: viewport.height })
      const fitted = (await bar.boundingBox())!
      expect(fitted.x, `${narrow}px`).toBeGreaterThanOrEqual(0)
      expect(fitted.x + fitted.width, `${narrow}px`).toBeLessThanOrEqual(narrow)
    }
    await page.setViewportSize(viewport)
    // The home lists no sections: the rest are «Sozlama»'s tiles, found by name.
    await expect(page.getByRole("main").getByRole("list", { name: "Bo'limlar" })).toHaveCount(0)
    await bar.getByRole("button", { name: "Sozlama" }).click()
    const menu = page.getByRole("dialog", { name: "Sozlama" })
    await expect(menu.getByRole("list", { name: "Ombor" }).getByRole("link")).toHaveText(["Ombor", "Xaridlar", "Ko'chirishlar", "Inventarizatsiya", "Boshlang'ich qoldiq", "Ta'minotchilar"])
    await menu.getByRole("searchbox", { name: "Qidirish" }).fill("xodim")
    await menu.getByRole("link", { name: "Xodimlar", exact: true }).click()
    await expect(page).toHaveURL(/\/employees$/)
    await expect(menu).toBeHidden()
    // A page past the bar is a page of the menu too: the bar stays, «Sozlama» marked.
    await expect(bar.getByRole("link", { name: "Bosh sahifa" })).not.toHaveAttribute("aria-current", "page")
    await expect(bar.getByRole("button", { name: "Sozlama" })).toHaveAttribute("aria-current", "page")
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

test("a page's way back is as wide as its words, as iOS's: the rest of its row leads nowhere", async ({ page }) => {
  const { dilshod } = seedCustomers()
  await signIn(page, "901234567")
  await expect(page.getByRole("heading", { name: "Salom, Ali Valiyev" })).toBeVisible()
  await page.goto(`/customers/${dilshod.id}`)
  await expect(page.getByRole("heading", { level: 1, name: "Dilshod Karimov" })).toBeVisible()

  const back = (await page.getByRole("main").getByRole("link", { name: "Mijozlar", exact: true }).boundingBox())!
  const main = (await page.getByRole("main").boundingBox())!
  expect(back.width).toBeLessThan(main.width / 2)
  // A tap at the row's other end stays on the page.
  await page.mouse.click(main.x + main.width - 40, back.y + back.height / 2)
  await page.waitForTimeout(500)
  await expect(page).toHaveURL(/\/customers\/\d+$/)
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

test("on a phone the member chooses the bar's pages under «Sozlama», which the bar keeps after a reload; a wide screen's sidebar keeps the default order", async ({
  page,
}) => {
  await signIn(page, "901234567")
  await expect(page.getByRole("heading", { name: "Salom, Ali Valiyev" })).toBeVisible()

  if (!onPhone(page)) {
    await expect((await sections(page)).getByRole("link")).toHaveText([
      "Bosh sahifa",
      "Mijozlar",
      "Vazifalar",
      "Mahsulotlar",
      "Sotuv",
      "Ombor",
      "Moliya",
      "Xodimlar",
      "Sozlamalar",
    ])
    await expect(page.getByRole("button", { name: "Sozlama" })).toBeHidden()
    return
  }

  const bar = tabBar(page)
  const choose = async () => {
    await bar.getByRole("button", { name: "Sozlama" }).click()
    await page.getByRole("dialog", { name: "Sozlama" }).getByRole("button", { name: "Pastki panelni sozlash" }).click()
    return page.getByRole("dialog", { name: "Pastki panel" })
  }
  let sheet = await choose()
  await expect(sheet.getByRole("heading", { name: "Panelda · 4/4" })).toBeVisible()
  await sheet.getByRole("button", { name: "Olib tashlash: Vazifalar" }).click()
  await sheet.getByRole("button", { name: "Qo'shish: Xaridlar" }).click()
  await sheet.getByRole("button", { name: "Xaridlar: tartibini o'zgartirish" }).focus()
  await page.keyboard.press("Home")
  await sheet.getByRole("button", { name: "Saqlash" }).click()
  await expect(page.getByText("Pastki panel saqlandi")).toBeVisible()
  await expect(bar.getByRole("link")).toHaveText(["Xaridlar", "Bosh sahifa", "Mijozlar", "Mahsulotlar"])

  await page.reload()
  await expect(page.getByRole("heading", { name: "Salom, Ali Valiyev" })).toBeVisible()
  await expect(bar.getByRole("link")).toHaveText(["Xaridlar", "Bosh sahifa", "Mijozlar", "Mahsulotlar"])
  // A page of the warehouse in the bar opens with the bar standing, its button marked.
  await bar.getByRole("link", { name: "Xaridlar" }).click()
  await expect(page).toHaveURL(/\/purchases$/)
  await expect(bar.getByRole("link", { name: "Xaridlar" })).toHaveAttribute("aria-current", "page")

  // «Standart» puts the default bar back.
  sheet = await choose()
  await sheet.getByRole("button", { name: "Standart" }).click()
  await sheet.getByRole("button", { name: "Saqlash" }).click()
  await expect(bar.getByRole("link")).toHaveText(["Bosh sahifa", "Mijozlar", "Vazifalar", "Mahsulotlar"])
})
