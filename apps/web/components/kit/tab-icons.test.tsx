import { render } from "@testing-library/react"
import { expect, test } from "vitest"
import { navKeys, navPages } from "@/lib/nav"
import { pageIcons, tabIcons } from "./tab-icons"

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

test("every page of the menu wears a filled tab icon of its own, drawn in the current color and hidden from assistive technology", () => {
  for (const { key } of navPages) {
    const Icon = pageIcons[key]
    expect(Icon, key).toBeTypeOf("function")
    const { container, unmount } = render(<Icon />)
    const svg = container.querySelector("svg")
    expect(svg, key).toHaveAttribute("aria-hidden", "true")
    expect(svg, key).toHaveAttribute("viewBox", "0 0 28 28")
    expect(svg, key).toHaveAttribute("fill", "currentColor")
    unmount()
  }
  expect(new Set(navPages.map(({ key }) => pageIcons[key])).size, "no two pages wear one icon").toBe(navPages.length)
})

test("the pages' icons twice on one page do not share a mask id", () => {
  const { container } = render(
    <>
      {[...navPages, ...navPages].map(({ key }, index) => {
        const Icon = pageIcons[key]
        return Icon ? <Icon key={index} /> : null
      })}
    </>,
  )
  const ids = Array.from(container.querySelectorAll("mask")).map((mask) => mask.id)
  expect(ids.length).toBeGreaterThan(navPages.length)
  expect(new Set(ids).size).toBe(ids.length)
})
