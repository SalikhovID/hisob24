import { render } from "@testing-library/react"
import { UserIcon } from "lucide-react"
import { expect, test } from "vitest"
import { sectionColors, TileIcon } from "./tile-icon"

test("a tile icon is a colored square with an icon, decoration beside its row's text", () => {
  const { container } = render(<TileIcon icon={UserIcon} color="#34C759" />)
  const tile = container.querySelector('[data-slot="tile-icon"]') as HTMLElement
  expect(tile).toHaveAttribute("aria-hidden", "true")
  expect(tile.style.background).toBe("rgb(52, 199, 89)")
  expect(tile.querySelector("svg")).toBeInTheDocument()
})

test("every section has a color of its own", () => {
  expect(sectionColors.home).toBe("#174449")
  expect(sectionColors.customers).toBe("#007AFF")
  expect(new Set(Object.values(sectionColors)).size).toBe(Object.keys(sectionColors).length)
})
