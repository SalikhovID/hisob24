import { act, render, screen } from "@testing-library/react"
import { afterEach, expect, test } from "vitest"
import { Providers } from "./providers"

afterEach(() => Reflect.deleteProperty(window, "visualViewport"))

test("every page is under KeyboardSync: a field typed in under the soft keyboard has the page told how much of its bottom is covered", () => {
  const viewport = Object.assign(new EventTarget(), { height: 812, offsetTop: 0, scale: 1, width: 375 })
  Object.defineProperty(window, "visualViewport", { value: viewport, configurable: true })
  Object.defineProperty(window, "innerHeight", { value: 812, configurable: true, writable: true })
  render(
    <Providers>
      <input aria-label="Narx" />
    </Providers>,
  )
  act(() => screen.getByLabelText("Narx").focus())
  viewport.height = 512
  act(() => {
    viewport.dispatchEvent(new Event("resize"))
  })
  expect(document.documentElement.style.getPropertyValue("--keyboard-inset")).toBe("300px")
})
