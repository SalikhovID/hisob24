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

test("a bar under a page fades the page into the prototype's fade, half its height; in a sheet, into the sheet", () => {
  const { rerender } = render(
    <MainBar>
      <MainButton>Saqlash</MainButton>
    </MainBar>,
  )
  const bar = () => screen.getByRole("button", { name: "Saqlash" }).closest('[data-slot="main-bar"]')
  expect(bar()).toHaveClass("from-(--fade)", "from-55%")
  expect(bar()).not.toHaveClass("from-background")

  rerender(
    <MainBar tone="sheet">
      <MainButton>Saqlash</MainButton>
    </MainBar>,
  )
  expect(bar()).toHaveClass("from-sheet")
})

test("on a wide screen a page's bar is the prototype's: its button 380px wide at the column's right, with no fade; a sheet's stays its own", () => {
  render(
    <>
      <MainBar>
        <MainButton>Saqlash</MainButton>
      </MainBar>
      <MainBar tone="sheet">
        <MainButton>Qo&apos;shish</MainButton>
      </MainBar>
    </>,
  )
  const [page, sheet] = document.querySelectorAll('[data-slot="main-bar"]')
  expect(page).toHaveClass("md:mx-0", "md:items-end", "md:px-0", "md:pb-7", "md:bg-none", "md:[&>*]:max-w-[380px]")
  expect(sheet).not.toHaveClass("md:bg-none")
})
