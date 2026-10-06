import type { Page } from "@playwright/test"
import { LOGIN_CODE } from "../mocks/data"
import { expect, test } from "./fixtures"

// signIn goes through the login page: the number without +998, then the code.
async function signIn(page: Page, number: string) {
  await page.goto("/login")
  await page.getByRole("textbox", { name: "Telefon raqami" }).fill(number)
  await page.getByRole("button", { name: "Kodni olish" }).click()
  await page.getByRole("textbox", { name: "Kod" }).fill(LOGIN_CODE)
}

// The sidebar is a column from the md breakpoint up, a tab bar along the
// bottom below it.
const onPhone = (page: Page) => (page.viewportSize()?.width ?? 0) < 768

const width = (page: Page) => async () => (await page.getByRole("complementary", { name: "Menyu" }).boundingBox())?.width

// tabBar is the phone's sections: the navigation that is shown, the
// sidebar's being hidden there.
const tabBar = (page: Page) => page.getByRole("navigation", { name: "Bo'limlar" }).filter({ visible: true })

test("the sections are a folding sidebar on a wide screen and a tab bar along the bottom of a phone", async ({ page }) => {
  await signIn(page, "901234567")
  await expect(page.getByRole("heading", { name: "Salom, Ali Valiyev" })).toBeVisible()
  const sidebar = page.getByRole("complementary", { name: "Menyu" })

  if (onPhone(page)) {
    await expect(sidebar).toBeHidden()
    await expect(page.getByRole("button", { name: "Menyu", exact: true })).toHaveCount(0)
    const bar = tabBar(page)
    await expect(bar.getByRole("link")).toHaveText(["Bosh sahifa", "Mijozlar", "Vazifalar", "Xodimlar", "Sozlamalar"])
    await expect(bar.getByRole("link", { name: "Bosh sahifa" })).toHaveAttribute("aria-current", "page")
    // The bar stands along the bottom, under the page, and the page fits its width.
    const box = (await bar.boundingBox())!
    const viewport = page.viewportSize()!
    expect(box.y + box.height).toBeGreaterThanOrEqual(viewport.height - 1)
    expect(box.width).toBe(viewport.width)
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0)
    await bar.getByRole("link", { name: "Xodimlar" }).click()
    await expect(page).toHaveURL(/\/employees$/)
    await expect(bar.getByRole("link", { name: "Xodimlar" })).toHaveAttribute("aria-current", "page")
    await expect(bar.getByRole("link", { name: "Bosh sahifa" })).not.toHaveAttribute("aria-current", "page")
    return
  }

  await expect(page.getByRole("button", { name: "Menyu", exact: true })).toHaveCount(0)
  await expect(sidebar.getByRole("link", { name: "Bosh sahifa" })).toHaveAttribute("aria-current", "page")
  await expect(sidebar.getByRole("link", { name: "Xodimlar" })).toBeVisible()
  await expect(sidebar.getByText("Olma Savdo")).toBeVisible()
  await expect.poll(width(page)).toBe(256)

  await sidebar.getByRole("button", { name: "Menyuni yig'ish" }).click()
  await expect.poll(width(page)).toBe(64)
  await expect(sidebar.getByText("Olma Savdo")).toHaveCount(0)
  await sidebar.getByRole("link", { name: "Xodimlar" }).hover()
  await expect(page.locator('[data-slot="tooltip-content"]')).toHaveText("Xodimlar")

  // The fold is the browser's to remember.
  await page.reload()
  await expect(sidebar.getByRole("button", { name: "Menyuni yoyish" })).toBeVisible()
  await expect.poll(width(page)).toBe(64)
  await sidebar.getByRole("button", { name: "Menyuni yoyish" }).click()
  await expect.poll(width(page)).toBe(256)
  await expect(sidebar.getByText("Olma Savdo")).toBeVisible()
})

test("an employee sees no section of the owner's", async ({ page }) => {
  await signIn(page, "902223344")
  await page.getByRole("button", { name: /Olma Savdo/ }).click()
  await expect(page.getByRole("heading", { name: "Salom, Vali Aliyev" })).toBeVisible()

  const sections = tabBar(page)
  await expect(sections.getByRole("link", { name: "Bosh sahifa" })).toBeVisible()
  await expect(sections.getByRole("link", { name: "Xodimlar" })).toHaveCount(0)
})

test("the profile menu says who is signed in and leads to their other company", async ({ page }) => {
  await signIn(page, "902223344")
  await page.getByRole("button", { name: /Olma Savdo/ }).click()
  await expect(page.getByRole("heading", { name: "Salom, Vali Aliyev" })).toBeVisible()

  await page.getByRole("button", { name: "Profil" }).click()
  const menu = page.getByRole("menu")
  await expect(menu.getByText("Vali Aliyev")).toBeVisible()
  await expect(menu.getByText("+998 90 222 33 44")).toBeVisible()
  await menu.getByRole("menuitem", { name: "Kompaniyani almashtirish" }).click()

  await expect(page).toHaveURL(/\/select-company$/)
})

test("the shell is headed by Hisob24's logo, the company's name under it, and by its mark when folded", async ({
  page,
}) => {
  await signIn(page, "901234567")
  await expect(page.getByRole("heading", { name: "Salom, Ali Valiyev" })).toBeVisible()
  const logo = { name: "Hisob24" }
  // under says the company's name starts where the logo ends, or lower.
  const under = async (within: ReturnType<Page["getByRole"]>) => {
    const logoBox = (await within.getByRole("img", logo).boundingBox())!
    const nameBox = (await within.getByText("Olma Savdo").boundingBox())!
    expect(nameBox.y).toBeGreaterThanOrEqual(logoBox.y + logoBox.height)
  }

  if (onPhone(page)) {
    // The top bar stands for the sidebar, which a phone hides; the tab bar
    // has the sections alone, no logo.
    const bar = page.getByRole("banner")
    await expect(bar.getByRole("img", logo)).toBeVisible()
    await under(bar)
    await expect(tabBar(page).getByRole("img", logo)).toHaveCount(0)
    return
  }

  const sidebar = page.getByRole("complementary", { name: "Menyu" })
  await expect(sidebar.getByRole("img", logo)).toBeVisible()
  await under(sidebar)
  // The sidebar shows it, so the top bar does not.
  await expect(page.getByRole("banner").getByRole("img", logo)).toHaveCount(0)

  await sidebar.getByRole("button", { name: "Menyuni yig'ish" }).click()
  await expect(sidebar.getByRole("img", logo)).toHaveCount(0)
  await expect(sidebar.getByRole("button", { name: "Menyuni yoyish" }).locator('[data-slot="logo-mark"]')).toBeVisible()
})
