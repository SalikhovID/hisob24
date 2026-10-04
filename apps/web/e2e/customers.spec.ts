import type { Locator, Page } from "@playwright/test"
import { db, seedCustomers, seedSixKinds } from "../mocks/data"
import { expect, test } from "./fixtures"
import { onPhone, openSection, sideScroll, signIn } from "./helpers"

// openCustomers signs the owner of Olma Savdo in and opens the customers.
async function openCustomers(page: Page) {
  await signIn(page, "901234567")
  await expect(page.getByRole("heading", { name: "Salom, Ali Valiyev" })).toBeVisible()
  await openSection(page, "Mijozlar")
  await expect(page).toHaveURL(/\/customers$/)
  await expect(page.getByRole("heading", { level: 1, name: "Mijozlar" })).toBeVisible()
}

// The list is a table on wide screens and cards on a phone: the one on
// screen is the one a test reads.
const list = (page: Page) =>
  onPhone(page) ? page.getByRole("list", { name: "Mijozlar" }) : page.getByRole("table", { name: "Mijozlar" })

// lines counts the lines an element's text stands on.
const lines = (locator: Locator) =>
  locator.evaluate((element) => {
    const range = document.createRange()
    range.selectNodeContents(element)
    return new Set(Array.from(range.getClientRects()).map((rect) => Math.round(rect.top))).size
  })

test("the list shows every answer whole: no word is broken to make a column narrower", async ({ page }) => {
  const { dilshod } = seedCustomers()
  const kinds = seedSixKinds()
  dilshod.values[kinds.yosh.id] = 34
  dilshod.values[kinds.jinsi.id] = kinds.jins.options[0].id
  dilshod.values[kinds.tillar.id] = [kinds.til.options[0].id, kinds.til.options[1].id]
  dilshod.values[kinds.kanallar.id] = [db.dropdowns[0].options[0].id, db.dropdowns[0].options[1].id]
  await openCustomers(page)
  const customers = list(page)
  await expect(customers.getByText("Dilshod Karimov")).toBeVisible()

  if (!onPhone(page)) {
    for (const header of await customers.getByRole("columnheader").all()) {
      expect(await lines(header), await header.textContent() ?? "").toBe(1)
    }
    const dilshodRow = customers.getByRole("row").filter({ hasText: "Dilshod Karimov" })
    for (const answer of ["Instagram", "Erkak", "34"]) {
      expect(await lines(dilshodRow.getByRole("cell", { name: answer, exact: true })), answer).toBe(1)
    }
    const firmRow = customers.getByRole("row").filter({ hasText: "Anor Tekstil MChJ" })
    expect(await lines(firmRow.getByRole("cell", { name: "301234567", exact: true }))).toBe(1)
  }
  expect(await sideScroll(page)).toBeLessThanOrEqual(0)
})

test("an employee enters a customer, edits it and deletes it; the history is not theirs to see", async ({ page }) => {
  await signIn(page, "902223344")
  await page.getByRole("button", { name: /Olma Savdo/ }).click()
  await expect(page.getByRole("heading", { name: "Salom, Vali Aliyev" })).toBeVisible()
  await openSection(page, "Mijozlar")
  await expect(page.getByText("Hali mijoz yo'q")).toBeVisible()

  await page.getByRole("button", { name: "Mijoz qo'shish" }).click()
  let dialog = page.getByRole("dialog", { name: "Mijoz qo'shish" })
  await dialog.getByLabel("Telefon raqami").fill("901112233")
  await dialog.getByLabel("F.I.Sh.").fill("Yangi Mijoz")
  await dialog.getByLabel("Manba").selectOption({ label: "LinkedIn" })
  await dialog.getByRole("button", { name: "Qo'shish" }).click()
  await expect(dialog).toBeHidden()

  const customers = list(page)
  await expect(customers.getByText("Yangi Mijoz")).toBeVisible()
  await expect(customers.getByText("+998 90 111 22 33")).toBeVisible()
  await expect(customers.getByText("LinkedIn")).toBeVisible()
  await expect(page.getByText("Kompaniyangiz mijozlari · 1 ta")).toBeVisible()
  expect(await sideScroll(page)).toBeLessThanOrEqual(0)

  // The name is the way into the customer.
  await customers.getByRole("link", { name: "Yangi Mijoz" }).click()
  await expect(page).toHaveURL(/\/customers\/\d+$/)
  await expect(page.getByRole("heading", { level: 1, name: "Yangi Mijoz" })).toBeVisible()
  await expect(page.getByText("Jismoniy · +998 90 111 22 33")).toBeVisible()
  await expect(page.getByRole("region", { name: "Ma'lumot" }).getByText("Vali Aliyev")).toBeVisible()
  await expect(page.getByRole("heading", { name: "Tarix" })).toHaveCount(0)
  expect(await sideScroll(page)).toBeLessThanOrEqual(0)

  await page.getByRole("button", { name: "Tahrirlash" }).click()
  dialog = page.getByRole("dialog", { name: "Mijozni tahrirlash" })
  await expect(dialog.getByLabel("Telefon raqami")).toHaveValue("90 111 22 33")
  await dialog.getByLabel("F.I.Sh.").fill("Yangi Mijoz Aliyev")
  await dialog.getByRole("button", { name: "Saqlash" }).click()
  await expect(dialog).toBeHidden()
  await expect(page.getByRole("heading", { level: 1, name: "Yangi Mijoz Aliyev" })).toBeVisible()

  await page.getByRole("button", { name: "O'chirish" }).click()
  await page.getByRole("alertdialog", { name: "Mijozni o'chirasizmi?" }).getByRole("button", { name: "O'chirish" }).click()
  await expect(page).toHaveURL(/\/customers$/)
  await expect(page.getByText("Hali mijoz yo'q")).toBeVisible()
})

test("the owner searches, keeps one type, hides a column for good and reads a customer's history", async ({ page }) => {
  seedCustomers()
  await openCustomers(page)
  const customers = list(page)
  // The list is there before anything is typed: a cold server answers late.
  await expect(customers.getByText("Dilshod Karimov")).toBeVisible()

  const search = page.getByRole("searchbox", { name: "Qidirish" })
  await search.fill("anor")
  await expect(page).toHaveURL(/search=anor/)
  await expect(customers.getByText("Anor Tekstil MChJ")).toBeVisible()
  await expect(customers.getByText("Dilshod Karimov")).toHaveCount(0)
  await search.fill("")
  await expect(customers.getByText("Dilshod Karimov")).toBeVisible()
  await expect(page).toHaveURL(/\/customers$/)

  await page.getByRole("tab", { name: "Yuridik" }).click()
  await expect(page).toHaveURL(/type=\d+/)
  await expect(customers.getByText("Anor Tekstil MChJ")).toBeVisible()
  await expect(customers.getByText("Malika Yusupova")).toHaveCount(0)
  await page.getByRole("tab", { name: "Barchasi" }).click()
  await expect(customers.getByText("Malika Yusupova")).toBeVisible()

  // A hidden column stays hidden after a reload: the choice is kept in the browser.
  await expect(customers.getByText("Sardor Karimov")).toBeVisible()
  await page.getByRole("button", { name: "Ustunlar" }).click()
  await page.getByRole("menuitemcheckbox", { name: "Qo'shgan" }).click()
  await page.keyboard.press("Escape")
  await expect(customers.getByText("Sardor Karimov")).toHaveCount(0)
  await page.reload()
  await expect(list(page).getByText("Malika Yusupova")).toBeVisible()
  await expect(list(page).getByText("Sardor Karimov")).toHaveCount(0)
  expect(await sideScroll(page)).toBeLessThanOrEqual(0)

  // An edit, then what the history says of it.
  await list(page).getByRole("link", { name: "Dilshod Karimov" }).click()
  await expect(page.getByRole("heading", { level: 1, name: "Dilshod Karimov" })).toBeVisible()
  await page.getByRole("button", { name: "Tahrirlash" }).click()
  const dialog = page.getByRole("dialog", { name: "Mijozni tahrirlash" })
  await dialog.getByLabel("Manba").selectOption({ label: "LinkedIn" })
  await dialog.getByRole("button", { name: "Saqlash" }).click()
  await expect(dialog).toBeHidden()
  const history = page.getByRole("list", { name: "Tarix" })
  const [edited, entered] = [history.getByRole("listitem").nth(0), history.getByRole("listitem").nth(1)]
  await expect(edited).toContainText("Tahrirlandi")
  await expect(edited).toContainText("Ali Valiyev")
  await expect(edited).toContainText("Instagram")
  await expect(edited).toContainText("LinkedIn")
  await expect(entered).toContainText("Qo'shildi")
  await expect(entered).toContainText("Vali Aliyev")
  expect(await sideScroll(page)).toBeLessThanOrEqual(0)
})

test("a phone that another customer has leads to that customer", async ({ page }) => {
  const { dilshod } = seedCustomers()
  await openCustomers(page)
  await expect(list(page).getByText("Dilshod Karimov")).toBeVisible()

  await page.getByRole("button", { name: "Mijoz qo'shish" }).click()
  const dialog = page.getByRole("dialog", { name: "Mijoz qo'shish" })
  await dialog.getByLabel("Telefon raqami").fill("911112233")
  await dialog.getByLabel("F.I.Sh.").fill("Boshqa Dilshod")
  await dialog.getByRole("button", { name: "Qo'shish" }).click()

  await expect(dialog.getByText("Bu raqamli mijoz allaqachon bor")).toBeVisible()
  await dialog.getByRole("link", { name: "Mijozni ochish" }).click()
  await expect(page).toHaveURL(new RegExp(`/customers/${dilshod.id}$`))
  await expect(page.getByRole("heading", { level: 1, name: "Dilshod Karimov" })).toBeVisible()
  await expect(page.getByRole("dialog")).toHaveCount(0)
})

test("a customer with a field of each kind is entered, and its page shows every answer", async ({ page }) => {
  seedSixKinds()
  await openCustomers(page)
  await expect(page.getByText("Hali mijoz yo'q")).toBeVisible()

  await page.getByRole("button", { name: "Mijoz qo'shish" }).click()
  const dialog = page.getByRole("dialog", { name: "Mijoz qo'shish" })
  await dialog.getByLabel("Telefon raqami").fill("901112233")
  await dialog.getByLabel("F.I.Sh.").fill("Olti Tur")
  await dialog.getByLabel("Manba").selectOption({ label: "Instagram" })
  await dialog.getByLabel("Yoshi").fill("30")
  await dialog.getByRole("radiogroup", { name: "Jinsi" }).getByRole("radio", { name: "Ayol" }).click()
  const languages = dialog.getByRole("group", { name: "Tillar" })
  await languages.getByRole("checkbox", { name: "O'zbek" }).click()
  await languages.getByRole("checkbox", { name: "Rus" }).click()
  await dialog.getByRole("button", { name: /Kanallar/ }).click()
  await page.getByRole("menuitemcheckbox", { name: "LinkedIn" }).click()
  await page.getByRole("menuitemcheckbox", { name: "Instagram" }).click()
  await page.keyboard.press("Escape")
  await expect(page.getByRole("menu")).toHaveCount(0)
  await expect(dialog.getByRole("button", { name: /Kanallar/ })).toContainText("Instagram, LinkedIn")
  expect(await sideScroll(page)).toBeLessThanOrEqual(0)
  await dialog.getByRole("button", { name: "Qo'shish" }).click()
  await expect(dialog).toBeHidden()

  await list(page).getByRole("link", { name: "Olti Tur" }).click()
  const info = page.getByRole("region", { name: "Ma'lumot" })
  for (const answer of ["+998 90 111 22 33", "Olti Tur", "Instagram", "30", "Ayol", "O'zbek, Rus", "Instagram, LinkedIn"]) {
    await expect(info.getByText(answer, { exact: true })).toBeVisible()
  }
  expect(await sideScroll(page)).toBeLessThanOrEqual(0)
})
