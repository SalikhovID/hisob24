import { expect, test } from "vitest"
import { keyboardInset } from "./keyboard"

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
