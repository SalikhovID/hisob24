import { render, screen } from "@testing-library/react"
import { expect, test } from "vitest"
import { WalletIcon } from "lucide-react"
import Link from "next/link"
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

test("a hero is the prototype's card: its label grey with its icon, a link at its right, the figure, a line under it", () => {
  render(
    <Hero
      label="Kassadagi pul"
      icon={WalletIcon}
      action={<Link href="/accounts">Kassa →</Link>}
      value="37820000.00"
      unit="so'm"
      sub="+ $1,550 · 4 ta akkaunt"
    />,
  )
  const hero = screen.getByText("Kassadagi pul").closest('[data-slot="hero"]') as HTMLElement
  expect(hero).toHaveClass("surface", "rounded-group", "md:rounded-lg", "text-left")
  expect(hero.querySelector('[data-slot="hero-label"]')).toHaveClass("text-md", "md:text-[12.5px]", "text-muted-foreground")
  expect(hero.querySelector('[data-slot="hero-label"] svg')).toBeInTheDocument()
  expect(screen.getByRole("link", { name: "Kassa →" }).parentElement).toHaveAttribute("data-slot", "hero-action")
  expect(screen.getByText("+ $1,550 · 4 ta akkaunt")).toHaveAttribute("data-slot", "hero-sub")
})

test("a hero's figure is the prototype's: 34px on a phone, 32px on the web, the unit 18px", () => {
  render(<Hero label="Mijozlar" value="10" unit="ta" />)
  expect(screen.getByText("Mijozlar").closest('[data-slot="hero"]')).toHaveClass("[--amount-big:34px]", "md:[--amount-big:32px]", "[--amount-unit:18px]")
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

test("a plain hero is the figure alone in the middle, no card (a product's price, a balance), as the prototype's", () => {
  render(<Hero plain label="Sotuv narxi" value="12000" unit="so'm" badges={<span>shu jumladan 5 $</span>} />)
  const hero = screen.getByText("Sotuv narxi").closest('[data-slot="hero"]')
  expect(hero).toHaveClass("text-center")
  expect(hero).not.toHaveClass("surface")
  expect(hero).not.toHaveClass("rounded-[30px]")
  expect(hero?.querySelector('[data-slot="hero-badges"]')).toHaveClass("justify-center")
})
