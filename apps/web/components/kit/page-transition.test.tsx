import { act, render, screen } from "@testing-library/react"
import { afterEach, expect, test, vi } from "vitest"
import { moveTo } from "@/lib/moves"
import { moved } from "@/test/moves"
import { PageTransition } from "./page-transition"

afterEach(() => {
  vi.useRealTimers()
})

test("a page is one sheet; once it has come, the move it came with is over a little after its slide, but not a move taken since", () => {
  vi.useFakeTimers()
  moveTo("forward")
  const { container } = render(
    <PageTransition>
      <p>Sahifa</p>
    </PageTransition>,
  )

  expect(container.querySelector("[data-slot=page]")).toContainElement(screen.getByText("Sahifa"))
  act(() => vi.advanceTimersByTime(400))
  expect(moved()).toBe("forward")
  act(() => vi.advanceTimersByTime(300))
  expect(moved()).toBeUndefined()

  moveTo("back")
  act(() => vi.advanceTimersByTime(700))
  expect(moved()).toBe("back")
})
