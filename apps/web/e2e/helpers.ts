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
// a wide screen (the current section's own pages under it), the tab bar's
// on a phone, on every page.
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

// openSection goes to a section's own page through the sidebar or the tab
// bar. On a phone the bar holds the member's pages (by default the home,
// the customers, the orders and the products) and «Sozlama» last, the
// settings page; the sections the bar does not hold are rows of that page
// (logic/roles.md, section 8): the finance opens at its cash.
export async function openSection(page: Page, name: string) {
  let bar = await sections(page)
  if (!onPhone(page)) {
    // The section's own row comes before its pages (a page may share its name).
    await bar.getByRole("link", { name, exact: true }).first().click()
    return
  }
  if ((await bar.count()) === 0) {
    await goHome(page)
    bar = await sections(page)
  }
  const settings = bar.getByRole("link", { name: "Sozlama", exact: true })
  if (name === "Sozlamalar") {
    await settings.click()
    await expect(page).toHaveURL(/\/settings$/)
    return
  }
  const inBar = bar.getByRole("link", { name, exact: true })
  // The pages come with the session: until then the bar holds the home and
  // «Sozlama» alone. A full bar (four pages and «Sozlama») means the page
  // is past it.
  await inBar.or(bar.getByRole("link").nth(4)).first().waitFor()
  if ((await inBar.count()) > 0) {
    await inBar.click()
    return
  }
  await settings.click()
  await expect(page).toHaveURL(/\/settings$/)
  await page.getByRole("main").getByRole("link", { name, exact: true }).click()
}

// back takes the page's way back: its own «‹ name» link on a phone, the
// top bar's «Orqaga» on a wide screen (it leads where the page's link does).
export async function back(page: Page, name: string) {
  if (onPhone(page)) await page.getByRole("main").getByRole("link", { name, exact: true }).click()
  else await page.locator('[data-slot="top-bar"]').getByRole("link", { name: "Orqaga" }).click()
}

// homeHead is the home's head: the greeting; on a phone the company big,
// who is signed in, their role and the location under it.
export const homeHead = (page: Page) => page.locator('[data-slot="home-head"]')

// expectSignedIn checks who is in and where: on a phone the home's head
// names them ("Olma Savdo", "Ali Valiyev · Egasi · …"); on a wide screen the
// sidebar's company block does, the name and the role under the company.
export async function expectSignedIn(page: Page, who: { company: string; name: string; role: string }) {
  if (onPhone(page)) {
    const phone = homeHead(page).locator('[data-slot="home-head-phone"]')
    await expect(phone).toContainText(who.company)
    await expect(phone).toContainText(`${who.name} · ${who.role}`)
    return
  }
  const sidebar = page.getByRole("complementary", { name: "Menyu" })
  await expect(sidebar.getByText(who.company, { exact: true })).toBeVisible()
  await expect(sidebar.locator('a[href="/profile"]')).toContainText(`${who.name} · ${who.role}`)
}

// openProfile goes to the profile page: the sidebar's company block on a
// wide screen, the «Sozlama» page's company row on a phone.
export async function openProfile(page: Page) {
  if (onPhone(page)) {
    await (await sections(page)).getByRole("link", { name: "Sozlama", exact: true }).click()
    await expect(page).toHaveURL(/\/settings$/)
    await page.getByRole("main").locator('a[href="/profile"]').click()
  } else {
    await page.getByRole("complementary", { name: "Menyu" }).locator('a[href="/profile"]').click()
  }
  await expect(page).toHaveURL(/\/profile$/)
}

// signOut leaves through the profile page (a wide screen's top bar has a
// way out of its own, which asks first).
export async function signOut(page: Page) {
  await openProfile(page)
  await page.getByRole("main").getByRole("button", { name: "Chiqish" }).click()
  await expect(page).toHaveURL(/\/login$/)
}

// locationSwitch is the pill that says the current location and switches
// it: the top bar's on a wide screen (a menu), the home's head on a phone
// (a sheet).
export const locationSwitch = (page: Page) =>
  (onPhone(page) ? page.getByRole("main") : page.locator('[data-slot="top-bar"]')).getByRole("button", { name: /^Lokatsiya: / })

// chooseLocation makes the location current (logic/locations.md, section
// 4). On a phone the switch is the home's: the way goes home and back.
export async function chooseLocation(page: Page, name: string) {
  const away = onPhone(page) && new URL(page.url()).pathname !== "/"
  if (away) await goHome(page)
  await locationSwitch(page).click()
  await page.getByRole("menuitemradio", { name, exact: true }).click()
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

// list is a named list as the screen shows it: the prototype's rows on any
// screen; the few left as a table on a wide screen (cards on a phone) are
// named here.
const tables = new Set(["Xodimlar", "Kurslar tarixi"])
export const list = (page: Page, name: string) => (!onPhone(page) && tables.has(name) ? page.getByRole("table", { name }) : page.getByRole("list", { name }))

// days is a list of documents grouped by their day (components/kit/day-groups.tsx).
export const days = (page: Page, name: string) => page.getByRole("region", { name })

// pick finds an item in a picker by what is typed and takes the option.
export async function pick(page: Page, scope: Page | Locator, label: string, typed: string, option: RegExp) {
  // The record is picked in a sheet its row opens: what is typed searches.
  await scope.getByRole("button", { name: new RegExp(`^${label}`) }).click()
  const sheet = page.getByRole("dialog", { name: label })
  if (typed) await sheet.getByRole("searchbox").fill(typed)
  await sheet.getByRole("option", { name: option }).click()
  await expect(sheet).toBeHidden()
}

// settle waits for the toasts of the last step to go: they stand at the
// bottom of the screen, and they wait while the pointer rests on them or a
// press on them is under way. The pointer leaves; the emulated phone keeps
// sonner's list taken for pressed after a tap that ended elsewhere, so the
// list is told the press is over and the pointer gone.
export async function settle(page: Page) {
  await page.mouse.move(8, 300)
  await page.evaluate(() => {
    const list = document.querySelector("[data-sonner-toaster]")
    list?.dispatchEvent(new PointerEvent("pointerup", { bubbles: true }))
    list?.dispatchEvent(new MouseEvent("mouseout", { bubbles: true, relatedTarget: document.body }))
  })
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
