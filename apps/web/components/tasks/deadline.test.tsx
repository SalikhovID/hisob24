import { render, screen } from "@testing-library/react"
import { expect, test } from "vitest"
import { addDays, localToday } from "@/mocks/data"
import { formatDate } from "@/lib/format"
import { Deadline } from "./deadline"

const today = localToday()

test("a deadline shows its day and how far off it is", () => {
  render(<Deadline value={addDays(today, 3)} done={false} />)

  expect(screen.getByText(formatDate(addDays(today, 3)))).toBeInTheDocument()
  expect(screen.getByText("3 kun qoldi")).toBeInTheDocument()
  expect(screen.getByText(formatDate(addDays(today, 3))).closest("[data-slot=deadline]")).not.toHaveClass("text-destructive")
})

test("a deadline that is past, on a task not done, is late and marked so", () => {
  render(<Deadline value={addDays(today, -2)} done={false} />)

  expect(screen.getByText("2 kun kechikdi")).toBeInTheDocument()
  expect(screen.getByText(formatDate(addDays(today, -2))).closest("[data-slot=deadline]")).toHaveClass("text-destructive")
})

test("today is today", () => {
  render(<Deadline value={today} done={false} />)

  expect(screen.getByText("Bugun")).toBeInTheDocument()
})

test("in a done stage the day is all that is said, however late", () => {
  render(<Deadline value={addDays(today, -5)} done />)

  expect(screen.getByText(formatDate(addDays(today, -5)))).toBeInTheDocument()
  expect(screen.queryByText(/kechikdi/)).not.toBeInTheDocument()
  expect(screen.getByText(formatDate(addDays(today, -5))).closest("[data-slot=deadline]")).not.toHaveClass("text-destructive")
})
