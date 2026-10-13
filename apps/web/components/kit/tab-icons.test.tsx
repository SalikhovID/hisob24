import { render } from "@testing-library/react"
import { expect, test } from "vitest"
import { navKeys } from "@/lib/nav"
import { tabIcons } from "./tab-icons"

test("every section has a filled tab icon, drawn in the current color and hidden from assistive technology", () => {
  for (const key of navKeys) {
    const Icon = tabIcons[key]
    const { container, unmount } = render(<Icon />)
    const svg = container.querySelector("svg")
    expect(svg, key).toHaveAttribute("aria-hidden", "true")
    expect(svg, key).toHaveAttribute("viewBox", "0 0 28 28")
    expect(svg, key).toHaveAttribute("fill", "currentColor")
    unmount()
  }
})

test("two icons with masks on one page do not share a mask id", () => {
  const Home = tabIcons.home
  const { container } = render(
    <>
      <Home />
      <Home />
    </>,
  )
  const ids = Array.from(container.querySelectorAll("mask")).map((mask) => mask.id)
  expect(new Set(ids).size).toBe(ids.length)
})
