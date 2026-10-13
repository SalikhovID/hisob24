"use client"

import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react"
import { useId, useState } from "react"
import { type Control, Controller, type FieldPath, type FieldValues } from "react-hook-form"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { formatDate } from "@/lib/format"
import { cn } from "@/lib/utils"
import { Chip, Chips } from "./chips"
import { PickRow } from "./form-row"
import { MainButton } from "./main-button"

export const MONTHS = ["yanvar", "fevral", "mart", "aprel", "may", "iyun", "iyul", "avgust", "sentabr", "oktabr", "noyabr", "dekabr"]
const WEEKDAYS = ["Du", "Se", "Ch", "Pa", "Ju", "Sh", "Ya"]

const pad = (n: number) => String(n).padStart(2, "0")
const iso = (year: number, month: number, day: number) => `${year}-${pad(month)}-${pad(day)}`

// today is the day in the browser's time zone, as YYYY-MM-DD.
export function today(): string {
  const now = new Date()
  return iso(now.getFullYear(), now.getMonth() + 1, now.getDate())
}

// addDays moves a day by n days.
export function addDays(day: string, n: number): string {
  const [year, month, date] = day.split("-").map(Number)
  const moved = new Date(Date.UTC(year, month - 1, date + n))
  return iso(moved.getUTCFullYear(), moved.getUTCMonth() + 1, moved.getUTCDate())
}

// monthGrid is a month's days in seven columns from Monday: null where the
// week before the first day is blank.
export function monthGrid(year: number, month: number): (string | null)[] {
  const first = new Date(Date.UTC(year, month - 1, 1)).getUTCDay()
  const blanks = (first + 6) % 7
  const days = new Date(Date.UTC(year, month, 0)).getUTCDate()
  return [...Array.from({ length: blanks }, () => null), ...Array.from({ length: days }, (_, i) => iso(year, month, i + 1))]
}

// DateSheet is the prototype's calendar sheet: presets (today, tomorrow, in
// three days, in a week), a month to page through, the days as buttons;
// «Tanlash» hands the pressed day over and closes the sheet.
export function DateSheet({
  open,
  onOpenChange,
  title = "Sana",
  value,
  onChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title?: string
  value: string
  onChange: (value: string) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <Calendar value={value} onChange={onChange} onClose={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  )
}

// Calendar is the open sheet's body: it mounts with every opening (the
// closed sheet holds nothing), so it starts at the value's month, or
// today's.
function Calendar({ value, onChange, onClose }: { value: string; onChange: (value: string) => void; onClose: () => void }) {
  const now = today()
  const [picked, setPicked] = useState(value || now)
  const [[year, month], setShown] = useState(() => {
    const [y, m] = (value || now).split("-").map(Number)
    return [y, m]
  })

  const pick = (day: string) => {
    setPicked(day)
    const [y, m] = day.split("-").map(Number)
    setShown([y, m])
  }
  const page = (by: number) => {
    let m = month + by
    let y = year
    if (m < 1) {
      m = 12
      y -= 1
    }
    if (m > 12) {
      m = 1
      y += 1
    }
    setShown([y, m])
  }
  const presets: [string, string][] = [
    ["Bugun", now],
    ["Ertaga", addDays(now, 1)],
    ["3 kundan keyin", addDays(now, 3)],
    ["1 haftadan keyin", addDays(now, 7)],
  ]

  return (
    <>
      <Chips className="mb-2.5">
        {presets.map(([label, day]) => (
          <Chip key={label} pressed={picked === day} onClick={() => pick(day)} className={picked !== day ? "bg-sheet-cell text-foreground" : undefined}>
            {label}
          </Chip>
        ))}
      </Chips>
      <div data-slot="calendar" className="rounded-group bg-sheet-cell px-3 pt-2.5 pb-3">
        <div className="flex items-center justify-between px-0.5 pb-2">
          <b className="text-base font-semibold">
            {MONTHS[month - 1]} {year}
          </b>
          <div className="flex">
            <button type="button" aria-label="Oldingi oy" onClick={() => page(-1)} className="grid size-11 place-items-center text-primary">
              <ChevronLeftIcon aria-hidden="true" strokeWidth={2.4} className="size-6" />
            </button>
            <button type="button" aria-label="Keyingi oy" onClick={() => page(1)} className="grid size-11 place-items-center text-primary">
              <ChevronRightIcon aria-hidden="true" strokeWidth={2.4} className="size-6" />
            </button>
          </div>
        </div>
        <div className="grid grid-cols-7 gap-y-0.5 text-center">
          {WEEKDAYS.map((weekday) => (
            <span key={weekday} aria-hidden="true" className="pt-1 pb-1.5 text-[12px] font-semibold text-muted-foreground">
              {weekday}
            </span>
          ))}
          {monthGrid(year, month).map((day, index) =>
            day === null ? (
              <span key={`blank-${index}`} />
            ) : (
              <button
                key={day}
                type="button"
                aria-label={formatDate(day)}
                aria-pressed={day === picked}
                data-today={day === now || undefined}
                onClick={() => pick(day)}
                className={cn(
                  "size-[42px] justify-self-center rounded-full text-base outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                  day === now && "font-bold text-primary",
                  day === picked && "bg-primary font-semibold text-primary-foreground",
                )}
              >
                {Number(day.slice(8))}
              </button>
            ),
          )}
        </div>
      </div>
      <DialogFooter>
        <MainButton
          onClick={() => {
            onChange(picked)
            onClose()
          }}
        >
          Tanlash
        </MainButton>
      </DialogFooter>
    </>
  )
}

interface Bound<T extends FieldValues, TOut extends FieldValues> {
  control: Control<T, unknown, TOut>
  name: FieldPath<T>
  label: string
  disabled?: boolean
}

// shownDay is a day as the row says it: dd.mm.yyyy, "· bugun" when it is today.
const shownDay = (day: string) => (day ? `${formatDate(day)}${day === today() ? " · bugun" : ""}` : undefined)

// DateRow is a day in a form (YYYY-MM-DD): a pick row that opens the calendar.
export function DateRow<T extends FieldValues, TOut extends FieldValues = T>({ control, name, label, disabled }: Bound<T, TOut>) {
  const [open, setOpen] = useState(false)
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <>
          <PickRow
            label={label}
            value={shownDay(String(field.value ?? ""))}
            placeholder="Sanani tanlang"
            onClick={() => setOpen(true)}
            error={fieldState.error?.message}
            disabled={disabled || field.disabled}
          />
          <DateSheet open={open} onOpenChange={setOpen} title={label} value={String(field.value ?? "")} onChange={(day) => field.onChange(day)} />
        </>
      )}
    />
  )
}

// DateTimeRow is a moment in a form (YYYY-MM-DDTHH:mm, what a
// datetime-local input gives): the day picked in the calendar, the time
// typed beside it.
export function DateTimeRow<T extends FieldValues, TOut extends FieldValues = T>({ control, name, label, disabled }: Bound<T, TOut>) {
  const [open, setOpen] = useState(false)
  const id = useId()
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => {
        const [day = "", time = "00:00"] = String(field.value ?? "").split("T")
        return (
          <>
            <div className="flex items-stretch">
              <div className="min-w-0 flex-1">
                <PickRow
                  label={label}
                  value={shownDay(day)}
                  placeholder="Sanani tanlang"
                  onClick={() => setOpen(true)}
                  error={fieldState.error?.message}
                  disabled={disabled || field.disabled}
                />
              </div>
              <label className="flex shrink-0 items-center pr-4">
                <span className="sr-only">{label}: soat</span>
                <input
                  id={id}
                  type="time"
                  value={time}
                  disabled={disabled || field.disabled}
                  onChange={(event) => field.onChange(`${day}T${event.target.value || "00:00"}`)}
                  onBlur={field.onBlur}
                  className="h-10 bg-transparent text-base text-foreground outline-none"
                />
              </label>
            </div>
            <DateSheet open={open} onOpenChange={setOpen} title={label} value={day} onChange={(picked) => field.onChange(`${picked}T${time}`)} />
          </>
        )
      }}
    />
  )
}
