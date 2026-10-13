"use client"

import { type ReactNode, useEffect, ViewTransition } from "react"
import { moveUnderWay, settleMove } from "@/lib/moves"

// settles drops the move a page change ran with once its transition is over
// (React runs what an event returns then): the next change starts afresh.
const settles = () => {
  const move = moveUnderWay()
  return () => settleMove(move)
}

// A transition React skipped (a render it had to make while preparing it:
// a confirm dialog closing as its record is deleted) runs no event: the
// page that came drops its move a little after the longest slide (420ms).
const SETTLED_MS = 600

// PageTransition is a page's content, moving with the steps between pages as
// the prototype's screens do: one opaque sheet filling the main area, laid
// out as main lays out its children, so what it covers in a move does not
// show through it. Put in each page.tsx, not a layout: a layout stays across
// navigations, so it never enters or leaves. The sheet enters as page-in and
// leaves as page-out on every page change; how it moves is the move under
// way (lib/moves.ts), read by app/globals.css. A React without ViewTransition
// (the unit tests') shows the sheet as it is.
export function PageTransition({ children }: { children: ReactNode }) {
  useEffect(() => {
    const move = moveUnderWay()
    const settling = setTimeout(() => settleMove(move), SETTLED_MS)
    return () => clearTimeout(settling)
  }, [])
  const sheet = (
    <div data-slot="page" className="flex flex-1 flex-col bg-background [&>*]:shrink-0">
      {children}
    </div>
  )
  if (!ViewTransition) return sheet
  return (
    <ViewTransition enter="page-in" exit="page-out" default="none" onEnter={settles} onExit={settles}>
      {sheet}
    </ViewTransition>
  )
}
