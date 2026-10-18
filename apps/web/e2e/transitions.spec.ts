import type { Page } from "@playwright/test"
import { seedCatalog, seedCustomers, seedOrders, seedWarehouse } from "../mocks/data"
import { expect, test } from "./fixtures"
import { back, onPhone, openSection, sections, signIn } from "./helpers"

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

// recordLayers keeps, for every view transition the page starts, how the
// browser stacks the tab bar's picture over the pages' ones: each one's
// z-index as its group has it ("none" for a bar not drawn on its own).
async function recordLayers(page: Page) {
  await page.addInitScript(() => {
    const layers: { bar: string; pages: string[]; ready: boolean }[] = []
    ;(window as unknown as { __layers: typeof layers }).__layers = layers
    const start = document.startViewTransition?.bind(document)
    if (!start) return
    const pages = () =>
      [...document.querySelectorAll('[data-slot="page"]')].map((page) => getComputedStyle(page).viewTransitionName).filter((name) => name !== "none")
    const layer = (name: string) => getComputedStyle(document.documentElement, `::view-transition-group(${name})`).zIndex
    document.startViewTransition = ((arg?: ViewTransitionUpdateCallback | StartViewTransitionOptions) => {
      const transition = start(arg as StartViewTransitionOptions)
      // The page that goes is named as it is captured, before it goes.
      const going = pages()
      const seen = { bar: "none", pages: [] as string[], ready: false }
      layers.push(seen)
      transition.ready
        .then(() => {
          // A bar that is not on the screen (a wide screen's) is not drawn at all.
          const bar = document.querySelector('[data-slot="tab-bar"]')
          const name = bar && bar.getClientRects().length > 0 ? getComputedStyle(bar).viewTransitionName : "none"
          seen.bar = name === "none" ? "none" : layer(name)
          seen.pages = [...going, ...pages()].map(layer)
          seen.ready = true
        })
        .catch(() => {})
      return transition
    }) as typeof document.startViewTransition
  })
}
const layers = (page: Page) => page.evaluate(() => (window as unknown as { __layers: { bar: string; pages: string[]; ready: boolean }[] }).__layers)
// readyLayers is how many of the transitions started since before have shown.
const readyLayers = async (page: Page, before: number) => (await layers(page)).slice(before).filter((move) => move.ready).length
const over = (layer: string) => (layer === "auto" ? 0 : Number(layer))

// holdTransitions keeps each view transition on the screen for 3s, drawn as
// it is (its root's picture runs a still animation), so that a shot can be
// taken of one; the page says whether one is under way.
async function holdTransitions(page: Page) {
  await page.addStyleTag({
    content: "::view-transition-image-pair(root) { animation: 3s linear both hold-still !important } @keyframes hold-still { to { opacity: 1 } }",
  })
  await page.evaluate(() => {
    const seen = window as unknown as { __changing: boolean }
    seen.__changing = false
    const start = document.startViewTransition.bind(document)
    document.startViewTransition = ((arg?: ViewTransitionUpdateCallback | StartViewTransitionOptions) => {
      const transition = start(arg as StartViewTransitionOptions)
      seen.__changing = true
      transition.finished.finally(() => (seen.__changing = false))
      return transition
    }) as typeof document.startViewTransition
  })
}
const changing = (page: Page) => page.evaluate(() => (window as unknown as { __changing: boolean }).__changing)

// apart is the share of the pixels two shots of one box tell apart (by more
// than a faint shade).
const apart = (page: Page, one: Buffer, other: Buffer) =>
  page.evaluate(async (sources) => {
    const pixels = async (source: string) => {
      const image = new Image()
      image.src = source
      await image.decode()
      const canvas = new OffscreenCanvas(image.width, image.height)
      const context = canvas.getContext("2d")!
      context.drawImage(image, 0, 0)
      return context.getImageData(0, 0, image.width, image.height).data
    }
    const [a, b] = await Promise.all(sources.map(pixels))
    let differ = 0
    for (let i = 0; i < a.length; i += 4) {
      if (Math.max(Math.abs(a[i] - b[i]), Math.abs(a[i + 1] - b[i + 1]), Math.abs(a[i + 2] - b[i + 2])) > 48) differ++
    }
    return differ / (a.length / 4)
  }, [one, other].map((shot) => `data:image/png;base64,${shot.toString("base64")}`))

// The prototype's push and pop on a phone; beside the sidebar the page under
// fades instead of moving (it would pass over the sidebar).
const forward = (page: Page) => (onPhone(page) ? ["page-from-right", "page-to-under"] : ["page-fade-out", "page-from-right"])
const backward = (page: Page) => (onPhone(page) ? ["page-from-under", "page-to-right"] : ["page-fade-in", "page-to-right"])

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
  // The page is one sheet filling the main area. At rest it lets the
  // column's ambient light show through; while it moves it is opaque in that
  // light, so what it covers does not show through it, as the prototype's
  // screens.
  const sheet = page.locator("main > [data-slot=page]")
  await expect(sheet).toHaveCount(1)
  await expect(page.locator("html")).not.toHaveAttribute("data-move")
  const background = (element: Element) => [getComputedStyle(element).backgroundColor, getComputedStyle(element).backgroundImage]
  expect(await sheet.evaluate(background)).toEqual(["rgba(0, 0, 0, 0)", "none"])
  expect((await page.getByRole("main").evaluate(background))[1]).toMatch(/gradient/)
  const [moving, light] = await sheet.evaluate((element) => {
    document.documentElement.dataset.move = "forward"
    const seen = [getComputedStyle(element).backgroundColor, getComputedStyle(element).backgroundImage]
    delete document.documentElement.dataset.move
    return seen
  })
  expect(moving).not.toMatch(/^(transparent|rgba\(0, 0, 0, 0\))$/)
  expect(light).toMatch(/gradient/)
  const [sheetHeight, mainHeight] = await sheet.evaluate((element) => [element.getBoundingClientRect().height, element.parentElement!.clientHeight])
  expect(sheetHeight).toBeGreaterThan(mainHeight * 0.6)

  const up = await movedBy(page, () => back(page, "Mijozlar"))
  await expect(page.getByRole("heading", { level: 1, name: "Mijozlar" })).toBeVisible()
  await expect.poll(up).toEqual([backward(page)])

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

test("a page from the menu changes under the shell: while it changes, the screen is drawn as it is once changed, the page never over the tab bar", async ({ page }) => {
  seedOrders()
  await signIn(page, "901234567")
  await expect(page.getByRole("heading", { name: "Salom, Ali Valiyev" })).toBeVisible()
  await expect(page.getByText("ta faol")).toBeVisible()
  await openSection(page, "Buyurtmalar")
  await expect(page.getByRole("heading", { level: 1, name: "Buyurtmalar" })).toBeVisible()
  await holdTransitions(page)

  await (await sections(page)).getByRole("link", { name: "Bosh sahifa", exact: true }).click()
  await expect(page.getByRole("heading", { name: "Salom, Ali Valiyev" })).toBeVisible()
  // The home runs on below the screen's edge: on a phone its cards go under the bar.
  expect(await page.getByRole("main").evaluate((main) => main.scrollHeight - main.clientHeight)).toBeGreaterThan(40)
  // The bar's lens has slid under the home's button (450ms).
  await page.waitForTimeout(800)
  const shot = () => (onPhone(page) ? page.locator('[data-slot="tab-bar"]').screenshot() : page.screenshot())
  const during = await shot()
  expect(await changing(page)).toBe(true)
  await expect.poll(() => changing(page), { timeout: 5_000 }).toBe(false)
  const after = await shot()
  expect(await apart(page, during, after)).toBeLessThan(0.001)
})

test("while a page moves the tab bar stands over both pages, stepping down as a record comes and up as its list comes back, as the prototype's bar over its screens", async ({ page }) => {
  seedCustomers()
  await recordLayers(page)
  await signIn(page, "901234567")
  await expect(page.getByRole("heading", { name: "Salom, Ali Valiyev" })).toBeVisible()
  await openSection(page, "Mijozlar")
  await expect(page.getByRole("heading", { level: 1, name: "Mijozlar" })).toBeVisible()
  const before = (await layers(page)).length

  await page.getByRole("list", { name: "Mijozlar" }).getByRole("link", { name: /^Dilshod Karimov/ }).click()
  await expect(page.getByRole("heading", { level: 1, name: "Dilshod Karimov" })).toBeVisible()
  await expect.poll(() => readyLayers(page, before)).toBe(1)
  await back(page, "Mijozlar")
  await expect(page.getByRole("heading", { level: 1, name: "Mijozlar" })).toBeVisible()
  await expect.poll(() => readyLayers(page, before)).toBe(2)

  const moves = (await layers(page)).slice(before)
  if (!onPhone(page)) {
    // A wide screen has no tab bar: the sidebar stands beside the pages.
    expect(moves.map((move) => move.bar)).toEqual(["none", "none"])
    return
  }
  for (const move of moves) {
    expect(move.pages).toHaveLength(2)
    expect(move.bar).not.toBe("none")
    expect(over(move.bar)).toBeGreaterThan(Math.max(...move.pages.map(over)))
  }
})
