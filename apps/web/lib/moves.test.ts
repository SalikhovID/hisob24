import { expect, test } from "vitest"
import { stepInto } from "./moves"

test.each([
  ["/customers/12", ["nav-forward"]],
  ["/sales/new", ["nav-forward"]],
  ["/purchases", ["nav-forward"]],
  ["/settings/customer-types", ["nav-forward"]],
  ["/profile/menu", ["nav-forward"]],
  ["/customers", undefined],
  ["/tasks?view=list", undefined],
  ["/warehouse", undefined],
  ["/expenses", undefined],
  ["/", undefined],
])("a link to %s moves the page %j: a step deeper forward, a section's own page (as the menu opens it) not at all", (href, moves) => {
  expect(stepInto(href)).toEqual(moves)
})
