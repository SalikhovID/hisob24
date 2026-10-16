import { render } from "@testing-library/react"
import { expect, test } from "vitest"
import { navKeys, navPages } from "@/lib/nav"
import { pageIcons, tabIcons } from "./tab-icons"

// outline checks an icon is the prototype's outline mark: 24×24, no fill, a
// 1.8 stroke in the current color, hidden from assistive technology.
const outline = (svg: Element | null, key: string) => {
  expect(svg, key).toHaveAttribute("aria-hidden", "true")
  expect(svg, key).toHaveAttribute("viewBox", "0 0 24 24")
  expect(svg, key).toHaveAttribute("fill", "none")
  expect(svg, key).toHaveAttribute("stroke", "currentColor")
  expect(svg, key).toHaveAttribute("stroke-width", "1.8")
}

test("every section has the prototype's outline icon: a 1.8 stroke in the current color, hidden from assistive technology", () => {
  for (const key of navKeys) {
    const Icon = tabIcons[key]
    const { container, unmount } = render(<Icon />)
    outline(container.querySelector("svg"), key)
    unmount()
  }
})

test("the sections wear the prototype's own marks: a house for the home, two knobs on two lines for the settings", () => {
  const Home = tabIcons.home
  const Settings = tabIcons.settings
  const { container } = render(
    <>
      <Home />
      <Settings />
    </>,
  )
  const [home, settings] = container.querySelectorAll("svg")
  expect(home.querySelector("path")).toHaveAttribute("d", "M4 10.5 12 4l8 6.5V19a1.5 1.5 0 0 1-1.5 1.5H15v-6H9v6H5.5A1.5 1.5 0 0 1 4 19z")
  expect(settings.querySelectorAll("circle")).toHaveLength(2)
  expect(settings.querySelector("path")).toHaveAttribute("d", "M9.4 7H20M4 17h10.6")
})

test("every page of the menu wears an outline icon of its own", () => {
  for (const { key } of navPages) {
    const Icon = pageIcons[key]
    expect(Icon, key).toBeTypeOf("function")
    const { container, unmount } = render(<Icon />)
    outline(container.querySelector("svg"), key)
    unmount()
  }
  expect(new Set(navPages.map(({ key }) => pageIcons[key])).size, "no two pages wear one icon").toBe(navPages.length)
})
