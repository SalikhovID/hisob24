const pad = (n: number) => String(n).padStart(2, "0")

// formatDate writes a date ("2026-10-07") or a timestamp as dd.mm.yyyy; a
// timestamp shows the day it is in the browser's time zone.
export function formatDate(value: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split("-")
    return `${day}.${month}.${year}`
  }
  const date = new Date(value)
  return `${pad(date.getDate())}.${pad(date.getMonth() + 1)}.${date.getFullYear()}`
}

// formatDateTime writes a moment as dd.mm.yyyy hh:mm, in the browser's time
// zone: when something was done.
export function formatDateTime(value: string): string {
  const date = new Date(value)
  return `${formatDate(value)} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}
