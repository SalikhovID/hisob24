import type { Page } from "@playwright/test"
import { seedCustomers, seedSixKinds } from "../mocks/data"
import { expect, test } from "./fixtures"
import { choose, openSection, sideScroll, signIn } from "./helpers"

// openCustomers signs the owner of Olma Savdo in and opens the customers.
async function openCustomers(page: Page) {
  await signIn(page, "901234567")
  await expect(page.getByRole("heading", { name: "Salom, Ali Valiyev" })).toBeVisible()
  await openSection(page, "Mijozlar")
  await expect(page).toHaveURL(/\/customers$/)
  await expect(page.getByRole("heading", { level: 1, name: "Mijozlar" })).toBeVisible()
}

// The list is a group of rows on a phone and a wide screen alike.
const list = (page: Page) => page.getByRole("list", { name: "Mijozlar" })
// addButton is the round + that heads the page.
const addButton = (page: Page) => page.getByRole("button", { name: "Mijoz qo'shish" }).first()

test("the list is a row each, its name over its phone and type, on any screen; the page fits its width", async ({ page }) => {
  const { dilshod } = seedCustomers()
  await openCustomers(page)
  const row = list(page).getByRole("link", { name: /^Dilshod Karimov/ })

  await expect(row).toHaveAttribute("href", `/customers/${dilshod.id}`)
  await expect(row).toContainText("+998 91 111 22 33 · Jismoniy")
  await expect(page.getByText("Jami: 3")).toBeVisible()
  expect(await sideScroll(page)).toBeLessThanOrEqual(0)
})

test("an employee enters a customer, edits it and deletes it; the history is not theirs to see", async ({ page }) => {
  await signIn(page, "902223344")
  await page.getByRole("button", { name: /Olma Savdo/ }).click()
  await expect(page.getByRole("heading", { name: "Salom, Vali Aliyev" })).toBeVisible()
  await openSection(page, "Mijozlar")
  await expect(page.getByText("Hali mijoz yo'q")).toBeVisible()

  await addButton(page).click()
  let dialog = page.getByRole("dialog", { name: "Mijoz qo'shish" })
  await dialog.getByLabel("Telefon raqami").fill("901112233")
  await dialog.getByLabel("F.I.Sh.").fill("Yangi Mijoz")
  await choose(dialog.getByLabel("Manba"), "LinkedIn")
  await dialog.getByRole("button", { name: "Qo'shish" }).click()
  await expect(dialog).toBeHidden()

  const customers = list(page)
  await expect(customers.getByText("Yangi Mijoz")).toBeVisible()
  await expect(customers.getByText("+998 90 111 22 33 · Jismoniy")).toBeVisible()
  await expect(page.getByText("Kompaniyangiz mijozlari · 1 ta")).toBeVisible()
  expect(await sideScroll(page)).toBeLessThanOrEqual(0)

  // The row is the way into the customer.
  await customers.getByRole("link", { name: /^Yangi Mijoz/ }).click()
  await expect(page).toHaveURL(/\/customers\/\d+$/)
  await expect(page.getByRole("heading", { level: 1, name: "Yangi Mijoz" })).toBeVisible()
  await expect(page.getByText("Jismoniy · +998 90 111 22 33")).toBeVisible()
  await expect(page.getByRole("region", { name: "Ma'lumot" }).getByText("Vali Aliyev")).toBeVisible()
  await expect(page.getByRole("region", { name: "Ma'lumot" }).getByText("LinkedIn")).toBeVisible()
  await expect(page.getByRole("heading", { name: "Tarix" })).toHaveCount(0)
  expect(await sideScroll(page)).toBeLessThanOrEqual(0)

  await page.getByRole("button", { name: "Tahrirlash" }).click()
  dialog = page.getByRole("dialog", { name: "Mijozni tahrirlash" })
  await expect(dialog.getByLabel("Telefon raqami")).toHaveValue("90 111 22 33")
  await dialog.getByLabel("F.I.Sh.").fill("Yangi Mijoz Aliyev")
  await dialog.getByRole("button", { name: "Saqlash" }).click()
  await expect(dialog).toBeHidden()
  await expect(page.getByRole("heading", { level: 1, name: "Yangi Mijoz Aliyev" })).toBeVisible()

  await page.getByRole("button", { name: "Mijozni o'chirish" }).click()
  await page.getByRole("alertdialog", { name: "Mijozni o'chirasizmi?" }).getByRole("button", { name: "O'chirish" }).click()
  await expect(page).toHaveURL(/\/customers$/)
  await expect(page.getByText("Hali mijoz yo'q")).toBeVisible()
})

test("the owner searches, keeps one type and reads a customer's history", async ({ page }) => {
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

  const types = page.getByRole("radiogroup", { name: "Mijoz turi" })
  await types.getByRole("radio", { name: "Yuridik" }).click()
  await expect(page).toHaveURL(/type=\d+/)
  await expect(customers.getByText("Anor Tekstil MChJ")).toBeVisible()
  await expect(customers.getByText("Malika Yusupova")).toHaveCount(0)
  await types.getByRole("radio", { name: "Barchasi" }).click()
  await expect(customers.getByText("Malika Yusupova")).toBeVisible()
  expect(await sideScroll(page)).toBeLessThanOrEqual(0)

  // An edit, then what the history says of it.
  await list(page).getByRole("link", { name: /^Dilshod Karimov/ }).click()
  await expect(page.getByRole("heading", { level: 1, name: "Dilshod Karimov" })).toBeVisible()
  await page.getByRole("button", { name: "Tahrirlash" }).click()
  const dialog = page.getByRole("dialog", { name: "Mijozni tahrirlash" })
  await choose(dialog.getByLabel("Manba"), "LinkedIn")
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

  await addButton(page).click()
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

  await addButton(page).click()
  const dialog = page.getByRole("dialog", { name: "Mijoz qo'shish" })
  await dialog.getByLabel("Telefon raqami").fill("901112233")
  await dialog.getByLabel("F.I.Sh.").fill("Olti Tur")
  await choose(dialog.getByLabel("Manba"), "Instagram")
  await dialog.getByLabel("Yoshi").fill("30")
  await dialog.getByRole("radiogroup", { name: "Jinsi" }).getByRole("radio", { name: "Ayol" }).click()
  const languages = dialog.getByRole("group", { name: "Tillar" })
  await languages.getByRole("checkbox", { name: "O'zbek" }).click()
  await languages.getByRole("checkbox", { name: "Rus" }).click()
  // A choice of several is made in a sheet that stays open while options are taken.
  const channels = dialog.getByRole("button", { name: /^Kanallar/ })
  await channels.click()
  const sheet = page.getByRole("dialog", { name: "Kanallar" })
  await sheet.getByRole("option", { name: "LinkedIn", exact: true }).click()
  await sheet.getByRole("option", { name: "Instagram", exact: true }).click()
  await sheet.getByRole("button", { name: "Tayyor" }).click()
  await expect(sheet).toBeHidden()
  await expect(channels).toContainText("Instagram, LinkedIn")
  expect(await sideScroll(page)).toBeLessThanOrEqual(0)
  await dialog.getByRole("button", { name: "Qo'shish" }).click()
  await expect(dialog).toBeHidden()

  await list(page).getByRole("link", { name: /^Olti Tur/ }).click()
  const info = page.getByRole("region", { name: "Ma'lumot" })
  for (const answer of ["+998 90 111 22 33", "Olti Tur", "Instagram", "30", "Ayol", "O'zbek, Rus", "Instagram, LinkedIn"]) {
    await expect(info.getByText(answer, { exact: true })).toBeVisible()
  }
  expect(await sideScroll(page)).toBeLessThanOrEqual(0)
})
