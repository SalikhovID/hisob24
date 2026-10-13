import { screen, waitFor, within } from "@testing-library/react"
import { expect, test, vi } from "vitest"
import { renderWithProviders } from "@/test/render"
import { NameDialog } from "./name-dialog"

test("a name is asked in the prototype's sheet, opened from outside: the name a row with its example, what it is for under the title; a refusal stays in it, the caller's yes closes it with a toast", async () => {
  const onSubmit = vi.fn().mockRejectedValueOnce(new Error("Bu nomli tur allaqachon bor")).mockResolvedValue(undefined)
  const onOpenChange = vi.fn()
  const { user } = renderWithProviders(
    <NameDialog
      title="Tur qo'shish"
      description="Masalan: Jismoniy, Yuridik."
      placeholder="Masalan, Yuridik"
      submit="Qo'shish"
      done="Tur qo'shildi"
      open
      onOpenChange={onOpenChange}
      onSubmit={onSubmit}
    />,
  )

  const sheet = await screen.findByRole("dialog", { name: "Tur qo'shish" })
  expect(sheet).toHaveAccessibleDescription("Masalan: Jismoniy, Yuridik.")
  const name = within(sheet).getByLabelText("Nomi")
  expect(name).toHaveAttribute("placeholder", "Masalan, Yuridik")
  expect(name.closest("[data-slot=form-row]")).not.toBeNull()
  await user.click(within(sheet).getByRole("button", { name: "Qo'shish" }))
  expect(await within(sheet).findByText("Nomni kiriting")).toBeInTheDocument()
  expect(onSubmit).not.toHaveBeenCalled()

  await user.type(name, " Yuridik ")
  await user.click(within(sheet).getByRole("button", { name: "Qo'shish" }))
  expect(await within(sheet).findByText("Bu nomli tur allaqachon bor")).toBeInTheDocument()
  expect(onOpenChange).not.toHaveBeenCalledWith(false)

  await user.click(within(sheet).getByRole("button", { name: "Qo'shish" }))
  await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false))
  expect(onSubmit).toHaveBeenLastCalledWith("Yuridik")
  expect((await screen.findAllByText("Tur qo'shildi")).length).toBeGreaterThan(0)
})
