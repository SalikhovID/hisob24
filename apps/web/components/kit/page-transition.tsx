import { type ReactNode, ViewTransition } from "react"

// The classes a page moves with (app/globals.css): forward, the new page
// comes in over the old one (push-in, push-out); back, the old one leaves
// over the page it uncovers (pop-out, pop-in). A move with no direction
// (lib/moves.ts) does not slide.
const enter = { "nav-forward": "push-in", "nav-back": "pop-in", default: "none" }
const exit = { "nav-forward": "push-out", "nav-back": "pop-out", default: "none" }

// PageTransition is a page's content, moving with the steps between pages as
// the prototype's screens do: one opaque sheet filling the main area, laid
// out as main lays out its children, so what it covers in a move does not
// show through it. Put in each page.tsx, not a layout: a layout stays across
// navigations, so it never enters or leaves. A React without ViewTransition
// (the unit tests') shows the sheet as it is.
export function PageTransition({ children }: { children: ReactNode }) {
  const sheet = (
    <div data-slot="page" className="flex flex-1 flex-col bg-background [&>*]:shrink-0">
      {children}
    </div>
  )
  if (!ViewTransition) return sheet
  return (
    <ViewTransition enter={enter} exit={exit} default="none">
      {sheet}
    </ViewTransition>
  )
}
