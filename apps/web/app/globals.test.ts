// @vitest-environment node
import { readFileSync } from "node:fs"
import { expect, test } from "vitest"

// The tokens are the flat prototype's (228b1108): the pages take their
// colors and sizes from them. A phone's values come first; from 48rem the
// web's (spec 2026-11-03, sections 2 and 3).
const css = readFileSync(new URL("./globals.css", import.meta.url), "utf8")

const block = (selector: string) => {
  const start = css.indexOf(selector)
  expect(start, selector).toBeGreaterThan(-1)
  return css.slice(start, css.indexOf("}", start))
}

// The wide screen's blocks: :root and .dark inside the 48rem media query.
const wide = (selector: ":root" | ".dark") => block(`@media (min-width: 48rem) {\n  ${selector} {`)

test("on a phone the light theme is the prototype's grouped list: an iOS grey page, white groups, the teal accent", () => {
  const root = block(":root {")
  expect(root).toContain("--background: #f2f2f7")
  expect(root).toContain("--foreground: #17181b")
  expect(root).toContain("--card: #ffffff")
  expect(root).toContain("--field: #ffffff")
  expect(root).toContain("--sheet: #f2f2f7")
  expect(root).toContain("--primary: #17595f")
  expect(root).toContain("--primary-foreground: #ffffff")
  expect(root).toContain("--primary-soft: rgba(23, 89, 95, 0.1)")
  expect(root).toContain("--accent-text: color-mix(in srgb, #17595f 82%, #000)")
  expect(root).toContain("--muted: rgba(118, 118, 128, 0.12)")
  expect(root).toContain("--muted-foreground: #6b6e76")
  expect(root).toContain("--faint: #9a9da4")
  expect(root).toContain("--border: rgba(0, 0, 0, 0.06)")
  expect(root).toContain("--line-faint: rgba(0, 0, 0, 0.04)")
  expect(root).toContain("--separator: rgba(60, 60, 67, 0.18)")
  expect(root).toContain("--group-ring: none")
  expect(root).toContain("--positive: #1d6e43")
  expect(root).toContain("--destructive: #b42a22")
  expect(root).toContain("--warning: #b45309")
  expect(root).toContain("--switch-on: #34c759")
  expect(root).toContain("--scrim: rgba(10, 12, 16, 0.24)")
  expect(root).toContain("--brand-mark: #174449")
})

test("the logo's words are in the ink, white in the dark; its H24 square is the teal of the prototype in either theme", () => {
  expect(block(":root {")).toContain("--brand: #17181b")
  expect(block(".dark {")).toContain("--brand: #ececee")
  expect(block(".dark {")).toContain("--brand-mark: #174449")
  expect(block("@theme inline {")).toContain("--color-brand-mark: var(--brand-mark)")
})

test("on a wide screen the light theme is the prototype's web: a white page, ringed cards, the plain fills", () => {
  const root = wide(":root")
  expect(root).toContain("--background: #ffffff")
  expect(root).toContain("--sheet: #ffffff")
  expect(root).toContain("--muted: rgba(0, 0, 0, 0.06)")
  expect(root).toContain("--group-ring: 0 0 0 1px var(--border)")
  expect(root).toContain("--switch-on: #17595f")
})

test("on a phone the dark theme is black with the iOS dark groups and the light teal", () => {
  const dark = block(".dark {")
  expect(dark).toContain("--background: #000000")
  expect(dark).toContain("--foreground: #ececee")
  expect(dark).toContain("--card: #1c1c1e")
  expect(dark).toContain("--field: #2c2c2e")
  expect(dark).toContain("--sheet: #000000")
  expect(dark).toContain("--primary: #5cc4bc")
  expect(dark).toContain("--primary-foreground: #062a2c")
  expect(dark).toContain("--primary-soft: rgba(92, 196, 188, 0.16)")
  expect(dark).toContain("--accent-text: color-mix(in srgb, #5cc4bc 70%, #fff)")
  expect(dark).toContain("--muted-foreground: #9d9da1")
  expect(dark).toContain("--faint: #6c6c70")
  expect(dark).toContain("--border: rgba(255, 255, 255, 0.08)")
  expect(dark).toContain("--separator: rgba(84, 84, 88, 0.6)")
  expect(dark).toContain("--positive: #4cc583")
  expect(dark).toContain("--destructive: #f87171")
  expect(dark).toContain("--switch-on: #30d158")
})

test("on a wide screen the dark theme is the prototype's: near black page and cards, raised menus and fields", () => {
  const dark = wide(".dark")
  expect(dark).toContain("--background: #1a1a1d")
  expect(dark).toContain("--card: #1a1a1d")
  expect(dark).toContain("--sheet: #1a1a1d")
  expect(dark).toContain("--popover: #26262a")
  expect(dark).toContain("--field: #26262a")
  expect(dark).toContain("--muted: rgba(255, 255, 255, 0.07)")
  expect(dark).toContain("--sidebar: #111113")
  expect(dark).toContain("--switch-on: #5cc4bc")
})

test("the wide screen's light comes before the dark, so the dark wins on a wide screen too", () => {
  expect(css.indexOf("@media (min-width: 48rem) {\n  :root {")).toBeLessThan(css.indexOf(".dark {"))
  expect(css.indexOf(".dark {")).toBeLessThan(css.indexOf("@media (min-width: 48rem) {\n  .dark {"))
})

test("the sidebar is the prototype's pale grey pane, its current section's sub-item in the accent's soft tint", () => {
  const root = block(":root {")
  expect(root).toContain("--sidebar: #f4f5f8")
  expect(root).toContain("--sidebar-accent: rgba(23, 89, 95, 0.1)")
})

test("inside Telegram the app keeps its own colors: the chat gives the scheme, not its theme's colors", () => {
  expect(css).not.toMatch(/var\(--tg-theme-/)
})

test("the text sizes follow the screen: 17px rows on a phone, 13px on the web", () => {
  const theme = block("@theme inline {")
  expect(theme).toContain("--text-base: var(--fs-base)")
  expect(theme).toContain("--text-md: var(--fs-md)")
  expect(theme).toContain("--text-sm: var(--fs-sm)")
  expect(theme).toContain("--text-xs: var(--fs-xs)")
  const root = block(":root {")
  expect(root).toContain("--fs-base: 17px")
  expect(root).toContain("--fs-md: 15px")
  expect(root).toContain("--fs-sm: 14px")
  expect(root).toContain("--fs-xs: 13px")
  const web = wide(":root")
  expect(web).toContain("--fs-base: 13px")
  expect(web).toContain("--fs-md: 12px")
  expect(web).toContain("--fs-sm: 12px")
  expect(web).toContain("--fs-xs: 11.5px")
})

test("the font is the prototype's: the system's SF on Apple devices, Inter elsewhere", () => {
  expect(block("@theme inline {")).toContain(
    '--font-sans: -apple-system, BlinkMacSystemFont, "SF Pro Text", var(--font-inter), "Inter", system-ui, "Segoe UI", sans-serif',
  )
})

test("the radii are the prototype's: 12px groups, 38px sheets, 12px main buttons, 10px fields", () => {
  const theme = block("@theme inline {")
  expect(theme).toContain("--radius-sm: 6px")
  expect(theme).toContain("--radius-md: 8px")
  expect(theme).toContain("--radius-lg: 10px")
  expect(theme).toContain("--radius-xl: 12px")
  expect(theme).toContain("--radius-group: 12px")
  expect(theme).toContain("--radius-sheet: 38px")
  expect(theme).toContain("--radius-main: 12px")
  expect(theme).toContain("--radius-field: 10px")
  expect(theme).toContain("--radius-badge: 999px")
})

test("a surface is a flat card: the card's color, ringed only on a wide screen, nothing blurred", () => {
  const surface = block("@utility surface {")
  expect(surface).toContain("background-color: var(--card)")
  expect(surface).toContain("box-shadow: var(--group-ring)")
  expect(surface).not.toContain("backdrop-filter")
})

test("the glass utilities are gone: a fill is a plain color now", () => {
  for (const name of ["glossy", "glossy-red", "glass-chip", "gloss", "bg-ambient", "scrim"]) expect(css, name).not.toContain(`@utility ${name} {`)
  expect(block("@theme inline {")).toContain("--color-scrim: var(--scrim)")
})

test("the page's body is the plain background", () => {
  const body = block("  body {")
  expect(body).toContain("@apply bg-background")
  expect(body).not.toContain("bg-ambient")
})

test("a page that moves is opaque in the page's own color", () => {
  const moving = block(':root[data-move] [data-slot="page"] {')
  expect(moving).toContain("background-color: var(--background)")
  expect(moving).not.toContain("var(--ambient)")
})

test("the tab bar is the prototype's frosted pill: the card at 80% over a blur, the current button in a grey capsule", () => {
  const frost = block('[data-slot="tab-bar"]::before {')
  expect(frost).toContain("background: color-mix(in srgb, var(--card) 80%, transparent)")
  expect(frost).toContain("backdrop-filter: blur(24px) saturate(1.8)")
  const lens = block('[data-slot="tab-lens"] {')
  expect(lens).toContain("background: rgba(120, 120, 128, 0.12)")
  expect(lens).not.toContain("backdrop-filter")
  expect(block(":root {")).toContain("--tab-bar-shadow: 0 8px 28px rgba(0, 0, 0, 0.12), 0 0 0 0.5px rgba(0, 0, 0, 0.08)")
})

test("a page keeps room under it for the floating tab bar, as the prototype's 116px", () => {
  expect(block("@utility pb-bar {")).toContain("padding-bottom: calc(116px + max(env(safe-area-inset-bottom), var(--tg-safe-area-inset-bottom, 0px)))")
})

test("on a phone the hairline between rows starts 16px in; on a wide screen it is the row's whole width, fainter", () => {
  expect(css).toContain("left: var(--inset, 16px);")
  expect(css).toContain("background: var(--separator);")
  expect(css).toMatch(/@media \(min-width: 48rem\) \{\n {2}\[data-slot="row"\] \+ \[data-slot="row"\]::before,[^}]*left: 0;[^}]*background: var\(--line-faint\);/)
})

test("the top fade is as tall as what lies over the screen and a little more, the page's color falling to nothing", () => {
  const fade = block('[data-slot="top-fade"] {')
  expect(fade).toContain("height: calc(var(--safe-top) + min(var(--safe-top), 18px))")
  expect(fade).toContain("background: linear-gradient(to bottom, var(--background) 40%, transparent)")
  expect(fade).toContain("opacity: 0")
  expect(block('[data-slot="top-fade"][data-on] {')).toContain("opacity: 1")
})
