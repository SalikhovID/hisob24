import { Badge } from "@/components/ui/badge"
import type { Company } from "@/lib/types"
import { cn } from "@/lib/utils"

type Tone = "danger" | "warning" | "success"

// A company in good standing is the rule, so its pill is plain: in a list of
// them the amber (a week or less left) and the red (expired, blocked) are
// what the eye finds. Whole class names, as Tailwind reads the source.
const tones: Record<Tone, string> = {
  danger: "bg-destructive/10 text-destructive",
  warning: "bg-amber-500/15 text-amber-800 dark:text-amber-400",
  success: "",
}

function statusOf({ is_active, days_left }: Pick<Company, "is_active" | "days_left">): { text: string; tone: Tone } {
  if (!is_active) return { text: "Bloklangan", tone: "danger" }
  if (days_left < 0) return { text: "Muddati o'tgan", tone: "danger" }
  if (days_left === 0) return { text: "Bugun tugaydi", tone: "warning" }
  return { text: `${days_left} kun qoldi`, tone: days_left <= 7 ? "warning" : "success" }
}

// CompanyStatusBadge says how a company's subscription stands: the days left,
// in amber when they run short, in red once it has expired or been blocked.
export function CompanyStatusBadge({ company }: { company: Pick<Company, "is_active" | "days_left"> }) {
  const { text, tone } = statusOf(company)
  return (
    <Badge variant="secondary" data-tone={tone} className={cn(tones[tone])}>
      {text}
    </Badge>
  )
}
