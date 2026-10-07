import type { Locator, Page } from "@playwright/test"
import { addDays, ALI, db, join, LOGIN_CODE, TODAY, VALI } from "../mocks/data"
import { expect, test } from "./fixtures"
import { openSection } from "./helpers"

// signIn goes through the login page: the number without +998, then the code.
async function signIn(page: Page, number: string) {
  await page.goto("/login")
  await page.getByRole("textbox", { name: "Telefon raqami" }).fill(number)
  await page.getByRole("button", { name: "Kodni olish" }).click()
  await page.getByRole("textbox", { name: "Kod" }).fill(LOGIN_CODE)
}

async function signOut(page: Page) {
  await page.getByRole("button", { name: "Profil" }).click()
  await page.getByRole("menuitem", { name: "Chiqish" }).click()
  await expect(page).toHaveURL(/\/login$/)
}

// The sidebar is a column from the md breakpoint up, a tab bar along the
// bottom below it; the members are a table there and cards here.
const onPhone = (page: Page) => (page.viewportSize()?.width ?? 0) < 768

// sections is the list of sections as the screen shows it: the sidebar's on
// a wide screen, the tab bar's on a phone.
async function sections(page: Page): Promise<Locator> {
  return page.getByRole("navigation", { name: "Bo'limlar" }).filter({ visible: true })
}

const members = (page: Page) =>
  onPhone(page) ? page.getByRole("list", { name: "Xodimlar" }) : page.getByRole("table", { name: "Xodimlar" })

// openEmployees signs the owner of Olma Savdo in and opens the employees.
async function openEmployees(page: Page) {
  await signIn(page, "901234567")
  await expect(page.getByRole("heading", { name: "Salom, Ali Valiyev" })).toBeVisible()
  await openSection(page, "Xodimlar")
  await expect(page).toHaveURL(/\/employees$/)
  await expect(page.getByRole("heading", { name: "Xodimlar" })).toBeVisible()
}

async function addEmployee(page: Page, number: string, name: string) {
  await page.getByRole("button", { name: "Xodim qo'shish" }).click()
  const dialog = page.getByRole("dialog", { name: "Xodim qo'shish" })
  await dialog.getByLabel("Telefon raqami").fill(number)
  await dialog.getByLabel("Ism").fill(name)
  await dialog.getByRole("button", { name: "Qo'shish" }).click()
  await expect(dialog).toBeHidden()
  await expect(members(page).getByText(name)).toBeVisible()
}

test("the owner adds an employee, who signs in and finds no way to the employees", async ({ page }) => {
  await openEmployees(page)
  await expect(members(page).getByText("+998 90 123 45 67")).toBeVisible()
  await expect(members(page).getByText("Siz")).toBeVisible()
  await expect(members(page).getByText("+998 90 222 33 44")).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0)

  await addEmployee(page, "907778899", "Yangi Xodim")
  await expect(members(page).getByText("+998 90 777 88 99")).toBeVisible()

  await signOut(page)
  await signIn(page, "907778899")
  await expect(page.getByRole("heading", { name: "Salom, Yangi Xodim" })).toBeVisible()
  await expect(page.getByRole("main").getByText("Xodim", { exact: true })).toBeVisible()
  const nav = await sections(page)
  await expect(nav.getByRole("link", { name: "Bosh sahifa" })).toBeVisible()
  await expect(nav.getByRole("link", { name: "Xodimlar" })).toHaveCount(0)
  // The address typed by hand leads back home.
  await page.goto("/employees")
  await expect(page).toHaveURL(/\/$/)
  await expect(page.getByRole("heading", { name: "Salom, Yangi Xodim" })).toBeVisible()
})

test("a phone that works in another company is added the same way, and chooses a company at sign-in", async ({ page }) => {
  await openEmployees(page)

  // Zarina works in Anor Servis.
  await addEmployee(page, "904445566", "Zarina (kassir)")

  await signOut(page)
  await signIn(page, "904445566")
  await expect(page).toHaveURL(/\/select-company$/)
  await expect(page.getByRole("button", { name: /Anor Servis/ })).toBeVisible()
  await page.getByRole("button", { name: /Olma Savdo/ }).click()
  await expect(page.getByRole("heading", { name: "Salom, Zarina (kassir)" })).toBeVisible()
})

test("the owner renames an employee and takes them out; out of their only company, they cannot sign in", async ({ page }) => {
  await openEmployees(page)
  await addEmployee(page, "907778899", "Yangi Xodim")

  await members(page).getByRole("button", { name: "Ismni o'zgartirish: Yangi Xodim" }).click()
  const rename = page.getByRole("dialog", { name: "Ismni o'zgartirish" })
  await expect(rename.getByLabel("Ism")).toHaveValue("Yangi Xodim")
  await rename.getByLabel("Ism").fill("Yangi Kassir")
  await rename.getByRole("button", { name: "Saqlash" }).click()
  await expect(rename).toBeHidden()
  await expect(members(page).getByText("Yangi Kassir")).toBeVisible()

  await members(page).getByRole("button", { name: "O'chirish: Yangi Kassir" }).click()
  const confirm = page.getByRole("alertdialog", { name: "Xodimni o'chirasizmi?" })
  await expect(confirm.getByText(/Yangi Kassir Olma Savdo kompaniyasiga kira olmaydi/)).toBeVisible()
  await confirm.getByRole("button", { name: "O'chirish" }).click()
  await expect(confirm).toBeHidden()
  await expect(members(page).getByText("+998 90 777 88 99")).toHaveCount(0)

  await signOut(page)
  await signIn(page, "907778899")
  await expect(page.getByRole("alert").filter({ hasText: "Kod noto'g'ri yoki muddati o'tgan" })).toBeVisible()
  await expect(page).toHaveURL(/\/login$/)
})

test("an employee taken out while signed in is out at the next page", async ({ page }) => {
  join("998907778899", 1, "Yangi Xodim")
  await signIn(page, "907778899")
  await expect(page.getByRole("heading", { name: "Salom, Yangi Xodim" })).toBeVisible()

  // The owner takes them out of their only company.
  db.members["998907778899"] = []
  await page.reload()

  await expect(page).toHaveURL(/\/login$/)
})

test("an employee of two companies taken out of one goes on in the other", async ({ page }) => {
  await signIn(page, "902223344")
  await page.getByRole("button", { name: /Olma Savdo/ }).click()
  await expect(page.getByRole("heading", { name: "Salom, Vali Aliyev" })).toBeVisible()

  // Olma Savdo's owner takes Vali out.
  db.members[VALI] = db.members[VALI].filter((membership) => membership.companyId !== 1)
  await page.reload()

  await expect(page).toHaveURL(/\/select-company$/)
  await expect(page.getByRole("button", { name: /Nok Market/ })).toBeEnabled()
  await expect(page.getByRole("button", { name: /Olma Savdo/ })).toHaveCount(0)
})

test("an owner replaced while signed in loses the employees at the next request", async ({ page }) => {
  await openEmployees(page)

  // The admin makes Vali the owner: Ali stays in the company, as an employee.
  db.members[ALI].find((membership) => membership.companyId === 1)!.role = "user"
  db.members[VALI].find((membership) => membership.companyId === 1)!.role = "owner"
  await page.getByRole("button", { name: "Xodim qo'shish" }).click()
  const dialog = page.getByRole("dialog", { name: "Xodim qo'shish" })
  await dialog.getByLabel("Telefon raqami").fill("907778899")
  await dialog.getByLabel("Ism").fill("Yangi Xodim")
  await dialog.getByRole("button", { name: "Qo'shish" }).click()

  await expect(page).toHaveURL(/\/$/)
  await expect(page.getByRole("heading", { name: "Salom, Ali Valiyev" })).toBeVisible()
  await expect(page.getByRole("main").getByText("Xodim", { exact: true })).toBeVisible()
  await expect((await sections(page)).getByRole("link", { name: "Xodimlar" })).toHaveCount(0)
  expect(db.members["998907778899"]).toBeUndefined()
})

test("a subscription that runs out under the owner leads to /expired at the next request", async ({ page }) => {
  await openEmployees(page)

  db.companies.find((company) => company.id === 1)!.end_date = addDays(TODAY, -1)
  await members(page).getByRole("button", { name: "O'chirish: Vali Aliyev" }).click()
  await page.getByRole("alertdialog", { name: "Xodimni o'chirasizmi?" }).getByRole("button", { name: "O'chirish" }).click()

  await expect(page).toHaveURL(/\/expired$/)
  expect(db.members[VALI].map((membership) => membership.companyId)).toEqual([1, 2])
})

test("a long name wraps: nothing scrolls sideways, on the page or inside it", async ({ page }) => {
  // The app scrolls inside <main>, so the document's own width proves nothing.
  join("998907778899", 1, "Abdulhamidxo'jayevabdurahmonqoriyevmuhammadyusufxon Abdulazizxo'jayevmirzo (bosh hisobchi)")
  await openEmployees(page)
  await expect(members(page).getByText(/Abdulhamidxo'jayev/)).toBeVisible()

  const overflow = await page.evaluate(() => {
    const main = document.querySelector("main")!
    return {
      page: document.documentElement.scrollWidth - innerWidth,
      main: main.scrollWidth - main.clientWidth,
    }
  })

  expect(overflow).toEqual({ page: expect.any(Number), main: 0 })
  expect(overflow.page).toBeLessThanOrEqual(0)
})
