import type { Locator, Page } from "@playwright/test"
import { LOGIN_CODE } from "../mocks/data"

// signIn goes through the login page: the number without +998, then the code.
export async function signIn(page: Page, number: string) {
  await page.goto("/login")
  await page.getByRole("textbox", { name: "Telefon raqami" }).fill(number)
  await page.getByRole("button", { name: "Kodni olish" }).click()
  await page.getByRole("textbox", { name: "Kod" }).fill(LOGIN_CODE)
}

// The sidebar is a column from the md breakpoint up, a sheet below it; lists
// are tables there and cards here.
export const onPhone = (page: Page) => (page.viewportSize()?.width ?? 0) < 768

// sections is the list of sections as the screen shows it: on a phone the
// menu's sheet is opened for it.
export async function sections(page: Page): Promise<Locator> {
  if (onPhone(page)) await page.getByRole("button", { name: "Menyu", exact: true }).click()
  return page.getByRole("navigation", { name: "Bo'limlar" }).filter({ visible: true })
}

// openSection goes to a section through the sidebar.
export async function openSection(page: Page, name: string) {
  await (await sections(page)).getByRole("link", { name }).click()
}

// noSideScroll tells whether the page fits its width: nothing to scroll
// sideways.
export const sideScroll = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth - innerWidth)

// choose opens a select (shadcn's: a combobox button) and picks the option
// by its name.
export async function choose(box: Locator, name: string) {
  await box.click()
  await box.page().getByRole("option", { name, exact: true }).click()
}
