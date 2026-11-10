import { expect, test } from "vitest"
import { keyboardInset, revealDelta } from "./keyboard"

// What the browser tells of the visual viewport: its height, how far its top
// stands below the layout viewport's, and its zoom.
const view = (height: number, offsetTop = 0, scale = 1) => ({ height, offsetTop, scale })

// How much of the page's bottom lies behind the soft keyboard: the layout
// viewport less what the visual viewport still shows.
test.each([
  // The browser does not tell, or tells that nothing is hidden.
  ["no visual viewport", null, 812, 0],
  ["nothing over the page", view(812), 812, 0],
  // A keyboard over the bottom: the visual viewport shrinks, the page stays.
  ["a keyboard 300px high", view(512), 812, 300],
  ["a fraction of a pixel is rounded", view(511.7), 812, 300],
  // The page was panned up to show the field: only what is still behind it counts.
  ["panned 100px up", view(512, 100), 812, 200],
  // The page itself shrank with the keyboard (the window was resized): nothing is hidden.
  ["the page shrank with it", view(512), 512, 0],
  // Never less than nothing.
  ["a viewport taller than the page", view(900), 812, 0],
  // A page pinched in is no keyboard, however small its visual viewport.
  ["zoomed in", view(406, 0, 2), 812, 0],
  ["a zoom of a hair is none", view(512, 0, 1.001), 812, 300],
])("keyboardInset: %s", (_name, viewport, layoutHeight, hidden) => {
  expect(keyboardInset(viewport, layoutHeight)).toBe(hidden)
})

// A stretch of the screen, its top and its bottom edge.
const span = (top: number, bottom: number) => ({ top, bottom })

// How far the field's scroller must scroll (the content moving up is
// positive) for the field to stand in the middle of the clear part of the
// screen: 16px under its top, and 96px over its bottom, where a sticky bar of
// the page's main button lies. A field that already stands there stays.
test.each([
  ["a field in the middle of the clear part stays", span(0, 512), span(200, 240), 0],
  ["with no keyboard a field low on the screen stays, clear of the bottom band", span(0, 812), span(300, 340), 0],
  ["a field behind the keyboard comes up", span(0, 512), span(690, 710), 484],
  ["a field above the screen's top comes down", span(0, 512), span(-50, -10), -246],
  ["a field in the bottom band is moved", span(0, 512), span(400, 420), 194],
  ["a field taller than the clear part gets its top edge in", span(0, 512), span(100, 600), 84],
  ["a panned view: the clear part starts lower", span(100, 612), span(640, 660), 334],
  ["a fraction of a pixel is rounded", span(0, 512), span(-40.4, -0.4), -236],
])("revealDelta: %s", (_name, clear, field, delta) => {
  expect(revealDelta(field, clear)).toBe(delta)
})
