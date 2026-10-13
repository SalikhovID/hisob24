import { screen, waitFor, within } from "@testing-library/react"
import { expect, test, vi } from "vitest"
import { renderWithProviders } from "@/test/render"
import { DeleteButton } from "./delete-button"

test("the question is opened from outside (a danger row), with no button of its own: a yes deletes, says so and closes; then the caller goes on", async () => {
  const onDelete = vi.fn().mockResolvedValue(undefined)
  const onOpenChange = vi.fn()
  const onDone = vi.fn()
  const { user } = renderWithProviders(
    <DeleteButton
      label="O'chirish: Yuridik"
      title="Turni o'chirasizmi?"
      description="«Yuridik» turi va uning maydonlari o'chadi."
      done="Tur o'chirildi"
      onDelete={onDelete}
      open
      onOpenChange={onOpenChange}
      onDone={onDone}
    />,
  )

  const question = await screen.findByRole("alertdialog", { name: "Turni o'chirasizmi?" })
  expect(screen.queryByRole("button", { name: "O'chirish: Yuridik" })).not.toBeInTheDocument()
  await user.click(within(question).getByRole("button", { name: "O'chirish" }))

  await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false))
  expect(onDelete).toHaveBeenCalled()
  expect(onDone).toHaveBeenCalled()
  expect((await screen.findAllByText("Tur o'chirildi")).length).toBeGreaterThan(0)
})

test("a refusal is said, and the caller does not go on", async () => {
  const onOpenChange = vi.fn()
  const onDone = vi.fn()
  const { user } = renderWithProviders(
    <DeleteButton
      label="O'chirish: Yuridik"
      title="Turni o'chirasizmi?"
      description="«Yuridik» turi va uning maydonlari o'chadi."
      done="Tur o'chirildi"
      onDelete={vi.fn().mockRejectedValue(new Error("Bu turda 2 ta mijoz bor"))}
      open
      onOpenChange={onOpenChange}
      onDone={onDone}
    />,
  )

  await user.click(within(await screen.findByRole("alertdialog", { name: "Turni o'chirasizmi?" })).getByRole("button", { name: "O'chirish" }))
  expect((await screen.findAllByText("Bu turda 2 ta mijoz bor")).length).toBeGreaterThan(0)
  await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false))
  expect(onDone).not.toHaveBeenCalled()
})
