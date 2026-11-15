import { screen, within } from "@testing-library/react"
import type { UserEvent } from "@testing-library/user-event"

// A document's currency is chosen by the buttons of its codes (UZS / USD):
// radios on the segmented control «Valyuta».

// currencyGroup is the form's «Valyuta», once it is there.
export const currencyGroup = () => screen.findByRole("radiogroup", { name: "Valyuta" })

// chooseCurrency presses the button of the currency's code.
export async function chooseCurrency(user: UserEvent, code: string) {
  await user.click(within(await currencyGroup()).getByRole("radio", { name: code }))
}
