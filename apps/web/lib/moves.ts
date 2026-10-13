import { isRootPath } from "@/lib/nav"

// A move between pages, as the prototype's push and pop (app/globals.css):
// forward, the new page comes in from the right over the old one; back, the
// old one leaves to the right over the page it uncovers. A section from the
// menu, a filter, the browser's own back have none: the page changes at once.
export type Move = "forward" | "back"

// The move under way is the root element's data-move, which the styles read
// when the page changes: it is taken where the step is (a link of the kit, a
// record saved or deleted, Telegram's back button) and dropped once the
// page's transition has run (PageTransition). React's transition types,
// which Next's links and router can carry, were lost now and then between
// the click and the page change (a commit in between takes them all).
let generation = 0
let takenAt = 0
let dropping: ReturnType<typeof setTimeout> | undefined

// A move no page change came of in this time (a slow navigation, or none)
// is dropped: a later change would slide with it.
const STALE_MS = 4000
// The browser's back is a move of its own (its gesture), unless it is
// Telegram's back button, which takes its move just before.
const FRESH_MS = 500

export function moveTo(move: Move | undefined): void {
  if (typeof document === "undefined") return
  clearTimeout(dropping)
  generation++
  if (move === undefined) {
    delete document.documentElement.dataset.move
    return
  }
  document.documentElement.dataset.move = move
  takenAt = Date.now()
  const taken = generation
  dropping = setTimeout(() => settleMove(taken), STALE_MS)
}

// moving takes the move and then runs the navigation it is for, on the next
// task: a toast said just before it (sonner) flushes its list on a timer,
// and a flush while the page's transition is being prepared cancels it.
// afterDelete={() => moving("back", () => router.replace("/sales"))}.
export function moving(move: Move, navigate: () => void): void {
  moveTo(move)
  setTimeout(navigate)
}

// moveUnderWay names the move under way; settleMove drops it once its page
// change has run, unless a newer one was taken since.
export function moveUnderWay(): number {
  return generation
}

export function settleMove(of: number): void {
  if (of !== generation) return
  moveTo(undefined)
}

// stepInto is the move a link to href takes: a step deeper (a record, a
// form, a page under a hub) forward; a section's own page is a section
// switched to, as the menu does and the prototype's openSection, with none.
export function stepInto(href: string): Move | undefined {
  return isRootPath(href.split(/[?#]/)[0]) ? undefined : "forward"
}

if (typeof window !== "undefined") {
  window.addEventListener("popstate", () => {
    if (Date.now() - takenAt > FRESH_MS) moveTo(undefined)
  })
}
