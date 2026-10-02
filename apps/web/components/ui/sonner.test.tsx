import { render, screen } from "@testing-library/react"
import { expect, test } from "vitest"
import { Toaster } from "./sonner"

// The interface speaks Uzbek, to screen readers too: sonner's own name for
// the toasts' region is English.
test("the toasts' region is named in Uzbek", () => {
  render(<Toaster />)

  expect(screen.getByRole("region", { name: /^Bildirishnomalar/ })).toBeInTheDocument()
})
