import { Badge } from "@/components/ui/badge"
import type { Company } from "@/lib/types"
import { cn } from "@/lib/utils"

type Tone = "danger" | "warning" | "success"

const tones: Record<Tone, string> = {
  danger: "bg-destructive/10 text-destructive dark:bg-destructive/20",
  warning: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  success: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
}

function statusOf({ is_active, days_left }: Pick<Company, "is_active" | "days_left">): { text: string; tone: Tone } {
  if (!is_active) return { text: "Bloklangan", tone: "danger" }
  if (days_left < 0) return { text: "Muddati o'tgan", tone: "danger" }
  if (days_left === 0) return { text: "Bugun tugaydi", tone: "warning" }
  return { text: `${days_left} kun qoldi`, tone: days_left <= 7 ? "warning" : "success" }
}

// CompanyStatusBadge says how a company's subscription stands: the days left,
// in red once it has expired or been blocked.
export function CompanyStatusBadge({ company }: { company: Pick<Company, "is_active" | "days_left"> }) {
  const { text, tone } = statusOf(company)
  return (
    <Badge data-tone={tone} className={cn(tones[tone])}>
      {text}
    </Badge>
  )
}
