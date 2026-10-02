const DAY = 24 * 60 * 60 * 1000

function addDays(date: string, days: number): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * DAY).toISOString().slice(0, 10)
}

// previewEndDate is the end date a payment of days will give a company.
export function previewEndDate(endDate: string, daysLeft: number, days: number): string {
  return addDays(endDate, days)
}
