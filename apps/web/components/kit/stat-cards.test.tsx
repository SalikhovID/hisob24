import { render, screen, within } from "@testing-library/react"
import { expect, test } from "vitest"
import { StageBar, StatCard, StatCards } from "./stat-cards"

test("a stat card says its label, its figure and a line under it; with a way in it is a link named by them", () => {
  render(
    <StatCards>
      <StatCard label="Mijozlar qarzi" value="25 950 000 so'm" sub="5 ta mijozda" href="/customers" />
      <StatCard label="Kam qolgan tovarlar" value="1" sub="Kompressor LG" />
    </StatCards>,
  )
  const link = screen.getByRole("link", { name: /Mijozlar qarzi/ })
  expect(link).toHaveAttribute("href", "/customers")
  expect(link).toHaveTextContent("25 950 000 so'm")
  expect(link).toHaveTextContent("5 ta mijozda")
  expect(screen.getByText("Kompressor LG").closest('[data-slot="stat-card"]')?.tagName).toBe("DIV")
})

test("the cards stand two to a row on a phone and four on the web; three of them a row of three", () => {
  const { rerender } = render(
    <StatCards>
      <StatCard label="A" value="1" />
    </StatCards>,
  )
  expect(document.querySelector('[data-slot="stat-cards"]')).toHaveClass("grid-cols-2", "md:grid-cols-4")
  rerender(
    <StatCards three>
      <StatCard label="A" value="1" />
    </StatCards>,
  )
  expect(document.querySelector('[data-slot="stat-cards"]')).toHaveClass("grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_minmax(0,1fr)]", "md:grid-cols-3")
})

test("a stat card is the prototype's flat card: its label grey, its figure semibold, a debt in red", () => {
  render(
    <StatCards>
      <StatCard label="Balans" value="Qarz 900 000 so'm" tone="red" />
    </StatCards>,
  )
  const card = screen.getByText("Balans").closest('[data-slot="stat-card"]')
  expect(card).toHaveClass("surface", "rounded-group", "md:rounded-lg")
  expect(screen.getByText("Balans")).toHaveClass("text-muted-foreground")
  expect(screen.getByText("Qarz 900 000 so'm")).toHaveClass("font-semibold", "text-destructive")
})

test("a stage bar is one image named with every stage's count, its legend the stages' dots, names and counts", () => {
  render(
    <StageBar
      label="Faol buyurtmalar"
      stages={[
        { name: "Yangi", color: "#3b82f6", count: 2 },
        { name: "Jarayonda", color: "#e8a23a", count: 0 },
        { name: "Tayyor", color: "#8b5cf6", count: 2 },
      ]}
    />,
  )
  const bar = screen.getByRole("img", { name: "Faol buyurtmalar: Yangi 2, Jarayonda 0, Tayyor 2" })
  // A stage with none takes no room on the bar; the legend names every stage.
  expect(bar.querySelectorAll('[data-slot="stage-bar-part"]')).toHaveLength(2)
  const legend = screen.getByText("Yangi 2").closest('[data-slot="stage-legend"]') as HTMLElement
  expect(within(legend).getByText("Jarayonda 0")).toBeInTheDocument()
})
