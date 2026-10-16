import { act, render, screen } from "@testing-library/react"
import { afterEach, expect, test, vi } from "vitest"
import { Amount, groupDigits, splitAmount } from "./amount"

test("the digits are grouped by thousands with a no-break space, the decimals kept apart", () => {
  expect(groupDigits("1250000")).toBe("1 250 000")
  expect(splitAmount("1250000.50")).toEqual({ whole: "1 250 000", decimals: ",50" })
  expect(splitAmount("12000.00")).toEqual({ whole: "12 000", decimals: "" })
  expect(splitAmount("7")).toEqual({ whole: "7", decimals: "" })
  // Below zero (an account that paid out more than it held) with a real minus sign.
  expect(splitAmount("-5000.50")).toEqual({ whole: "\u22125\u00a0000", decimals: ",50" })
})

test("an amount reads as one number with its unit", () => {
  render(<Amount value="1250000.50" unit="so'm" />)
  const amount = screen.getByText((_, element) => element?.getAttribute("data-slot") === "amount")
  // jest-dom folds a no-break space into a space when it reads text.
  expect(amount).toHaveTextContent("1 250 000,50 so'm")
  expect(amount.querySelector('[data-slot="amount-whole"]')).toHaveTextContent("1 250 000")
  expect(amount.querySelector('[data-slot="amount-decimals"]')).toHaveTextContent(",50")
})

// layout stands in for the browser's layout, which jsdom lacks: the box the
// figure sits in is box wide (its padding inside), and the figure is
// natural wide at full size, narrower in proportion to its scale.
function layout(size: { box: number; natural: number }) {
  const scale = (el: HTMLElement) => Number(el.style.getPropertyValue("--k") || "1")
  vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockImplementation(function (this: HTMLElement) {
    return this.dataset.slot === "amount" ? 0 : size.box
  })
  vi.spyOn(HTMLElement.prototype, "scrollWidth", "get").mockImplementation(function (this: HTMLElement) {
    return this.dataset.slot === "amount" ? Math.round(size.natural * scale(this)) : size.box
  })
  return size
}
afterEach(() => vi.restoreAllMocks())

const figure = () => document.querySelector<HTMLElement>("[data-slot=amount]")!
const scaleOf = (el: HTMLElement) => Number(el.style.getPropertyValue("--k"))

test("a figure too wide for its box is scaled down to the box's content width: the box's padding is not room", () => {
  // A 343px box with 8px of padding on each side leaves 327px; the figure keeps 8px off that.
  layout({ box: 343, natural: 352 })
  render(
    <div style={{ padding: "0 8px" }}>
      <Amount value="1000000" unit="so'm" />
    </div>,
  )
  expect(scaleOf(figure())).toBeCloseTo(319 / 352, 2)
})

// Observed stands in for the browser's ResizeObserver: the test tells it
// when the box changed, and to what.
class Observed {
  static last: Observed
  constructor(readonly report: ResizeObserverCallback) {
    Observed.last = this
  }
  observe() {}
  unobserve() {}
  disconnect() {}
  // resized tells the figure its box is now width × height (content box).
  resized(width: number, height: number) {
    act(() => this.report([{ contentRect: { width, height } } as ResizeObserverEntry], this as unknown as ResizeObserver))
  }
}

test("the figure is fitted again when its box grows or shrinks in width; a change of height alone (its own scaling) leaves it be", () => {
  vi.stubGlobal("ResizeObserver", Observed)
  const size = layout({ box: 343, natural: 352 })
  render(
    <div style={{ padding: "0 8px" }}>
      <Amount value="1000000" unit="so'm" />
    </div>,
  )
  const fitted = scaleOf(figure())
  expect(fitted).toBeCloseTo(319 / 352, 2)

  // Scaled, the figure is lower, and so is its box: nothing to fit. (Were
  // it measured again, the figure would be fitted anew to 400px.)
  size.natural = 400
  Observed.last.resized(327, 109.8)
  expect(scaleOf(figure())).toBe(fitted)

  // A narrower box (a turned phone, a sidebar opened) fits it again.
  size.box = 300
  Observed.last.resized(284, 109.8)
  expect(scaleOf(figure())).toBeCloseTo(276 / 400, 2)
  vi.unstubAllGlobals()
})

test("an amount's unit is in the prototype's gold", () => {
  const { container } = render(<Amount value="10" unit="so'm" />)
  const unit = container.querySelector('[data-slot="amount-unit"]')
  expect(unit).toHaveClass("text-(--gold)")
  expect(unit).not.toHaveClass("text-muted-foreground")
})
