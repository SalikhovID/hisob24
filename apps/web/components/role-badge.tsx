import { Badge } from "@/components/ui/badge"
import { roleLabels } from "@/lib/roles"
import type { Role } from "@/lib/types"

// RoleBadge names a member's role in the company. The owner, of whom a
// company has exactly one, is marked apart: a dot beside the name, so the
// difference does not rest on color alone.
export function RoleBadge({ role }: { role: Role }) {
  const owner = role === "owner"
  return (
    <Badge data-role={role} variant="secondary" className={owner ? "bg-primary/10 text-primary" : undefined}>
      {owner && <span data-slot="dot" aria-hidden="true" className="size-1.5 rounded-full bg-current" />}
      {roleLabels[role]}
    </Badge>
  )
}
