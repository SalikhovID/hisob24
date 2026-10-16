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
