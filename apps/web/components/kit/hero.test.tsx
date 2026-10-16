import { render, screen } from "@testing-library/react"
import { expect, test } from "vitest"
import { Badge } from "@/components/ui/badge"
import { Hero } from "./hero"

test("a hero is the page's one figure under its label, with badges under it; with a way in it is a link", () => {
  render(<Hero href="/suppliers" label="Ta'minotchilarga qarz" value="1250000.00" unit="so'm" badges={<span>3 ta ta&apos;minotchi</span>} />)
  const hero = screen.getByRole("link", { name: /Ta'minotchilarga qarz/ })
  expect(hero).toHaveTextContent("1 250 000 so'm")
  expect(hero).toHaveTextContent("3 ta ta'minotchi")
})

test("a hero with no way in is a plain block", () => {
  render(<Hero label="Mijozlar" value="10" unit="ta" />)
  expect(screen.queryByRole("link")).not.toBeInTheDocument()
  expect(screen.queryByRole("button")).not.toBeInTheDocument()
  expect(screen.getByText("Mijozlar")).toBeInTheDocument()
})

test("a hero's label may be the page's heading: a document's page opens with it", () => {
  render(<Hero heading label="Xarid № 3" value="20001.50" unit="so'm" />)
  expect(screen.getByRole("heading", { level: 1, name: "Xarid № 3" })).toBeInTheDocument()
})

test("a hero's badges are the prototype's larger pills: 26px tall, 11px aside, in 14px", () => {
  render(<Hero label="Xarid № 3" value="10" unit="so'm" badges={<Badge variant="red">Qoldi 5</Badge>} />)
  expect(screen.getByText("Qoldi 5").closest('[data-slot="hero-badges"]')).toHaveClass(
    "[&_[data-slot=badge]]:h-[26px]",
    "[&_[data-slot=badge]]:px-[11px]",
    "[&_[data-slot=badge]]:text-sm",
  )
})

test("a hero is the prototype's card of frosted glass: 30px round, its label, figure and badges at the left", () => {
  render(<Hero href="/suppliers" label="Ta'minotchilarga qarz" value="1250000.00" unit="so'm" badges={<Badge variant="red">3 ta</Badge>} />)
  const hero = screen.getByRole("link", { name: /Ta'minotchilarga qarz/ })
  expect(hero).toHaveClass("surface", "rounded-[30px]", "text-left")
  expect(hero).not.toHaveClass("text-center")
  // Its label is the hint's: 16px, not bold.
  expect(hero.querySelector('[data-slot="hero-label"]')).toHaveClass("text-[16px]", "font-medium", "text-muted-foreground")
  expect(hero.querySelector('[data-slot="hero-badges"]')).toHaveClass("justify-start")
})

test("on a wide screen a hero's figure is larger, 72px and 48px for its decimals", () => {
  render(<Hero label="Mijozlar" value="10" unit="ta" />)
  expect(screen.getByText("Mijozlar").closest('[data-slot="hero"]')).toHaveClass("md:[--amount-big:72px]", "md:[--amount-small:48px]")
})

test("a debt's label keeps its red, an advance's its green", () => {
  render(
    <>
      <Hero label="Qarz" tone="red" value="10" unit="so'm" />
      <Hero label="Avans" tone="green" value="10" unit="so'm" />
    </>,
  )
  expect(screen.getByText("Qarz")).toHaveClass("text-destructive")
  expect(screen.getByText("Qarz")).not.toHaveClass("text-muted-foreground")
  expect(screen.getByText("Avans")).toHaveClass("text-positive")
})
