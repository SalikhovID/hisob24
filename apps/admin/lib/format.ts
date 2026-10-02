// formatDate writes a date or a timestamp the way the panel shows it.
export function formatDate(value: string): string {
  const [year, month, day] = value.split("-")
  return `${day}.${month}.${year}`
}
