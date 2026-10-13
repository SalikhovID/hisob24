import { formatAmount } from "@/lib/format"

// PaidStatus says what was paid with a document (a purchase, a sale) at its
// row's end: all of it (green), none (red), or how much.
export function PaidStatus({ total, paid }: { total: string; paid: string }) {
  const value = Number(paid)
  if (value >= Number(total)) return <span className="text-positive">To&apos;langan</span>
  if (value === 0) return <span className="text-destructive">To&apos;lanmagan</span>
  return <>{formatAmount(paid)} to&apos;langan</>
}
