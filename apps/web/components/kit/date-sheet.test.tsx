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

test("a sheet for a span already past (a list's days) offers the past: today, yesterday, a week and a month back", async () => {
  const change = vi.fn()
  render(<DateSheet open onOpenChange={() => {}} title="Sanadan" value="" onChange={change} presets="past" />)
  const dialog = await screen.findByRole("dialog", { name: "Sanadan" })
  expect(Array.from(dialog.querySelectorAll("[data-slot=chip]"), (chip) => chip.textContent)).toEqual(["Bugun", "Kecha", "7 kun oldin", "30 kun oldin"])
  await userEvent.click(within(dialog).getByRole("button", { name: "7 kun oldin" }))
  await userEvent.click(within(dialog).getByRole("button", { name: "Tanlash" }))
  expect(change).toHaveBeenCalledWith("2026-10-06")
})

test("a sheet with a way to no day hands an empty day over and closes (a filter let go)", async () => {
  const change = vi.fn()
  const open = vi.fn()
  render(<DateSheet open onOpenChange={open} title="Sanadan" value="2026-10-03" onChange={change} presets="past" none="Hamma kunlar" />)
  const dialog = await screen.findByRole("dialog", { name: "Sanadan" })
  await userEvent.click(within(dialog).getByRole("button", { name: "Hamma kunlar" }))
  expect(change).toHaveBeenCalledWith("")
  expect(open).toHaveBeenCalledWith(false)
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

test("a date row says the day (and that it is today); a date-time row is the day's row, picked in the calendar, over the time's row", async () => {
  const submit = vi.fn()
  render(<Form onSubmit={submit} />)
  expect(screen.getByRole("button", { name: "Muddat 13.10.2026 · bugun" })).toBeInTheDocument()
  // A document's day goes without «· bugun»: it starts as today anyway, and
  // the row stays short enough for a sheet on a phone.
  await userEvent.click(screen.getByRole("button", { name: "Sana 13.10.2026" }))
  const sheet = await screen.findByRole("dialog", { name: "Sana" })
  await userEvent.click(within(sheet).getByRole("button", { name: "15.10.2026" }))
  await userEvent.click(within(sheet).getByRole("button", { name: "Tanlash" }))
  expect(screen.getByRole("button", { name: "Sana 15.10.2026" })).toBeInTheDocument()
  const time = screen.getByLabelText("Vaqt")
  expect(time).toHaveValue("10:30")
  // jsdom's time input takes a whole value at once, not keystrokes.
  fireEvent.change(time, { target: { value: "18:45" } })
  await userEvent.click(screen.getByRole("button", { name: "Saqlash" }))
  expect(submit).toHaveBeenCalledWith({ deadline: "2026-10-13", at: "2026-10-15T18:45" }, expect.anything())
})
