"use client"

import { useQueryClient } from "@tanstack/react-query"
import { useRouter } from "next/navigation"
import { PageHeader } from "@/components/page-header"
import { Failed, ListLoading } from "@/components/states"
import { api, call } from "@/lib/api"
import { rolesKey, useRoles } from "@/lib/queries"
import { useOwner } from "@/lib/use-gate"
import { DeleteButton } from "./delete-button"
import { RoleForm } from "./role-form"
import { settingsHref } from "./use-settings-tab"

const back = { href: settingsHref("roles"), label: "Sozlamalar" }

// holders says how many members hold a role.
const holders = (count: number) => (count === 0 ? "Hech kimda" : `${count} ta xodim`)

// NewRolePage is the page of a role to be made, the owner's alone.
export function NewRolePage() {
  const owner = useOwner()
  if (!owner) return null
  return (
    <div className="space-y-5">
      <PageHeader title="Yangi rol" description="Nomi va xodim shu rol bilan nima qila olishi" back={back} />
      <RoleForm companyId={owner.company.id} />
    </div>
  )
}

// RolePage is one role of the owner's company: its name and permissions,
// to be changed, and the way to delete it (the API refuses while someone
// holds it).
export function RolePage({ id }: { id: number }) {
  const owner = useOwner()
  const companyId = owner ? owner.company.id : null
  const roles = useRoles(companyId)
  const queryClient = useQueryClient()
  const router = useRouter()

  if (!owner) return null
  if (!roles.data) {
    return (
      <div className="space-y-5">
        <PageHeader title="Rol" back={back} />
        {roles.isPending && <ListLoading rows={3} mark="none" />}
        {roles.isError && <Failed error={roles.error} onRetry={() => roles.refetch()} />}
      </div>
    )
  }
  const role = roles.data.find((candidate) => candidate.id === id)
  if (!role) {
    return <PageHeader title="Rol topilmadi" description="Bu rol o'chirilgan yoki sizning kompaniyangizniki emas." back={back} />
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title={role.name}
        description={`Rol · ${holders(role.members_count)}`}
        back={back}
        actions={
          <DeleteButton
            label={`O'chirish: ${role.name}`}
            title="Rolni o'chirasizmi?"
            description={`«${role.name}» roli o'chadi. Xodimga biriktirilgan rol o'chirilmaydi.`}
            done="Rol o'chirildi"
            onDelete={async () => {
              await call(api.DELETE("/app/roles/{id}", { params: { path: { id: role.id } } }))
              await queryClient.invalidateQueries({ queryKey: rolesKey(companyId) })
              router.push(settingsHref("roles"))
            }}
          />
        }
      />
      {/* The form starts from the role as it is; a reload after a save starts from the saved one. */}
      <RoleForm key={`${role.id}:${role.name}:${role.permissions.join(",")}`} companyId={owner.company.id} role={role} />
    </div>
  )
}
