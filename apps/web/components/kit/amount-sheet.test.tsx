import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { expect, test, vi } from "vitest"
import { AmountSheet, amountToDecimal, decimalToTyped, Keypad, nextAmount } from "./amount-sheet"

test("the keys build an amount: at most eleven whole digits, two decimals, one comma, no leading zero", () => {
  expect(nextAmount("", "0")).toBe("0")
  expect(nextAmount("0", "5")).toBe("5")
  expect(nextAmount("5", ",")).toBe("5,")
  expect(nextAmount("5,", ",")).toBe("5,")
  expect(nextAmount("5,", "2")).toBe("5,2")
  expect(nextAmount("5,25", "9")).toBe("5,25")
  expect(nextAmount("", ",")).toBe("0,")
  expect(nextAmount("12345678901", "2")).toBe("12345678901")
  expect(nextAmount("5,2", "del")).toBe("5,")
  expect(amountToDecimal("1250,5")).toBe("1250.5")
  expect(amountToDecimal("")).toBe("")
})

test("the sheet shows the amount as typed on the keypad and hands it over", async () => {
  const change = vi.fn()
  const submit = vi.fn()
  render(
    <AmountSheet
      open
      onOpenChange={() => {}}
      title="To'lov qo'shish"
      subtitle="Agro Fresh MChJ"
      value=""
      onChange={change}
      hint="Qarz: 300 000 so'm"
      submitLabel="Qo'shish"
      onSubmit={submit}
      pending={false}
    />,
  )
  expect(await screen.findByRole("dialog", { name: "To'lov qo'shish" })).toBeInTheDocument()
  const keys = screen.getByRole("group", { name: "Raqamlar" })
  await userEvent.click(screen.getByRole("button", { name: "1" }))
  expect(change).toHaveBeenLastCalledWith("1")
  expect(keys.querySelector('[aria-label="O\'chirish"]')).toBeInTheDocument()
  await userEvent.click(screen.getByRole("button", { name: "Qo'shish" }))
  expect(submit).toHaveBeenCalledTimes(1)
})

test("a «To'liq» offer fills the whole debt; an error is said under the amount", async () => {
  const full = vi.fn()
  render(
    <AmountSheet open onOpenChange={() => {}} title="To'lov" value="" onChange={() => {}} onFull={full} error="Summani kiriting" submitLabel="Qo'shish" onSubmit={() => {}} pending={false} />,
  )
  await userEvent.click(screen.getByRole("button", { name: "To'liq" }))
  expect(full).toHaveBeenCalledTimes(1)
  expect(screen.getByRole("alert")).toHaveTextContent("Summani kiriting")
})

test("an amount as the API writes it is typed back the keypad's way: a comma, no trailing zeros", () => {
  expect(decimalToTyped("1200.50")).toBe("1200,5")
  expect(decimalToTyped("1500.00")).toBe("1500")
  expect(decimalToTyped("0.05")).toBe("0,05")
  expect(decimalToTyped("700")).toBe("700")
  expect(decimalToTyped("")).toBe("")
})

test("a digit key is frosted glass, its corners 18px; the comma and delete have no fill", () => {
  render(<Keypad onKey={() => {}} />)
  const one = screen.getByRole("button", { name: "1" })
  expect(one).toHaveClass("surface", "rounded-[18px]")
  expect(one).not.toHaveClass("bg-sheet-cell")
  expect(screen.getByRole("button", { name: "vergul" })).not.toHaveClass("surface")
})
