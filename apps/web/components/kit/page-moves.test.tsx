import { render, screen } from "@testing-library/react"
import { PencilIcon, PhoneIcon, ReceiptIcon } from "lucide-react"
import type { ComponentProps } from "react"
import { expect, test, vi } from "vitest"
import { DetailHead, Tile, Tiles } from "./detail-head"
import { Group, Row } from "./group"
import { Hero } from "./hero"
import { BackLink, PlusButton } from "./page-title"
import { StatCard } from "./stat-card"

// next/link as far as the moves go: the directions a link gives its
// navigation, on the anchor.
vi.mock("next/link", () => ({
  default: ({ transitionTypes, ...props }: ComponentProps<"a"> & { transitionTypes?: string[] }) => (
    <a data-moves={transitionTypes ? transitionTypes.join(" ") : "none"} {...props} />
  ),
}))

const moves = (name: string | RegExp) => screen.getByRole("link", { name }).getAttribute("data-moves")

test("the kit's ways into a record move the page forward, as the prototype's push; a way to a section's own page switches to it without a slide, as its openSection", () => {
  render(
    <>
      <Group label="Mijozlar">
        <Row href="/customers/12" title="Dilshod Karimov" />
        <Row href="/tasks" title="Barcha vazifalar" />
      </Group>
      <PlusButton label="Sotuv qo'shish" href="/sales/new" />
      <DetailHead title="Sotuv № 4" />
      <Tiles>
        <Tile icon={PencilIcon} label="Tahrirlash" href="/sales/4/edit" />
        <Tile icon={PhoneIcon} label="Qo'ng'iroq" href="tel:+998911112233" />
      </Tiles>
      <Hero href="/customers" label="Mijozlar" value="3" unit="ta" />
      <StatCard href="/purchases" icon={ReceiptIcon} color="#AF52DE" title="Xaridlar" value="12" />
      <StatCard href="/tasks" icon={ReceiptIcon} color="#FF9500" title="Vazifalar" value="4" />
    </>,
  )

  expect(moves(/^Dilshod Karimov/)).toBe("nav-forward")
  expect(moves("Sotuv qo'shish")).toBe("nav-forward")
  expect(moves("Tahrirlash")).toBe("nav-forward")
  expect(moves(/^Xaridlar/)).toBe("nav-forward")
  expect(moves(/^Barcha vazifalar/)).toBe("none")
  expect(moves(/^Mijozlar/)).toBe("none")
  expect(moves(/^Vazifalar/)).toBe("none")
  // A call leaves the app: a plain link, no move.
  expect(moves("Qo'ng'iroq")).toBeNull()
})

test("the way back moves the page back, as the prototype's pop", () => {
  render(<BackLink href="/customers" label="Mijozlar" />)

  expect(moves("Mijozlar")).toBe("nav-back")
})
