import { render, screen } from "@testing-library/react"
import { expect, test } from "vitest"
import { identityOf } from "@/test/identity"
import { Identity } from "./identity"

test("Identity is a title over a subtitle, beside the avatar of the title", () => {
  const { container } = render(<Identity title="Ali Valiyev" subtitle="+998 90 123 45 67" seed="998901234567" />)

  expect(identityOf(container)).toEqual(["Ali Valiyev", "+998 90 123 45 67"])
  expect(screen.getByText("AV")).toHaveAttribute("aria-hidden", "true")
})

test("Identity without a subtitle has one line; with no name behind the title, the avatar shows an icon", () => {
  const { container } = render(<Identity title="+998 94 444 55 66" name={null} seed="998944445566" />)

  expect(identityOf(container)).toEqual(["+998 94 444 55 66", null])
  expect(container.querySelector('[data-slot="avatar"]')).toHaveTextContent("")
})

test("Identity links by its title alone", () => {
  render(<Identity title="Olma Savdo" subtitle="Yaratilgan 11.09.2026" seed={1} href="/companies/1" />)

  expect(screen.getByRole("link", { name: "Olma Savdo" })).toHaveAttribute("href", "/companies/1")
  expect(screen.getAllByRole("link")).toHaveLength(1)
})

test("Identity carries a mark beside its title, apart from the title and its link", () => {
  const { container } = render(
    <Identity
      title="Ali Valiyev"
      subtitle="+998 90 123 45 67"
      seed="998901234567"
      href="/members/1"
      mark={<span>Siz</span>}
    />,
  )

  const mark = screen.getByText("Siz")
  expect(container.querySelector('[data-slot="identity"]')).toContainElement(mark)
  // The title stays the name alone, and so does the link's name.
  expect(identityOf(container)).toEqual(["Ali Valiyev", "+998 90 123 45 67"])
  expect(screen.getByRole("link", { name: "Ali Valiyev" })).not.toContainElement(mark)
})
