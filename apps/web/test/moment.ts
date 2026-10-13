import { screen, within } from "@testing-library/react"
import type { UserEvent } from "@testing-library/user-event"
import { MONTHS } from "@/lib/format"

// momentIn reads a date-time row (components/kit/date-sheet.tsx) back as a
// datetime-local value, YYYY-MM-DDTHH:mm: the day its «Sana» row says, the
// time typed in the row under it.
export function momentIn(scope: HTMLElement, label = "Vaqt"): string {
  const shown = within(scope).getByRole("button", { name: /^Sana/ }).querySelector("[data-slot=pick-value]")?.textContent ?? ""
  const [day, month, year] = shown.slice(0, 10).split(".")
  const time = (within(scope).getByLabelText(label) as HTMLInputElement).value
  return `${year}-${month}-${day}T${time}`
}

// pickDay picks a day (YYYY-MM-DD) for a date-time row in its calendar
// sheet: the sheet is paged to the day's month, the day pressed, «Tanlash».
export async function pickDay(user: UserEvent, scope: HTMLElement, day: string) {
  await user.click(within(scope).getByRole("button", { name: /^Sana/ }))
  const sheet = await screen.findByRole("dialog", { name: "Sana" })
  const [year, month, date] = day.split("-").map(Number)
  const heading = () => {
    const [name, shownYear] = (sheet.querySelector("[data-slot=calendar] b")?.textContent ?? "").split(" ")
    return Number(shownYear) * 12 + MONTHS.indexOf(name)
  }
  const target = year * 12 + month - 1
  while (heading() !== target) {
    await user.click(within(sheet).getByRole("button", { name: heading() > target ? "Oldingi oy" : "Keyingi oy" }))
  }
  await user.click(within(sheet).getByRole("button", { name: `${String(date).padStart(2, "0")}.${String(month).padStart(2, "0")}.${year}` }))
  await user.click(within(sheet).getByRole("button", { name: "Tanlash" }))
}
