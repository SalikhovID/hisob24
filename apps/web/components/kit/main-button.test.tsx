import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { expect, test, vi } from "vitest"
import { MainBar, MainButton } from "./main-button"

test("a main button that is pending is busy, keeps focus, shows it is sending and takes no press", async () => {
  const submit = vi.fn()
  const { rerender } = render(<MainButton onClick={submit}>Saqlash</MainButton>)
  const button = screen.getByRole("button", { name: "Saqlash" })
  await userEvent.click(button)
  expect(submit).toHaveBeenCalledTimes(1)

  rerender(
    <MainButton onClick={submit} pending>
      Saqlash
    </MainButton>,
  )
  expect(button).toHaveAttribute("aria-busy", "true")
  expect(button).toHaveAttribute("aria-disabled", "true")
  expect(button).not.toBeDisabled()
  expect(button).toHaveTextContent("Yuborilmoqda")
  button.focus()
  expect(button).toHaveFocus()
  await userEvent.click(button)
  expect(submit).toHaveBeenCalledTimes(1)
})

test("a main button says its variant; a bar holds the buttons under a page", () => {
  render(
    <MainBar>
      <MainButton variant="red">O&apos;chirish</MainButton>
      <MainButton variant="ghost">Bekor qilish</MainButton>
    </MainBar>,
  )
  expect(screen.getByRole("button", { name: "O'chirish" })).toHaveAttribute("data-variant", "red")
  expect(screen.getByRole("button", { name: "Bekor qilish" })).toHaveAttribute("data-variant", "ghost")
  expect(screen.getByRole("button", { name: "O'chirish" }).closest('[data-slot="main-bar"]')).toBeInTheDocument()
})

test("a main button is the prototype's glossy capsule, 54px tall; a red one the red capsule; a ghost has no fill", () => {
  render(
    <>
      <MainButton>Saqlash</MainButton>
      <MainButton variant="red">O&apos;chirish</MainButton>
      <MainButton variant="ghost">Bekor qilish</MainButton>
    </>,
  )
  const save = screen.getByRole("button", { name: "Saqlash" })
  expect(save).toHaveClass("glossy", "rounded-full", "h-[54px]")
  expect(save).not.toHaveClass("bg-primary")
  expect(screen.getByRole("button", { name: "O'chirish" })).toHaveClass("glossy-red", "rounded-full", "h-[54px]")
  const ghost = screen.getByRole("button", { name: "Bekor qilish" })
  expect(ghost).toHaveClass("h-11", "bg-transparent")
  expect(ghost).not.toHaveClass("glossy")
})
