import { fireEvent, render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { useForm } from "react-hook-form"
import { afterEach, beforeEach, expect, test, vi } from "vitest"
import { addDays, DateRow, DateSheet, DateTimeRow, monthGrid } from "./date-sheet"

beforeEach(() => vi.setSystemTime(new Date("2026-10-13T09:00:00+05:00")))
afterEach(() => vi.useRealTimers())

test("a month's grid starts on Monday, with blanks before the first day", () => {
  // October 2026 starts on a Thursday: three blanks, then 31 days.
  const grid = monthGrid(2026, 10)
  expect(grid.slice(0, 4)).toEqual([null, null, null, "2026-10-01"])
  expect(grid.filter(Boolean)).toHaveLength(31)
  expect(addDays("2026-10-30", 3)).toBe("2026-11-02")
})

test("the calendar shows the month of the value, marks today and the value, and hands the pressed day over on «Tanlash»", async () => {
  const change = vi.fn()
  const open = vi.fn()
  render(<DateSheet open onOpenChange={open} title="Muddat" value="2026-10-20" onChange={change} />)
  const dialog = await screen.findByRole("dialog", { name: "Muddat" })
  expect(within(dialog).getByText("oktabr 2026")).toBeInTheDocument()
  expect(within(dialog).getByRole("button", { name: "13.10.2026" })).toHaveAttribute("data-today", "true")
  expect(within(dialog).getByRole("button", { name: "20.10.2026" })).toHaveAttribute("aria-pressed", "true")
  await userEvent.click(within(dialog).getByRole("button", { name: "Keyingi oy" }))
  expect(within(dialog).getByText("noyabr 2026")).toBeInTheDocument()
  await userEvent.click(within(dialog).getByRole("button", { name: "05.11.2026" }))
  await userEvent.click(within(dialog).getByRole("button", { name: "Tanlash" }))
  expect(change).toHaveBeenCalledWith("2026-11-05")
  expect(open).toHaveBeenCalledWith(false)
})

test("the presets jump: tomorrow is the day after today", async () => {
  const change = vi.fn()
  render(<DateSheet open onOpenChange={() => {}} value="" onChange={change} />)
  await userEvent.click(screen.getByRole("button", { name: "Ertaga" }))
  await userEvent.click(screen.getByRole("button", { name: "Tanlash" }))
  expect(change).toHaveBeenCalledWith("2026-10-14")
})

function Form({ onSubmit }: { onSubmit: (values: { deadline: string; at: string }) => void }) {
  const form = useForm<{ deadline: string; at: string }>({ defaultValues: { deadline: "2026-10-13", at: "2026-10-13T10:30" } })
  return (
    <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
      <DateRow control={form.control} name="deadline" label="Muddat" />
      <DateTimeRow control={form.control} name="at" label="Vaqt" />
      <button type="submit">Saqlash</button>
    </form>
  )
}

test("a date row says the day (and that it is today); a date-time row keeps the time beside the day", async () => {
  const submit = vi.fn()
  render(<Form onSubmit={submit} />)
  expect(screen.getByRole("button", { name: "Muddat 13.10.2026 · bugun" })).toBeInTheDocument()
  await userEvent.click(screen.getByRole("button", { name: /^Vaqt/ }))
  await userEvent.click(await screen.findByRole("button", { name: "15.10.2026" }))
  await userEvent.click(screen.getByRole("button", { name: "Tanlash" }))
  const time = screen.getByLabelText("Vaqt: soat")
  expect(time).toHaveValue("10:30")
  // jsdom's time input takes a whole value at once, not keystrokes.
  fireEvent.change(time, { target: { value: "18:45" } })
  await userEvent.click(screen.getByRole("button", { name: "Saqlash" }))
  expect(submit).toHaveBeenCalledWith({ deadline: "2026-10-13", at: "2026-10-15T18:45" }, expect.anything())
})
