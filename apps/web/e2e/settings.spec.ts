import type { Locator, Page } from "@playwright/test"
import { typesOf } from "../mocks/data"
import { expect, test } from "./fixtures"
import { back, choose, onPhone, openSection, sections, sideScroll, signIn } from "./helpers"

// openSettings signs the owner of Olma Savdo in and opens the settings' hub.
async function openSettings(page: Page) {
  await signIn(page, "901234567")
  await expect(page.getByRole("heading", { name: "Salom, Ali Valiyev" })).toBeVisible()
  await openSection(page, "Sozlamalar")
  await expect(page).toHaveURL(/\/settings$/)
  await expect(page.getByRole("heading", { level: 1, name: "Sozlamalar" })).toBeVisible()
}

// openPart follows a row of the hub to its page.
async function openPart(page: Page, name: string, address: RegExp) {
  await page.getByRole("main").getByRole("link", { name: new RegExp(`^${name}`) }).click()
  await expect(page).toHaveURL(address)
  await expect(page.getByRole("heading", { level: 1, name })).toBeVisible()
}

// titles are the titles of a list's rows, the marks beside them left out.
const titles = (list: Locator) => list.locator('[data-slot="row-title"] > span:first-child').allTextContents()

// moveUp takes a row up past the one above it in the «Tartiblash» mode: a
// finger's drag needs a long press, so on a phone the handle's keys do it.
async function moveUp(page: Page, list: Locator, name: string, above: string) {
  await page.getByRole("button", { name: "Tartiblash" }).click()
  const handle = list.getByRole("button", { name: `${name}: tartibini o'zgartirish` })
  if (onPhone(page)) {
    await handle.focus()
    await page.keyboard.press("ArrowUp")
  } else {
    const from = (await handle.boundingBox())!
    const to = (await list.getByRole("button", { name: `${above}: tartibini o'zgartirish` }).boundingBox())!
    await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2)
    await page.mouse.down()
    await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2 - 6, { steps: 12 })
    await page.mouse.up()
  }
  await page.getByRole("button", { name: "Tayyor" }).click()
}

test("the owner makes a dropdown, types its options in, and uses it in a field of a new type; a dropdown in use is not deleted", async ({ page }) => {
  await openSettings(page)
  expect(await sideScroll(page)).toBeLessThanOrEqual(0)

  await openPart(page, "Dropdownlar", /\/settings\/dropdowns$/)
  const dropdowns = page.getByRole("list", { name: "Dropdownlar" })
  await expect(dropdowns.getByRole("link", { name: /^Manba/ })).toBeVisible()
  await page.getByRole("button", { name: "Dropdown qo'shish" }).click()
  let sheet = page.getByRole("dialog", { name: "Dropdown qo'shish" })
  await sheet.getByLabel("Nomi").fill("Holat")
  await sheet.getByRole("button", { name: "Qo'shish" }).click()
  await expect(sheet).toBeHidden()

  await dropdowns.getByRole("link", { name: /^Holat/ }).click()
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

  // Back through the dropdowns to the hub, then into the customer types.
  await back(page, "Dropdownlar")
  await expect(page).toHaveURL(/\/settings\/dropdowns$/)
  await back(page, "Sozlamalar")
  await expect(page).toHaveURL(/\/settings$/)
  await openPart(page, "Mijoz turlari", /\/settings\/customer-types$/)
  await page.getByRole("button", { name: "Tur qo'shish" }).click()
  sheet = page.getByRole("dialog", { name: "Tur qo'shish" })
  await sheet.getByLabel("Nomi").fill("Hamkor")
  await sheet.getByRole("button", { name: "Qo'shish" }).click()
  await expect(sheet).toBeHidden()
  await page.getByRole("list", { name: "Mijoz turlari" }).getByRole("link", { name: /^Hamkor/ }).click()
  await expect(page.getByRole("heading", { level: 1, name: "Hamkor" })).toBeVisible()
  await expect(page.getByText("Bu turda maydon yo'q")).toBeVisible()

  await page.getByRole("button", { name: "Maydon qo'shish" }).click()
  sheet = page.getByRole("dialog", { name: "Maydon qo'shish" })
  await sheet.getByLabel("Nomi").fill("Holati")
  await choose(sheet.getByLabel("Turi"), "Radio (bitta tanlov)")
  await choose(sheet.getByLabel("Dropdown"), "Holat")
  await sheet.getByRole("switch", { name: "Majburiy" }).click()
  await sheet.getByRole("button", { name: "Qo'shish" }).click()
  await expect(sheet).toBeHidden()
  const fields = page.getByRole("list", { name: "Maydonlar" })
  await expect(fields.getByText("Radio (bitta tanlov) · Holat")).toBeVisible()
  await expect(fields.getByText("Majburiy")).toBeVisible()
  expect(await sideScroll(page)).toBeLessThanOrEqual(0)

  // A dropdown that a field takes its options from is not deleted.
  await page.goto("/settings/dropdowns")
  await page.getByRole("list", { name: "Dropdownlar" }).getByRole("link", { name: /^Holat/ }).click()
  await expect(page.getByRole("heading", { level: 1, name: "Holat" })).toBeVisible()
  await page.getByRole("button", { name: "Dropdownni o'chirish" }).click()
  await page.getByRole("alertdialog", { name: "Dropdownni o'chirasizmi?" }).getByRole("button", { name: "O'chirish" }).click()
  await expect(page.getByText("Bu dropdown 1 ta maydonda ishlatilgan")).toBeVisible()
  await expect(page.getByRole("heading", { level: 1, name: "Holat" })).toBeVisible()
})

test("the owner puts the customer types in a new order, and it stays", async ({ page }) => {
  await openSettings(page)
  await openPart(page, "Mijoz turlari", /\/settings\/customer-types$/)
  const types = page.getByRole("list", { name: "Mijoz turlari" })
  await expect.poll(() => titles(types)).toEqual(["Jismoniy", "Yuridik"])

  await moveUp(page, types, "Yuridik", "Jismoniy")
  await expect.poll(() => titles(types)).toEqual(["Yuridik", "Jismoniy"])
  await page.reload()
  await expect.poll(() => titles(types)).toEqual(["Yuridik", "Jismoniy"])
})

test("an employee finds no settings: «Sozlamalar» lists the pages they may open alone, and the settings' addresses typed by hand lead home", async ({ page }) => {
  await signIn(page, "902223344")
  await page.getByRole("button", { name: /Olma Savdo/ }).click()
  await expect(page.getByRole("heading", { name: "Salom, Vali Aliyev" })).toBeVisible()

  // The sidebar holds the sections the member may open, the settings none of
  // them; a phone's bar ends with «Sozlamalar», every member's way to every page.
  const nav = await sections(page)
  await expect(nav.getByRole("link", { name: "Bosh sahifa" })).toBeVisible()
  await expect(nav.getByRole("link", { name: "Sozlamalar" })).toHaveCount(onPhone(page) ? 1 : 0)
  await page.goto("/settings")
  await expect(page.getByRole("heading", { level: 1, name: "Sozlamalar" })).toBeVisible()
  await expect(page.getByRole("main").getByRole("list", { name: "Bo'limlar" })).toBeVisible()
  await expect(page.getByRole("main").getByRole("list", { name: "Mijozlar va vazifalar" })).toHaveCount(0)

  for (const address of ["/settings/customer-types", `/settings/customer-types/${typesOf(1)[0].id}`]) {
    await page.goto(address)
    await expect(page).toHaveURL(/\/$/)
    await expect(page.getByRole("heading", { name: "Salom, Vali Aliyev" })).toBeVisible()
  }
})

test("the owner makes a stage with its color and the final mark, and puts the stages in a new order that stays", async ({ page }) => {
  await openSettings(page)
  await openPart(page, "Bosqichlar", /\/settings\/stages$/)
  const stages = page.getByRole("list", { name: "Bosqichlar" })
  await expect.poll(() => titles(stages)).toEqual(["Yangi", "Jarayonda", "Bajarildi"])
  await expect(stages.getByRole("listitem").filter({ hasText: "Bajarildi" }).getByText("Yakuniy")).toBeVisible()

  await page.getByRole("button", { name: "Bosqich qo'shish" }).click()
  const sheet = page.getByRole("dialog", { name: "Bosqich qo'shish" })
  await sheet.getByLabel("Nomi").fill("Kutilmoqda")
  await sheet.getByRole("radio", { name: "Moviy" }).click()
  await sheet.getByRole("switch", { name: "Yakuniy bosqich" }).click()
  await sheet.getByRole("button", { name: "Qo'shish" }).click()
  await expect(sheet).toBeHidden()
  await expect.poll(() => titles(stages)).toEqual(["Yangi", "Jarayonda", "Bajarildi", "Kutilmoqda"])
  await expect(stages.getByRole("listitem").filter({ hasText: "Kutilmoqda" }).getByText("Yakuniy")).toBeVisible()
  expect(await sideScroll(page)).toBeLessThanOrEqual(0)

  await moveUp(page, stages, "Kutilmoqda", "Bajarildi")
  await expect.poll(() => titles(stages)).toEqual(["Yangi", "Jarayonda", "Kutilmoqda", "Bajarildi"])
  await page.reload()
  await expect.poll(() => titles(stages)).toEqual(["Yangi", "Jarayonda", "Kutilmoqda", "Bajarildi"])
})

test("the owner makes an order type and gives it a choice field; the dropdown it uses is not deleted", async ({ page }) => {
  await openSettings(page)
  await openPart(page, "Vazifa turlari", /\/settings\/task-types$/)
  const types = page.getByRole("list", { name: "Vazifa turlari" })
  await expect(types.getByRole("link", { name: /^Vazifa/ })).toBeVisible()

  await page.getByRole("button", { name: "Vazifa turi qo'shish" }).click()
  let sheet = page.getByRole("dialog", { name: "Vazifa turi qo'shish" })
  await sheet.getByLabel("Nomi").fill("Montaj")
  await sheet.getByRole("button", { name: "Qo'shish" }).click()
  await expect(sheet).toBeHidden()
  await types.getByRole("link", { name: /^Montaj/ }).click()
  await expect(page.getByRole("heading", { level: 1, name: "Montaj" })).toBeVisible()
  await expect(page.getByText("Bu turda maydon yo'q")).toBeVisible()
  await expect(page.getByText("Vazifa turi · 0 ta maydon")).toBeVisible()

  await page.getByRole("button", { name: "Maydon qo'shish" }).click()
  sheet = page.getByRole("dialog", { name: "Maydon qo'shish" })
  await expect(sheet.getByRole("switch", { name: "Takrorlanmasin" })).toHaveCount(0)
  await sheet.getByLabel("Nomi").fill("Holati")
  await choose(sheet.getByLabel("Turi"), "Radio (bitta tanlov)")
  await choose(sheet.getByLabel("Dropdown"), "Manba")
  await sheet.getByRole("switch", { name: "Majburiy" }).click()
  await sheet.getByRole("button", { name: "Qo'shish" }).click()
  await expect(sheet).toBeHidden()
  const fields = page.getByRole("list", { name: "Maydonlar" })
  await expect(fields.getByText("Radio (bitta tanlov) · Manba")).toBeVisible()
  await expect(fields.getByText("Majburiy")).toBeVisible()
  await expect(page.getByText("Vazifa turi · 1 ta maydon")).toBeVisible()
  expect(await sideScroll(page)).toBeLessThanOrEqual(0)

  // A dropdown that an order field takes its options from is not deleted.
  await back(page, "Vazifa turlari")
  await expect(types.getByRole("link", { name: /^Montaj/ })).toBeVisible()
  await back(page, "Sozlamalar")
  await openPart(page, "Dropdownlar", /\/settings\/dropdowns$/)
  await page.getByRole("list", { name: "Dropdownlar" }).getByRole("link", { name: /^Manba/ }).click()
  await page.getByRole("button", { name: "Dropdownni o'chirish" }).click()
  await page.getByRole("alertdialog", { name: "Dropdownni o'chirasizmi?" }).getByRole("button", { name: "O'chirish" }).click()
  await expect(page.getByText("Bu dropdown 2 ta maydonda ishlatilgan")).toBeVisible()
  await expect(page.getByRole("heading", { level: 1, name: "Manba" })).toBeVisible()
})

test("the owner of a company in dollars enters the rate, which the history keeps", async ({ page }) => {
  await signIn(page, "902223344")
  await page.getByRole("button", { name: /Nok Market/ }).click()
  await expect(page.getByRole("heading", { name: "Salom, Vali Aliyev" })).toBeVisible()
  await openSection(page, "Sozlamalar")
  await openPart(page, "Valyuta kurslari", /\/settings\/currencies$/)
  const current = page.getByRole("list", { name: "Joriy kurslar" })
  await expect(current.getByText("1 USD = 12 800 so'm")).toBeVisible()
  expect(await sideScroll(page)).toBeLessThanOrEqual(0)

  await page.getByRole("button", { name: "Kurslarni yangilash" }).click()
  const sheet = page.getByRole("dialog", { name: "Kurslarni yangilash" })
  await sheet.getByLabel("1 USD").fill("12 950")
  await sheet.getByRole("button", { name: "Saqlash" }).click()
  await expect(sheet).toBeHidden()
  await expect(current.getByText("1 USD = 12 950 so'm")).toBeVisible()
  // The history: the new row on top of the one Vali set before.
  const history = page.getByRole("list", { name: "Kurslar tarixi" })
  await expect(history.getByText("USD 12 950")).toBeVisible()
  await expect(history.getByText("USD 12 800")).toBeVisible()
})

test("the owner keeps the finance categories: an expense category added and turned off, and an income one", async ({ page }) => {
  await openSettings(page)
  await openPart(page, "Moliya kategoriyalari", /\/settings\/finance-categories$/)
  expect(await sideScroll(page)).toBeLessThanOrEqual(0)

  await page.getByRole("button", { name: "Kategoriya qo'shish" }).click()
  let sheet = page.getByRole("dialog", { name: "Kategoriya qo'shish" })
  await sheet.getByLabel("Nomi").fill("Ijara")
  await sheet.getByRole("button", { name: "Qo'shish" }).click()
  await expect(sheet).toBeHidden()
  const expenses = page.getByRole("list", { name: "Xarajat kategoriyalari" })
  await expect(expenses.getByText("Ijara")).toBeVisible()

  await page.getByRole("tab", { name: "Kirim" }).click()
  await page.getByRole("button", { name: "Kategoriya qo'shish" }).click()
  sheet = page.getByRole("dialog", { name: "Kategoriya qo'shish" })
  await sheet.getByLabel("Nomi").fill("Boshqa kirim")
  await sheet.getByRole("button", { name: "Qo'shish" }).click()
  await expect(sheet).toBeHidden()
  await expect(page.getByRole("list", { name: "Kirim kategoriyalari" }).getByText("Boshqa kirim")).toBeVisible()

  await page.getByRole("tab", { name: "Xarajat" }).click()
  await expenses.getByRole("button", { name: /^Ijara/ }).click()
  await page.getByRole("menuitem", { name: "Nofaol qilish" }).click()
  await expect(expenses.getByText("Nofaol")).toBeVisible()
})
