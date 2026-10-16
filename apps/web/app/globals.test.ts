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

test("the dark theme is the prototype's night glass: a lavender accent on a deep violet", () => {
  const dark = block(".dark {")
  expect(dark).toContain("--background: #15121E")
  expect(dark).toContain("--foreground: #F5F2FF")
  expect(dark).toContain("--card: rgba(255, 255, 255, 0.075)")
  expect(dark).toContain("--primary: #B0A4FF")
  expect(dark).toContain("--primary-foreground: #1A1433")
  expect(dark).toContain("--muted-foreground: #A7A1C0")
  expect(dark).toContain("--heading: #DAD5EE")
  expect(dark).toContain("--sheet: rgba(30, 26, 44, 0.84)")
  expect(dark).toContain("--destructive: #FF7A70")
})

test("inside Telegram the app keeps its own colors: the chat gives the scheme, not its theme's colors", () => {
  expect(css).not.toMatch(/var\(--tg-theme-/)
})

test("the radii, the text sizes and the font stack are the prototype's", () => {
  const theme = block("@theme inline {")
  expect(theme).toContain("--radius-group: 26px")
  expect(theme).toContain("--radius-tile: 22px")
  expect(theme).toContain("--radius-sheet: 40px")
  expect(theme).toContain("--radius-badge: 999px")
  expect(theme).toContain("--radius-main: 14px")
  expect(theme).toContain("--text-base: 17px")
  expect(theme).toContain("--text-md: 15px")
  expect(theme).toMatch(/--font-sans: -apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", var\(--font-geist\)/)
  expect(css).toContain("@utility pb-bar")
})
