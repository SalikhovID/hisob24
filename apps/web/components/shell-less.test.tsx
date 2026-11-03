import { render, screen } from "@testing-library/react"
import { expect, test } from "vitest"
import { ShellLess } from "./shell-less"

test("a screen without a shell is headed by the brand's lockup, in the middle of its column; the splash's goes without it", () => {
  const { container, rerender } = render(<ShellLess>Matn</ShellLess>)
  const lockup = container.querySelector('[data-slot="brand-lockup"]')
  expect(lockup).toHaveClass("mx-auto")
  expect(screen.getByRole("img", { name: "Hisob24" })).toBeInTheDocument()

  rerender(<ShellLess logo={false}>Matn</ShellLess>)
  expect(container.querySelector('[data-slot="brand-lockup"]')).toBeNull()
})

test("the lockup may stand at the column's left, a back link over it", () => {
  const { container } = render(
    <ShellLess start head={<a href="/profile">Profil</a>}>
      Matn
    </ShellLess>,
  )
  const lockup = container.querySelector('[data-slot="brand-lockup"]')!
  expect(lockup).toHaveClass("self-start")
  expect(screen.getByRole("link", { name: "Profil" }).compareDocumentPosition(lockup) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
})

test("on a wide screen the screen is a card in the middle of the pale grey page, as the login's; on a phone its column is the screen", () => {
  render(<ShellLess>Matn</ShellLess>)
  const main = screen.getByRole("main")
  expect(main).toHaveClass("min-h-svh", "max-w-md", "md:min-h-0", "md:rounded-xl", "md:bg-card", "md:p-8")
  expect(main.parentElement).toHaveClass("md:bg-sidebar", "md:items-center", "md:justify-center")
})
