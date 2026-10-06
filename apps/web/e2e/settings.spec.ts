import type { Page } from "@playwright/test"
import { typesOf } from "../mocks/data"
import { expect, test } from "./fixtures"
import { choose, onPhone, openSection, sections, sideScroll, signIn } from "./helpers"

// openSettings signs the owner of Olma Savdo in and opens the settings.
async function openSettings(page: Page) {
  await signIn(page, "901234567")
  await expect(page.getByRole("heading", { name: "Salom, Ali Valiyev" })).toBeVisible()
  await openSection(page, "Sozlamalar")
  await expect(page).toHaveURL(/\/settings$/)
  await expect(page.getByRole("heading", { level: 1, name: "Sozlamalar" })).toBeVisible()
}

// backToSettings follows the page's own way back (the sidebar has a link of
// the same name).
const backToSettings = (page: Page) => page.getByRole("main").getByRole("link", { name: "Sozlamalar" }).click()

// openTab opens one of the settings' tabs.
const openTab = (page: Page, name: string) => page.getByRole("tab", { name }).click()

test("the owner makes a dropdown, types its options in, and uses it in a field of a new type", async ({ page }) => {
  await openSettings(page)
  const types = page.getByRole("list", { name: "Mijoz turlari" })
  const dropdowns = page.getByRole("list", { name: "Dropdownlar" })
  await expect(types.getByRole("link", { name: "Jismoniy" })).toBeVisible()
  expect(await sideScroll(page)).toBeLessThanOrEqual(0)

  // The dropdowns are a tab of their own, and the open tab is in the address.
  await openTab(page, "Dropdownlar")
  await expect(page).toHaveURL(/\/settings\?tab=dropdowns$/)
  await expect(dropdowns.getByRole("link", { name: "Manba" })).toBeVisible()
  await expect(types).toHaveCount(0)
  expect(await sideScroll(page)).toBeLessThanOrEqual(0)

  await page.getByRole("button", { name: "Dropdown qo'shish" }).click()
  let dialog = page.getByRole("dialog", { name: "Dropdown qo'shish" })
  await dialog.getByLabel("Nomi").fill("Holat")
  await dialog.getByRole("button", { name: "Qo'shish" }).click()
  await expect(dialog).toBeHidden()

  await dropdowns.getByRole("link", { name: "Holat" }).click()
  await expect(page.getByRole("heading", { level: 1, name: "Holat" })).toBeVisible()
  await expect(page.getByText("Hali variant yo'q")).toBeVisible()
  const line = page.getByRole("textbox", { name: "Yangi variant" })
  for (const option of ["Yangi", "Doimiy", "VIP"]) {
    await line.fill(option)
    await line.press("Enter")
    await expect(page.getByRole("list", { name: "Variantlar" }).getByText(option, { exact: true })).toBeVisible()
  }
  await expect(page.getByText("Dropdown · 3 ta variant")).toBeVisible()
  expect(await sideScroll(page)).toBeLessThanOrEqual(0)

  // The way back leads to the dropdowns' tab; the types are on theirs.
  await backToSettings(page)
  await expect(page).toHaveURL(/\/settings\?tab=dropdowns$/)
  await expect(dropdowns.getByRole("link", { name: "Holat" })).toBeVisible()
  await openTab(page, "Mijozlar")
  await expect(page).toHaveURL(/\/settings$/)
  await page.getByRole("button", { name: "Tur qo'shish" }).click()
  dialog = page.getByRole("dialog", { name: "Tur qo'shish" })
  await dialog.getByLabel("Nomi").fill("Hamkor")
  await dialog.getByRole("button", { name: "Qo'shish" }).click()
  await expect(dialog).toBeHidden()
  await types.getByRole("link", { name: "Hamkor" }).click()
  await expect(page.getByRole("heading", { level: 1, name: "Hamkor" })).toBeVisible()
  await expect(page.getByText("Bu turda maydon yo'q")).toBeVisible()

  await page.getByRole("button", { name: "Maydon qo'shish" }).click()
  dialog = page.getByRole("dialog", { name: "Maydon qo'shish" })
  await dialog.getByLabel("Nomi").fill("Holati")
  await choose(dialog.getByLabel("Turi"), "Radio (bitta tanlov)")
  await choose(dialog.getByLabel("Dropdown"), "Holat")
  await dialog.getByRole("checkbox", { name: "Majburiy" }).click()
  await dialog.getByRole("button", { name: "Qo'shish" }).click()
  await expect(dialog).toBeHidden()
  const fields = page.getByRole("list", { name: "Maydonlar" })
  await expect(fields.getByText("Radio (bitta tanlov) · Holat")).toBeVisible()
  await expect(fields.getByText("Majburiy")).toBeVisible()
  expect(await sideScroll(page)).toBeLessThanOrEqual(0)

  // A dropdown that a field takes its options from is not deleted.
  await backToSettings(page)
  await expect(page).toHaveURL(/\/settings$/)
  await openTab(page, "Dropdownlar")
  await dropdowns.getByRole("button", { name: "O'chirish: Holat" }).click()
  const confirm = page.getByRole("alertdialog", { name: "Dropdownni o'chirasizmi?" })
  await confirm.getByRole("button", { name: "O'chirish" }).click()
  await expect(page.getByText("Bu dropdown 1 ta maydonda ishlatilgan")).toBeVisible()
  await expect(dropdowns.getByRole("link", { name: "Holat" })).toBeVisible()
})

test("the owner puts the customer types in a new order, and it stays", async ({ page }) => {
  await openSettings(page)
  const types = page.getByRole("list", { name: "Mijoz turlari" })
  const names = () => types.locator('[data-slot="setting-title"]').allTextContents()
  await expect.poll(names).toEqual(["Jismoniy", "Yuridik"])

  const handle = types.getByRole("button", { name: "Yuridik: tartibini o'zgartirish" })
  if (onPhone(page)) {
    // A finger's drag needs a long press; the handle answers the keys too.
    await handle.focus()
    await page.keyboard.press("ArrowUp")
  } else {
    const from = (await handle.boundingBox())!
    const to = (await types.getByRole("button", { name: "Jismoniy: tartibini o'zgartirish" }).boundingBox())!
    await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2)
    await page.mouse.down()
    await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2 - 6, { steps: 12 })
    await page.mouse.up()
  }

  await expect.poll(names).toEqual(["Yuridik", "Jismoniy"])
  await page.reload()
  await expect.poll(names).toEqual(["Yuridik", "Jismoniy"])
})

test("an employee finds no settings, and the address typed by hand leads home", async ({ page }) => {
  await signIn(page, "902223344")
  await page.getByRole("button", { name: /Olma Savdo/ }).click()
  await expect(page.getByRole("heading", { name: "Salom, Vali Aliyev" })).toBeVisible()

  const nav = await sections(page)
  await expect(nav.getByRole("link", { name: "Bosh sahifa" })).toBeVisible()
  await expect(nav.getByRole("link", { name: "Sozlamalar" })).toHaveCount(0)

  await page.goto("/settings")
  await expect(page).toHaveURL(/\/$/)
  await page.goto(`/settings/customer-types/${typesOf(1)[0].id}`)
  await expect(page).toHaveURL(/\/$/)
  await expect(page.getByRole("heading", { name: "Salom, Vali Aliyev" })).toBeVisible()
})

test("the owner makes a stage with its color and the final mark, and puts the stages in a new order that stays", async ({ page }) => {
  await openSettings(page)
  await openTab(page, "Vazifalar")
  await expect(page).toHaveURL(/\/settings\?tab=tasks$/)
  const stages = page.getByRole("list", { name: "Bosqichlar" })
  const names = () => stages.locator('[data-slot="setting-title"]').allTextContents()
  await expect.poll(names).toEqual(["Yangi", "Jarayonda", "Bajarildi"])
  await expect(stages.getByRole("listitem").filter({ hasText: "Bajarildi" }).getByText("Yakuniy")).toBeVisible()

  await page.getByRole("button", { name: "Bosqich qo'shish" }).click()
  const dialog = page.getByRole("dialog", { name: "Bosqich qo'shish" })
  await dialog.getByLabel("Nomi").fill("Kutilmoqda")
  await dialog.getByRole("radio", { name: "Moviy" }).click()
  await dialog.getByRole("checkbox", { name: "Yakuniy bosqich" }).click()
  await dialog.getByRole("button", { name: "Qo'shish" }).click()
  await expect(dialog).toBeHidden()
  await expect.poll(names).toEqual(["Yangi", "Jarayonda", "Bajarildi", "Kutilmoqda"])
  await expect(stages.getByRole("listitem").filter({ hasText: "Kutilmoqda" }).getByText("Yakuniy")).toBeVisible()
  expect(await sideScroll(page)).toBeLessThanOrEqual(0)

  const handle = stages.getByRole("button", { name: "Kutilmoqda: tartibini o'zgartirish" })
  if (onPhone(page)) {
    // A finger's drag needs a long press; the handle answers the keys too.
    await handle.focus()
    await page.keyboard.press("ArrowUp")
  } else {
    const from = (await handle.boundingBox())!
    const to = (await stages.getByRole("button", { name: "Bajarildi: tartibini o'zgartirish" }).boundingBox())!
    await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2)
    await page.mouse.down()
    await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2 - 6, { steps: 12 })
    await page.mouse.up()
  }

  await expect.poll(names).toEqual(["Yangi", "Jarayonda", "Kutilmoqda", "Bajarildi"])
  await page.reload()
  await expect.poll(names).toEqual(["Yangi", "Jarayonda", "Kutilmoqda", "Bajarildi"])
})

test("the owner makes a task type and gives it a choice field; the dropdown it uses is not deleted", async ({ page }) => {
  await openSettings(page)
  await openTab(page, "Vazifalar")
  const types = page.getByRole("list", { name: "Vazifa turlari" })
  await expect(types.getByRole("link", { name: "Vazifa" })).toBeVisible()

  await page.getByRole("button", { name: "Vazifa turi qo'shish" }).click()
  let dialog = page.getByRole("dialog", { name: "Vazifa turi qo'shish" })
  await dialog.getByLabel("Nomi").fill("Buyurtma")
  await dialog.getByRole("button", { name: "Qo'shish" }).click()
  await expect(dialog).toBeHidden()
  await types.getByRole("link", { name: "Buyurtma" }).click()
  await expect(page.getByRole("heading", { level: 1, name: "Buyurtma" })).toBeVisible()
  await expect(page.getByText("Bu turda maydon yo'q")).toBeVisible()
  await expect(page.getByText("Vazifa turi · 0 ta maydon")).toBeVisible()

  await page.getByRole("button", { name: "Maydon qo'shish" }).click()
  dialog = page.getByRole("dialog", { name: "Maydon qo'shish" })
  await expect(dialog.getByRole("checkbox", { name: "Takrorlanmasin" })).toHaveCount(0)
  await dialog.getByLabel("Nomi").fill("Holati")
  await choose(dialog.getByLabel("Turi"), "Radio (bitta tanlov)")
  await choose(dialog.getByLabel("Dropdown"), "Manba")
  await dialog.getByRole("checkbox", { name: "Majburiy" }).click()
  await dialog.getByRole("button", { name: "Qo'shish" }).click()
  await expect(dialog).toBeHidden()
  const fields = page.getByRole("list", { name: "Maydonlar" })
  await expect(fields.getByText("Radio (bitta tanlov) · Manba")).toBeVisible()
  await expect(fields.getByText("Majburiy")).toBeVisible()
  await expect(page.getByText("Vazifa turi · 1 ta maydon")).toBeVisible()
  expect(await sideScroll(page)).toBeLessThanOrEqual(0)

  // A dropdown that a task field takes its options from is not deleted. The
  // way back leads to the tasks' tab; the dropdowns are on theirs.
  await backToSettings(page)
  await expect(page).toHaveURL(/\/settings\?tab=tasks$/)
  await expect(types.getByRole("link", { name: "Buyurtma" })).toBeVisible()
  await openTab(page, "Dropdownlar")
  const dropdowns = page.getByRole("list", { name: "Dropdownlar" })
  await dropdowns.getByRole("button", { name: "O'chirish: Manba" }).click()
  const confirm = page.getByRole("alertdialog", { name: "Dropdownni o'chirasizmi?" })
  await confirm.getByRole("button", { name: "O'chirish" }).click()
  await expect(page.getByText("Bu dropdown 2 ta maydonda ishlatilgan")).toBeVisible()
  await expect(dropdowns.getByRole("link", { name: "Manba" })).toBeVisible()
})
