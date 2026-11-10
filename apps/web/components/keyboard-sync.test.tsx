import { act, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, expect, test, vi } from "vitest"
import { KeyboardSync } from "./keyboard-sync"

// FakeViewport stands for window.visualViewport: it tells its height, and is
// told to resize.
type FakeViewport = EventTarget & { height: number; offsetTop: number; scale: number; width: number }

function installViewport(height: number): FakeViewport {
  const viewport = Object.assign(new EventTarget(), { height, offsetTop: 0, scale: 1, width: 375 })
  Object.defineProperty(window, "visualViewport", { value: viewport, configurable: true })
  return viewport
}

// resizeTo is the keyboard coming up or going down: the visual viewport takes
// the height and says so.
function resizeTo(viewport: FakeViewport, height: number) {
  viewport.height = height
  act(() => {
    viewport.dispatchEvent(new Event("resize"))
  })
}

const inset = () => document.documentElement.style.getPropertyValue("--keyboard-inset")

beforeEach(() => {
  vi.useFakeTimers()
  Object.defineProperty(window, "innerHeight", { value: 812, configurable: true, writable: true })
})

afterEach(() => {
  vi.useRealTimers()
  Reflect.deleteProperty(window, "visualViewport")
  document.documentElement.removeAttribute("style")
})

test("while a field is typed in and the keyboard lies over the page's bottom, the page says how much (--keyboard-inset); it takes it back when the keyboard goes down", () => {
  const viewport = installViewport(812)
  render(
    <>
      <KeyboardSync />
      <input aria-label="Narx" />
    </>,
  )
  act(() => screen.getByLabelText("Narx").focus())
  expect(inset()).toBe("")

  resizeTo(viewport, 512)
  expect(inset()).toBe("300px")

  resizeTo(viewport, 812)
  expect(inset()).toBe("")
})

test("when the field loses focus the page takes the keyboard's room back, even if the viewport never says the keyboard went", () => {
  const viewport = installViewport(812)
  render(
    <>
      <KeyboardSync />
      <input aria-label="Narx" />
    </>,
  )
  const field = screen.getByLabelText("Narx")
  act(() => field.focus())
  resizeTo(viewport, 512)
  expect(inset()).toBe("300px")

  act(() => field.blur())
  act(() => {
    vi.advanceTimersByTime(200)
  })
  expect(inset()).toBe("")
})

// scene is a field in a scroller, as a page or a sheet holds it, with the
// KeyboardSync beside it. jsdom lays nothing out, so where the field stands
// on the screen and what the scroller holds are told; scrollBy is watched.
function scene(top: number, bottom: number) {
  const scrollBy = vi.fn()
  render(
    <>
      <KeyboardSync />
      <div data-testid="scroller" style={{ overflowY: "auto" }}>
        <input aria-label="Narx" />
      </div>
    </>,
  )
  const scroller = screen.getByTestId("scroller")
  Object.defineProperty(scroller, "scrollHeight", { value: 2000 })
  Object.defineProperty(scroller, "clientHeight", { value: 800 })
  Object.assign(scroller, { scrollBy })
  const field = screen.getByLabelText("Narx")
  Object.assign(field, { getBoundingClientRect: () => ({ top, bottom, left: 0, right: 100, width: 100, height: bottom - top, x: 0, y: top, toJSON() {} }) })
  return { field, scrollBy }
}

test("a field the keyboard comes up over is scrolled clear of it once the keyboard has settled", () => {
  const viewport = installViewport(812)
  const { field, scrollBy } = scene(690, 710)
  act(() => field.focus())
  // Nothing lies over it yet, and it stands clear of the bottom band.
  expect(scrollBy).not.toHaveBeenCalled()

  resizeTo(viewport, 512)
  act(() => {
    vi.advanceTimersByTime(200)
  })
  expect(scrollBy).toHaveBeenCalledWith({ top: 484, behavior: "smooth" })
})
