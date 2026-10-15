import { afterEach, expect, test, vi } from "vitest"
import { moved } from "@/test/moves"
import { moveTo, moveUnderWay, moving, settleMove, stepInto } from "./moves"

afterEach(() => {
  vi.useRealTimers()
})

test.each([
  ["/customers/12", "forward"],
  ["/sales/new", "forward"],
  ["/purchases", "forward"],
  ["/settings/customer-types", "forward"],
  ["/profile", "forward"],
  ["/customers", undefined],
  ["/tasks?view=list", undefined],
  ["/warehouse", undefined],
  ["/expenses", undefined],
  ["/", undefined],
])("a link to %s moves the page %s: a step deeper forward, a section's own page (as the menu opens it) not at all", (href, move) => {
  expect(stepInto(href)).toBe(move)
})

test("a move is the root's data-move until the page change it was taken for has run; an older one's end leaves a newer one", () => {
  moveTo("forward")
  expect(moved()).toBe("forward")
  const first = moveUnderWay()
  moveTo("back")
  settleMove(first)
  expect(moved()).toBe("back")
  settleMove(moveUnderWay())
  expect(moved()).toBeUndefined()
  moveTo("forward")
  moveTo(undefined)
  expect(moved()).toBeUndefined()
})

test("a move no page change came of is dropped after a while: a later change does not slide with it", () => {
  vi.useFakeTimers()
  moveTo("forward")
  vi.advanceTimersByTime(3900)
  expect(moved()).toBe("forward")
  vi.advanceTimersByTime(200)
  expect(moved()).toBeUndefined()
})

test("the browser's own back drops a move taken a while before; Telegram's back button, which takes its move just before, keeps it", () => {
  vi.useFakeTimers()
  moveTo("forward")
  vi.advanceTimersByTime(1000)
  window.dispatchEvent(new PopStateEvent("popstate"))
  expect(moved()).toBeUndefined()
  moveTo("back")
  window.dispatchEvent(new PopStateEvent("popstate"))
  expect(moved()).toBe("back")
})

test("a navigation with its move waits for the toasts said just before it: their flush would cancel the page's transition", () => {
  vi.useFakeTimers()
  const order: string[] = []
  setTimeout(() => order.push("toast"))
  moving("back", () => order.push("navigate"))

  expect(moved()).toBe("back")
  expect(order).toEqual([])
  vi.runAllTimers()
  expect(order).toEqual(["toast", "navigate"])
})
