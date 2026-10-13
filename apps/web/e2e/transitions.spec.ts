import type { Page } from "@playwright/test"
import { seedCatalog, seedCustomers, seedWarehouse } from "../mocks/data"
import { expect, test } from "./fixtures"
import { openSection, signIn } from "./helpers"

// recordTransitions keeps the types of every view transition the page starts
// (React starts one for a navigation that moves a page), in window.__moves.
async function recordTransitions(page: Page) {
  await page.addInitScript(() => {
    const moves: string[][] = []
    ;(window as unknown as { __moves: string[][] }).__moves = moves
    const start = document.startViewTransition?.bind(document)
    if (!start) return
    document.startViewTransition = ((arg?: ViewTransitionUpdateCallback | StartViewTransitionOptions) => {
      moves.push(typeof arg === "object" && arg && "types" in arg ? [...(arg.types ?? [])] : [])
      return start(arg as StartViewTransitionOptions)
    }) as typeof document.startViewTransition
  })
}
const moves = (page: Page) => page.evaluate(() => (window as unknown as { __moves: string[][] }).__moves)
const lastMove = async (page: Page) => (await moves(page)).at(-1)

test("a step into a record moves the page forward and its way back moves it back, as the prototype's push and pop; a section from the menu does not slide", async ({ page }) => {
  seedCustomers()
  await recordTransitions(page)
  await signIn(page, "901234567")
  await expect(page.getByRole("heading", { name: "Salom, Ali Valiyev" })).toBeVisible()

  await openSection(page, "Mijozlar")
  await expect(page.getByRole("heading", { level: 1, name: "Mijozlar" })).toBeVisible()
  // A section of the menu is not a step deeper: no direction.
  expect((await moves(page)).flat()).not.toContain("nav-forward")

  await page.getByRole("list", { name: "Mijozlar" }).getByRole("link", { name: /^Dilshod Karimov/ }).click()
  await expect(page.getByRole("heading", { level: 1, name: "Dilshod Karimov" })).toBeVisible()
  await expect.poll(() => lastMove(page)).toEqual(["nav-forward"])
  // The page that moves is one opaque sheet filling the main area: what it
  // covers does not show through it, as the prototype's screens.
  const sheet = page.locator("main > [data-slot=page]")
  await expect(sheet).toHaveCount(1)
  expect(await sheet.evaluate((element) => getComputedStyle(element).backgroundColor)).not.toMatch(/^(transparent|rgba\(0, 0, 0, 0\))$/)
  const [sheetHeight, mainHeight] = await sheet.evaluate((element) => [element.getBoundingClientRect().height, element.parentElement!.clientHeight])
  expect(sheetHeight).toBeGreaterThan(mainHeight * 0.6)

  await page.getByRole("main").getByRole("link", { name: "Mijozlar", exact: true }).click()
  await expect(page.getByRole("heading", { level: 1, name: "Mijozlar" })).toBeVisible()
  await expect.poll(() => lastMove(page)).toEqual(["nav-back"])
})

test("a document saved opens with a step forward; one deleted leads back with a step back", async ({ page }) => {
  seedWarehouse(seedCatalog())
  await recordTransitions(page)
  await signIn(page, "901234567")
  await expect(page.getByRole("heading", { name: "Salom, Ali Valiyev" })).toBeVisible()
  await page.goto("/purchases")
  await expect(page.getByRole("heading", { level: 1, name: "Xaridlar" })).toBeVisible()

  await page.getByRole("region", { name: "Xaridlar" }).getByRole("link").first().click()
  await expect(page.getByRole("heading", { level: 1, name: /^Xarid № / })).toBeVisible()
  await expect.poll(() => lastMove(page)).toEqual(["nav-forward"])
  await page.getByRole("group", { name: "Amallar" }).getByRole("button", { name: "O'chirish" }).click()
  await page.getByRole("alertdialog", { name: "Xaridni o'chirasizmi?" }).getByRole("button", { name: "O'chirish" }).click()
  await expect(page).toHaveURL(/\/purchases$/)
  await expect.poll(() => lastMove(page)).toEqual(["nav-back"])
})
