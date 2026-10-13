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

test("the light theme wears the prototype's colors", () => {
  const root = block(":root {")
  expect(root).toContain("--background: #EDEEF2")
  expect(root).toContain("--card: #ffffff")
  expect(root).toContain("--primary: #117A68")
  expect(root).toContain("--muted-foreground: #636368")
  expect(root).toContain("--press: #E2E3E8")
  expect(root).toContain("--sheet: #F2F2F7")
  expect(root).toContain("--positive: #1A7F37")
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
