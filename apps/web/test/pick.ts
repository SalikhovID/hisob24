import { screen, waitFor, within } from "@testing-library/react"
import type { UserEvent } from "@testing-library/user-event"
import { expect } from "vitest"

// pick takes a record in a search picker (components/warehouse/pickers.tsx):
// it opens the row by its label within scope, types in the sheet's search
// when told, and takes the option whose name matches.
export async function pick(user: UserEvent, scope: HTMLElement, label: string, typed: string, option: RegExp) {
  await user.click(within(scope).getByRole("button", { name: new RegExp(`^${label}`) }))
  const sheet = await screen.findByRole("dialog", { name: label })
  if (typed) await user.type(within(sheet).getByRole("searchbox"), typed)
  await user.click(await within(sheet).findByRole("option", { name: option }))
  await waitFor(() => expect(screen.queryByRole("dialog", { name: label })).not.toBeInTheDocument())
}
