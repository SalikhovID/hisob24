import { act, render, screen } from "@testing-library/react"
import { expect, test } from "vitest"
import { ActionTooltip } from "./action-tooltip"

test("an icon action says what it does when focused, and keeps its own name", async () => {
  render(
    <ActionTooltip label="O'chirish">
      <button type="button" aria-label="O'chirish: Vali Aliyev" />
    </ActionTooltip>,
  )
  const button = screen.getByRole("button", { name: "O'chirish: Vali Aliyev" })
  expect(screen.queryByText("O'chirish")).not.toBeInTheDocument()

  act(() => button.focus())

  expect(await screen.findByText("O'chirish")).toBeInTheDocument()
  expect(screen.getByRole("button", { name: "O'chirish: Vali Aliyev" })).toBe(button)
})
