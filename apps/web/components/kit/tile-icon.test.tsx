import { render } from "@testing-library/react"
import { UserIcon } from "lucide-react"
import { expect, test } from "vitest"
import { SoftIcon, TileIcon } from "./tile-icon"

test("a tile icon is the prototype's plain outline mark beside its row's text: no color under it, the heading's ink, decoration", () => {
  const { container } = render(<TileIcon icon={UserIcon} />)
  const tile = container.querySelector('[data-slot="tile-icon"]') as HTMLElement
  expect(tile).toHaveAttribute("aria-hidden", "true")
  expect(tile.style.background).toBe("")
  expect(tile).toHaveClass("text-heading", "w-7", "[&_svg]:size-[22px]")
  expect(tile).not.toHaveClass("gloss")
  expect(tile.querySelector("svg")).toHaveAttribute("stroke-width", "1.8")
})

test("a soft icon is the icon in its color on a pale wash of it, decoration beside a document's row", () => {
  const { container } = render(<SoftIcon icon={UserIcon} color="#34C759" />)
  const tile = container.querySelector('[data-slot="soft-icon"]') as HTMLElement
  expect(tile).toHaveAttribute("aria-hidden", "true")
  expect(tile.style.color).toBe("rgb(52, 199, 89)")
  expect(tile.querySelector("svg")).toBeInTheDocument()
})


test("a soft icon is the prototype's task mark: a 40px circle on the plain fill, no rim, the icon alone in its color", () => {
  const { container } = render(<SoftIcon icon={UserIcon} color="#34C759" />)
  const icon = container.querySelector('[data-slot="soft-icon"]') as HTMLElement
  expect(icon).toHaveClass("size-10", "rounded-full", "bg-muted")
  expect(icon).not.toHaveClass("shadow-[inset_0_0_0_1px_rgba(255,255,255,.5)]")
  expect(icon.className).not.toContain("color-mix")
  expect(icon.style.color).toBe("rgb(52, 199, 89)")
})
