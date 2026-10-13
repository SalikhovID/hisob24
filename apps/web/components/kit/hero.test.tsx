import { render, screen } from "@testing-library/react"
import { expect, test } from "vitest"
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
