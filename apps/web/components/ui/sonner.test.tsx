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

// The toasts are the prototype's: at the bottom of the screen, on a phone
// over the floating tab bar (108px up, plus the phone's bottom edge), on the
// web 24px from the bottom; the ink's pill with the page's color in it.
test("the toasts stand at the bottom: over the tab bar on a phone, 24px up on the web", async () => {
  render(<Toaster />)
  toast("Saqlandi")
  await screen.findByText("Saqlandi")

  // The list of toasts is drawn once there is one; its offsets are inline.
  const toaster = document.querySelector<HTMLElement>("[data-sonner-toaster]")
  expect(toaster).toHaveAttribute("data-y-position", "bottom")
  expect(toaster?.style.getPropertyValue("--offset-bottom")).toBe("24px")
  expect(toaster?.style.getPropertyValue("--mobile-offset-bottom")).toBe("calc(108px + max(env(safe-area-inset-bottom), var(--tg-safe-area-inset-bottom, 0px)))")
  expect(toaster?.style.getPropertyValue("--normal-bg")).toBe("var(--foreground)")
})
