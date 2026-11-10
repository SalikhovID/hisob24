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
