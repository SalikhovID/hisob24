import { render, screen } from "@testing-library/react"
import { CheckIcon } from "lucide-react"
import { expect, test } from "vitest"
import { Bars, Sparkline, StatCard } from "./stat-card"

test("a stat card is the way to its section, named by its title and figure", () => {
  render(
    <StatCard
      href="/orders"
      icon={CheckIcon}
      title="Buyurtmalar"
      value="12"
      unit="ta faol"
      meta={<span>2 kechikkan</span>}
      chart={<Sparkline values={[1, 3, 2]} />}
    />,
  )
  const card = screen.getByRole("link", { name: /Buyurtmalar/ })
  expect(card).toHaveAttribute("href", "/orders")
  expect(card).toHaveTextContent("12")
  expect(card).toHaveTextContent("ta faol")
  expect(card.querySelector('[data-slot="sparkline"]')).toHaveAttribute("aria-hidden", "true")
})

test("the bars say their figures in words, tallest for the largest", () => {
  const { container } = render(
    <Bars
      label="Bosqichlar bo'yicha"
      items={[
        { label: "Yangi", value: 4, color: "#007AFF" },
        { label: "Jarayonda", value: 2, color: "#FF9500" },
      ]}
    />,
  )
  expect(screen.getByRole("img", { name: "Bosqichlar bo'yicha: Yangi 4, Jarayonda 2" })).toBeInTheDocument()
  const bars = container.querySelectorAll<HTMLElement>('[data-slot="bar"]')
  expect(bars[0].style.height).toBe("100%")
  expect(bars[1].style.height).toBe("50%")
})

test("a sparkline is one path over its values", () => {
  const { container } = render(<Sparkline values={[0, 5, 3, 8]} />)
  const paths = container.querySelectorAll("path")
  expect(paths).toHaveLength(2)
  expect(paths[1].getAttribute("d")).toMatch(/^M0\.0,/)
})

// pairs reads a path's coordinates, its curves' handles too, as [x, y].
const pairs = (d: string) => [...d.matchAll(/(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/g)].map((m) => [Number(m[1]), Number(m[2])])

test("a month with nothing but today neither dips under the sparkline's foot nor runs off the card: it rises short of the edge and goes on level to it", () => {
  const { container } = render(<Sparkline values={[...Array(17).fill(0), 50000]} />)
  const points = pairs(container.querySelectorAll("path")[1].getAttribute("d")!)

  // The foot is 70 of the 78 high, the top 12.8.
  for (const [, y] of points) {
    expect(y).toBeLessThanOrEqual(70)
    expect(y).toBeGreaterThanOrEqual(12.8)
  }
  const [edgeX, edgeY] = points.at(-1)!
  const [todayX, todayY] = points.at(-2)!
  expect(edgeX).toBe(160)
  expect(todayX).toBeLessThan(150)
  expect(edgeY).toBe(todayY)
})

test("a stat card is frosted glass, its section's mark the icon on the plain fill, in the text's ink", () => {
  render(<StatCard href="/orders" icon={CheckIcon} title="Buyurtmalar" value="12" />)
  const card = screen.getByRole("link", { name: /Buyurtmalar/ })
  expect(card).toHaveClass("surface", "rounded-group")
  expect(card).not.toHaveClass("bg-card")
  const mark = card.querySelector("[aria-hidden=true]") as HTMLElement
  expect(mark).toHaveClass("bg-muted", "text-foreground")
  expect(mark).not.toHaveClass("gloss")
  expect(mark.style.background).toBe("")
})

test("a bar is its color with a light falling from its top, rounder at the top than at the foot", () => {
  const { container } = render(<Bars label="Bosqichlar bo'yicha" items={[{ label: "Yangi", value: 4, color: "#007AFF" }]} />)
  const bar = container.querySelector<HTMLElement>('[data-slot="bar"]')!
  // The color is the bar's own; the light over it comes from the class.
  expect(bar.style.backgroundColor).toBe("rgb(0, 122, 255)")
  expect(bar.style.backgroundImage).toBe("")
  expect(bar).toHaveClass("bg-[linear-gradient(180deg,rgba(255,255,255,.35),rgba(255,255,255,0))]", "rounded-t-[8px]", "rounded-b-[5px]")
})
