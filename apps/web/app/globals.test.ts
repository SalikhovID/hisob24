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

test("a surface is the prototype's frosted glass: the cell, a sheen over its top, a white rim and a soft lift", () => {
  const surface = block("@utility surface {")
  expect(surface).toContain("background-color: var(--card)")
  expect(surface).toContain("background-image: var(--sheen)")
  expect(surface).toContain("box-shadow: var(--rim), var(--lift)")
  expect(surface).toContain("backdrop-filter: blur(18px) saturate(1.6)")
  expect(block(":root {")).toContain("--rim: inset 0 0 0 1px rgba(255, 255, 255, 0.9), inset 0 1px 0 #ffffff")
  expect(block(".dark {")).toContain("--rim: inset 0 0 0 1px rgba(255, 255, 255, 0.09), inset 0 1px 0 rgba(255, 255, 255, 0.16)")
})

test("glossy is the prototype's capsule fill of an accent control: the accent as a gradient with a glow", () => {
  const glossy = block("@utility glossy {")
  expect(glossy).toContain("background-image: var(--btn)")
  expect(glossy).toContain("box-shadow: var(--btn-glow)")
  expect(glossy).toContain("color: var(--primary-foreground)")
  expect(block(":root {")).toContain("--btn: linear-gradient(180deg, #2E2F34 0%, #0E0F11 100%)")
  expect(block(".dark {")).toContain("--btn: linear-gradient(180deg, #C2B8FF 0%, #9585F5 100%)")
})

test("glossy-red is the prototype's red capsule of an act that cannot be undone, in either theme", () => {
  const red = block("@utility glossy-red {")
  expect(red).toContain("background-image: linear-gradient(180deg, #F2847A, #CF3F37)")
  expect(red).toContain("box-shadow: 0 8px 22px rgba(207, 63, 55, 0.28), inset 0 1px 0 rgba(255, 255, 255, 0.4)")
  expect(red).toContain("color: #ffffff")
})

test("glass-chip is the prototype's small glass of a chip or a round button: the chip's tint and the white rim", () => {
  const chip = block("@utility glass-chip {")
  expect(chip).toContain("background-color: var(--chip)")
  expect(chip).toContain("box-shadow: var(--rim)")
  expect(block(":root {")).toContain("--chip: rgba(255, 255, 255, 0.6)")
  expect(block(".dark {")).toContain("--chip: rgba(255, 255, 255, 0.08)")
})
