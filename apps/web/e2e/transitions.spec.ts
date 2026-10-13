import type { Page } from "@playwright/test"
import { seedCatalog, seedCustomers, seedWarehouse } from "../mocks/data"
import { expect, test } from "./fixtures"
import { onPhone, openSection, signIn } from "./helpers"

// recordMoves keeps, for every view transition the page starts (React
// starts one when a page changes), the animations it runs on the
// transition's pseudo-elements, by name.
async function recordMoves(page: Page) {
  await page.addInitScript(() => {
    const moves: string[][] = []
    ;(window as unknown as { __moves: string[][] }).__moves = moves
    const start = document.startViewTransition?.bind(document)
    if (!start) return
    document.startViewTransition = ((arg?: ViewTransitionUpdateCallback | StartViewTransitionOptions) => {
      const transition = start(arg as StartViewTransitionOptions)
      const names: string[] = []
      moves.push(names)
      transition.ready
        .then(() => {
          for (const animation of document.getAnimations()) {
            const effect = animation.effect as KeyframeEffect | null
            if (effect?.pseudoElement?.startsWith("::view-transition") && animation instanceof CSSAnimation) names.push(animation.animationName)
          }
          names.sort()
        })
        .catch((error: Error) => names.push(`skipped: ${error.name}: ${error.message}`))
      return transition
    }) as typeof document.startViewTransition
  })
}
const moves = (page: Page) => page.evaluate(() => (window as unknown as { __moves: string[][] }).__moves)

// movedBy is the transitions an action started: those recorded after it.
async function movedBy(page: Page, action: () => Promise<unknown>) {
  const before = (await moves(page)).length
  await action()
  return async () => (await moves(page)).slice(before)
}

// The prototype's push and pop on a phone; beside the sidebar the page under
// fades instead of moving (it would pass over the sidebar).
const forward = (page: Page) => (onPhone(page) ? ["page-from-right", "page-to-under"] : ["page-fade-out", "page-from-right"])
const back = (page: Page) => (onPhone(page) ? ["page-from-under", "page-to-right"] : ["page-fade-in", "page-to-right"])

test("a step into a record moves the page forward and its way back moves it back, as the prototype's push and pop; a section from the menu changes at once", async ({ page }) => {
  seedCustomers()
  await recordMoves(page)
  await signIn(page, "901234567")
  await expect(page.getByRole("heading", { name: "Salom, Ali Valiyev" })).toBeVisible()

  const menu = await movedBy(page, () => openSection(page, "Mijozlar"))
  await expect(page.getByRole("heading", { level: 1, name: "Mijozlar" })).toBeVisible()
  // A section of the menu is not a step deeper: no animation at all, the
  // shell's included.
  await page.waitForTimeout(500)
  expect((await menu()).flat()).toEqual([])

  const into = await movedBy(page, () => page.getByRole("list", { name: "Mijozlar" }).getByRole("link", { name: /^Dilshod Karimov/ }).click())
  await expect(page.getByRole("heading", { level: 1, name: "Dilshod Karimov" })).toBeVisible()
  await expect.poll(into).toEqual([forward(page)])
  // The page that moves is one opaque sheet filling the main area: what it
  // covers does not show through it, as the prototype's screens.
  const sheet = page.locator("main > [data-slot=page]")
  await expect(sheet).toHaveCount(1)
  expect(await sheet.evaluate((element) => getComputedStyle(element).backgroundColor)).not.toMatch(/^(transparent|rgba\(0, 0, 0, 0\))$/)
  const [sheetHeight, mainHeight] = await sheet.evaluate((element) => [element.getBoundingClientRect().height, element.parentElement!.clientHeight])
  expect(sheetHeight).toBeGreaterThan(mainHeight * 0.6)

  const up = await movedBy(page, () => page.getByRole("main").getByRole("link", { name: "Mijozlar", exact: true }).click())
  await expect(page.getByRole("heading", { level: 1, name: "Mijozlar" })).toBeVisible()
  await expect.poll(up).toEqual([back(page)])

  // The browser's own back has its own gesture: the page changes at once.
  const history = await movedBy(page, () => page.goBack())
  await expect(page.getByRole("heading", { level: 1, name: "Dilshod Karimov" })).toBeVisible()
  await page.waitForTimeout(500)
  expect((await history()).flat()).toEqual([])
})

test("a document opened from its list moves forward; deleted, it leads back to the list, and the move it was taken with does not stay behind", async ({ page }) => {
  seedWarehouse(seedCatalog())
  await recordMoves(page)
  await signIn(page, "901234567")
  await expect(page.getByRole("heading", { name: "Salom, Ali Valiyev" })).toBeVisible()
  await page.goto("/purchases")
  await expect(page.getByRole("heading", { level: 1, name: "Xaridlar" })).toBeVisible()

  const into = await movedBy(page, () => page.getByRole("region", { name: "Xaridlar" }).getByRole("link").first().click())
  await expect(page.getByRole("heading", { level: 1, name: /^Xarid № / })).toBeVisible()
  await expect.poll(into).toEqual([forward(page)])
  // After a deletion a production build shows the list at once: the confirm
  // dialog going with its record renders while React prepares the
  // transition, and React then skips it. The move does not stay behind for
  // the next page change.
  await page.getByRole("group", { name: "Amallar" }).getByRole("button", { name: "O'chirish" }).click()
  await page.getByRole("alertdialog", { name: "Xaridni o'chirasizmi?" }).getByRole("button", { name: "O'chirish" }).click()
  await expect(page).toHaveURL(/\/purchases$/)
  await expect.poll(() => page.evaluate(() => document.documentElement.dataset.move ?? null)).toBeNull()
})
