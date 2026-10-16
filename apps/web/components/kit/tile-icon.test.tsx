import { render } from "@testing-library/react"
import { UserIcon } from "lucide-react"
import { expect, test } from "vitest"
import { sectionColors, SoftIcon, TileIcon } from "./tile-icon"

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

test("a soft icon is the icon in its color on a pale wash of it, decoration beside a document's row", () => {
  const { container } = render(<SoftIcon icon={UserIcon} color="#34C759" />)
  const tile = container.querySelector('[data-slot="soft-icon"]') as HTMLElement
  expect(tile).toHaveAttribute("aria-hidden", "true")
  expect(tile.style.color).toBe("rgb(52, 199, 89)")
  expect(tile.querySelector("svg")).toBeInTheDocument()
})

test("a tile icon is glossy, as the prototype's: a light falling from its top, its corners 10px", () => {
  const { container } = render(<TileIcon icon={UserIcon} color="#007AFF" />)
  expect(container.querySelector('[data-slot="tile-icon"]')).toHaveClass("gloss", "rounded-[10px]")
})

test("a soft icon has a faint white rim, as the prototype's task icons", () => {
  const { container } = render(<SoftIcon icon={UserIcon} />)
  expect(container.querySelector('[data-slot="soft-icon"]')).toHaveClass("shadow-[inset_0_0_0_1px_rgba(255,255,255,.5)]")
})
