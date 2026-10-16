// @vitest-environment node
import { readFileSync } from "node:fs"
import { expect, test } from "vitest"

// The tokens are the prototype's: the pages take their colors from them.
const css = readFileSync(new URL("./globals.css", import.meta.url), "utf8")

const block = (selector: string) => {
  const start = css.indexOf(selector)
  expect(start, selector).toBeGreaterThan(-1)
  return css.slice(start, css.indexOf("}", start))
}

test("the light theme is the prototype's light glass: grey-white, white cards, a black accent", () => {
  const root = block(":root {")
  expect(root).toContain("--background: #F1F2F4")
  expect(root).toContain("--foreground: #0E0F12")
  expect(root).toContain("--card: rgba(255, 255, 255, 0.86)")
  expect(root).toContain("--primary: #111214")
  expect(root).toContain("--primary-soft: rgba(17, 18, 20, 0.07)")
  expect(root).toContain("--muted-foreground: #6B6E76")
  expect(root).toContain("--heading: #2A2C31")
  expect(root).toContain("--press: rgba(0, 0, 0, 0.05)")
  expect(root).toContain("--sheet: rgba(244, 245, 247, 0.88)")
  expect(root).toContain("--positive: #23804E")
  expect(root).toContain("--destructive: #CF3F37")
})

test("the dark theme wears the prototype's colors", () => {
  const dark = block(".dark {")
  expect(dark).toContain("--background: #000000")
  expect(dark).toContain("--card: #1C1C1E")
  expect(dark).toContain("--primary: #3CC5AE")
  expect(dark).toContain("--primary-foreground: #00261F")
})

test("inside Telegram the chat gives the colors", () => {
  const telegram = block("html[data-telegram] {")
  expect(telegram).toContain("--background: var(--tg-theme-secondary-bg-color)")
  expect(telegram).toContain("--primary: var(--tg-theme-button-color)")
  expect(telegram).toContain("--sheet: var(--tg-theme-secondary-bg-color)")
})

test("the radii, the text sizes and the font stack are the prototype's", () => {
  const theme = block("@theme inline {")
  expect(theme).toContain("--radius-group: 22px")
  expect(theme).toContain("--radius-sheet: 36px")
  expect(theme).toContain("--radius-main: 14px")
  expect(theme).toContain("--text-base: 17px")
  expect(theme).toContain("--text-md: 15px")
  expect(theme).toMatch(/--font-sans: -apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", var\(--font-geist\)/)
  expect(css).toContain("@utility pb-bar")
})
