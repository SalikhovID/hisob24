"use client"

import { ShieldIcon } from "lucide-react"
import { Group, Row } from "@/components/kit/group"
import { PageTitle, PlusButton } from "@/components/kit/page-title"
import { EmptyState, Failed, ListLoading } from "@/components/states"
import { summaryOf } from "@/lib/permissions"
import { useRoles } from "@/lib/queries"
import { useOwner } from "@/lib/use-gate"
import { holders } from "./role-page"

// RolesPage is the company's roles, the owner's alone (logic/roles.md,
// section 5), as the prototype's page: each a row by name with the
// sections it opens under it and who holds it at its end, leading to its
// page (where it changes and is deleted); the plus leads to a new one.
export function RolesPage() {
  const owner = useOwner()
  const roles = useRoles(owner ? owner.company.id : null)

  if (!owner) return null
  return (
    <>
      <PageTitle
        title="Rollar"
        description="Rol xodimga qaysi bo'limlarda nima qilishi mumkinligini belgilaydi."
        back={{ href: "/settings", label: "Sozlamalar" }}
        action={<PlusButton label="Rol qo'shish" href="/settings/roles/new" />}
      />
      {roles.isPending && <ListLoading rows={2} mark="none" />}
      {roles.isError && <Failed error={roles.error} onRetry={() => roles.refetch()} />}
      {roles.data?.length === 0 && <EmptyState icon={ShieldIcon} title="Hali rol yo'q" description="Xodimga rol berilsa, u faqat shu rol ruxsatlari bilan ishlaydi." />}
      {roles.data && roles.data.length > 0 && (
        <Group label="Rollar">
          {roles.data.map((role) => (
            <Row
              key={role.id}
              href={`/settings/roles/${role.id}`}
              title={role.name}
              sub={summaryOf(role.permissions)}
              end={<span className="text-muted-foreground">{holders(role.members_count)}</span>}
            />
          ))}
        </Group>
      )}
    </>
  )
}
