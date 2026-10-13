import { expect, type Locator, type Page } from "@playwright/test"
import { LOGIN_CODE } from "../mocks/data"

// signIn goes through the login page: the number without +998, then the code.
export async function signIn(page: Page, number: string) {
  await page.goto("/login")
  await page.getByRole("textbox", { name: "Telefon raqami" }).fill(number)
  await page.getByRole("button", { name: "Kodni olish" }).click()
  await page.getByRole("textbox", { name: "Kod" }).fill(LOGIN_CODE)
}

// The sidebar is a column from the md breakpoint up, a floating tab bar
// below it; lists are tables there and cards here.
export const onPhone = (page: Page) => (page.viewportSize()?.width ?? 0) < 768

// sections is the list of sections as the screen shows it: the sidebar's on
// a wide screen, the tab bar's on a phone. The tab bar stands on a
// section's own pages only: on a record, a form or the profile it is hidden
// (and out of the accessibility tree).
export async function sections(page: Page): Promise<Locator> {
  return page.getByRole("navigation", { name: "Bo'limlar" }).filter({ visible: true })
}

// goHome goes to the home: through the sections where they are on screen,
// by address from a page that hides the tab bar.
export async function goHome(page: Page) {
  const home = (await sections(page)).getByRole("link", { name: "Bosh sahifa", exact: true })
  if ((await home.count()) > 0) await home.click()
  else await page.goto("/")
  await expect(page).toHaveURL(/\/$/)
}

// openSection goes to a section through the sidebar or the tab bar. On a
// phone the bar holds the home and the member's first four sections; the
// rest are a row each on the home and the profile (logic/roles.md,
// section 8): the way there goes through the home.
export async function openSection(page: Page, name: string) {
  let bar = await sections(page)
  if (!onPhone(page)) {
    await bar.getByRole("link", { name, exact: true }).click()
    return
  }
  if ((await bar.count()) === 0) {
    await goHome(page)
    bar = await sections(page)
  }
  const inBar = bar.getByRole("link", { name, exact: true })
  // The sections come with the session: until then the bar holds the home
  // alone. A full bar (the home and four) means the section is past it.
  await inBar.or(bar.getByRole("link").nth(4)).first().waitFor()
  if ((await inBar.count()) > 0) {
    await inBar.click()
    return
  }
  await goHome(page)
  await page.getByRole("main").getByRole("list", { name: "Bo'limlar" }).getByRole("link", { name, exact: true }).click()
}

// homeHead is the home's head: the company, the short name and the role,
// the way to the profile.
export const homeHead = (page: Page) => page.getByRole("main").locator('a[href="/profile"]')

// openProfile goes to the profile page: the sidebar's foot on a wide screen,
// the home's head on a phone.
export async function openProfile(page: Page) {
  if (onPhone(page)) {
    await goHome(page)
    await homeHead(page).click()
  } else {
    await page.getByRole("complementary", { name: "Menyu" }).locator('a[href="/profile"]').click()
  }
  await expect(page).toHaveURL(/\/profile$/)
}

// signOut leaves through the profile page.
export async function signOut(page: Page) {
  await openProfile(page)
  await page.getByRole("button", { name: "Chiqish" }).click()
  await expect(page).toHaveURL(/\/login$/)
}

// locationSwitch is the pill that says the current location and switches
// it: the sidebar's on a wide screen, the home's head on a phone.
export const locationSwitch = (page: Page) =>
  (onPhone(page) ? page.getByRole("main") : page.getByRole("complementary", { name: "Menyu" })).getByRole("button", { name: /^Lokatsiya: / })

// chooseLocation makes the location current (logic/locations.md, section
// 4). On a phone the switch is the home's: the way goes home and back.
export async function chooseLocation(page: Page, name: string) {
  const away = onPhone(page) && new URL(page.url()).pathname !== "/"
  if (away) await goHome(page)
  await locationSwitch(page).click()
  await page.getByRole("dialog", { name: "Lokatsiya" }).getByRole("menuitemradio", { name, exact: true }).click()
  await expect(locationSwitch(page)).toHaveAccessibleName(`Lokatsiya: ${name}`)
  if (away) await page.goBack()
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

// list is a named list as the screen shows it. The sections that have the
// prototype's rows are a list on any screen; the rest are still a table on a
// wide screen and cards on a phone.
const rowLists = new Set(["Mijozlar", "Vazifalar", "Mahsulotlar", "Xizmatlar", "Ta'minotchilar", "Harakatlar", "Xaridlar"])
export const list = (page: Page, name: string) =>
  onPhone(page) || rowLists.has(name) ? page.getByRole("list", { name }) : page.getByRole("table", { name })

// pick finds an item in a picker by what is typed and takes the option.
export async function pick(page: Page, scope: Page | Locator, label: string, typed: string, option: RegExp) {
  // The record is picked in a sheet its row opens: what is typed searches.
  await scope.getByRole("button", { name: new RegExp(`^${label}`) }).click()
  const sheet = page.getByRole("dialog", { name: label })
  if (typed) await sheet.getByRole("searchbox").fill(typed)
  await sheet.getByRole("option", { name: option }).click()
  await expect(sheet).toBeHidden()
}

// settle waits for the toasts of the last step to go: on a phone they stand
// over the page's header, and they wait while the pointer rests on them.
export async function settle(page: Page) {
  await page.mouse.move(8, 300)
  await expect(page.locator("[data-sonner-toast]")).toHaveCount(0, { timeout: 15_000 })
}

// press types on an amount sheet's keypad (components/kit/amount-sheet.tsx)
// within scope: a comma is «vergul», "<" a step back («O'chirish»).
export async function press(scope: Locator, keys: string) {
  const keypad = scope.getByRole("group", { name: "Raqamlar" })
  for (const key of keys) {
    await keypad.getByRole("button", { name: key === "," ? "vergul" : key === "<" ? "O'chirish" : key, exact: true }).click()
  }
}
