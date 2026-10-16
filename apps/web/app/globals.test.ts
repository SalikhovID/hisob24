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
  expect(root).toContain("--sheet: #EFF0F2")
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
  expect(dark).toContain("--sheet: #1C1829")
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

test("the ambient light is the prototype's: soft gradients over the theme's base, a screen tall from the top", () => {
  const ambient = block("@utility bg-ambient {")
  expect(ambient).toContain("background-color: var(--ambient-base)")
  expect(ambient).toContain("background-image: var(--ambient)")
  expect(ambient).toContain("background-repeat: no-repeat")
  expect(ambient).toContain("background-size: 100% 100vh")
  expect(block(":root {")).toContain(
    "--ambient: radial-gradient(90% 38% at 50% -4%, rgba(255, 255, 255, 0.95) 0%, rgba(255, 255, 255, 0) 70%), linear-gradient(180deg, #F7F8F9 0%, #EFF0F3 50%, #E5E7EB 100%)",
  )
  expect(block(":root {")).toContain("--ambient-base: #E5E7EB")
  expect(block(".dark {")).toContain("--ambient: radial-gradient(110% 55% at -5% -5%, rgba(92, 62, 120, 0.55) 0%, rgba(92, 62, 120, 0) 60%)")
  expect(block(".dark {")).toContain("--ambient-base: #15121E")
})

test("the page's body is lit by the ambient light, under the screens without the shell too", () => {
  const body = block("  body {")
  expect(body).toContain("@apply bg-ambient")
  expect(body).not.toContain("bg-background")
})

test("a page that moves is opaque in the ambient light, laid where the column's own lies", () => {
  const moving = block(':root[data-move] [data-slot="page"] {')
  expect(moving).toContain("background-color: var(--ambient-base)")
  expect(moving).toContain("background-image: var(--ambient)")
  expect(moving).toContain("background-repeat: no-repeat")
  // The sheet stands inside main's padding (16px aside, 8px on top; 24px
  // from md): its light is main's, a screen tall, moved back by the padding.
  expect(moving).toContain("background-size: calc(100% + 2rem) 100vh")
  expect(moving).toContain("background-position: -1rem -0.5rem")
  expect(css).toMatch(
    /@media \(min-width: 48rem\) \{\s*:root\[data-move\] \[data-slot="page"\] \{\s*background-size: calc\(100% \+ 3rem\) 100vh;\s*background-position: -1\.5rem -1\.5rem;/,
  )
})

test("the avatars are the prototype's plain grey circles with dark initials: no tint per person", () => {
  expect(css).not.toContain('[data-slot="avatar"][data-tone')
  expect(block(":root {")).toContain("--av-bg: #E8E9EC")
  expect(block(":root {")).toContain("--av-ink: #1A1B1F")
  expect(block(".dark {")).toContain("--av-bg: rgba(255, 255, 255, 0.12)")
  expect(block(".dark {")).toContain("--av-ink: #F2F2F5")
})

test("gloss is the shine of a small colored icon: a thin light rim, a soft shadow and a light falling from its top", () => {
  const gloss = block("@utility gloss {")
  expect(gloss).toContain("box-shadow: inset 0 0 0 0.5px rgba(255, 255, 255, 0.4), 0 3px 8px rgba(60, 40, 120, 0.12)")
  expect(css).toMatch(/@utility gloss \{[^@]*&::after \{[^}]*background: linear-gradient\(180deg, rgba\(255, 255, 255, 0\.42\) 0%, rgba\(255, 255, 255, 0\) 55%\)/)
})

test("the fade under a bar is the page's own color, nearly opaque", () => {
  expect(block(":root {")).toContain("--fade: rgba(243, 244, 246, 0.94)")
  expect(block(".dark {")).toContain("--fade: rgba(21, 18, 30, 0.94)")
})

test("the search glass is a pale field with a hairline in the light, the chips' glass in the night", () => {
  expect(block(":root {")).toContain("--search: rgba(240, 241, 243, 0.7)")
  expect(block(":root {")).toContain("--search-rim: inset 0 0 0 1px rgba(0, 0, 0, 0.08)")
  expect(block(".dark {")).toContain("--search: rgba(255, 255, 255, 0.08)")
  expect(block(".dark {")).toContain("--search-rim: inset 0 0 0 1px rgba(255, 255, 255, 0.09), inset 0 1px 0 rgba(255, 255, 255, 0.16)")
})

test("the segmented thumb is black with white ink in the light, a pale glass in the night", () => {
  expect(block(":root {")).toContain("--seg-thumb: #111214")
  expect(block(":root {")).toContain("--seg-on: #ffffff")
  expect(block(":root {")).toContain("--seg-shadow: 0 4px 12px rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.15)")
  expect(block(".dark {")).toContain("--seg-thumb: rgba(255, 255, 255, 0.18)")
  expect(block(".dark {")).toContain("--seg-on: #F5F2FF")
  expect(block(".dark {")).toContain("--seg-shadow: 0 4px 14px rgba(60, 40, 120, 0.14), inset 0 1px 0 rgba(255, 255, 255, 0.7)")
})

test("a switch that is off is a faint violet track in the light, the plain fill in the night", () => {
  expect(block(":root {")).toContain("--switch-off: rgba(120, 108, 176, 0.18)")
  expect(block(".dark {")).toContain("--switch-off: rgba(255, 255, 255, 0.08)")
})

test("the gold of an amount's unit is the hint's grey in the light, a warm gold in the night", () => {
  expect(block(":root {")).toContain("--gold: #6B6E76")
  expect(block(".dark {")).toContain("--gold: #E4C27C")
})

test("the banner is a white card in the light, violet to gold in the night", () => {
  expect(block(":root {")).toContain("--ban: linear-gradient(135deg, #FFFFFF 0%, #EDEFF2 100%)")
  expect(block(":root {")).toContain("--ban-ink: #0E0F12")
  expect(block(":root {")).toContain("--ban-sub: #4A4D55")
  expect(block(".dark {")).toContain("--ban: linear-gradient(135deg, #3B2F52 0%, #2D2A4A 55%, #4A3B22 100%)")
  expect(block(".dark {")).toContain("--ban-sub: #E4C27C")
})

test("the brand's fill is the glossy black in the light, the lavender in the night; its mark's shadow follows", () => {
  expect(block(":root {")).toContain("--brand-fill: linear-gradient(180deg, #2E2F34 0%, #0E0F11 100%)")
  expect(block(":root {")).toContain("--mark-shadow: 0 12px 30px rgba(0, 0, 0, 0.25), inset 0 1px 0 rgba(255, 255, 255, 0.2)")
  expect(block(".dark {")).toContain("--brand-fill: linear-gradient(150deg, #A497F7 0%, #6453D3 100%)")
  expect(block(".dark {")).toContain(
    "--mark-shadow: 0 12px 30px rgba(106, 90, 214, 0.32), inset 0 0 0 1.5px rgba(242, 208, 138, 0.75), inset 0 2px 0 rgba(255, 255, 255, 0.4)",
  )
})

test("on a page's own background the logo is the light glass's ink, near black; white in the night", () => {
  expect(block(":root {")).toContain("--brand: #0E0F12")
  expect(block(".dark {")).toContain("--brand: #ffffff")
})

test("under the brand's fill the panel's own color is its deepest: near black in the light, the lavender's in the night", () => {
  expect(block(":root {")).toContain("--brand-panel: #0E0F11")
  expect(block(".dark {")).toContain("--brand-panel: #6453D3")
})

test("a board's column is a faint glass: a whisper of white in the light, less in the night", () => {
  expect(block(":root {")).toContain("--col: rgba(255, 255, 255, 0.45)")
  expect(block(".dark {")).toContain("--col: rgba(255, 255, 255, 0.04)")
})

test("a lifted row is a white card in the light (not the segmented thumb's black, as the prototype's), a pale glass in the night", () => {
  expect(block(":root {")).toContain("--lifted: #ffffff")
  expect(block(".dark {")).toContain("--lifted: rgba(255, 255, 255, 0.18)")
})

test("the sidebar's pane is a pale glass in the light, a dark violet glass in the night", () => {
  expect(block(":root {")).toContain("--head: rgba(246, 247, 249, 0.72)")
  expect(block(".dark {")).toContain("--head: rgba(28, 24, 40, 0.55)")
})
