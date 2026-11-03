import { render, screen } from "@testing-library/react"
import { expect, test } from "vitest"
import { Badge } from "./badge"

test("a badge is neutral unless told, and says its variant for the styles", () => {
  const { rerender } = render(<Badge>Xodim</Badge>)
  expect(screen.getByText("Xodim")).toHaveAttribute("data-variant", "neutral")

  rerender(<Badge variant="red">Muddati o&apos;tgan</Badge>)
  expect(screen.getByText("Muddati o'tgan")).toHaveAttribute("data-variant", "red")
})

test("a badge may lead with a dot, which is decoration", () => {
  render(
    <Badge variant="accent" dot>
      Egasi
    </Badge>,
  )
  const badge = screen.getByText("Egasi")
  const dot = badge.querySelector('[data-slot="badge-dot"]')
  expect(dot).toHaveAttribute("aria-hidden", "true")
  expect(badge).toHaveTextContent(/^Egasi$/)
})

test("the names from before still work, for the pages not yet moved over", () => {
  render(<Badge variant="secondary">Jismoniy</Badge>)
  expect(screen.getByText("Jismoniy")).toHaveAttribute("data-variant", "secondary")
})

test("a badge is the prototype's pill: 24px and 13px on a phone, 20px and 11.5px on the web; neutral is the ink on a faint fill", () => {
  render(<Badge>Nofaol</Badge>)
  const badge = screen.getByText("Nofaol")
  expect(badge).toHaveAttribute("data-slot", "badge")
  expect(badge).toHaveClass("rounded-badge", "h-6", "px-2.5", "text-[13px]", "md:h-5", "md:px-2", "md:text-[11.5px]", "bg-ink-2", "text-foreground")
})

test("a badge's dot is the prototype's 6px one, in the color it is given (a stage's)", () => {
  render(
    <Badge dot dotColor="#e8a23a">
      Jarayonda
    </Badge>,
  )
  const dot = screen.getByText("Jarayonda").querySelector('[data-slot="badge-dot"]') as HTMLElement
  expect(dot).toHaveClass("size-1.5")
  expect(dot.style.background).toBe("rgb(232, 162, 58)")
})
