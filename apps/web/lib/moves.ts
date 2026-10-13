import { isRootPath } from "@/lib/nav"

// The directions a navigation moves the page in (components/kit/page-transition.tsx),
// as the prototype's push and pop: a step deeper (a record from its list, a
// document saved) forward; a step up (a page's way back, a record deleted, an
// edit saved) back. A section from the menu, a filter, the way home have none.
export const stepForward = ["nav-forward"]
export const stepBack = ["nav-back"]

// stepInto is how a link in a page moves it: a step deeper (a record, a
// form, a page under a hub) forward; a section's own page is a section
// switched to, as the menu does and the prototype's openSection, with no slide.
export function stepInto(href: string): string[] | undefined {
  return isRootPath(href.split(/[?#]/)[0]) ? undefined : stepForward
}
