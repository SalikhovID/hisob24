import { render, screen } from "@testing-library/react"
import { toast } from "sonner"
import { expect, test } from "vitest"
import { Toaster } from "./sonner"

// The interface speaks Uzbek, to screen readers too: sonner's own name for
// the toasts' region is English.
test("the toasts' region is named in Uzbek", () => {
  render(<Toaster />)

  expect(screen.getByRole("region", { name: /^Bildirishnomalar/ })).toBeInTheDocument()
})

// In a Mini App opened full screen the toasts, at the top, would come down
// under Telegram's controls: their offset grows by --safe-top (globals.css),
// which is 0 anywhere else.
test("the toasts keep clear of what Telegram lays over a full-screen Mini App", async () => {
  render(<Toaster position="top-center" />)
  toast("Saqlandi")
  await screen.findByText("Saqlandi")

  // The list of toasts is drawn once there is one; its offsets are inline.
  const toaster = document.querySelector<HTMLElement>("[data-sonner-toaster]")
  expect(toaster?.style.getPropertyValue("--offset-top")).toBe("calc(24px + var(--safe-top))")
  expect(toaster?.style.getPropertyValue("--mobile-offset-top")).toBe("calc(16px + var(--safe-top))")
})
