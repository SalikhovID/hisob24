import { render, within } from "@testing-library/react"
import { expect, test } from "vitest"
import { BrandLockup, BrandMark } from "./brand-mark"

test("the brand mark is the prototype's: the white H24 on the teal square, 22px and 5px round, decoration", () => {
  const { container } = render(<BrandMark />)
  const mark = container.querySelector('[data-slot="brand-mark"]')
  expect(mark).toHaveAttribute("aria-hidden", "true")
  expect(mark).toHaveClass("bg-brand-mark", "text-white", "size-[22px]", "rounded-[5px]")
  expect(mark?.querySelector('[data-slot="logo-mark"]')).toHaveClass("text-white")
})

test("the brand's lockup is the H24 square beside Hisob24's logo, the square 28px: the logo is its one picture, named Hisob24", () => {
  const { container } = render(<BrandLockup />)
  const lockup = container.querySelector('[data-slot="brand-lockup"]')!
  expect(lockup.querySelector('[data-slot="brand-mark"]')).toHaveClass("size-7")
  expect(within(lockup as HTMLElement).getAllByRole("img")).toHaveLength(1)
  expect(within(lockup as HTMLElement).getByRole("img", { name: "Hisob24" })).toBeInTheDocument()
})
