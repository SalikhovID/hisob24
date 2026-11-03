import { render } from "@testing-library/react"
import { expect, test } from "vitest"
import { navKeys, navPages } from "@/lib/nav"
import { pageIcons, tabIcons } from "./tab-icons"

// lucide checks an icon is the prototype's: a lucide outline icon, its
// stroke 1.75, hidden from assistive technology.
const lucide = (svg: Element | null, key: string) => {
  expect(svg, key).toHaveClass("lucide")
  expect(svg, key).toHaveAttribute("aria-hidden", "true")
  expect(svg, key).toHaveAttribute("stroke-width", "1.75")
}

test("every section wears the prototype's lucide icon: a 1.75 stroke, hidden from assistive technology", () => {
  for (const key of navKeys) {
    const Icon = tabIcons[key]
    const { container, unmount } = render(<Icon />)
    lucide(container.querySelector("svg"), key)
    unmount()
  }
})

test("the sections wear the prototype's icons: a house for the home, a contact card for the customers, a gear for the settings", () => {
  const Home = tabIcons.home
  const Customers = tabIcons.customers
  const Settings = tabIcons.settings
  const { container } = render(
    <>
      <Home />
      <Customers />
      <Settings />
    </>,
  )
  const [home, customers, settings] = container.querySelectorAll("svg")
  expect(home).toHaveClass("lucide-house")
  expect(customers).toHaveClass("lucide-contact")
  expect(settings).toHaveClass("lucide-settings")
})

test("every page of the menu wears an icon of its own", () => {
  for (const { key } of navPages) {
    const Icon = pageIcons[key]
    expect(Icon, key).toBeTypeOf("function")
    const { container, unmount } = render(<Icon />)
    lucide(container.querySelector("svg"), key)
    unmount()
  }
  expect(new Set(navPages.map(({ key }) => pageIcons[key])).size, "no two pages wear one icon").toBe(navPages.length)
})
