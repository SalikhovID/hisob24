import { Badge } from "@/components/ui/badge"
import { roleLabels } from "@/lib/roles"
import type { Role } from "@/lib/types"

// RoleBadge names a member's standing in the company: the owner, of whom a
// company has exactly one, marked apart by a dot beside the name, so the
// difference does not rest on color alone; an employee by the company role
// they hold (name), or as an employee plain when they hold none. The label
// is ordinary text on a soft fill: brand-colored text on its own tint is too
// faint in the dark theme and inside Telegram, where the brand color is the
// chat's.
export function RoleBadge({ role, name }: { role: Role; name?: string | null }) {
  const owner = role === "owner"
  return (
    <Badge data-role={role} variant="secondary" className={owner ? "bg-primary/10 text-foreground dark:bg-primary/15" : undefined}>
      {owner && <span data-slot="dot" aria-hidden="true" className="size-1.5 rounded-full bg-primary" />}
      {owner ? roleLabels.owner : (name ?? roleLabels.user)}
    </Badge>
  )
}
