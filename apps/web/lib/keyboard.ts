// A stretch of the screen, its top and its bottom edge.
export interface Span {
  top: number
  bottom: number
}

// What the browser tells of the visual viewport (window.visualViewport).
export interface ViewportInfo {
  height: number
  offsetTop: number
  scale: number
}

// keyboardInset is how much of the page's bottom lies behind the soft
// keyboard: the layout viewport's height (the page's own) less what the
// visual viewport still shows, its top edge and its height. It is nothing
// when the browser does not tell, when the page shrank with the keyboard (the
// two heights then agree), and when the page is pinched in: a small visual
// viewport is then a zoom, not a keyboard.
export function keyboardInset(viewport: ViewportInfo | null, layoutHeight: number): number {
  if (!viewport || viewport.scale > 1.01) return 0
  return Math.max(0, Math.round(layoutHeight - viewport.offsetTop - viewport.height))
}

// The room kept clear of a field: under the top of the clear part of the
// screen, and over its bottom, where a sticky bar of the page's main button
// lies (it stands above the keyboard, over the content that scrolls under it).
const ROOM = { top: 16, bottom: 96 }

// revealDelta is how far the field's scroller must scroll (the content moving
// up is positive) for the field to stand in the middle of the clear part of
// the screen, the part the keyboard leaves, less the room kept; a field that
// already stands there is not moved (0). One taller than that gets its top
// edge in.
export function revealDelta(field: Span, clear: Span): number {
  const top = clear.top + ROOM.top
  const bottom = clear.bottom - ROOM.bottom
  if (field.top >= top && field.bottom <= bottom) return 0
  if (field.bottom - field.top > bottom - top) return Math.round(field.top - top)
  return Math.round((field.top + field.bottom) / 2 - (top + bottom) / 2)
}
