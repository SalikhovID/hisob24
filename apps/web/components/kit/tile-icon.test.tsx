import { render } from "@testing-library/react"
import { UserIcon } from "lucide-react"
import { expect, test } from "vitest"
import { SoftIcon, TileIcon } from "./tile-icon"

test("a tile icon is the prototype's row icon: a 30px accent square with a white icon on a phone, a 28px grey one on the web; decoration", () => {
  const { container } = render(<TileIcon icon={UserIcon} />)
  const tile = container.querySelector('[data-slot="tile-icon"]') as HTMLElement
  expect(tile).toHaveAttribute("aria-hidden", "true")
  expect(tile).toHaveClass("size-[30px]", "rounded-md", "bg-primary", "text-primary-foreground", "md:size-7", "md:bg-ink-2", "md:text-icon")
  expect(tile.querySelector("svg")).toHaveAttribute("stroke-width", "1.8")
})

test("a soft icon is a document's mark: its icon in its color on a 32px grey square (28px on the web), decoration", () => {
  const { container } = render(<SoftIcon icon={UserIcon} color="#34C759" />)
  const icon = container.querySelector('[data-slot="soft-icon"]') as HTMLElement
  expect(icon).toHaveAttribute("aria-hidden", "true")
  expect(icon).toHaveClass("size-8", "rounded-md", "bg-ink-2", "md:size-7")
  expect(icon.style.color).toBe("rgb(52, 199, 89)")
})
