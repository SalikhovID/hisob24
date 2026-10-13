import { within } from "@testing-library/react"
import type { UserEvent } from "@testing-library/user-event"

// press types on an amount sheet's keypad (components/kit/amount-sheet.tsx)
// within scope: a comma is «vergul», "<" a step back («O'chirish»).
export async function press(user: UserEvent, scope: HTMLElement, keys: string) {
  const keypad = within(scope).getByRole("group", { name: "Raqamlar" })
  for (const key of keys) {
    await user.click(within(keypad).getByRole("button", { name: key === "," ? "vergul" : key === "<" ? "O'chirish" : key }))
  }
}
