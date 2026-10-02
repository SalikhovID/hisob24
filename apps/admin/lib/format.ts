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

// formatPhone writes a stored phone (digits only) for people to read: an
// Uzbek number as +998 90 123 45 67, any other as + and its digits.
export function formatPhone(phone: string): string {
  const uz = /^998(\d{2})(\d{3})(\d{2})(\d{2})$/.exec(phone)
  if (!uz) return `+${phone}`
  return `+998 ${uz[1]} ${uz[2]} ${uz[3]} ${uz[4]}`
}

// formatAmount writes a stored amount ("150000.50") for people to read:
// thousands apart by a no-break space, the decimals after a comma, a dash
// when there is no amount.
export function formatAmount(amount: string | null): string {
  if (amount === null) return "—"
  const [whole, decimals] = amount.split(".")
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, "\u00a0")
  return decimals === undefined ? grouped : `${grouped},${decimals}`
}
