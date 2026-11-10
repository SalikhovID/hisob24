import type { Locator } from "@playwright/test"
import { seedCatalog, seedWarehouse } from "../mocks/data"
import { expect, test } from "./fixtures"
import { onPhone, openSection, signIn } from "./helpers"

// overlayKeyboard stands for a soft keyboard that lies over the bottom of the
// screen without resizing the page (an iPhone's, a Mini App opened full
// screen): the layout viewport and window.innerHeight stay as they are, the
// visual viewport shrinks by the keyboard's height and says so.
// window.__keyboard(px) raises the keyboard to that height; 0 lowers it.
const overlayKeyboard = `
  const fake = new EventTarget()
  Object.assign(fake, { width: window.innerWidth, height: window.innerHeight, offsetTop: 0, offsetLeft: 0, pageTop: 0, pageLeft: 0, scale: 1 })
  Object.defineProperty(window, "visualViewport", { value: fake, configurable: true })
  window.__keyboard = (px) => {
    fake.height = window.innerHeight - px
    fake.dispatchEvent(new Event("resize"))
  }
`

const KEYBOARD = 360

const raise = (page: import("@playwright/test").Page, px: number) =>
  page.evaluate((height) => (window as unknown as { __keyboard: (px: number) => void }).__keyboard(height), px)

// bottomOf is where a field's bottom edge stands on the screen.
const bottomOf = async (field: Locator) => {
  const box = await field.boundingBox()
  return box ? box.y + box.height : Number.POSITIVE_INFINITY
}

test("a field focused in a sheet stands clear of the keyboard that lies over the sheet's bottom, with no swipe", async ({ page }) => {
  test.skip(!onPhone(page), "a soft keyboard is a phone's")
  await page.addInitScript(overlayKeyboard)
  seedCatalog()
  await signIn(page, "901234567")
  await expect(page.getByRole("heading", { name: "Salom, Ali Valiyev" })).toBeVisible()
  await openSection(page, "Mahsulotlar")
  await page.getByRole("button", { name: "Mahsulot qo'shish" }).click()
  const note = page.getByRole("dialog", { name: "Mahsulot qo'shish" }).getByLabel("Izoh")
  const clear = (page.viewportSize()?.height ?? 0) - KEYBOARD

  // Nothing lies over it yet: the last field of the sheet stands low on the screen.
  await note.focus()
  expect(await bottomOf(note)).toBeGreaterThan(clear)

  // The keyboard comes up over the bottom: the field is lifted above it.
  await raise(page, KEYBOARD)
  await expect.poll(() => bottomOf(note)).toBeLessThanOrEqual(clear)
  await expect(note).toBeFocused()

  // The keyboard goes down: the sheet is as it was.
  await raise(page, 0)
  await expect.poll(() => bottomOf(note)).toBeGreaterThan(clear)
})

test("a field at the foot of a page is scrolled clear of the keyboard that lies over the page's bottom", async ({ page }) => {
  test.skip(!onPhone(page), "a soft keyboard is a phone's")
  await page.addInitScript(overlayKeyboard)
  seedWarehouse(seedCatalog())
  await signIn(page, "901234567")
  await expect(page.getByRole("heading", { name: "Salom, Ali Valiyev" })).toBeVisible()
  await page.goto("/purchases/new")
  const note = page.getByLabel("Izoh")
  const clear = (page.viewportSize()?.height ?? 0) - KEYBOARD

  // The page scrolled to its foot: its last field stands low on the screen.
  await note.scrollIntoViewIfNeeded()
  await note.focus()
  await page.evaluate(() => document.querySelector("main")?.scrollTo({ top: 99999 }))
  await expect.poll(() => bottomOf(note)).toBeGreaterThan(clear)

  // The keyboard comes up over the bottom: the page scrolls the field out from under it.
  await raise(page, KEYBOARD)
  await expect.poll(() => bottomOf(note)).toBeLessThanOrEqual(clear)
  await expect(note).toBeFocused()
})
