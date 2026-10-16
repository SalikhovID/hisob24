import type { Page } from "@playwright/test"
import { seedCustomers } from "../mocks/data"
import { expect, test } from "./fixtures"
import { expectSignedIn, onPhone, openProfile, sections, signIn } from "./helpers"

const width = (page: Page) => async () => (await page.getByRole("complementary", { name: "Menyu" }).boundingBox())?.width

// tabBar is the phone's sections: the navigation that is shown, the
// sidebar's being hidden there.
const tabBar = (page: Page) => page.getByRole("navigation", { name: "Bo'limlar" }).filter({ visible: true })

test("the sections are a folding sidebar on a wide screen and a floating tab bar on a phone, the rest on the settings page", async ({ page }) => {
  await signIn(page, "901234567")
  await expect(page.getByRole("heading", { name: "Salom, Ali Valiyev" })).toBeVisible()
  const sidebar = page.getByRole("complementary", { name: "Menyu" })

  if (onPhone(page)) {
    await expect(sidebar).toBeHidden()
    await expect(page.getByRole("banner")).toHaveCount(0)
    const bar = tabBar(page)
    // The default bar: four pages, «Sozlamalar» last, the way to the rest.
    await expect(bar.getByRole("link")).toHaveText(["Bosh sahifa", "Mijozlar", "Vazifalar", "Mahsulotlar", "Sozlamalar"])
    await expect(bar.getByRole("link", { name: "Bosh sahifa" })).toHaveAttribute("aria-current", "page")
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
    // The home lists no sections: the rest are rows of the settings page.
    await expect(page.getByRole("main").getByRole("list", { name: "Bo'limlar" })).toHaveCount(0)
    await bar.getByRole("link", { name: "Sozlamalar" }).click()
    await expect(page).toHaveURL(/\/settings$/)
    await expect(bar.getByRole("link", { name: "Sozlamalar" })).toHaveAttribute("aria-current", "page")
    const main = page.getByRole("main")
    await expect(main.getByRole("list", { name: "Ombor" }).getByRole("link")).toHaveText(["Ombor", "Xaridlar", "Ko'chirishlar", "Inventarizatsiya", "Boshlang'ich qoldiq", "Ta'minotchilar"])
    await main.getByRole("link", { name: "Xodimlar", exact: true }).click()
    await expect(page).toHaveURL(/\/employees$/)
    // A page past the bar is a page of the menu too: the bar stays, «Sozlamalar» marked.
    await expect(bar.getByRole("link", { name: "Bosh sahifa" })).not.toHaveAttribute("aria-current", "page")
    await expect(bar.getByRole("link", { name: "Sozlamalar" })).toHaveAttribute("aria-current", "page")
    // On a record or the profile the bar steps aside.
    await openProfile(page)
    await expect(page.getByRole("navigation", { name: "Bo'limlar" })).toHaveCount(0)
    return
  }

  await expect(page.getByRole("button", { name: "Menyu", exact: true })).toHaveCount(0)
  await expect(sidebar.getByRole("link", { name: "Bosh sahifa" })).toHaveAttribute("aria-current", "page")
  await expect(sidebar.getByRole("link", { name: "Xodimlar" })).toBeVisible()
  await expect(sidebar.getByText("Olma Savdo")).toBeVisible()
  await expect.poll(width(page)).toBe(264)
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
  await expect.poll(width(page)).toBe(264)
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

test("the way to the profile (the home's head on a phone, the sidebar's foot on a wide screen) says who is signed in and leads to their other company and back", async ({ page }) => {
  await signIn(page, "902223344")
  await page.getByRole("button", { name: /Olma Savdo/ }).click()
  await expect(page.getByRole("heading", { name: "Salom, Vali Aliyev" })).toBeVisible()

  await expectSignedIn(page, { company: "Olma Savdo", short: "Vali A.", role: "Xodim" })
  await openProfile(page)
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

  if (!onPhone(page)) {
    // On a wide screen the top bar leads back: a small glass, as wide as its words.
    const back = page.locator('[data-slot="top-bar"]').getByRole("link", { name: "Orqaga" })
    expect((await back.boundingBox())!.width).toBeLessThan(160)
    await back.click()
    await expect(page).toHaveURL(/\/customers$/)
    return
  }
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

test("on a phone the member chooses the bar's pages on «Pastki panel», under the settings, which the bar keeps after a reload; a wide screen's sidebar keeps the default order", async ({
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
    // A wide screen has no bar to choose: the settings page leads to none.
    await (await sections(page)).getByRole("link", { name: "Sozlamalar" }).click()
    await expect(page.getByRole("heading", { level: 1, name: "Sozlamalar" })).toBeVisible()
    await expect(page.getByRole("link", { name: /^Pastki panelni sozlash/ })).toBeHidden()
    return
  }

  const bar = tabBar(page)
  const choose = async () => {
    await bar.getByRole("link", { name: "Sozlamalar" }).click()
    await page.getByRole("link", { name: /^Pastki panelni sozlash/ }).click()
    // The editor's first visit may wait for the dev server to build it.
    await expect(page).toHaveURL(/\/settings\/tab-bar$/, { timeout: 15_000 })
    return page.getByRole("main")
  }
  let editor = await choose()
  // The bar steps aside on its own editor, which pictures it.
  await expect(page.getByRole("navigation", { name: "Bo'limlar" })).toHaveCount(0)
  await expect(editor.getByText("4 / 4")).toBeVisible()
  await editor.getByRole("button", { name: "Paneldan olib tashlash: Vazifalar" }).click()
  await editor.getByRole("button", { name: "Panelga qo'shish: Xaridlar" }).click()
  await editor.getByRole("button", { name: "Xaridlar: tartibini o'zgartirish" }).focus()
  await page.keyboard.press("Home")
  await expect(editor.getByRole("list", { name: "Ko'rinishi" }).getByRole("listitem")).toHaveText(["Xaridlar", "Bosh sahifa", "Mijozlar", "Sotuv", "Sozlamalar"])
  await editor.getByRole("button", { name: "Saqlash" }).click()
  await expect(page.getByText("Pastki panel saqlandi")).toBeVisible()
  await expect(page).toHaveURL(/\/settings$/)
  await expect(bar.getByRole("link")).toHaveText(["Xaridlar", "Bosh sahifa", "Mijozlar", "Sotuv", "Sozlamalar"])

  await page.reload()
  await expect(bar.getByRole("link")).toHaveText(["Xaridlar", "Bosh sahifa", "Mijozlar", "Sotuv", "Sozlamalar"])
  // A page of the warehouse in the bar opens with the bar standing, its button marked.
  await bar.getByRole("link", { name: "Xaridlar" }).click()
  await expect(page).toHaveURL(/\/purchases$/)
  await expect(bar.getByRole("link", { name: "Xaridlar" })).toHaveAttribute("aria-current", "page")

  // «Standart holat» puts the default bar back.
  editor = await choose()
  await editor.getByRole("button", { name: "Standart holat" }).click()
  await editor.getByRole("button", { name: "Saqlash" }).click()
  await expect(page).toHaveURL(/\/settings$/)
  await expect(bar.getByRole("link")).toHaveText(["Bosh sahifa", "Mijozlar", "Vazifalar", "Mahsulotlar", "Sozlamalar"])
})

// namesOf reads the bar's names as the screen sets them: whether each shows
// whole (no ellipsis), how far its words keep from its button's edges, and
// its size.
const namesOf = (page: Page) =>
  page.locator('[data-slot="tab-bar"] a > span').evaluateAll((names) =>
    names.map((name) => {
      const words = document.createRange()
      words.selectNodeContents(name)
      const width = words.getBoundingClientRect().width
      const button = name.parentElement!.getBoundingClientRect().width
      return { name: name.textContent, whole: width <= name.clientWidth + 0.5, clear: (button - width) / 2, size: getComputedStyle(name).fontSize }
    }),
  )

test("the bar's names show whole on a phone of any width, clear of their buttons' edges and all one size; a narrow phone sets them a little smaller", async ({ page }) => {
  await signIn(page, "901234567")
  await expect(page.getByRole("heading", { name: "Salom, Ali Valiyev" })).toBeVisible()

  if (!onPhone(page)) {
    // A wide screen names its sections in the sidebar, the bar hidden.
    await expect(page.locator('[data-slot="tab-bar"]')).toBeHidden()
    return
  }
  await expect(tabBar(page).getByRole("link")).toHaveCount(5)
  const sizes: string[] = []
  for (const width of [414, 375, 360, 320]) {
    await page.setViewportSize({ width, height: 800 })
    await expect
      .poll(async () => (await namesOf(page)).filter((name) => !name.whole || name.clear < 3.5).map((name) => `${width}px ${name.name}: ${name.clear.toFixed(1)}px clear`))
      .toEqual([])
    const names = await namesOf(page)
    expect(new Set(names.map((name) => name.size)).size).toBe(1)
    sizes.push(names[0].size)
  }
  // 11px where there is room (the prototype's), less on a 320px phone, never under 9px.
  expect(sizes[0]).toBe("11px")
  expect(parseFloat(sizes[3])).toBeLessThan(11)
  expect(parseFloat(sizes[3])).toBeGreaterThanOrEqual(9)
})

