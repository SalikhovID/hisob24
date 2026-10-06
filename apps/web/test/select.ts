import { screen, waitFor, within } from "@testing-library/react"
import type { UserEvent } from "@testing-library/user-event"
import { expect } from "vitest"

// The selects are shadcn's (Base UI): a combobox button that opens the
// options in a listbox, portaled to the body, so they are found on the
// screen, not inside the box.

// choose opens the select and picks the option by name; a choice of one
// closes the list.
export async function choose(user: UserEvent, box: HTMLElement, name: string) {
  await user.click(box)
  await user.click(await screen.findByRole("option", { name }))
  await waitFor(() => expect(screen.queryByRole("listbox")).not.toBeInTheDocument())
}

// optionsOf opens the select, reads its options' names and closes it again.
export async function optionsOf(user: UserEvent, box: HTMLElement): Promise<string[]> {
  await user.click(box)
  const list = await screen.findByRole("listbox")
  const names = within(list)
    .getAllByRole("option")
    .map((option) => option.textContent ?? "")
  await user.keyboard("{Escape}")
  await waitFor(() => expect(screen.queryByRole("listbox")).not.toBeInTheDocument())
  return names
}
