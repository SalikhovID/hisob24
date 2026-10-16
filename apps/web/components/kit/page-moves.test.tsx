import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { PencilIcon, ReceiptIcon } from "lucide-react"
import type { ComponentProps } from "react"
import { expect, test, vi } from "vitest"
import { moved } from "@/test/moves"
import { DetailHead, Tile, Tiles } from "./detail-head"
import { Group, Row } from "./group"
import { Hero } from "./hero"
import { BackLink, PlusButton } from "./page-title"
import { StatCard } from "./stat-card"

// next/link as far as the moves go: a link that runs its click and stays.
vi.mock("next/link", () => ({
  default: ({ onClick, ...props }: ComponentProps<"a">) => (
    <a
      {...props}
      onClick={(event) => {
        onClick?.(event)
        event.preventDefault()
      }}
    />
  ),
}))

// moveOf is the move a click on the link takes, from a stale one.
async function moveOf(name: string | RegExp) {
  document.documentElement.dataset.move = "stale"
  await userEvent.setup().click(screen.getByRole("link", { name }))
  return moved()
}

test("the kit's ways into a record move the page forward, as the prototype's push; a way to a section's own page switches to it without a move, as its openSection", async () => {
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
      </Tiles>
      <Hero href="/customers" label="Mijozlar" value="3" unit="ta" />
      <StatCard href="/purchases" icon={ReceiptIcon} title="Xaridlar" value="12" />
      <StatCard href="/tasks" icon={ReceiptIcon} title="Vazifalar" value="4" />
    </>,
  )

  expect(await moveOf(/^Dilshod Karimov/)).toBe("forward")
  expect(await moveOf("Sotuv qo'shish")).toBe("forward")
  expect(await moveOf("Tahrirlash")).toBe("forward")
  expect(await moveOf(/^Xaridlar/)).toBe("forward")
  expect(await moveOf(/^Barcha vazifalar/)).toBeUndefined()
  expect(await moveOf(/^Mijozlar/)).toBeUndefined()
  expect(await moveOf(/^Vazifalar/)).toBeUndefined()
})

test("the way back moves the page back, as the prototype's pop", async () => {
  render(<BackLink href="/customers" label="Mijozlar" />)

  expect(await moveOf("Mijozlar")).toBe("back")
})
