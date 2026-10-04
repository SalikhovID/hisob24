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
