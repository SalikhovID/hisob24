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

// formatAmount writes a stored amount ("150000.50") for people to read:
// thousands apart by a no-break space, the decimals after a comma as the
// database writes them, and left out when they are all zero ("12000.00").
export function formatAmount(amount: string): string {
  const [whole, decimals = ""] = amount.split(".")
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, " ")
  return /^0*$/.test(decimals) ? grouped : `${grouped},${decimals}`
}

// unitLabel is a unit's name on screen: its code, but m2 as m².
export function unitLabel(unit: string): string {
  return unit === "m2" ? "m²" : unit
}

// formatQuantity writes a stored quantity ("1.500") with its unit for
// people to read: thousands apart by a no-break space, the decimals after a
// comma without the trailing zeros ("1,5 kg", "12 dona"); no unit, no
// suffix.
export function formatQuantity(quantity: string, unit: string | null): string {
  const [whole, decimals = ""] = quantity.split(".")
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, " ")
  const trimmed = decimals.replace(/0+$/, "")
  const number = trimmed ? `${grouped},${trimmed}` : grouped
  return unit ? `${number} ${unitLabel(unit)}` : number
}

// formatMoney writes an amount with its currency for people to read: the
// number as formatAmount writes it, then the currency's symbol ("1 200 000
// so'm", "150 $").
export function formatMoney(amount: string, currency: { symbol: string }): string {
  return `${formatAmount(amount)} ${currency.symbol}`
}

// formatRate writes a stored rate ("12800.0000") for people to read:
// thousands apart, the decimals after a comma without the trailing zeros
// ("12 800", "12 800,5").
export function formatRate(rate: string): string {
  const [whole, decimals = ""] = rate.split(".")
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, "\u00a0")
  const trimmed = decimals.replace(/0+$/, "")
  return trimmed ? `${grouped},${trimmed}` : grouped
}

// compactAmount writes a large sum where room is short (a card): millions
// as "4,6 mln", a smaller sum grouped and whole.
export function compactAmount(amount: string): string {
  const n = Number(amount)
  if (Math.abs(n) >= 1_000_000) {
    const millions = (n / 1_000_000).toFixed(2).replace(/\.?0+$/, "").replace(".", ",")
    return `${millions}\u00a0mln`
  }
  return formatAmount(amount.split(".")[0])
}
